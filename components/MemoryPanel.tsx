'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Memory } from '@/types';
import { getMemories, createMemory, updateMemory, deleteMemory } from '@/utils/api';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MEMORY_TYPES = ['all', 'fact', 'preference', 'context', 'instruction'] as const;

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fact: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  preference: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  context: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  instruction: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
};

function ImportanceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < filled ? 'bg-slate-400' : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.fact;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
    >
      {type}
    </span>
  );
}

export function MemoryPanel({ isOpen, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<string>('fact');
  const [newImportance, setNewImportance] = useState(0.5);

  // Load memories when panel opens
  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  const loadMemories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      setError('Failed to load memories');
      console.error('[MemoryPanel] Load error:', err);
    }
    setIsLoading(false);
  };

  const filtered = filter === 'all'
    ? memories
    : memories.filter((m) => m.memory_type === filter);

  // Edit
  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
  };

  const saveEdit = async (id: string) => {
    try {
      const updated = await updateMemory(id, { content: editContent });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingId(null);
    } catch (err) {
      console.error('[MemoryPanel] Update error:', err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // Delete with 2-click confirmation
  const handleDelete = useCallback(async (id: string) => {
    if (confirmDeleteId !== id) {
      // First click — show "Confirm?"
      setConfirmDeleteId(id);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    // Second click — delete
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('[MemoryPanel] Delete error:', err);
    }
  }, [confirmDeleteId]);

  // Create
  const handleCreate = async () => {
    if (!newContent.trim()) return;
    try {
      const created = await createMemory({
        content: newContent.trim(),
        memory_type: newType,
        importance: newImportance,
      });
      setMemories((prev) => [created, ...prev]);
      setNewContent('');
      setNewType('fact');
      setNewImportance(0.5);
      setShowCreate(false);
    } catch (err) {
      console.error('[MemoryPanel] Create error:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-800 z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-200">Memories</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-slate-800/50 overflow-x-auto">
          {MEMORY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
                filter === type
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={loadMemories}
                className="mt-2 text-xs text-slate-500 hover:text-slate-400"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-600 py-8">
              {filter === 'all' ? 'No memories yet' : `No ${filter} memories`}
            </p>
          ) : (
            filtered.map((memory) => (
              <div
                key={memory.id}
                className="rounded-lg border border-slate-800 p-3 group hover:border-slate-700 transition-colors"
              >
                {/* Top row: badge + date + actions */}
                <div className="flex items-center justify-between mb-1.5">
                  <TypeBadge type={memory.memory_type} />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600">
                      {formatDate(memory.created_at)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(memory)}
                        className="p-0.5 text-slate-600 hover:text-slate-400"
                        title="Edit"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        className={`p-0.5 transition-colors ${
                          confirmDeleteId === memory.id
                            ? 'text-red-400'
                            : 'text-slate-600 hover:text-red-400'
                        }`}
                        title={confirmDeleteId === memory.id ? 'Confirm delete' : 'Delete'}
                      >
                        {confirmDeleteId === memory.id ? (
                          <span className="text-[10px] font-medium">Confirm?</span>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                {editingId === memory.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-slate-800 text-sm text-slate-300 rounded px-2 py-1.5 border border-slate-700 focus:border-slate-600 focus:outline-none resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(memory.id)}
                        className="px-2 py-1 text-[11px] bg-slate-700 text-slate-200 rounded hover:bg-slate-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-3">
                    {memory.content}
                  </p>
                )}

                {/* Bottom: importance */}
                <div className="flex items-center justify-between mt-2">
                  <ImportanceDots value={memory.importance} />
                  {memory.category && (
                    <span className="text-[10px] text-slate-600">{memory.category}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="border-t border-slate-800 px-3 py-3 space-y-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full bg-slate-800 text-sm text-slate-300 rounded px-2 py-1.5 border border-slate-700 focus:outline-none"
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="context">Context</option>
              <option value="instruction">Instruction</option>
            </select>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What should I remember?"
              className="w-full bg-slate-800 text-sm text-slate-300 rounded px-2 py-1.5 border border-slate-700 focus:border-slate-600 focus:outline-none resize-none placeholder:text-slate-600"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-slate-500">Importance</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={newImportance}
                onChange={(e) => setNewImportance(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-slate-500"
              />
              <span className="text-[11px] text-slate-500 w-6 text-right">
                {Math.round(newImportance * 100)}%
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newContent.trim()}
                className="px-3 py-1.5 text-xs bg-slate-200 text-slate-900 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800">
          <span className="text-[11px] text-slate-600">
            {filtered.length} {filtered.length === 1 ? 'memory' : 'memories'}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showCreate ? 'Close' : '+ Add Memory'}
          </button>
        </div>
      </div>
    </>
  );
}
