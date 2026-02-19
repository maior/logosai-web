'use client';

import React, { useState } from 'react';
import { X, Download, Search } from 'lucide-react';
import { KnowledgeGraphData } from '@/utils/streaming';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { KnowledgeGraphViewer, NEO4J_COLORS, getNodeColor } from './KnowledgeGraphViewer';

interface KnowledgeGraphPopupProps {
  data: KnowledgeGraphData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeGraphPopup({ data, isOpen, onClose }: KnowledgeGraphPopupProps) {
  const [viewMode, setViewMode] = useState<'graph' | 'nodes' | 'edges' | 'stats'>('graph');
  const [searchQuery, setSearchQuery] = useState('');

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
              {/* Graph View — delegated to KnowledgeGraphViewer */}
              {viewMode === 'graph' && (
                <div className="flex-1">
                  <KnowledgeGraphViewer
                    data={data}
                    className="w-full h-full"
                  />
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
