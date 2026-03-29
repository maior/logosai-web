'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import { KnowledgeGraphData } from '@/utils/streaming';
import { KnowledgeGraphViewer, NEO4J_COLORS as KG_COLORS } from '@/components/KnowledgeGraphViewer';

// --- Types ---

interface SelectionRecord {
  timestamp: string;
  query: string;
  selected_agent: string;
  method: string;
  confidence: number;
  value_estimate: number;
  elapsed_ms: number;
  reasoning?: string;
  graph_insights?: {
    has_insights: boolean;
    entities: string[];
    related_concepts: string[];
    past_patterns: Array<{
      agent: string;
      category: string;
      success_rate: number;
      final_score: number;
      time_weight: number;
    }>;
    recommended_agents: Array<{
      agent_id: string;
      graph_score: number;
    }>;
    kg_confidence: number;
  };
  gnn_rl?: {
    raw_confidence: number | null;
    value_estimate: number | null;
    suggested_agent: string | null;
    used_directly: boolean;
  } | null;
  feedback?: {
    success: boolean;
    query_semantics: {
      category: string;
      intent: string;
      entities: string[];
      keywords: string[];
      generalization_pattern: string;
    };
    ema_success_rate: number | null;
    kg_nodes_updated: boolean;
  } | null;
}

interface TrainingRecord {
  timestamp: string;
  total_loss: number;
  training_steps: number;
  buffer_size: number;
}

interface MLStats {
  available: boolean;
  message?: string;
  total_selections: number;
  gnn_rl_selections: number;
  gnn_rl_fallback: number;
  graph_assisted: number;
  llm_only: number;
  feedback_stored: number;
  gnn_rl_enabled: boolean;
  buffer_size: number;
  selection_history: SelectionRecord[];
  training_history: TrainingRecord[];
  ml_stats: {
    selections: number;
    feedbacks: number;
    training_steps: number;
    last_train_loss: number | null;
  } | null;
  version: string;
}

// --- Constants ---

const METHOD_COLORS: Record<string, string> = {
  gnn_rl: '#10B981',
  gnn_rl_fallback: '#EF4444',
  graph_assisted: '#8B5CF6',
  llm_only: '#F59E0B',
  gnn_rl_assisted: '#06B6D4',
  kg_assisted: '#8B5CF6',
  unknown: '#6B7280',
};

const METHOD_LABELS: Record<string, string> = {
  gnn_rl: 'GNN+RL Direct',
  gnn_rl_fallback: 'GNN+RL Fallback',
  gnn_rl_assisted: 'GNN+RL Assisted',
  graph_assisted: 'KG Assisted',
  kg_assisted: 'KG Assisted',
  llm_only: 'LLM Only',
  unknown: 'Unknown',
};

const CONFIDENCE_THRESHOLD = 0.7;

// --- Metric Card ---

function MetricCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// --- Donut Chart ---

function DonutChart({ data }: { data: Record<string, number> }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const width = 240;
    const height = 240;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.55;

    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    if (total === 0) {
      svg.attr('width', width).attr('height', height);
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#64748b')
        .text('No data yet');
      return;
    }

    const g = svg
      .attr('width', width).attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<[string, number]>().value(d => d[1]).sort(null);
    const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
      .innerRadius(innerRadius).outerRadius(radius);

    const arcs = g.selectAll('path')
      .data(pie(entries))
      .enter().append('path')
      .attr('d', arc)
      .attr('fill', d => METHOD_COLORS[d.data[0]] || '#6B7280')
      .attr('stroke', '#0f172a').attr('stroke-width', 2)
      .style('opacity', 0.9);

    arcs.append('title')
      .text(d => `${METHOD_LABELS[d.data[0]] || d.data[0]}: ${d.data[1]} (${((d.data[1] / total) * 100).toFixed(1)}%)`);

    // Center text
    g.append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.2em')
      .attr('fill', '#e2e8f0').attr('font-size', '28px').attr('font-weight', 'bold')
      .text(total);
    g.append('text')
      .attr('text-anchor', 'middle').attr('dy', '1.2em')
      .attr('fill', '#94a3b8').attr('font-size', '12px')
      .text('selections');
  }, [data]);

  return <svg ref={ref} />;
}

// --- Confidence Line Chart ---

function ConfidenceChart({ history }: { history: SelectionRecord[] }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 45 };
    const width = 440 - margin.left - margin.right;
    const height = 240 - margin.top - margin.bottom;

    svg.attr('width', width + margin.left + margin.right)
       .attr('height', height + margin.top + margin.bottom);

    if (history.length === 0) {
      svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', (height + margin.top + margin.bottom) / 2)
        .attr('text-anchor', 'middle').attr('fill', '#64748b')
        .text('Run queries to see confidence data');
      return;
    }

    const recent = history.slice(-50);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, recent.length - 1]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    // Grid lines
    g.append('g').attr('class', 'grid')
      .selectAll('line')
      .data([0.2, 0.4, 0.6, 0.8, 1.0])
      .enter().append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#334155').attr('stroke-dasharray', '2,4');

    // Threshold line at 0.7
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(CONFIDENCE_THRESHOLD)).attr('y2', y(CONFIDENCE_THRESHOLD))
      .attr('stroke', '#ef4444').attr('stroke-width', 1.5).attr('stroke-dasharray', '6,3');

    g.append('text')
      .attr('x', width - 2).attr('y', y(CONFIDENCE_THRESHOLD) - 5)
      .attr('text-anchor', 'end').attr('fill', '#ef4444').attr('font-size', '10px')
      .text('threshold 0.7');

    // Area fill
    const area = d3.area<SelectionRecord>()
      .x((_, i) => x(i))
      .y0(height)
      .y1(d => y(d.confidence))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(recent)
      .attr('d', area)
      .attr('fill', '#10B981').attr('opacity', 0.08);

    // Line
    const line = d3.line<SelectionRecord>()
      .x((_, i) => x(i))
      .y(d => y(d.confidence))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(recent)
      .attr('d', line)
      .attr('fill', 'none').attr('stroke', '#10B981')
      .attr('stroke-width', 2);

    // Dots
    g.selectAll('circle')
      .data(recent)
      .enter().append('circle')
      .attr('cx', (_, i) => x(i))
      .attr('cy', d => y(d.confidence))
      .attr('r', 4)
      .attr('fill', d => METHOD_COLORS[d.method] || '#6B7280')
      .attr('stroke', '#0f172a').attr('stroke-width', 1.5)
      .append('title')
      .text(d => `${d.selected_agent}\n${METHOD_LABELS[d.method] || d.method}: ${(d.confidence * 100).toFixed(1)}%\n${d.query}`);

    // Axes
    g.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `#${+d + 1}`))
      .selectAll('text,line,path').attr('stroke', '#64748b').attr('fill', '#64748b');
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(+d * 100).toFixed(0)}%`))
      .selectAll('text,line,path').attr('stroke', '#64748b').attr('fill', '#64748b');
  }, [history]);

  return <svg ref={ref} />;
}

// --- Training Loss Chart ---

function LossChart({ history }: { history: TrainingRecord[] }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 55 };
    const width = 700 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    svg.attr('width', width + margin.left + margin.right)
       .attr('height', height + margin.top + margin.bottom);

    if (history.length === 0) {
      svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', (height + margin.top + margin.bottom) / 2)
        .attr('text-anchor', 'middle').attr('fill', '#64748b')
        .text('No training data yet. Run queries to generate feedback.');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(history, d => d.training_steps) as [number, number])
      .range([0, width]);
    const yMax = d3.max(history, d => d.total_loss) || 1;
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height, 0]);

    // Grid
    g.append('g').selectAll('line')
      .data(y.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#334155').attr('stroke-dasharray', '2,4');

    // Line
    const line = d3.line<TrainingRecord>()
      .x(d => x(d.training_steps))
      .y(d => y(d.total_loss))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('d', line)
      .attr('fill', 'none').attr('stroke', '#8B5CF6')
      .attr('stroke-width', 2);

    // Dots
    g.selectAll('circle')
      .data(history)
      .enter().append('circle')
      .attr('cx', d => x(d.training_steps))
      .attr('cy', d => y(d.total_loss))
      .attr('r', 3)
      .attr('fill', '#8B5CF6')
      .append('title')
      .text(d => `Step ${d.training_steps}: loss=${d.total_loss.toFixed(4)}, buffer=${d.buffer_size}`);

    // Axes
    g.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}`))
      .selectAll('text,line,path').attr('stroke', '#64748b').attr('fill', '#64748b');
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format('.3f')(+d)))
      .selectAll('text,line,path').attr('stroke', '#64748b').attr('fill', '#64748b');

    // Label
    g.append('text')
      .attr('x', -margin.left + 15).attr('y', -8)
      .attr('fill', '#94a3b8').attr('font-size', '11px')
      .text('Loss');
  }, [history]);

  return <svg ref={ref} />;
}

// --- Legend ---

function Legend() {
  const items = [
    { key: 'gnn_rl', label: 'GNN+RL Direct' },
    { key: 'gnn_rl_assisted', label: 'GNN+RL Assisted' },
    { key: 'graph_assisted', label: 'KG Assisted' },
    { key: 'llm_only', label: 'LLM Only' },
    { key: 'gnn_rl_fallback', label: 'Fallback' },
  ];

  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: METHOD_COLORS[key] }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// --- Selection Detail Modal ---

function PipelineStep({ num, label, color, active, children }: {
  num: number; label: string; color: string; active: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`relative pl-8 pb-5 ${active ? '' : 'opacity-50'}`}>
      <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        active ? color : 'bg-slate-700 text-slate-500'
      }`}>
        {num}
      </div>
      {num < 5 && <div className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-24px)] bg-slate-700" />}
      <div className="ml-2">
        <div className="text-xs font-medium text-slate-400 mb-1">{label}</div>
        {children}
      </div>
    </div>
  );
}

function TagPill({ text, color = 'bg-slate-700 text-slate-300' }: { text: string; color?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${color} mr-1 mb-1`}>
      {text}
    </span>
  );
}

function SelectionDetailModal({ record, onClose }: { record: SelectionRecord; onClose: () => void }) {
  const [tab, setTab] = useState<'process' | 'kg' | 'learning'>('process');
  const gi = record.graph_insights;
  const gnn = record.gnn_rl;
  const fb = record.feedback;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-6 max-w-3xl max-h-[85vh] mx-auto bg-slate-900 rounded-xl border border-slate-700/50 shadow-2xl z-50 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Selection Detail</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(record.timestamp).toLocaleString()} &middot; {record.elapsed_ms.toFixed(0)}ms
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/30">
              {([
                { key: 'process' as const, label: 'Process' },
                { key: 'kg' as const, label: 'KG State' },
                { key: 'learning' as const, label: 'Learning' },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    tab === t.key
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ===== Process Tab ===== */}
          {tab === 'process' && (
            <div>
              <PipelineStep num={1} label="Query Received" color="bg-blue-500 text-white" active>
                <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-200">{record.query}</div>
              </PipelineStep>

              <PipelineStep num={2} label="GNN+RL Phase" color="bg-emerald-500 text-white" active={!!gnn}>
                {gnn ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-4">
                      <span className="text-slate-400">Suggested:</span>
                      <span className="text-slate-200 font-mono">{gnn.suggested_agent}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-slate-400">Confidence:</span>
                      <span className={gnn.raw_confidence && gnn.raw_confidence >= CONFIDENCE_THRESHOLD ? 'text-emerald-400' : 'text-amber-400'}>
                        {gnn.raw_confidence != null ? `${(gnn.raw_confidence * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-slate-400">Value Estimate:</span>
                      <span className="text-slate-200">{gnn.value_estimate != null ? gnn.value_estimate.toFixed(3) : 'N/A'}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-slate-400">Used Directly:</span>
                      <span className={gnn.used_directly ? 'text-emerald-400' : 'text-amber-400'}>
                        {gnn.used_directly ? 'Yes (high confidence)' : 'No (fell back to KG+LLM)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">GNN+RL not available for this selection</div>
                )}
              </PipelineStep>

              <PipelineStep num={3} label="Knowledge Graph Analysis" color="bg-purple-500 text-white" active={!!gi?.has_insights}>
                {gi?.has_insights ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-4">
                      <span className="text-slate-400">Entities:</span>
                      <span className="text-slate-200">{gi.entities.length > 0 ? gi.entities.join(', ') : 'none'}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-slate-400">KG Confidence:</span>
                      <span className="text-purple-400">{(gi.kg_confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-slate-400">Past Patterns:</span>
                      <span className="text-slate-200">{gi.past_patterns.length} found</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No graph insights available</div>
                )}
              </PipelineStep>

              <PipelineStep num={4} label="LLM Decision" color="bg-amber-500 text-white" active={!!record.reasoning}>
                {record.reasoning ? (
                  <div className="bg-slate-800/50 rounded p-3 text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {record.reasoning}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No LLM reasoning recorded</div>
                )}
              </PipelineStep>

              <PipelineStep num={5} label="Result" color="bg-cyan-500 text-white" active>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-white">{record.selected_agent}</span>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${METHOD_COLORS[record.method] || '#6B7280'}20`,
                      color: METHOD_COLORS[record.method] || '#6B7280',
                    }}
                  >
                    {METHOD_LABELS[record.method] || record.method}
                  </span>
                  <span className="text-xs text-slate-500">{record.elapsed_ms.toFixed(0)}ms</span>
                </div>
              </PipelineStep>
            </div>
          )}

          {/* ===== KG State Tab ===== */}
          {tab === 'kg' && (
            <div className="space-y-5">
              {/* Entities */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Extracted Entities</h3>
                <div className="flex flex-wrap">
                  {gi?.entities && gi.entities.length > 0
                    ? gi.entities.map((e, i) => <TagPill key={i} text={e} color="bg-orange-500/20 text-orange-300" />)
                    : <span className="text-xs text-slate-500">No entities extracted</span>
                  }
                </div>
              </div>

              {/* Related Concepts */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Related Concepts</h3>
                <div className="flex flex-wrap">
                  {gi?.related_concepts && gi.related_concepts.length > 0
                    ? gi.related_concepts.map((c, i) => <TagPill key={i} text={c} color="bg-purple-500/20 text-purple-300" />)
                    : <span className="text-xs text-slate-500">No related concepts found</span>
                  }
                </div>
              </div>

              {/* Past Success Patterns */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Past Success Patterns</h3>
                {gi?.past_patterns && gi.past_patterns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-400 border-b border-slate-700/50">
                        <tr>
                          <th className="text-left py-1.5 pr-3">Agent</th>
                          <th className="text-left py-1.5 pr-3">Category</th>
                          <th className="text-right py-1.5 pr-3">Success Rate</th>
                          <th className="text-right py-1.5 pr-3">Time Weight</th>
                          <th className="text-right py-1.5">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {gi.past_patterns.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-3 font-mono text-slate-300">{p.agent}</td>
                            <td className="py-1.5 pr-3 text-slate-400">{p.category}</td>
                            <td className="py-1.5 pr-3 text-right text-emerald-400">{(p.success_rate * 100).toFixed(0)}%</td>
                            <td className="py-1.5 pr-3 text-right text-slate-400">{p.time_weight?.toFixed(2) ?? '-'}</td>
                            <td className="py-1.5 text-right text-cyan-400">{p.final_score?.toFixed(3) ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">No past patterns matched</span>
                )}
              </div>

              {/* Graph Recommendations */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Graph Recommendations</h3>
                {gi?.recommended_agents && gi.recommended_agents.length > 0 ? (
                  <div className="space-y-1">
                    {gi.recommended_agents.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                        <span className="font-mono text-xs text-slate-300">{r.agent_id}</span>
                        <span className="text-xs text-cyan-400">score: {r.graph_score?.toFixed(3) ?? '-'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">No graph-based recommendations</span>
                )}
              </div>

              {/* KG Confidence */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">KG Confidence</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                    <div
                      className="bg-purple-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${(gi?.kg_confidence ?? 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-purple-400">
                    {((gi?.kg_confidence ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ===== Learning Tab ===== */}
          {tab === 'learning' && (
            <div className="space-y-5">
              {/* Feedback Status */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Feedback Status</h3>
                {fb ? (
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      fb.success
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {fb.success ? 'Success' : 'Failed'}
                    </span>
                    {fb.kg_nodes_updated && (
                      <span className="text-xs text-purple-400">KG nodes updated</span>
                    )}
                  </div>
                ) : (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600/30">
                    Pending (no feedback yet)
                  </span>
                )}
              </div>

              {/* Query Semantics */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Query Semantics</h3>
                {fb?.query_semantics ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded p-3">
                      <div className="text-xs text-slate-400 mb-1">Category</div>
                      <div className="text-sm text-white font-medium">{fb.query_semantics.category}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-3">
                      <div className="text-xs text-slate-400 mb-1">Intent</div>
                      <div className="text-sm text-white font-medium">{fb.query_semantics.intent}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-3">
                      <div className="text-xs text-slate-400 mb-1">Pattern</div>
                      <div className="text-sm text-cyan-400 font-mono">{fb.query_semantics.generalization_pattern}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-3">
                      <div className="text-xs text-slate-400 mb-1">Entities</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {fb.query_semantics.entities.length > 0
                          ? fb.query_semantics.entities.map((e, i) => <TagPill key={i} text={e} />)
                          : <span className="text-xs text-slate-500">none</span>
                        }
                      </div>
                    </div>
                    <div className="col-span-2 bg-slate-800/50 rounded p-3">
                      <div className="text-xs text-slate-400 mb-1">Keywords</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {fb.query_semantics.keywords.map((k, i) => <TagPill key={i} text={k} color="bg-blue-500/20 text-blue-300" />)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Semantics available after feedback is processed</span>
                )}
              </div>

              {/* EMA Success Rate */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">EMA Success Rate</h3>
                {fb?.ema_success_rate != null ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          fb.ema_success_rate >= 0.7 ? 'bg-emerald-500' : fb.ema_success_rate >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${fb.ema_success_rate * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-white">
                      {(fb.ema_success_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Available after feedback processing</span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// --- Main Page ---

export default function MLDashboardPage() {
  const [stats, setStats] = useState<MLStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SelectionRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'knowledge-graph' | 'learning'>('overview');
  const [kgData, setKgData] = useState<KnowledgeGraphData | null>(null);
  const [kgFullscreen, setKgFullscreen] = useState(false);
  const [kgStats, setKgStats] = useState<Record<string, any> | null>(null);
  const [kgLoading, setKgLoading] = useState(false);
  const [kgNodeFilter, setKgNodeFilter] = useState<string>('all');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ml/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(`Failed to fetch: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchStats]);

  const fetchKgData = useCallback(async () => {
    setKgLoading(true);
    try {
      const res = await fetch('/api/v1/ml/knowledge-graph?max_nodes=120');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.available) {
        setKgData({ nodes: data.nodes, edges: data.edges, metadata: data.metadata });
        setKgStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch KG data:', e);
    } finally {
      setKgLoading(false);
    }
  }, []);

  // Fetch KG data when switching to knowledge-graph tab
  useEffect(() => {
    if (activeTab === 'knowledge-graph' && !kgData) {
      fetchKgData();
    }
  }, [activeTab, kgData, fetchKgData]);

  // ESC key to close fullscreen KG
  useEffect(() => {
    if (!kgFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setKgFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kgFullscreen]);

  // Computed metrics
  const total = stats?.total_selections || 0;
  const gnnRlDirect = stats?.gnn_rl_selections || 0;
  const hitRate = total > 0 ? ((gnnRlDirect / total) * 100).toFixed(1) : '0.0';
  const avgConfidence = stats?.selection_history?.length
    ? (stats.selection_history.reduce((s, r) => s + r.confidence, 0) / stats.selection_history.length).toFixed(2)
    : '0.00';
  const bufferSize = stats?.buffer_size || 0;

  const methodData = {
    gnn_rl: stats?.gnn_rl_selections || 0,
    gnn_rl_fallback: stats?.gnn_rl_fallback || 0,
    graph_assisted: stats?.graph_assisted || 0,
    llm_only: stats?.llm_only || 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse text-lg">Loading ML Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ontology Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Knowledge Graph, GNN+RL Agent Selection & Continuous Learning</p>
        </div>
        <div className="flex items-center gap-4">
          {/* System status */}
          <div className="flex items-center gap-2 text-sm">
            {stats?.gnn_rl_enabled ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">System Active</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-slate-500">GNN+RL Disabled</span>
              </>
            )}
          </div>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              autoRefresh
                ? 'border-emerald-600 text-emerald-400 bg-emerald-950/30'
                : 'border-slate-600 text-slate-400 bg-slate-800/30'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          {/* Manual refresh */}
          <button
            onClick={() => { fetchStats(); if (activeTab === 'knowledge-graph') fetchKgData(); }}
            className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-800/40 rounded-lg p-1 border border-slate-700/40">
        {([
          { key: 'overview' as const, label: 'Overview', icon: '📊' },
          { key: 'knowledge-graph' as const, label: 'Knowledge Graph', icon: '🕸️' },
          { key: 'learning' as const, label: 'Learning & Feedback', icon: '🧠' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-800/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {stats && !stats.available && (
        <div className="mb-4 p-3 bg-yellow-950/30 border border-yellow-800/50 rounded text-yellow-400 text-sm">
          {stats.message || 'ML system not available'}
        </div>
      )}

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Selections" value={total} color="text-white" />
            <MetricCard
              label="GNN+RL Hit Rate"
              value={`${hitRate}%`}
              sub={`${gnnRlDirect} direct selections`}
              color="text-emerald-400"
            />
            <MetricCard
              label="Avg Confidence"
              value={avgConfidence}
              sub={`from last ${stats?.selection_history?.length || 0} selections`}
              color="text-purple-400"
            />
            <MetricCard
              label="Buffer Size"
              value={bufferSize.toLocaleString()}
              sub={stats?.ml_stats ? `${stats.ml_stats.training_steps} training steps` : 'N/A'}
              color="text-amber-400"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
              <h2 className="text-sm font-medium text-slate-300 mb-3">Selection Methods</h2>
              <div className="flex justify-center">
                <DonutChart data={methodData} />
              </div>
              <Legend />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
              <h2 className="text-sm font-medium text-slate-300 mb-3">Confidence Over Time</h2>
              <div className="flex justify-center overflow-x-auto">
                <ConfidenceChart history={stats?.selection_history || []} />
              </div>
            </div>
          </div>

          {/* Training Loss Chart */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-medium text-slate-300 mb-3">Training Loss</h2>
            <div className="flex justify-center overflow-x-auto">
              <LossChart history={stats?.training_history || []} />
            </div>
          </div>

          {/* Recent Selections Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-3">
              Recent Selections
              <span className="text-xs text-slate-500 ml-2">
                (last {Math.min(stats?.selection_history?.length || 0, 50)})
              </span>
            </h2>

            {(!stats?.selection_history || stats.selection_history.length === 0) ? (
              <p className="text-slate-500 text-sm py-4 text-center">No selections recorded yet. Send queries to populate.</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 border-b border-slate-700/50 sticky top-0 bg-slate-800/90">
                    <tr>
                      <th className="text-left py-2 pr-3 font-medium">Time</th>
                      <th className="text-left py-2 pr-3 font-medium">Query</th>
                      <th className="text-left py-2 pr-3 font-medium">Agent</th>
                      <th className="text-left py-2 pr-3 font-medium">Method</th>
                      <th className="text-right py-2 pr-3 font-medium">Confidence</th>
                      <th className="text-right py-2 font-medium">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {[...stats.selection_history].reverse().slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedRecord(r)}>
                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 pr-3 text-slate-300 max-w-[200px] truncate" title={r.query}>
                          {r.query}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-300">{r.selected_agent}</td>
                        <td className="py-2 pr-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${METHOD_COLORS[r.method] || '#6B7280'}20`,
                              color: METHOD_COLORS[r.method] || '#6B7280',
                            }}
                          >
                            {METHOD_LABELS[r.method] || r.method}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          <span className={r.confidence >= CONFIDENCE_THRESHOLD ? 'text-emerald-400' : 'text-amber-400'}>
                            {(r.confidence * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-slate-500 text-xs">
                          {r.elapsed_ms.toFixed(0)}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedRecord && (
            <SelectionDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
        </>
      )}

      {/* ===== KNOWLEDGE GRAPH TAB ===== */}
      {activeTab === 'knowledge-graph' && (
        <>
          {kgLoading && !kgData ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-slate-400 animate-pulse">Loading Knowledge Graph...</div>
            </div>
          ) : kgData ? (
            <>
              {/* KG Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  label="Graph Nodes"
                  value={kgStats?.total_nodes ?? kgData.nodes.length}
                  sub={`${kgData.nodes.length} visualized`}
                  color="text-blue-400"
                />
                <MetricCard
                  label="Graph Edges"
                  value={kgStats?.total_edges ?? kgData.edges.length}
                  sub={`${kgData.edges.length} visualized`}
                  color="text-purple-400"
                />
                <MetricCard
                  label="Node Types"
                  value={kgStats?.node_types ? Object.keys(kgStats.node_types).length : new Set(kgData.nodes.map(n => n.type)).size}
                  color="text-emerald-400"
                />
                <MetricCard
                  label="Avg Degree"
                  value={kgStats?.average_degree?.toFixed(1) ?? '-'}
                  sub={kgStats?.is_connected ? 'connected graph' : 'disconnected'}
                  color="text-amber-400"
                />
              </div>

              {/* Node Type Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setKgNodeFilter('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    kgNodeFilter === 'all'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  All ({kgData.nodes.length})
                </button>
                {Array.from(new Set(kgData.nodes.map(n => n.type))).sort().map(type => {
                  const count = kgData.nodes.filter(n => n.type === type).length;
                  const color = KG_COLORS.nodes[type as keyof typeof KG_COLORS.nodes];
                  return (
                    <button
                      key={type}
                      onClick={() => setKgNodeFilter(kgNodeFilter === type ? 'all' : type)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                        kgNodeFilter === type
                          ? 'bg-slate-700 text-white border-slate-500'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
                      }`}
                    >
                      {color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
                      {type.replace(/_/g, ' ')} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Knowledge Graph Viewer */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden mb-6 relative">
                <div className="absolute top-14 right-3 z-10">
                  <button
                    onClick={() => setKgFullscreen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-900/80 border border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-500 transition-colors backdrop-blur-sm"
                    title="Fullscreen view"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Fullscreen
                  </button>
                </div>
                <KnowledgeGraphViewer
                  data={kgNodeFilter === 'all' ? kgData : {
                    nodes: kgData.nodes.filter(n => n.type === kgNodeFilter),
                    edges: kgData.edges.filter(e => {
                      const filteredIds = new Set(kgData.nodes.filter(n => n.type === kgNodeFilter).map(n => n.id));
                      return filteredIds.has(e.source) && filteredIds.has(e.target);
                    }),
                    metadata: kgData.metadata,
                  }}
                  height={520}
                />
              </div>

              {/* Fullscreen KG Modal */}
              <AnimatePresence>
                {kgFullscreen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex flex-col"
                  >
                    {/* Fullscreen header */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/60 shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🕸️</span>
                        <h2 className="text-sm font-medium text-slate-200">Knowledge Graph</h2>
                        <span className="text-[10px] text-slate-500">
                          {kgData.nodes.length} nodes &middot; {kgData.edges.length} edges
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Node type filters in fullscreen */}
                        <div className="flex gap-1 mr-4">
                          <button
                            onClick={() => setKgNodeFilter('all')}
                            className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                              kgNodeFilter === 'all'
                                ? 'bg-purple-600 text-white border-purple-500'
                                : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300'
                            }`}
                          >
                            All
                          </button>
                          {Array.from(new Set(kgData.nodes.map(n => n.type))).sort().map(type => {
                            const color = KG_COLORS.nodes[type as keyof typeof KG_COLORS.nodes];
                            return (
                              <button
                                key={type}
                                onClick={() => setKgNodeFilter(kgNodeFilter === type ? 'all' : type)}
                                className={`px-2 py-1 text-[10px] rounded border transition-colors flex items-center gap-1 ${
                                  kgNodeFilter === type
                                    ? 'bg-slate-700 text-white border-slate-500'
                                    : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300'
                                }`}
                              >
                                {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                                {type.replace(/_/g, ' ')}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setKgFullscreen(false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Close
                        </button>
                      </div>
                    </div>
                    {/* Fullscreen graph */}
                    <div className="flex-1 min-h-0">
                      <KnowledgeGraphViewer
                        data={kgNodeFilter === 'all' ? kgData : {
                          nodes: kgData.nodes.filter(n => n.type === kgNodeFilter),
                          edges: kgData.edges.filter(e => {
                            const filteredIds = new Set(kgData.nodes.filter(n => n.type === kgNodeFilter).map(n => n.id));
                            return filteredIds.has(e.source) && filteredIds.has(e.target);
                          }),
                          metadata: kgData.metadata,
                        }}
                        height={typeof window !== 'undefined' ? window.innerHeight - 56 : 800}
                        className="w-full h-full"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Distributions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Node Type Distribution */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
                  <h2 className="text-sm font-medium text-slate-300 mb-3">Node Type Distribution</h2>
                  <div className="space-y-2.5">
                    {Object.entries(
                      kgData.nodes.reduce((acc, n) => {
                        acc[n.type] = (acc[n.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).sort(([,a], [,b]) => b - a).map(([type, count]) => {
                      const color = KG_COLORS.nodes[type as keyof typeof KG_COLORS.nodes] || '#68B7F7';
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-slate-400 text-xs w-32 truncate">{type.replace(/_/g, ' ')}</span>
                          <div className="flex-1 bg-slate-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${(count / kgData.nodes.length) * 100}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-slate-400 text-xs w-10 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Edge Type Distribution */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
                  <h2 className="text-sm font-medium text-slate-300 mb-3">Edge Type Distribution</h2>
                  <div className="space-y-2.5">
                    {Object.entries(
                      kgData.edges.reduce((acc, e) => {
                        acc[e.type] = (acc[e.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).sort(([,a], [,b]) => b - a).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs w-32 truncate">{type.replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${(count / kgData.edges.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-xs w-10 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-500">
              Knowledge Graph not available. Ensure the ontology system is running.
            </div>
          )}
        </>
      )}

      {/* ===== LEARNING & FEEDBACK TAB ===== */}
      {activeTab === 'learning' && (
        <>
          {/* Learning Pipeline */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-medium text-slate-300 mb-4">Ontology Learning Pipeline</h2>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
              {[
                { label: 'Query', icon: '💬', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' },
                { label: 'KG Analysis', icon: '🕸️', color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30' },
                { label: 'Agent Selection', icon: '🎯', color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30' },
                { label: 'Execution', icon: '⚡', color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30' },
                { label: 'Feedback', icon: '📊', color: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30' },
                { label: 'KG Update', icon: '🔄', color: 'from-pink-500/20 to-pink-600/20 border-pink-500/30' },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div className={`flex flex-col items-center gap-2 px-3 py-3 rounded-lg bg-gradient-to-br ${step.color} border min-w-[100px]`}>
                    <span className="text-xl">{step.icon}</span>
                    <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <svg className="w-6 h-6 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Learning Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Feedback Stored"
              value={stats?.feedback_stored || 0}
              sub="total feedback entries"
              color="text-cyan-400"
            />
            <MetricCard
              label="KG Assisted"
              value={stats?.graph_assisted || 0}
              sub={total > 0 ? `${((stats?.graph_assisted || 0) / total * 100).toFixed(1)}% of selections` : 'N/A'}
              color="text-purple-400"
            />
            <MetricCard
              label="GNN+RL Direct"
              value={stats?.gnn_rl_selections || 0}
              sub={total > 0 ? `${((stats?.gnn_rl_selections || 0) / total * 100).toFixed(1)}% hit rate` : 'N/A'}
              color="text-emerald-400"
            />
            <MetricCard
              label="Training Steps"
              value={stats?.ml_stats?.training_steps || 0}
              sub={stats?.ml_stats?.last_train_loss != null ? `last loss: ${stats.ml_stats.last_train_loss.toFixed(4)}` : 'not yet trained'}
              color="text-amber-400"
            />
          </div>

          {/* Recent Feedback Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-medium text-slate-300 mb-3">
              Recent Learning Events
              <span className="text-xs text-slate-500 ml-2">
                (selections with feedback data)
              </span>
            </h2>

            {(() => {
              const feedbackRecords = (stats?.selection_history || []).filter(r => r.feedback);
              if (feedbackRecords.length === 0) {
                return <p className="text-slate-500 text-sm py-4 text-center">No feedback data yet. Run queries to generate learning events.</p>;
              }
              return (
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-slate-400 border-b border-slate-700/50 sticky top-0 bg-slate-800/90">
                      <tr>
                        <th className="text-left py-2 pr-3 font-medium">Status</th>
                        <th className="text-left py-2 pr-3 font-medium">Agent</th>
                        <th className="text-left py-2 pr-3 font-medium">Category</th>
                        <th className="text-left py-2 pr-3 font-medium">Pattern</th>
                        <th className="text-right py-2 pr-3 font-medium">EMA Rate</th>
                        <th className="text-center py-2 font-medium">KG Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {[...feedbackRecords].reverse().slice(0, 30).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedRecord(r)}>
                          <td className="py-2 pr-3">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.feedback?.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-slate-300">{r.selected_agent}</td>
                          <td className="py-2 pr-3 text-xs text-slate-400">{r.feedback?.query_semantics?.category || '-'}</td>
                          <td className="py-2 pr-3 text-xs text-cyan-400 font-mono max-w-[200px] truncate" title={r.feedback?.query_semantics?.generalization_pattern}>
                            {r.feedback?.query_semantics?.generalization_pattern || '-'}
                          </td>
                          <td className="py-2 pr-3 text-right text-xs">
                            {r.feedback?.ema_success_rate != null ? (
                              <span className={r.feedback.ema_success_rate >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
                                {(r.feedback.ema_success_rate * 100).toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 text-center text-xs">
                            {r.feedback?.kg_nodes_updated
                              ? <span className="text-purple-400">Yes</span>
                              : <span className="text-slate-600">No</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Category Success Rates */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-3">Category Success Rates</h2>
            {(() => {
              const feedbackRecords = (stats?.selection_history || []).filter(r => r.feedback?.query_semantics?.category);
              const categoryMap: Record<string, { success: number; total: number }> = {};
              feedbackRecords.forEach(r => {
                const cat = r.feedback!.query_semantics.category;
                if (!categoryMap[cat]) categoryMap[cat] = { success: 0, total: 0 };
                categoryMap[cat].total++;
                if (r.feedback!.success) categoryMap[cat].success++;
              });

              const entries = Object.entries(categoryMap).sort(([,a], [,b]) => b.total - a.total);
              if (entries.length === 0) {
                return <p className="text-slate-500 text-sm py-4 text-center">No category data available yet.</p>;
              }

              return (
                <div className="space-y-3">
                  {entries.map(([cat, { success, total }]) => {
                    const rate = total > 0 ? success / total : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs w-28 truncate capitalize">{cat}</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              rate >= 0.8 ? 'bg-emerald-500' : rate >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${rate * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right">
                          {success}/{total} ({(rate * 100).toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {selectedRecord && (
            <SelectionDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-slate-600">
        HybridAgentSelector v{stats?.version || '?'} | Buffer: {bufferSize} experiences
        {stats?.ml_stats?.last_train_loss != null && (
          <> | Last loss: {stats.ml_stats.last_train_loss.toFixed(4)}</>
        )}
      </div>
    </div>
  );
}
