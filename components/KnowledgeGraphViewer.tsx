'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { KnowledgeGraphData, KnowledgeGraphNode } from '@/utils/streaming';
import { motion } from 'framer-motion';
import * as d3 from 'd3';

// Neo4j-style color palette (shared with KnowledgeGraphPopup)
export const NEO4J_COLORS = {
  nodes: {
    workflow: '#fdcb6e',
    agent: '#fd79a8',
    domain: '#a29bfe',
    capability: '#00cec9',
    task: '#74b9ff',
    result: '#00b894',
    entity: '#e17055',
    concept: '#6c5ce7',
    query_agent_mapping: '#55efc4',
    query_category: '#ffeaa7',
  },
  nodeDefaults: [
    '#68B7F7', '#FF6B85', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'
  ],
  edges: {
    default: '#4A5568',
    active: '#3B82F6',
    highlighted: '#F59E0B',
  },
  background: {
    primary: '#0F172A',
    secondary: '#1E293B',
  }
};

// D3 node interface
interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  size: number;
  color: string;
  properties?: Record<string, any>;
  confidence?: number;
  radius: number;
  neighborCount: number;
}

// D3 link interface
interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: D3Node | string;
  target: D3Node | string;
  label?: string;
  type: string;
  weight: number;
  color: string;
  size: number;
}

export function getNodeColor(node: KnowledgeGraphNode, index: number): string {
  const typeColor = NEO4J_COLORS.nodes[node.type as keyof typeof NEO4J_COLORS.nodes];
  if (typeColor) return typeColor;
  if (node.color) return node.color;
  return NEO4J_COLORS.nodeDefaults[index % NEO4J_COLORS.nodeDefaults.length];
}

interface KnowledgeGraphViewerProps {
  data: KnowledgeGraphData;
  height?: number;
  onNodeClick?: (node: KnowledgeGraphNode) => void;
  selectedNodeId?: string | null;
  showControls?: boolean;
  showLegend?: boolean;
  className?: string;
}

export function KnowledgeGraphViewer({
  data,
  height = 500,
  onNodeClick,
  selectedNodeId: externalSelectedNode,
  showControls = true,
  showLegend = true,
  className = '',
}: KnowledgeGraphViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(externalSelectedNode ?? null);
  const [zoom, setZoom] = useState(1);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  // Ref to track selection inside D3 closures without triggering re-render
  const selectedRef = useRef<string | null>(externalSelectedNode ?? null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedRef.current = selectedNode;
  }, [selectedNode]);

  // Sync external selected node prop
  useEffect(() => {
    if (externalSelectedNode !== undefined) {
      selectedRef.current = externalSelectedNode;
      setSelectedNode(externalSelectedNode);
    }
  }, [externalSelectedNode]);

  // D3 Force-directed graph rendering
  const renderGraph = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth || 900;
    const graphHeight = containerRef.current.clientHeight || height;

    svg.attr("width", width).attr("height", graphHeight);

    // Defs (gradients, filters, markers)
    const defs = svg.append("defs");

    const glowFilter = defs.append("filter")
      .attr("id", "kg-glow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");

    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4").attr("result", "coloredBlur");

    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    defs.append("marker")
      .attr("id", "kg-arrowhead")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 20).attr("refY", 0)
      .attr("markerWidth", 5).attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-3L7,0L0,3")
      .attr("fill", NEO4J_COLORS.edges.default)
      .attr("opacity", 0.7);

    defs.append("marker")
      .attr("id", "kg-arrowhead-highlight")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 20).attr("refY", 0)
      .attr("markerWidth", 5).attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-3L7,0L0,3")
      .attr("fill", NEO4J_COLORS.edges.highlighted)
      .attr("opacity", 1);

    // CSS animations for persistent selection effects
    svg.append("style").text(`
      @keyframes kg-glow-pulse {
        0%, 100% { opacity: 0.35; r: attr(r); }
        50% { opacity: 0.7; }
      }
      @keyframes kg-ring-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .kg-selected-glow {
        animation: kg-glow-pulse 2s ease-in-out infinite;
      }
      .kg-selected-ring {
        animation: kg-ring-spin 8s linear infinite;
      }
      .kg-connected-glow {
        animation: kg-glow-pulse 3s ease-in-out infinite;
        animation-delay: 0.5s;
      }
    `);

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const mainGroup = svg.append("g");

    // Data preparation (deduplicate nodes)
    const uniqueNodesMap = new Map<string, KnowledgeGraphNode>();
    data.nodes.forEach(node => {
      if (!uniqueNodesMap.has(node.id)) {
        uniqueNodesMap.set(node.id, node);
      }
    });

    // Pre-calculate connection counts from raw edges for sizing
    const connectionCounts = new Map<string, number>();
    data.edges.forEach(e => {
      connectionCounts.set(e.source, (connectionCounts.get(e.source) || 0) + 1);
      connectionCounts.set(e.target, (connectionCounts.get(e.target) || 0) + 1);
    });

    // Type-based base radius: agents are primary, metadata nodes are smaller
    const typeBaseRadius: Record<string, number> = {
      agent: 17,
      domain: 15,
      entity: 14,
      concept: 14,
      query_category: 13,
      query_agent_mapping: 12,
      capability: 11,
      tag: 10,
    };

    const nodes: D3Node[] = Array.from(uniqueNodesMap.values()).map((d, i) => {
      const connections = connectionCounts.get(d.id) || 0;
      const base = typeBaseRadius[d.type] || 13;
      // sqrt scale: dampens extreme connection counts
      const connectionBonus = Math.sqrt(connections) * 2.5;
      const radius = Math.max(10, Math.min(Math.round(base + connectionBonus), 34));

      return {
        id: d.id,
        label: d.label,
        type: d.type,
        size: d.size || 1,
        color: getNodeColor(d, i),
        properties: d.properties,
        confidence: d.confidence,
        radius,
        x: width / 2 + (Math.random() - 0.5) * 300,
        y: graphHeight / 2 + (Math.random() - 0.5) * 300,
        neighborCount: connections,
      };
    });

    const nodeIds = new Set(nodes.map(n => n.id));

    const links: D3Link[] = data.edges
      .filter(d => nodeIds.has(d.source) && nodeIds.has(d.target))
      .map(d => ({
        id: d.id,
        source: d.source,
        target: d.target,
        label: d.label,
        type: d.type,
        weight: d.weight || 1,
        color: d.color || NEO4J_COLORS.edges.default,
        size: Math.max(1, (d.size || 1) * 0.8)
      }));

    nodesRef.current = nodes;

    // Physics simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => 80 + (d as D3Link).weight * 20)
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody()
        .strength(d => -200 - (d as D3Node).radius * 8)
      )
      .force("center", d3.forceCenter(width / 2, graphHeight / 2))
      .force("collision", d3.forceCollide()
        .radius(d => (d as D3Node).radius + 6)
        .strength(0.85)
      )
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(graphHeight / 2).strength(0.03));

    simulationRef.current = simulation;

    // --- Helper: get connected node IDs ---
    function getConnectedIds(nodeId: string): Set<string> {
      const ids = new Set<string>([nodeId]);
      links.forEach(link => {
        const sId = typeof link.source === 'string' ? link.source : link.source.id;
        const tId = typeof link.target === 'string' ? link.target : link.target.id;
        if (sId === nodeId || tId === nodeId) { ids.add(sId); ids.add(tId); }
      });
      return ids;
    }

    function isConnected(link: D3Link, nodeId: string): boolean {
      const sId = typeof link.source === 'string' ? link.source : (link.source as D3Node).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as D3Node).id;
      return sId === nodeId || tId === nodeId;
    }

    // --- Helper: apply highlight with persistent animations ---
    function highlightNode(nodeId: string | null) {
      if (!nodeId) {
        // Deselect: restore all nodes, remove animations
        nodeElements.transition().duration(300).style("opacity", 1);
        nodeElements.each(function(this: SVGGElement, d: any) {
          const el = d3.select(this);
          el.select(".node-main").transition().duration(300)
            .attr("r", d.radius)
            .attr("stroke", "#1E293B").attr("stroke-width", 2);
          el.select(".node-glow")
            .classed("kg-selected-glow", false)
            .classed("kg-connected-glow", false)
            .transition().duration(300).attr("opacity", 0);
          el.select(".node-select-ring")
            .classed("kg-selected-ring", false)
            .transition().duration(200).attr("opacity", 0);
        });
        linkPaths.transition().duration(300)
          .attr("stroke-opacity", 0.5)
          .attr("stroke-width", (d: any) => d.size)
          .attr("stroke", (d: any) => d.color)
          .attr("marker-end", "url(#kg-arrowhead)");
        linkLabelTexts.transition().duration(300).style("opacity", 0.8);
        return;
      }

      const connected = getConnectedIds(nodeId);

      // Fade unconnected nodes, highlight connected ones
      nodeElements.transition().duration(300)
        .style("opacity", (d: any) => connected.has(d.id) ? 1 : 0.12);

      nodeElements.each(function(this: SVGGElement, d: any) {
        const el = d3.select(this);
        if (d.id === nodeId) {
          // Selected node: bright border + persistent pulsing glow + spinning ring
          el.select(".node-main").transition().duration(300)
            .attr("stroke", "#fff").attr("stroke-width", 3);
          el.select(".node-glow")
            .attr("opacity", 0.5)
            .classed("kg-selected-glow", true)
            .classed("kg-connected-glow", false);
          el.select(".node-select-ring")
            .attr("stroke", d.color)
            .classed("kg-selected-ring", true)
            .transition().duration(300).attr("opacity", 0.7);
        } else if (connected.has(d.id)) {
          // Connected neighbor: subtle persistent glow
          el.select(".node-main").transition().duration(300)
            .attr("stroke", d.color).attr("stroke-width", 2.5);
          el.select(".node-glow")
            .attr("opacity", 0.15)
            .classed("kg-connected-glow", true)
            .classed("kg-selected-glow", false);
          el.select(".node-select-ring")
            .classed("kg-selected-ring", false)
            .transition().duration(200).attr("opacity", 0);
        } else {
          // Unconnected: dim, no animations
          el.select(".node-main").transition().duration(300)
            .attr("stroke", "#1E293B").attr("stroke-width", 1.5);
          el.select(".node-glow")
            .classed("kg-selected-glow", false)
            .classed("kg-connected-glow", false)
            .transition().duration(300).attr("opacity", 0);
          el.select(".node-select-ring")
            .classed("kg-selected-ring", false)
            .transition().duration(200).attr("opacity", 0);
        }
      });

      // Highlight connected edges
      linkPaths.transition().duration(300)
        .attr("stroke-opacity", (d: any) => isConnected(d, nodeId) ? 1 : 0.06)
        .attr("stroke-width", (d: any) => isConnected(d, nodeId) ? d.size * 1.8 : d.size * 0.5)
        .attr("stroke", (d: any) => isConnected(d, nodeId) ? NEO4J_COLORS.edges.highlighted : d.color)
        .attr("marker-end", (d: any) => isConnected(d, nodeId) ? "url(#kg-arrowhead-highlight)" : "url(#kg-arrowhead)");
      linkLabelTexts.transition().duration(300)
        .style("opacity", (d: any) => isConnected(d, nodeId) ? 1 : 0.05);
    }

    // Link rendering
    const linkGroup = mainGroup.append("g").attr("class", "links");

    const linkPaths = linkGroup.selectAll("path")
      .data(links)
      .enter().append("path")
      .attr("class", "link")
      .attr("stroke", d => d.color)
      .attr("stroke-width", d => d.size)
      .attr("stroke-opacity", 0.5)
      .attr("fill", "none")
      .attr("marker-end", "url(#kg-arrowhead)");

    // Link labels
    const linkLabels = mainGroup.append("g").attr("class", "link-labels");

    const linkLabelTexts = linkLabels.selectAll("text")
      .data(links.filter(d => d.label && d.label.length < 20))
      .enter().append("text")
      .attr("class", "link-label")
      .attr("font-size", "9px")
      .attr("fill", "#94A3B8")
      .attr("text-anchor", "middle")
      .attr("dy", "-4px")
      .style("pointer-events", "none")
      .text(d => d.label || d.type);

    // Node group
    const nodeGroup = mainGroup.append("g").attr("class", "nodes");

    const nodeElements = nodeGroup.selectAll<SVGGElement, D3Node>("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node-group")
      .style("cursor", "pointer");

    // Node glow (pulsing when selected)
    nodeElements.append("circle")
      .attr("class", "node-glow")
      .attr("r", d => d.radius + 10)
      .attr("fill", d => d.color)
      .attr("opacity", 0)
      .attr("filter", "url(#kg-glow)");

    // Selection ring (rotating dashed circle, hidden by default)
    nodeElements.append("circle")
      .attr("class", "node-select-ring")
      .attr("r", d => d.radius + 5)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3")
      .attr("opacity", 0)
      .style("transform-origin", "0 0");

    // Main node circle
    nodeElements.append("circle")
      .attr("class", "node-main")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("stroke", "#1E293B")
      .attr("stroke-width", 2);

    // Node highlight (specular)
    nodeElements.append("circle")
      .attr("class", "node-highlight")
      .attr("r", d => d.radius * 0.4)
      .attr("fill", "white")
      .attr("opacity", 0.15)
      .attr("cy", d => -d.radius * 0.25);

    // Node labels — font size scales with node radius
    nodeElements.append("text")
      .attr("class", "node-label")
      .attr("dy", d => d.radius + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", d => `${Math.max(9, Math.min(12, d.radius * 0.5))}px`)
      .attr("font-weight", d => d.radius >= 20 ? "600" : "500")
      .attr("fill", "#E2E8F0")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
      .text(d => {
        const maxLen = d.radius >= 22 ? 20 : d.radius >= 16 ? 15 : 10;
        return d.label.length > maxLen ? d.label.slice(0, maxLen) + "…" : d.label;
      });

    // --- Hover events (only when nothing is selected) ---
    nodeElements
      .on("mouseenter", function(_event, d) {
        if (selectedRef.current) return;
        d3.select(this).select(".node-main")
          .transition().duration(150)
          .attr("r", d.radius * 1.2)
          .attr("stroke", "#fff").attr("stroke-width", 3);
        d3.select(this).select(".node-glow")
          .transition().duration(150).attr("opacity", 0.4);

        const connected = getConnectedIds(d.id);
        nodeElements.transition().duration(150)
          .style("opacity", (n: any) => connected.has(n.id) ? 1 : 0.15);
        linkPaths.transition().duration(150)
          .attr("stroke-opacity", (l: any) => isConnected(l, d.id) ? 1 : 0.08)
          .attr("stroke", (l: any) => isConnected(l, d.id) ? NEO4J_COLORS.edges.highlighted : l.color)
          .attr("marker-end", (l: any) => isConnected(l, d.id) ? "url(#kg-arrowhead-highlight)" : "url(#kg-arrowhead)");
        linkLabelTexts.transition().duration(150)
          .style("opacity", (l: any) => isConnected(l, d.id) ? 1 : 0.1);
      })
      .on("mouseleave", function(_event, d) {
        if (selectedRef.current) return;
        d3.select(this).select(".node-main")
          .transition().duration(150)
          .attr("r", d.radius).attr("stroke", "#1E293B").attr("stroke-width", 2);
        d3.select(this).select(".node-glow")
          .transition().duration(150).attr("opacity", 0);

        nodeElements.transition().duration(150).style("opacity", 1);
        linkPaths.transition().duration(150)
          .attr("stroke-opacity", 0.5)
          .attr("stroke", (d: any) => d.color)
          .attr("marker-end", "url(#kg-arrowhead)");
        linkLabelTexts.transition().duration(150).style("opacity", 0.8);
      });

    // --- Drag behavior with click detection ---
    let dragStartX = 0, dragStartY = 0, wasDragged = false;
    let nodeClicked = false; // flag to prevent SVG click from stealing selection

    const dragBehavior = d3.drag<SVGGElement, D3Node>()
      .on("start", function(event, d) {
        dragStartX = event.x;
        dragStartY = event.y;
        wasDragged = false;
        // Unpin all OTHER nodes so forces pull them naturally
        nodes.forEach(n => { if (n.id !== d.id) { n.fx = null; n.fy = null; } });
        d.fx = d.x;
        d.fy = d.y;
        if (!event.active) simulation.alphaTarget(0.3).restart();
      })
      .on("drag", function(event, d) {
        const dx = event.x - dragStartX;
        const dy = event.y - dragStartY;
        if (Math.sqrt(dx * dx + dy * dy) > 4) wasDragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function(event, d) {
        if (wasDragged) {
          // Pin all nodes at their current positions after drag
          if (!event.active) simulation.alphaTarget(0);
          nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
        } else {
          // Click — re-pin all nodes (undo the unpin from start)
          nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });

          // Toggle selection
          nodeClicked = true;
          setTimeout(() => { nodeClicked = false; }, 50);

          d.fx = d.x;
          d.fy = d.y;
          const prev = selectedRef.current;
          const newSel = prev === d.id ? null : d.id;
          selectedRef.current = newSel;
          setSelectedNode(newSel);
          highlightNode(newSel);

          // Click pulse animation on selected node
          if (newSel) {
            const el = d3.select(this);
            el.select(".node-main")
              .transition().duration(120).attr("r", d.radius * 1.35)
              .transition().duration(200).attr("r", d.radius)
              .attr("stroke", "#fff").attr("stroke-width", 3);
            el.select(".node-glow")
              .transition().duration(120).attr("opacity", 0.8)
              .transition().duration(300).attr("opacity", 0.6);
          }

          if (onNodeClick) {
            const orig = data.nodes.find(n => n.id === d.id);
            if (orig) onNodeClick(orig);
          }
        }
      });

    nodeElements.call(dragBehavior);

    // Stop click propagation on nodes so SVG background handler doesn't steal it
    nodeElements.on("click", function(event: any) {
      event.stopPropagation();
    });

    // Click on background to deselect
    svg.on("click", function() {
      if (nodeClicked) return;
      if (selectedRef.current) {
        selectedRef.current = null;
        setSelectedNode(null);
        highlightNode(null);
      }
    });

    // Simulation tick
    simulation.on("tick", () => {
      linkPaths.attr("d", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        if (!source.x || !source.y || !target.x || !target.y) return "";

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.8;

        return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
      });

      linkLabelTexts.attr("transform", d => {
        const source = d.source as D3Node;
        const target = d.target as D3Node;
        if (!source.x || !source.y || !target.x || !target.y) return "";
        return `translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`;
      });

      nodeElements.attr("transform", d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    setIsSimulationRunning(true);
    simulation.alpha(1).restart();

    // Pin all nodes after simulation settles
    const pinAllNodes = () => {
      setIsSimulationRunning(false);
      nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
    };

    simulation.on("end.pin", pinAllNodes);
    setTimeout(() => {
      simulation.alphaTarget(0).alpha(0);
      pinAllNodes();
    }, 3500);

  }, [data, height, onNodeClick]);

  useEffect(() => {
    const timer = setTimeout(renderGraph, 100);
    return () => clearTimeout(timer);
  }, [renderGraph]);

  useEffect(() => {
    const handleResize = () => setTimeout(renderGraph, 100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderGraph]);

  // Control functions
  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().duration(300)
        .call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().duration(300)
        .call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 0.67);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().duration(500)
        .call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
    }
  };

  const handleRecenter = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart();
      setTimeout(() => simulationRef.current?.alpha(0), 1000);
    }
  };

  const selectedNodeData = selectedNode ? nodesRef.current.find(n => n.id === selectedNode) : null;

  // Compute active node types from data
  const activeNodeTypes = Array.from(new Set(data.nodes.map(n => n.type)));

  return (
    <div className={`relative ${className}`} style={{ height }} ref={containerRef}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${NEO4J_COLORS.background.secondary} 0%, ${NEO4J_COLORS.background.primary} 100%)`
        }}
      />

      {/* Status indicators */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div className="bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-600/30">
          Zoom: {(zoom * 100).toFixed(0)}%
        </div>
        {isSimulationRunning && (
          <div className="bg-blue-500/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-blue-300 border border-blue-500/30 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Simulating...
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="absolute top-3 right-3 flex bg-slate-800/80 backdrop-blur-sm rounded-lg p-1 border border-slate-600/30">
          <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleResetZoom} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors" title="Reset Zoom">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleRecenter} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors" title="Re-center">
            <Move className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3">
          <div className="text-xs text-slate-400 mb-2 font-medium">Node Types</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {activeNodeTypes.map(type => {
              const color = NEO4J_COLORS.nodes[type as keyof typeof NEO4J_COLORS.nodes] || NEO4J_COLORS.nodeDefaults[0];
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-400 capitalize truncate">{type.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Node Panel */}
      {selectedNodeData && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="absolute top-0 right-0 w-64 h-full bg-slate-800/95 backdrop-blur-xl border-l border-slate-700/50 overflow-y-auto"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200 text-sm">Node Details</h3>
              <button onClick={() => { selectedRef.current = null; setSelectedNode(null); }} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30 mb-3">
              <div className="w-4 h-4 rounded-full border-2 border-white/20 flex-shrink-0" style={{ backgroundColor: selectedNodeData.color }} />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-200 text-sm truncate">{selectedNodeData.label}</h4>
                <p className="text-xs text-slate-400">{selectedNodeData.type.replace(/_/g, ' ')}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Size</span>
                <span className="text-slate-300">{selectedNodeData.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Connections</span>
                <span className="text-slate-300">{selectedNodeData.neighborCount}</span>
              </div>
              {selectedNodeData.confidence != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Confidence</span>
                  <span className="text-slate-300">{(selectedNodeData.confidence * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>

            {selectedNodeData.properties && Object.keys(selectedNodeData.properties).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Properties</h5>
                <div className="space-y-1.5">
                  {Object.entries(selectedNodeData.properties).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-slate-500">{key}: </span>
                      <span className="text-slate-300">{String(value).slice(0, 50)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
