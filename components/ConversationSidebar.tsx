'use client';

import { useState, useMemo } from 'react';
import { Session } from '@/types';
import { cn } from '@/utils/cn';

interface ConversationSidebarProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelectSession: (session: Session) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  isLoading?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateGroup(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'Previous 7 Days';
  return 'Older';
}

interface GroupedSessions {
  [key: string]: Session[];
}

export function ConversationSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isLoading = false,
  isOpen,
  onToggle,
}: ConversationSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: GroupedSessions = {};
    const order = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

    sessions.forEach(session => {
      const group = getDateGroup(session.last_message_at || session.updated_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(session);
    });

    // Return in order
    const orderedGroups: GroupedSessions = {};
    order.forEach(key => {
      if (groups[key]) orderedGroups[key] = groups[key];
    });
    return orderedGroups;
  }, [sessions]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (deleteConfirm === sessionId) {
      // Second click - actually delete
      setDeletingId(sessionId);
      setDeleteConfirm(null);
      try {
        await onDeleteSession?.(sessionId);
      } finally {
        setDeletingId(null);
      }
    } else {
      // First click - show confirmation
      setDeleteConfirm(sessionId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <>
      {/* Toggle button - floating pill design */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed top-[4.5rem] z-40 transition-all duration-300 ease-out",
          "flex items-center justify-center",
          "w-6 h-12 rounded-r-full",
          "bg-slate-800/90 backdrop-blur-sm",
          "border border-slate-700/50 border-l-0",
          "text-slate-400 hover:text-slate-200",
          "hover:bg-slate-700/90 hover:w-8",
          "shadow-lg shadow-black/20",
          isOpen ? "left-72" : "left-0"
        )}
        title={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-12 left-0 h-[calc(100vh-3rem)] z-30",
          "w-72 flex flex-col",
          "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
          "border-r border-slate-800/60",
          "transform transition-all duration-300 ease-out",
          "shadow-2xl shadow-black/40",
          isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        )}
      >
        {/* Header with gradient border */}
        <div className="relative px-4 py-4">
          <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

          <button
            onClick={onNewSession}
            className={cn(
              "w-full flex items-center justify-center gap-2.5",
              "px-4 py-3 rounded-xl",
              "bg-gradient-to-r from-indigo-600/20 to-purple-600/20",
              "hover:from-indigo-600/30 hover:to-purple-600/30",
              "border border-indigo-500/30 hover:border-indigo-500/50",
              "text-slate-200 hover:text-white",
              "transition-all duration-200",
              "shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20",
              "group"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-lg",
              "bg-gradient-to-br from-indigo-500 to-purple-500",
              "flex items-center justify-center",
              "group-hover:scale-110 transition-transform duration-200"
            )}>
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">New Conversation</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-8 h-8 border-2 border-slate-700 rounded-full" />
                <div className="absolute inset-0 w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="mt-3 text-slate-500 text-sm">Loading conversations...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl mb-4",
                "bg-gradient-to-br from-slate-800 to-slate-900",
                "border border-slate-700/50",
                "flex items-center justify-center"
              )}>
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-slate-400 text-sm font-medium">No conversations yet</p>
              <p className="text-slate-600 text-xs mt-1 text-center">
                Start a new conversation to begin exploring
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSessions).map(([group, groupSessions]) => (
                <div key={group}>
                  {/* Date group label */}
                  <div className="flex items-center gap-2 px-2 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {group}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-700/50 to-transparent" />
                  </div>

                  {/* Sessions in group */}
                  <ul className="space-y-1">
                    {groupSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const isHovered = hoveredId === session.id;
                      const isConfirming = deleteConfirm === session.id;
                      const isBeingDeleted = deletingId === session.id;

                      return (
                        <li key={session.id}>
                          <div
                            role="button"
                            tabIndex={isBeingDeleted ? -1 : 0}
                            onClick={() => !isBeingDeleted && onSelectSession(session)}
                            onKeyDown={(e) => e.key === 'Enter' && !isBeingDeleted && onSelectSession(session)}
                            onMouseEnter={() => setHoveredId(session.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={cn(
                              "w-full relative px-3 py-3 rounded-xl text-left",
                              "transition-all duration-200 ease-out",
                              "group",
                              isBeingDeleted
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer",
                              isActive && !isBeingDeleted
                                ? "bg-gradient-to-r from-slate-800 to-slate-800/80 shadow-lg shadow-black/20"
                                : !isBeingDeleted && "hover:bg-slate-800/50",
                              isConfirming && "ring-1 ring-red-500/50"
                            )}
                          >
                            {/* Deleting overlay */}
                            {isBeingDeleted && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-xl z-10">
                                <div className="flex items-center gap-2 text-red-400 text-xs">
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span>Deleting...</span>
                                </div>
                              </div>
                            )}

                            {/* Active indicator */}
                            {isActive && !isBeingDeleted && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                            )}

                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex-shrink-0",
                                "flex items-center justify-center",
                                "transition-all duration-200",
                                isActive
                                  ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400"
                                  : "bg-slate-800/50 text-slate-500 group-hover:text-slate-400"
                              )}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pr-6">
                                <p className={cn(
                                  "text-sm font-medium truncate leading-tight",
                                  isActive ? "text-slate-100" : "text-slate-300 group-hover:text-slate-200"
                                )}>
                                  {session.title || 'New conversation'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className={cn(
                                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    isActive
                                      ? "bg-indigo-500/20 text-indigo-300"
                                      : "bg-slate-700/50 text-slate-500"
                                  )}>
                                    {session.message_count} msg
                                  </span>
                                  <span className="text-[10px] text-slate-600">
                                    {formatRelativeTime(session.last_message_at || session.updated_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delete button - hidden when being deleted */}
                            {onDeleteSession && !isBeingDeleted && (
                              <button
                                onClick={(e) => handleDelete(e, session.id)}
                                className={cn(
                                  "absolute right-2 top-1/2 -translate-y-1/2 z-20",
                                  "w-7 h-7 rounded-lg",
                                  "flex items-center justify-center",
                                  "transition-all duration-200",
                                  isHovered || isConfirming ? "opacity-100" : "opacity-0",
                                  isConfirming
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                                )}
                                title={isConfirming ? "Click again to confirm" : "Delete conversation"}
                              >
                                {isConfirming ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.5}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-4 py-3">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500">
                {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-[10px] text-slate-600 font-medium">
              LogosAI
            </span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
