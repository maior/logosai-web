'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw, Move, Search, Maximize2 } from 'lucide-react';
import { KnowledgeGraphData, KnowledgeGraphNode, KnowledgeGraphEdge } from '@/utils/streaming';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';

// Neo4j 스타일 색상 팔레트
const NEO4J_COLORS = {
  nodes: {
    workflow: '#fdcb6e',
    agent: '#fd79a8',
    domain: '#a29bfe',
    capability: '#00cec9',
    task: '#74b9ff',
    result: '#00b894',
    entity: '#e17055',
    concept: '#6c5ce7',
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

// D3 노드 인터페이스
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

// D3 링크 인터페이스
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

interface KnowledgeGraphPopupProps {
  data: KnowledgeGraphData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeGraphPopup({ data, isOpen, onClose }: KnowledgeGraphPopupProps) {
  const [viewMode, setViewMode] = useState<'graph' | 'nodes' | 'edges' | 'stats'>('graph');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);

  // 노드 색상 결정
  const getNodeColor = (node: KnowledgeGraphNode, index: number): string => {
    const typeColor = NEO4J_COLORS.nodes[node.type as keyof typeof NEO4J_COLORS.nodes];
    if (typeColor) return typeColor;
    if (node.color) return node.color;
    return NEO4J_COLORS.nodeDefaults[index % NEO4J_COLORS.nodeDefaults.length];
  };

  // D3 Force-directed 그래프 렌더링
  const renderGraph = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current || viewMode !== 'graph') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 600;

    svg.attr("width", width).attr("height", height);

    // Defs (그라데이션, 필터, 마커)
    const defs = svg.append("defs");

    // 노드 글로우 필터
    const glowFilter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");

    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 화살표 마커
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-3L7,0L0,3")
      .attr("fill", NEO4J_COLORS.edges.default)
      .attr("opacity", 0.7);

    // 하이라이트 화살표
    defs.append("marker")
      .attr("id", "arrowhead-highlight")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-3L7,0L0,3")
      .attr("fill", NEO4J_COLORS.edges.highlighted)
      .attr("opacity", 1);

    // 줌 동작
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const mainGroup = svg.append("g");

    // 데이터 준비 (중복 제거)
    const uniqueNodesMap = new Map<string, KnowledgeGraphNode>();
    data.nodes.forEach(node => {
      if (!uniqueNodesMap.has(node.id)) {
        uniqueNodesMap.set(node.id, node);
      }
    });

    const nodes: D3Node[] = Array.from(uniqueNodesMap.values()).map((d, i) => ({
      id: d.id,
      label: d.label,
      type: d.type,
      size: d.size || 1,
      color: getNodeColor(d, i),
      properties: d.properties,
      confidence: d.confidence,
      radius: Math.max(14, (d.size || 1) * 2.5),
      x: width / 2 + (Math.random() - 0.5) * 300,
      y: height / 2 + (Math.random() - 0.5) * 300,
      neighborCount: 0
    }));

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

    // 이웃 노드 수 계산
    nodes.forEach(node => {
      node.neighborCount = links.filter(link =>
        (typeof link.source === 'string' ? link.source : link.source.id) === node.id ||
        (typeof link.target === 'string' ? link.target : link.target.id) === node.id
      ).length;
    });

    nodesRef.current = nodes;

    // 물리 시뮬레이션
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => 80 + (d as D3Link).weight * 20)
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody()
        .strength(d => -400 - (d as D3Node).neighborCount * 50)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius(d => (d as D3Node).radius + 8)
        .strength(0.8)
      )
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03));

    simulationRef.current = simulation;

    // 링크 렌더링
    const linkGroup = mainGroup.append("g").attr("class", "links");

    const linkPaths = linkGroup.selectAll("path")
      .data(links)
      .enter().append("path")
      .attr("class", "link")
      .attr("stroke", d => d.color)
      .attr("stroke-width", d => d.size)
      .attr("stroke-opacity", 0.5)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)")
      .style("transition", "stroke 0.2s, stroke-opacity 0.2s");

    // 링크 라벨
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

    // 노드 그룹
    const nodeGroup = mainGroup.append("g").attr("class", "nodes");

    const nodeElements = nodeGroup.selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node-group")
      .style("cursor", "pointer");

    // 노드 글로우
    nodeElements.append("circle")
      .attr("class", "node-glow")
      .attr("r", d => d.radius + 8)
      .attr("fill", d => d.color)
      .attr("opacity", 0)
      .attr("filter", "url(#glow)");

    // 메인 노드
    nodeElements.append("circle")
      .attr("class", "node-main")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("stroke", "#1E293B")
      .attr("stroke-width", 2)
      .style("transition", "all 0.2s ease");

    // 노드 하이라이트
    nodeElements.append("circle")
      .attr("class", "node-highlight")
      .attr("r", d => d.radius * 0.4)
      .attr("fill", "white")
      .attr("opacity", 0.15)
      .attr("cy", d => -d.radius * 0.25);

    // 노드 라벨
    nodeElements.append("text")
      .attr("class", "node-label")
      .attr("dy", d => d.radius + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#E2E8F0")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
      .text(d => d.label.length > 15 ? d.label.slice(0, 15) + "..." : d.label);

    // 마우스 이벤트
    nodeElements
      .on("mouseenter", function(event, d) {
        // 노드 확대
        d3.select(this).select(".node-main")
          .transition().duration(150)
          .attr("r", d.radius * 1.25)
          .attr("stroke-width", 3);

        d3.select(this).select(".node-glow")
          .transition().duration(150)
          .attr("opacity", 0.5);

        // 연결된 노드 찾기
        const connectedNodeIds = new Set<string>();
        links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          if (sourceId === d.id || targetId === d.id) {
            connectedNodeIds.add(sourceId);
            connectedNodeIds.add(targetId);
          }
        });

        // 비연결 노드 흐리게
        nodeElements.style("opacity", node => connectedNodeIds.has(node.id) ? 1 : 0.2);

        // 연결된 링크 하이라이트
        linkPaths
          .attr("stroke-opacity", link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as D3Node).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as D3Node).id;
            return (sourceId === d.id || targetId === d.id) ? 1 : 0.1;
          })
          .attr("stroke", link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as D3Node).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as D3Node).id;
            return (sourceId === d.id || targetId === d.id) ? NEO4J_COLORS.edges.highlighted : link.color;
          })
          .attr("marker-end", link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as D3Node).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as D3Node).id;
            return (sourceId === d.id || targetId === d.id) ? "url(#arrowhead-highlight)" : "url(#arrowhead)";
          });

        linkLabelTexts.style("opacity", link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as D3Node).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as D3Node).id;
          return (sourceId === d.id || targetId === d.id) ? 1 : 0.2;
        });
      })
      .on("mouseleave", function(event, d) {
        d3.select(this).select(".node-main")
          .transition().duration(150)
          .attr("r", d.radius)
          .attr("stroke-width", 2);

        d3.select(this).select(".node-glow")
          .transition().duration(150)
          .attr("opacity", 0);

        nodeElements.style("opacity", 1);
        linkPaths
          .attr("stroke-opacity", 0.5)
          .attr("stroke", d => d.color)
          .attr("marker-end", "url(#arrowhead)");
        linkLabelTexts.style("opacity", 0.8);
      })
      .on("click", function(event, d) {
        event.stopPropagation();
        setSelectedNode(selectedNode === d.id ? null : d.id);
      });

    // 드래그
    const dragBehavior = d3.drag<SVGGElement, D3Node>()
      .on("start", function(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(dragBehavior);

    // 시뮬레이션 틱
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

    setTimeout(() => {
      setIsSimulationRunning(false);
      simulation.alpha(0);
    }, 3000);

  }, [data, viewMode, selectedNode]);

  useEffect(() => {
    if (isOpen && viewMode === 'graph') {
      setTimeout(renderGraph, 100);
    }
  }, [isOpen, viewMode, renderGraph]);

  useEffect(() => {
    const handleResize = () => {
      if (viewMode === 'graph') {
        setTimeout(renderGraph, 100);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, renderGraph]);

  // 컨트롤 함수
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

  const downloadJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge_graph_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !data) return null;

  const selectedNodeData = selectedNode ? nodesRef.current.find(n => n.id === selectedNode) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 max-w-7xl mx-auto bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl z-50 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 border border-purple-500/30">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="5" cy="6" r="2" />
                    <circle cx="19" cy="6" r="2" />
                    <circle cx="5" cy="18" r="2" />
                    <circle cx="19" cy="18" r="2" />
                    <path d="M7 7l3 3m4 0l3-3M7 17l3-3m4 0l3 3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Knowledge Graph Explorer
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {data.nodes.length} nodes • {data.edges.length} relationships
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 w-48"
                  />
                </div>

                {/* View Mode Tabs */}
                <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/30">
                  {(['graph', 'nodes', 'edges', 'stats'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                        viewMode === mode
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                          : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                      )}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Graph Controls */}
                {viewMode === 'graph' && (
                  <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/30">
                    <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={handleResetZoom} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={handleRecenter} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
                      <Move className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button onClick={downloadJSON} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <Download className="w-4 h-4" />
                </button>

                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Graph View */}
              {viewMode === 'graph' && (
                <div className="flex-1 relative" ref={containerRef}>
                  <svg
                    ref={svgRef}
                    className="w-full h-full"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${NEO4J_COLORS.background.secondary} 0%, ${NEO4J_COLORS.background.primary} 100%)`
                    }}
                  />

                  {/* Status indicators */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
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

                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3">
                    <div className="text-xs text-slate-400 mb-2 font-medium">Node Types</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(NEO4J_COLORS.nodes).slice(0, 6).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs text-slate-400 capitalize">{type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Node Panel */}
                  {selectedNodeData && (
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      className="absolute top-0 right-0 w-72 h-full bg-slate-800/95 backdrop-blur-xl border-l border-slate-700/50 overflow-y-auto"
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-200">Node Details</h3>
                          <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30 mb-4">
                          <div className="w-5 h-5 rounded-full border-2 border-white/20" style={{ backgroundColor: selectedNodeData.color }} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-200 truncate">{selectedNodeData.label}</h4>
                            <p className="text-xs text-slate-400">{selectedNodeData.type}</p>
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Size</span>
                            <span className="text-slate-300">{selectedNodeData.size}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Connections</span>
                            <span className="text-slate-300">{selectedNodeData.neighborCount}</span>
                          </div>
                          {selectedNodeData.confidence && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Confidence</span>
                              <span className="text-slate-300">{(selectedNodeData.confidence * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>

                        {selectedNodeData.properties && Object.keys(selectedNodeData.properties).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Properties</h5>
                            <div className="space-y-2">
                              {Object.entries(selectedNodeData.properties).map(([key, value]) => (
                                <div key={key} className="text-sm">
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
              )}

              {/* Nodes View */}
              {viewMode === 'nodes' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.nodes.map((node, i) => (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600/50 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: getNodeColor(node, i) }} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-200 truncate">{node.label}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{node.type}</p>
                            {node.confidence && (
                              <div className="mt-2 text-xs text-slate-400">
                                Confidence: {(node.confidence * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edges View */}
              {viewMode === 'edges' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-3">
                    {data.edges.map((edge, i) => {
                      const sourceNode = data.nodes.find(n => n.id === edge.source);
                      const targetNode = data.nodes.find(n => n.id === edge.target);
                      return (
                        <motion.div
                          key={edge.id || i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-slate-300 font-medium">{sourceNode?.label || edge.source}</span>
                            <div className="flex-1 flex items-center justify-center gap-2">
                              <div className="h-px flex-1 bg-slate-600" />
                              <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-400 border border-slate-600/30">
                                {edge.label || edge.type}
                              </span>
                              <div className="h-px flex-1 bg-slate-600" />
                              <span className="text-purple-400">→</span>
                            </div>
                            <span className="text-slate-300 font-medium">{targetNode?.label || edge.target}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats View */}
              {viewMode === 'stats' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-3xl font-bold text-blue-400">{data.nodes.length}</div>
                      <div className="text-sm text-slate-400">Nodes</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-4">
                      <div className="text-3xl font-bold text-purple-400">{data.edges.length}</div>
                      <div className="text-sm text-slate-400">Relationships</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-400">
                        {new Set(data.nodes.map(n => n.type)).size}
                      </div>
                      <div className="text-sm text-slate-400">Node Types</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-lg p-4">
                      <div className="text-3xl font-bold text-orange-400">
                        {new Set(data.edges.map(e => e.type)).size}
                      </div>
                      <div className="text-sm text-slate-400">Edge Types</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
                      <h3 className="text-lg font-semibold text-slate-200 mb-4">Node Distribution</h3>
                      <div className="space-y-3">
                        {Object.entries(
                          data.nodes.reduce((acc, n) => {
                            acc[n.type] = (acc[n.type] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).sort(([,a], [,b]) => b - a).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-3">
                            <span className="text-slate-400 w-24 truncate">{type}</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${(count / data.nodes.length) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-sm w-12 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
                      <h3 className="text-lg font-semibold text-slate-200 mb-4">Edge Distribution</h3>
                      <div className="space-y-3">
                        {Object.entries(
                          data.edges.reduce((acc, e) => {
                            acc[e.type] = (acc[e.type] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).sort(([,a], [,b]) => b - a).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-3">
                            <span className="text-slate-400 w-24 truncate">{type}</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-purple-500 h-2 rounded-full"
                                style={{ width: `${(count / data.edges.length) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-sm w-12 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
