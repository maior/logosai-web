'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ══════════════════════════════════════════════════════════════
// Section 1 — Hero: What makes this different
// ══════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="relative px-6 md:px-16 pt-20 pb-16 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(139,92,246,0.08),transparent)] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto text-center relative"
      >
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-400/70 mb-4">
          Self-Evolving Multi-Agent AI System
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
          Agents that build agents.
          <br />
          <span className="text-slate-500">And fix themselves.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          LogosAI is not a chatbot wrapper. It&apos;s an autonomous system where 50+ specialized
          agents collaborate, and when a capability is missing, the system
          <span className="text-white font-medium"> generates a new agent in real-time</span>,
          deploys it without downtime, and continuously improves it from failure data.
        </p>
      </motion.div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Section 1.5 — Interactive Architecture Diagram (SVG)
// ══════════════════════════════════════════════════════════════

/*
  Full-stack request flow diagram with animated data pulses.
  3 tabs: Normal Request / Agent Generation / Self-Evolution
*/

interface FlowNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  icon: string;
  details?: string[];
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  color: string;
  animated?: boolean;
}

interface FlowDiagram {
  id: string;
  tab: string;
  tagline: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  annotations: { x: number; y: number; text: string; color: string }[];
}

const FLOW_DIAGRAMS: FlowDiagram[] = [
  // ─── Flow 1: Normal Request ───
  {
    id: 'normal',
    tab: 'Normal Request',
    tagline: 'User asks a question → multiple agents collaborate → integrated answer',
    nodes: [
      { id: 'user', label: 'User', sub: 'Natural language query', x: 400, y: 20, w: 120, h: 44, color: '#3b82f6', icon: '💬' },
      { id: 'web', label: 'logos_web', sub: ':8010', x: 400, y: 100, w: 120, h: 44, color: '#3b82f6', icon: '🌐',
        details: ['Next.js 14', 'SSE streaming', '14-event pipeline'] },
      { id: 'api', label: 'logos_api', sub: ':8090', x: 400, y: 180, w: 120, h: 44, color: '#8b5cf6', icon: '⚡',
        details: ['FastAPI', 'JWT auth', 'Memory injection', 'Desktop direct routing'] },
      { id: 'memory', label: 'User Memory', sub: 'Context enrichment', x: 600, y: 180, w: 120, h: 44, color: '#a855f7', icon: '🧠',
        details: ['Preferences, facts, instructions', 'Importance × recency scoring', '30-day half-life decay'] },
      { id: 'onto', label: 'Ontology', sub: 'Agent selection', x: 250, y: 270, w: 120, h: 44, color: '#10b981', icon: '🧠',
        details: ['GNN + RL + KG + LLM', 'Scores 50 agents in <100ms', 'Zero hardcoded routing'] },
      { id: 'planner', label: 'QueryPlanner', sub: 'Decompose & format', x: 550, y: 270, w: 120, h: 44, color: '#10b981', icon: '📋',
        details: ['Complex → sub-queries', 'Format instructions per type', 'Parallel strategy decision'] },
      { id: 'acp', label: 'ACP Server', sub: ':8888 — Runtime', x: 400, y: 360, w: 140, h: 50, color: '#10b981', icon: '🔧',
        details: ['JSON-RPC + SSE', '50+ agents loaded', 'WorkflowEngine', 'call_agent() inter-agent'] },
      { id: 'a1', label: 'internet', sub: 'Tavily search', x: 160, y: 460, w: 110, h: 40, color: '#d97706', icon: '🔍' },
      { id: 'a2', label: 'analysis', sub: 'Data analysis', x: 310, y: 460, w: 110, h: 40, color: '#d97706', icon: '📊' },
      { id: 'a3', label: 'code', sub: 'Code generation', x: 460, y: 460, w: 110, h: 40, color: '#d97706', icon: '💻' },
      { id: 'a4', label: 'translation', sub: '10 languages', x: 610, y: 460, w: 110, h: 40, color: '#d97706', icon: '🌍' },
      { id: 'integrate', label: 'Result Integration', sub: 'LLM merges all outputs', x: 400, y: 540, w: 140, h: 44, color: '#8b5cf6', icon: '🔄',
        details: ['Semantic merge', 'Source attribution', 'Markdown formatting'] },
      { id: 'result', label: 'Integrated Answer', sub: 'Streamed to user', x: 400, y: 620, w: 140, h: 44, color: '#3b82f6', icon: '✨' },
    ],
    edges: [
      { from: 'user', to: 'web', color: '#3b82f6', animated: true },
      { from: 'web', to: 'api', label: 'SSE stream', color: '#3b82f6', animated: true },
      { from: 'api', to: 'memory', label: 'load memories', color: '#a855f7' },
      { from: 'api', to: 'onto', label: 'select agents', color: '#8b5cf6', animated: true },
      { from: 'api', to: 'planner', label: 'plan query', color: '#8b5cf6' },
      { from: 'onto', to: 'acp', label: 'agent IDs', color: '#10b981', animated: true },
      { from: 'planner', to: 'acp', label: 'sub-queries', color: '#10b981' },
      { from: 'acp', to: 'a1', color: '#d97706', animated: true },
      { from: 'acp', to: 'a2', color: '#d97706', animated: true },
      { from: 'acp', to: 'a3', color: '#d97706', animated: true },
      { from: 'acp', to: 'a4', color: '#d97706', animated: true },
      { from: 'a1', to: 'integrate', color: '#d97706' },
      { from: 'a2', to: 'integrate', color: '#d97706' },
      { from: 'a3', to: 'integrate', color: '#d97706' },
      { from: 'a4', to: 'integrate', color: '#d97706' },
      { from: 'integrate', to: 'result', color: '#3b82f6', animated: true },
    ],
    annotations: [
      { x: 62, y: 475, text: 'Parallel execution', color: '#d97706' },
      { x: 755, y: 290, text: '← No hardcoded routing', color: '#10b981' },
    ],
  },

  // ─── Flow 2: Agent Generation (Gap) ───
  {
    id: 'generation',
    tab: 'Agent Generation',
    tagline: 'No agent exists for the query → system builds one in real-time',
    nodes: [
      { id: 'user', label: 'User Query', sub: '"ESG 분석 에이전트 만들어줘"', x: 80, y: 30, w: 160, h: 44, color: '#3b82f6', icon: '💬' },
      { id: 'acp', label: 'ACP Server', sub: 'select_appropriate_agent()', x: 80, y: 110, w: 160, h: 44, color: '#10b981', icon: '🔧',
        details: ['Searches 50+ agents', 'No match found', 'Triggers GapDetector'] },
      { id: 'gap', label: 'GapDetector', sub: 'LLM analyzes capability gap', x: 80, y: 200, w: 160, h: 50, color: '#ef4444', icon: '🔍',
        details: ['LLM: "Can any agent handle this?"', 'confidence: 0.92', 'missing: [esg_scoring]', 'suggested: "ESG Score Agent"'] },
      { id: 'bridge', label: 'ForgeBridge', sub: 'WebSocket to FORGE', x: 80, y: 290, w: 160, h: 44, color: '#f59e0b', icon: '🔗',
        details: ['ws://localhost:8030/ws/acp-gap-xxx', 'Sends GapDetectionResult', 'Streams progress events'] },
      { id: 'v6', label: 'FORGE V6 Pipeline', sub: '8-stage generation', x: 400, y: 30, w: 160, h: 50, color: '#f59e0b', icon: '🏗️',
        details: ['11 agents collaborate', 'Multi-agent debate', '~45 seconds total'] },
      { id: 'analyze', label: '① Analyze', sub: '3 sub-agents debate', x: 620, y: 30, w: 130, h: 40, color: '#f59e0b', icon: '🔬' },
      { id: 'decompose', label: '② Decompose', sub: 'Chain-of-Thought', x: 620, y: 90, w: 130, h: 40, color: '#f59e0b', icon: '🧩' },
      { id: 'strategy', label: '③ Strategy', sub: 'ReAct reasoning', x: 620, y: 150, w: 130, h: 40, color: '#f59e0b', icon: '🎯' },
      { id: 'codegen', label: '④ Generate', sub: 'Slice library + LLM', x: 620, y: 210, w: 130, h: 40, color: '#f59e0b', icon: '⚙️' },
      { id: 'wfdebate', label: '⑤ Workflow Debate', sub: '5 proposers vote', x: 620, y: 270, w: 130, h: 40, color: '#8b5cf6', icon: '🗳️' },
      { id: 'assemble', label: '⑥ Assemble', sub: 'Full agent code', x: 620, y: 330, w: 130, h: 40, color: '#f59e0b', icon: '📦' },
      { id: 'heal', label: '⑦ Error Heal', sub: '3 experts parallel', x: 620, y: 390, w: 130, h: 40, color: '#ef4444', icon: '🩺' },
      { id: 'test', label: '⑧ Test Validate', sub: 'Feedback loop', x: 620, y: 450, w: 130, h: 40, color: '#10b981', icon: '🧪' },
      { id: 'confidence', label: 'Confidence Gate', sub: '≥ 0.95 → auto-deploy', x: 400, y: 380, w: 160, h: 44, color: '#8b5cf6', icon: '🛡️',
        details: ['≥0.95: auto-deploy', '0.70-0.94: human review', '<0.70: reject'] },
      { id: 'hotreg', label: 'hot_register', sub: 'Zero-downtime deploy', x: 400, y: 470, w: 160, h: 44, color: '#10b981', icon: '🚀',
        details: ['Dynamic importlib load', 'LogosAIAgent detection', 'agents.json persistence', '_agent_registry injection'] },
      { id: 'live', label: 'Agent Live!', sub: 'Serves traffic immediately', x: 170, y: 470, w: 160, h: 44, color: '#10b981', icon: '✅' },
    ],
    edges: [
      { from: 'user', to: 'acp', color: '#3b82f6', animated: true },
      { from: 'acp', to: 'gap', label: 'No agent found', color: '#ef4444', animated: true },
      { from: 'gap', to: 'bridge', label: 'GapResult', color: '#ef4444', animated: true },
      { from: 'bridge', to: 'v6', label: 'WebSocket', color: '#f59e0b', animated: true },
      { from: 'v6', to: 'analyze', color: '#f59e0b', animated: true },
      { from: 'analyze', to: 'decompose', color: '#f59e0b', animated: true },
      { from: 'decompose', to: 'strategy', color: '#f59e0b', animated: true },
      { from: 'strategy', to: 'codegen', color: '#f59e0b', animated: true },
      { from: 'codegen', to: 'wfdebate', color: '#f59e0b', animated: true },
      { from: 'wfdebate', to: 'assemble', color: '#8b5cf6', animated: true },
      { from: 'assemble', to: 'heal', color: '#ef4444', animated: true },
      { from: 'heal', to: 'test', color: '#10b981', animated: true },
      { from: 'test', to: 'confidence', label: 'validated', color: '#10b981', animated: true },
      { from: 'confidence', to: 'hotreg', label: 'approved', color: '#10b981', animated: true },
      { from: 'hotreg', to: 'live', label: 'registered', color: '#10b981', animated: true },
    ],
    annotations: [
      { x: 780, y: 245, text: '11 agents\ncollaborate', color: '#f59e0b' },
      { x: 400, y: 540, text: '↑ New agent permanently available', color: '#10b981' },
    ],
  },

  // ─── Flow 3: Self-Evolution ───
  {
    id: 'evolution',
    tab: 'Self-Evolution',
    tagline: 'Agent fails repeatedly → system fixes itself → deploys improved version',
    nodes: [
      { id: 'agent_run', label: 'Agent Executes', sub: 'process(query)', x: 80, y: 40, w: 150, h: 44, color: '#10b981', icon: '⚙️' },
      { id: 'success', label: 'Success', sub: 'Return result', x: 80, y: 140, w: 100, h: 40, color: '#10b981', icon: '✅' },
      { id: 'fail', label: 'Failure', sub: 'Error logged', x: 260, y: 140, w: 100, h: 40, color: '#ef4444', icon: '❌' },
      { id: 'logger', label: 'FailureLogger', sub: 'Pattern detection', x: 260, y: 230, w: 150, h: 50, color: '#ef4444', icon: '📋',
        details: ['agent_calls.json (500)', 'agent_failures.json (200)', 'Group by agent+action', 'Frequency counting'] },
      { id: 'rate', label: 'Rate Check', sub: '>30% in 10+ calls?', x: 260, y: 330, w: 150, h: 44, color: '#ef4444', icon: '📊',
        details: ['Recent 100 calls scanned', 'Per-agent failure rate', 'Circuit breaker: 60min'] },
      { id: 'circuit', label: 'Circuit Breaker', sub: '60min cooldown', x: 80, y: 330, w: 120, h: 40, color: '#6b7280', icon: '🔒',
        details: ['Prevents duplicate requests', 'Auto-expires', 'Per-agent isolation'] },
      { id: 'export', label: 'Export for FORGE', sub: 'Failure patterns + code', x: 470, y: 230, w: 150, h: 50, color: '#f59e0b', icon: '📤',
        details: ['Agent source code', 'Failure patterns', 'Sample queries', 'Error messages'] },
      { id: 'bridge2', label: 'ForgeBridge', sub: 'request_improvement()', x: 470, y: 330, w: 150, h: 44, color: '#f59e0b', icon: '🔗' },
      { id: 'improver', label: 'CodeImprover', sub: 'FORGE analyzes & fixes', x: 680, y: 230, w: 150, h: 50, color: '#f59e0b', icon: '🩺',
        details: ['Load current source', 'Analyze failure context', 'LLM generates minimal fix', 'Self-Healing validation'] },
      { id: 'gate', label: 'Confidence Gate', sub: '≥0.95 auto / <0.95 review', x: 680, y: 330, w: 150, h: 44, color: '#8b5cf6', icon: '🛡️' },
      { id: 'auto_deploy', label: 'Auto Deploy', sub: 'Backup → Write → Register', x: 580, y: 430, w: 140, h: 44, color: '#10b981', icon: '🚀',
        details: ['Original backed up (.bak)', 'New code written', 'hot_register called'] },
      { id: 'pending', label: 'Pending Review', sub: 'data/pending_improvements/', x: 770, y: 430, w: 140, h: 44, color: '#6b7280', icon: '👤',
        details: ['Saved as JSON', 'Includes diff', 'Human approval needed'] },
      { id: 'improved', label: 'Improved Agent', sub: 'Serves better results', x: 400, y: 520, w: 160, h: 44, color: '#10b981', icon: '✨' },
      { id: 'loop', label: 'Feedback Loop', sub: 'Monitoring continues', x: 150, y: 520, w: 150, h: 40, color: '#3b82f6', icon: '🔄',
        details: ['New agent calls logged', 'Performance tracked', 'Failures trigger next cycle'] },
    ],
    edges: [
      { from: 'agent_run', to: 'success', label: 'OK', color: '#10b981' },
      { from: 'agent_run', to: 'fail', label: 'Error', color: '#ef4444', animated: true },
      { from: 'fail', to: 'logger', color: '#ef4444', animated: true },
      { from: 'logger', to: 'rate', color: '#ef4444', animated: true },
      { from: 'rate', to: 'circuit', label: 'active?', color: '#6b7280' },
      { from: 'rate', to: 'export', label: '>30%', color: '#f59e0b', animated: true },
      { from: 'export', to: 'bridge2', color: '#f59e0b', animated: true },
      { from: 'export', to: 'improver', label: 'code + data', color: '#f59e0b', animated: true },
      { from: 'bridge2', to: 'improver', label: 'WebSocket', color: '#f59e0b' },
      { from: 'improver', to: 'gate', label: 'result', color: '#8b5cf6', animated: true },
      { from: 'gate', to: 'auto_deploy', label: '≥0.95', color: '#10b981', animated: true },
      { from: 'gate', to: 'pending', label: '<0.95', color: '#6b7280' },
      { from: 'auto_deploy', to: 'improved', color: '#10b981', animated: true },
      { from: 'improved', to: 'loop', color: '#3b82f6' },
      { from: 'loop', to: 'logger', label: 'next cycle', color: '#3b82f6' },
    ],
    annotations: [
      { x: 80, y: 460, text: 'Fully autonomous\nNo human needed', color: '#10b981' },
      { x: 770, y: 490, text: 'Low confidence\n→ human reviews', color: '#6b7280' },
    ],
  },
];

// SVG helpers
function getCenter(n: FlowNode): [number, number] {
  return [n.x + n.w / 2, n.y + n.h / 2];
}

function getEdgePath(from: FlowNode, to: FlowNode): string {
  const [x1, y1] = getCenter(from);
  const [x2, y2] = getCenter(to);
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Exit/enter from the edge of the box
  let sx = x1, sy = y1, ex = x2, ey = y2;
  if (Math.abs(dy) > Math.abs(dx) * 0.3) {
    sy = dy > 0 ? from.y + from.h : from.y;
    ey = dy > 0 ? to.y : to.y + to.h;
    // Smooth cubic bezier
    const cy1 = sy + (ey - sy) * 0.4;
    const cy2 = sy + (ey - sy) * 0.6;
    return `M${sx},${sy} C${sx},${cy1} ${ex},${cy2} ${ex},${ey}`;
  } else {
    sx = dx > 0 ? from.x + from.w : from.x;
    ex = dx > 0 ? to.x : to.x + to.w;
    const cx1 = sx + (ex - sx) * 0.5;
    return `M${sx},${sy} C${cx1},${sy} ${cx1},${ey} ${ex},${ey}`;
  }
}

function FlowDiagramSVG({ diagram, selectedId, onSelect }: {
  diagram: FlowDiagram;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const nodeMap = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));

  // Compute viewBox from nodes
  let maxX = 0, maxY = 0;
  for (const n of diagram.nodes) {
    maxX = Math.max(maxX, n.x + n.w + 40);
    maxY = Math.max(maxY, n.y + n.h + 40);
  }
  for (const a of diagram.annotations) {
    maxX = Math.max(maxX, a.x + 120);
  }

  return (
    <svg viewBox={`0 0 ${Math.max(maxX, 860)} ${maxY}`} className="w-full h-auto" style={{ maxHeight: '65vh' }}>
      <defs>
        {/* Animated pulse for edges */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {diagram.edges.map((edge, i) => {
        const fromNode = nodeMap[edge.from];
        const toNode = nodeMap[edge.to];
        if (!fromNode || !toNode) return null;
        const path = getEdgePath(fromNode, toNode);
        const [mx, my] = [(getCenter(fromNode)[0] + getCenter(toNode)[0]) / 2, (getCenter(fromNode)[1] + getCenter(toNode)[1]) / 2];

        return (
          <g key={`e-${i}`}>
            <path d={path} fill="none" stroke={edge.color} strokeWidth={1.5} opacity={0.3} />
            {edge.animated && (
              <circle r="3" fill={edge.color} opacity={0.9} filter="url(#glow)">
                <animateMotion dur="2s" repeatCount="indefinite" path={path} />
              </circle>
            )}
            {/* Arrowhead */}
            <path d={path} fill="none" stroke={edge.color} strokeWidth={1.5} opacity={0.5}
              markerEnd={`url(#ah-${edge.color.replace('#', '')})`} />
            {edge.label && (
              <text x={mx} y={my - 6} fontSize={8} fill={edge.color} textAnchor="middle" opacity={0.7} fontWeight={500}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {diagram.nodes.map((node) => {
        const isSel = selectedId === node.id;
        return (
          <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer" role="button" tabIndex={0}>
            <rect
              x={node.x} y={node.y} width={node.w} height={node.h} rx={8}
              fill={node.color + '18'}
              stroke={isSel ? '#fff' : node.color}
              strokeWidth={isSel ? 2.5 : 1.2}
            />
            {/* Icon + label */}
            <text x={node.x + 10} y={node.y + 18} fontSize={10} fill="#e2e8f0" fontWeight={600}>
              <tspan>{node.icon} </tspan>
              <tspan>{node.label}</tspan>
            </text>
            <text x={node.x + 10} y={node.y + 32} fontSize={8} fill="#94a3b8" opacity={0.7}>
              {node.sub}
            </text>
          </g>
        );
      })}

      {/* Annotations */}
      {diagram.annotations.map((a, i) => (
        <text key={i} x={a.x} y={a.y} fontSize={9} fill={a.color} opacity={0.5} fontStyle="italic" fontWeight={500}>
          {a.text.split('\n').map((line, li) => (
            <tspan key={li} x={a.x} dy={li === 0 ? 0 : 13}>{line}</tspan>
          ))}
        </text>
      ))}

      {/* Generic arrowhead markers (one per color) */}
      <defs>
        {['3b82f6', '8b5cf6', '10b981', 'd97706', 'f59e0b', 'ef4444', '6b7280', 'a855f7'].map((c) => (
          <marker key={c} id={`ah-${c}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={`#${c}`} opacity={0.7} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

function InteractiveArchSection() {
  const [tabIdx, setTabIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const diagram = FLOW_DIAGRAMS[tabIdx];
  const selectedNode = selectedId ? diagram.nodes.find((n) => n.id === selectedId) : null;

  return (
    <section className="px-6 md:px-16 py-16 border-t border-slate-800/50" id="process">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-blue-400/60 mb-3">Process Visualization</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            How data flows through the system
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-2xl">
            Three core processes power LogosAI. The animated dots show live data movement. Click any component for details.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 bg-slate-900/60 rounded-lg p-1 w-fit border border-slate-800/60">
          {FLOW_DIAGRAMS.map((d, i) => (
            <button
              key={d.id}
              onClick={() => { setTabIdx(i); setSelectedId(null); }}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                tabIdx === i
                  ? 'bg-slate-800 text-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {d.tab}
            </button>
          ))}
        </div>

        {/* Tagline */}
        <p className="text-xs text-slate-400 mb-4 italic">{diagram.tagline}</p>

        {/* Diagram */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 relative">
          <FlowDiagramSVG diagram={diagram} selectedId={selectedId} onSelect={(id) => setSelectedId(prev => prev === id ? null : id)} />
        </div>

        {/* Detail tooltip */}
        <AnimatePresence>
          {selectedNode && selectedNode.details && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/95 p-4 max-w-md"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-200">{selectedNode.icon} {selectedNode.label}</h4>
                <button onClick={() => setSelectedId(null)} className="text-slate-600 hover:text-slate-400 text-xs">close</button>
              </div>
              <ul className="space-y-1">
                {selectedNode.details.map((d, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">-</span>{d}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-5 text-[10px] text-slate-500">
          <span className="font-semibold text-slate-400">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" /></span>
            Animated = live data flow
          </span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-px bg-slate-500" /> Connection</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500/30 border border-red-500/50" /> Failure path</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/50" /> Success path</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500/30 border border-amber-500/50" /> FORGE pipeline</span>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Section 2 — Innovation Pillars
// ══════════════════════════════════════════════════════════════

const INNOVATIONS = [
  {
    id: 'self-evolve',
    icon: '🧬',
    title: 'Self-Evolving Agents',
    headline: 'Agents detect their own failures and autonomously request code fixes',
    description: 'When an agent\'s failure rate exceeds 30%, the system automatically analyzes failure patterns, sends the code to FORGE for improvement, validates the fix, and deploys it — all without human intervention.',
    flow: [
      { label: 'Agent fails 3+ times', color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'FailureLogger detects pattern', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'FORGE V6 generates fix', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'Confidence gate (≥0.95)', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'hot_register deploys live', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
    comparison: {
      others: 'Engineer notices bug → files ticket → waits for sprint → deploys next week',
      logosai: 'System detects, fixes, validates, and deploys in minutes. Autonomously.',
    },
  },
  {
    id: 'agents-build-agents',
    title: 'Agents Building Agents',
    icon: '🏗️',
    headline: '11 AI agents collaborate in an 8-stage pipeline to generate new agent code',
    description: 'FORGE V6 isn\'t one LLM generating code. It\'s a team: 3 analyzers debate the query, a strategist picks the approach (ReAct), 5 proposers debate the workflow, 3 error healers diagnose in parallel, and a validator runs test cases with a feedback loop.',
    flow: [
      { label: 'QueryAnalyzer (3-agent debate)', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'FunctionDecomposer (Chain-of-Thought)', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'StrategyAgent (ReAct reasoning)', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'CodeGenerator + Slice Library (176)', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'WorkflowDebate (5 proposers vote)', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'ErrorHealer (3 experts parallel)', color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'TestValidator (feedback loop)', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
    comparison: {
      others: 'LLM generates code in one shot. Works sometimes. Breaks often.',
      logosai: 'Multi-agent debate + healing + validation. 99% functional rate across 300 test cases.',
    },
  },
  {
    id: 'gap-detection',
    title: 'Capability Gap Detection',
    icon: '🔍',
    headline: 'When no agent can handle a query, the system creates one on the spot',
    description: 'GapDetector uses LLM to analyze whether existing agents can handle a query. If not, it identifies missing capabilities, constructs input/output schemas, and sends a generation request to FORGE — which builds, tests, and deploys the new agent while the user waits.',
    flow: [
      { label: 'User asks: "ESG 보고서 분석해줘"', color: 'text-slate-300', bg: 'bg-slate-500/10' },
      { label: 'No suitable agent found', color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'GapDetector: "Need ESG scoring agent"', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'FORGE generates ESGScoreAgent', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'hot_register → agent live', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Query re-executed with new agent', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
    comparison: {
      others: 'User gets "I can\'t do that." End of story.',
      logosai: 'System builds the capability it\'s missing, deploys it, and answers the query.',
    },
  },
  {
    id: 'desktop-ai',
    title: 'Desktop as an Agent',
    icon: '🖥️',
    headline: 'AI controls your desktop apps like a human — no APIs needed',
    description: 'Desktop agents don\'t use REST APIs. They use the same UI you do: AppleScript clicks the KakaoTalk search button, Chrome JavaScript reads your Gmail inbox, keyboard shortcuts navigate Notion. It\'s the difference between an API integration and an AI that actually operates your computer.',
    flow: [
      { label: '"카카오톡으로 김교수에게 회의 안내 보내줘"', color: 'text-slate-300', bg: 'bg-slate-500/10' },
      { label: 'LLM routes → kakaotalk_agent', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'AppleScript opens KakaoTalk', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Accessibility API clicks search', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Peekaboo pastes Korean text', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'Message sent ✓', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
    comparison: {
      others: 'Build a KakaoTalk API integration. Wait for approval. Limited features.',
      logosai: 'AI operates the app directly — works with any app, no API approval needed.',
    },
  },
  {
    id: 'ontology',
    title: 'Semantic Agent Selection',
    icon: '🧠',
    headline: 'Zero hardcoded routing. LLM + Knowledge Graph + GNN selects agents semantically.',
    description: 'Most multi-agent systems hardcode routing rules: "if query contains \'weather\' → weather_agent." LogosAI\'s ontology engine uses a HybridAgentSelector combining Graph Neural Networks, Reinforcement Learning, Knowledge Graphs, and LLM scoring. Add a new agent? It\'s automatically discoverable — no code changes.',
    flow: [
      { label: 'User query in any language', color: 'text-slate-300', bg: 'bg-slate-500/10' },
      { label: 'LLM extracts intent + entities', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'GNN scores 50 agents in <100ms', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'KG + RL validates selection', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { label: 'QueryPlanner decomposes if complex', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { label: 'Parallel execution → integrated result', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
    comparison: {
      others: 'if "날씨" in query: return weather_agent  # breaks with "오늘 비 올까?"',
      logosai: 'LLM understands intent semantically. Works in any language, any phrasing.',
    },
  },
];

function InnovationCard({ item, index }: { item: typeof INNOVATIONS[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-start gap-4">
          <span className="text-2xl mt-0.5 shrink-0">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                className="text-slate-500 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.span>
            </div>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{item.headline}</p>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-5">
              <p className="text-sm text-slate-400 leading-relaxed pl-10">
                {item.description}
              </p>

              {/* Flow visualization */}
              <div className="pl-10 space-y-1.5">
                {item.flow.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center gap-2 shrink-0 w-5">
                      {i < item.flow.length - 1 ? (
                        <span className="text-slate-700 text-xs">→</span>
                      ) : (
                        <span className="text-emerald-500 text-xs">✓</span>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-md ${step.bg} ${step.color} font-medium`}>
                      {step.label}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Comparison */}
              <div className="pl-10 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">Others</p>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">{item.comparison.others}</p>
                </div>
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-violet-400/70 mb-1.5">LogosAI</p>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">{item.comparison.logosai}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InnovationsSection() {
  return (
    <section className="px-6 md:px-16 py-16 border-t border-slate-800/50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-amber-400/60 mb-3">What makes this different</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            5 things no other system does
          </h2>
          <p className="text-sm text-slate-500 mb-10 max-w-xl">
            Each innovation is a research-grade capability running in production. Click to see the details.
          </p>
        </motion.div>

        <div className="space-y-3">
          {INNOVATIONS.map((item, i) => (
            <InnovationCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Section 3 — Live Scenario Animation
// ══════════════════════════════════════════════════════════════

function LiveScenario() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 5500),
      setTimeout(() => setPhase(5), 7000),
      setTimeout(() => setPhase(6), 8500),
      setTimeout(() => setPhase(7), 10000),
      setTimeout(() => setPhase(0), 13000),
    ];
    const loop = setInterval(() => {
      setPhase(0);
      timers.push(
        setTimeout(() => setPhase(1), 1000),
        setTimeout(() => setPhase(2), 2500),
        setTimeout(() => setPhase(3), 4000),
        setTimeout(() => setPhase(4), 5500),
        setTimeout(() => setPhase(5), 7000),
        setTimeout(() => setPhase(6), 8500),
        setTimeout(() => setPhase(7), 10000),
      );
    }, 13000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const steps = [
    { p: 1, icon: '💬', text: 'User: "고객 이탈률을 예측하는 에이전트 만들어줘"', color: 'text-slate-200' },
    { p: 2, icon: '🔍', text: 'GapDetector: No churn prediction agent found (confidence: 0.92)', color: 'text-red-400' },
    { p: 3, icon: '🔗', text: 'ForgeBridge → FORGE V6 WebSocket connected', color: 'text-amber-400' },
    { p: 4, icon: '🏗️', text: 'V6 Pipeline: 3 analyzers debate → Strategy: ReAct → Code generating...', color: 'text-violet-400' },
    { p: 5, icon: '🧪', text: 'TestValidator: 2/2 test cases passed (1st attempt)', color: 'text-blue-400' },
    { p: 6, icon: '🚀', text: 'hot_register: ChurnPredictorAgent deployed (zero downtime)', color: 'text-emerald-400' },
    { p: 7, icon: '✅', text: 'Query re-executed → "고객 이탈 확률: 23.5%, 주요 요인: 최근 활동 감소"', color: 'text-emerald-300' },
  ];

  return (
    <section className="px-6 md:px-16 py-16 border-t border-slate-800/50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-emerald-400/60 mb-3">Live scenario</p>
          <h2 className="text-2xl font-bold text-white mb-2">
            Watch an agent get born
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            A user asks for something no agent can do. The system builds one in real-time.
          </p>
        </motion.div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/50">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <div className="w-2 h-2 rounded-full bg-amber-500/60" />
            <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span className="ml-2 text-[11px] text-slate-600 font-mono">LogosAI — Self-Evolution in action</span>
          </div>

          <div className="p-5 space-y-2 min-h-[280px]">
            {steps.map((step) => (
              phase >= step.p && (
                <motion.div
                  key={step.p}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-sm mt-0.5 shrink-0">{step.icon}</span>
                  <span className={`text-[13px] leading-relaxed ${step.color}`}>{step.text}</span>
                </motion.div>
              )
            ))}
            {phase === 0 && (
              <div className="flex items-center justify-center h-[240px]">
                <span className="text-slate-700 text-sm animate-pulse">Starting scenario...</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-800/40 flex items-center gap-4 text-[10px] text-slate-600 font-mono">
            <span>Total time: ~45 seconds</span>
            <span className="text-slate-800">|</span>
            <span>No human involved</span>
            <span className="text-slate-800">|</span>
            <span>Agent permanently available</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Section 4 — Architecture (compact, supporting detail)
// ══════════════════════════════════════════════════════════════

function ArchLayer({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-slate-400">{label}</span>
      </div>
      <div className="ml-3 pl-3 border-l border-slate-800/40">
        <div className="flex flex-wrap gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function ArchBox({ label, sub, port, color }: { label: string; sub: string; port?: number; color: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-[140px]`} style={{ borderColor: color + '40', backgroundColor: color + '10' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        {port && <span className="text-[9px] font-mono text-slate-600">:{port}</span>}
      </div>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function ArchitectureSection() {
  return (
    <section className="px-6 md:px-16 py-16 border-t border-slate-800/50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-blue-400/60 mb-3">System topology</p>
          <h2 className="text-2xl font-bold text-white mb-8">How it all connects</h2>
        </motion.div>

        <div className="space-y-6">
          <ArchLayer label="Frontend" color="#3b82f6">
            <ArchBox label="logos_web" sub="Chat UI (SSE streaming)" port={8010} color="#3b82f6" />
            <ArchBox label="FORGE Web" sub="Agent Builder (Monaco + D3)" port={8050} color="#f59e0b" />
          </ArchLayer>

          {/* Arrow */}
          <div className="ml-6 text-slate-700 text-xs">↓ HTTP / SSE / WebSocket</div>

          <ArchLayer label="API Services" color="#8b5cf6">
            <ArchBox label="logos_api" sub="FastAPI + JWT + Memory + Telegram" port={8090} color="#8b5cf6" />
            <ArchBox label="FORGE API" sub="V6 Agentic Pipeline (11 agents)" port={8030} color="#f59e0b" />
            <ArchBox label="logos_server" sub="Django Legacy" port={8080} color="#6b7280" />
          </ArchLayer>

          <div className="ml-6 text-slate-700 text-xs">↓ JSON-RPC / Agent Selection</div>

          <ArchLayer label="Orchestration" color="#10b981">
            <ArchBox label="Ontology" sub="GNN+RL+KG+LLM hybrid selection" color="#10b981" />
            <ArchBox label="ACP Server" sub="50+ agents, hot_register, SSE" port={8888} color="#10b981" />
            <ArchBox label="logosai SDK" sub="LogosAIAgent base + Evolution" color="#34d399" />
            <ArchBox label="Debate System" sub="5-phase agent negotiation" color="#10b981" />
          </ArchLayer>

          <div className="ml-6 text-slate-700 text-xs">↓ process(query, context)</div>

          <ArchLayer label="50+ Agents" color="#d97706">
            <ArchBox label="Core (30+)" sub="search, analysis, code, RAG, translate..." color="#d97706" />
            <ArchBox label="Desktop (5)" sub="Gmail, KakaoTalk, Notion, WhatsApp" color="#d97706" />
            <ArchBox label="FORGE V6 (11)" sub="Analyzer→Generator→Healer→Validator" color="#f59e0b" />
          </ArchLayer>

          <div className="ml-6 text-slate-700 text-xs">↓ failure data / gap detection</div>

          <ArchLayer label="Self-Evolution" color="#ef4444">
            <ArchBox label="FailureLogger" sub="Pattern analysis + 30% trigger" color="#ef4444" />
            <ArchBox label="GapDetector" sub="LLM missing-capability scan" color="#ef4444" />
            <ArchBox label="ForgeBridge" sub="WebSocket to FORGE V6" color="#f59e0b" />
            <ArchBox label="hot_register" sub="Zero-downtime agent deploy" color="#10b981" />
          </ArchLayer>

          {/* Feedback loop arrow */}
          <div className="ml-6 flex items-center gap-2 text-xs">
            <span className="text-emerald-600">↑</span>
            <span className="text-slate-600">New agent registered → serves traffic → failures logged → continuous improvement loop</span>
          </div>
        </div>

        {/* Data stores */}
        <div className="mt-10 pt-6 border-t border-slate-800/40">
          <p className="text-xs font-semibold text-slate-500 mb-3">External Dependencies</p>
          <div className="flex flex-wrap gap-2">
            {[
              'PostgreSQL (logosus schema)',
              'Elasticsearch (RAG)',
              'Gemini API (gemini-2.5-flash-lite)',
              'Tavily (web search)',
              'Telegram Bot API',
              'macOS Accessibility + Peekaboo',
            ].map((d) => (
              <span key={d} className="text-[10px] px-2 py-1 rounded bg-slate-800/60 text-slate-500 border border-slate-800/40">
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Section 5 — Numbers
// ══════════════════════════════════════════════════════════════

function NumbersSection() {
  const stats = [
    { value: '50+', label: 'Specialized Agents', detail: 'Each a domain expert' },
    { value: '99%', label: 'Functional Rate', detail: 'V5 benchmark (300 samples)' },
    { value: '11', label: 'FORGE V6 Agents', detail: 'Building other agents' },
    { value: '176', label: 'Reusable Slices', detail: 'Code component library' },
    { value: '0s', label: 'Deploy Downtime', detail: 'hot_register = instant' },
    { value: '<8s', label: 'Query Response', detail: 'Parallel multi-agent' },
  ];

  return (
    <section className="px-6 md:px-16 py-16 border-t border-slate-800/50">
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="text-center"
          >
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs font-medium text-slate-300 mt-1">{s.label}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <span className="text-base font-light">
              <span className="text-slate-400">LogosAI</span>
              <span className="text-slate-700 mx-2">/</span>
              <span className="text-slate-200">Architecture</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a href="#process" className="hover:text-slate-400 transition-colors">Process</a>
            <a href="#innovations" className="hover:text-slate-400 transition-colors">Innovations</a>
            <a href="#scenario" className="hover:text-slate-400 transition-colors">Live Demo</a>
            <a href="#topology" className="hover:text-slate-400 transition-colors">Topology</a>
          </div>
        </div>
      </nav>

      <HeroSection />
      <InteractiveArchSection />
      <div id="innovations"><InnovationsSection /></div>
      <div id="scenario"><LiveScenario /></div>
      <NumbersSection />
      <div id="topology"><ArchitectureSection /></div>

      {/* Footer */}
      <footer className="px-6 md:px-16 py-8 border-t border-slate-800/40">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>LogosAI — Self-Evolving Multi-Agent AI System</span>
          <span>SKKU AI Research Lab</span>
        </div>
      </footer>
    </div>
  );
}
