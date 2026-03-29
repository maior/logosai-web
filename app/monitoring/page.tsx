'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/utils/cn';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface ServiceInfo {
  name: string;
  url: string;
  status: 'running' | 'stopped' | 'error';
  http_code: number;
  response_time_ms?: number;
  error?: string;
}

interface MonitoringData {
  timestamp: string;
  uptime: string;
  uptime_seconds: number;
  services: ServiceInfo[];
}

interface LogEntry {
  service: string;
  line: string;
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'all';
type ServiceFilter = 'all' | 'acp' | 'api' | 'web';

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

const SVC_META: Record<string, { label: string; color: string; dot: string; port: number }> = {
  acp:  { label: 'ACP Server',  color: 'emerald', dot: 'bg-emerald-400', port: 8888 },
  api:  { label: 'logos_api',   color: 'blue',    dot: 'bg-blue-400',    port: 8090 },
  web:  { label: 'logos_web',   color: 'violet',  dot: 'bg-violet-400',  port: 8010 },
  forge:{ label: 'FORGE',       color: 'amber',   dot: 'bg-amber-400',   port: 8030 },
};

const LEVEL_COLORS: Record<string, { text: string; bg: string }> = {
  error: { text: 'text-red-400',    bg: 'bg-red-500/6' },
  warn:  { text: 'text-amber-400',  bg: 'bg-amber-500/5' },
  info:  { text: 'text-slate-400',  bg: '' },
  debug: { text: 'text-slate-600',  bg: '' },
};

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function detectLevel(line: string): string {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('CRITICAL') || upper.includes('EXCEPTION') || upper.includes('Traceback')) return 'error';
  if (upper.includes('WARN')) return 'warn';
  if (upper.includes('DEBUG')) return 'debug';
  return 'info';
}

function extractTime(line: string): string {
  const m = line.match(/(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function mapServiceName(name: string): string {
  if (name.includes('ACP') || name.toLowerCase() === 'acp') return 'acp';
  if (name.includes('api') || name.toLowerCase() === 'api') return 'api';
  if (name.includes('web') || name.toLowerCase() === 'web') return 'web';
  if (name.includes('FORGE') || name.toLowerCase() === 'forge') return 'forge';
  return name.toLowerCase();
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const [svcFilter, setSvcFilter] = useState<ServiceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Data Fetching ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/monitoring/services`);
      if (res.ok) { setData(await res.json()); setError(null); }
    } catch { setError('Cannot connect to logos_api'); }
  }, []);

  // ── SSE Streaming ──
  const startStreaming = useCallback(() => {
    eventSourceRef.current?.close();
    try {
      const es = new EventSource(`${API_URL}/api/v1/monitoring/logs/stream`);
      es.onmessage = (event) => {
        try {
          const entry: LogEntry = JSON.parse(event.data);
          setStreamLogs(prev => {
            const next = [...prev, entry];
            return next.length > 1000 ? next.slice(-800) : next;
          });
        } catch { /* heartbeat */ }
      };
      es.onerror = () => setIsStreaming(false);
      es.onopen = () => setIsStreaming(true);
      eventSourceRef.current = es;
    } catch { setIsStreaming(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    startStreaming();
    return () => { eventSourceRef.current?.close(); };
  }, [startStreaming]);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs, autoScroll]);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // ── Scroll detection for auto-scroll toggle ──
  const handleLogScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isNearBottom);
  }, []);

  // ── Filtered + Searched Logs ──
  const filteredLogs = useMemo(() => {
    return streamLogs.filter(entry => {
      if (svcFilter !== 'all' && entry.service !== svcFilter) return false;
      if (levelFilter !== 'all' && detectLevel(entry.line) !== levelFilter) return false;
      if (searchQuery && !entry.line.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [streamLogs, svcFilter, levelFilter, searchQuery]);

  // ── Log level counts ──
  const levelCounts = useMemo(() => {
    const c = { error: 0, warn: 0, info: 0, debug: 0 };
    const source = svcFilter === 'all' ? streamLogs : streamLogs.filter(e => e.service === svcFilter);
    source.forEach(e => { const l = detectLevel(e.line); if (l in c) c[l as keyof typeof c]++; });
    return c;
  }, [streamLogs, svcFilter]);

  // ── Service counts ──
  const svcCounts = useMemo(() => {
    const c: Record<string, number> = {};
    streamLogs.forEach(e => { c[e.service] = (c[e.service] || 0) + 1; });
    return c;
  }, [streamLogs]);

  const running = data?.services.filter(s => s.status === 'running').length || 0;
  const total = data?.services.length || 0;

  return (
    <div className="h-screen bg-[#080C14] text-slate-300 flex flex-col overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <header className="border-b border-slate-800/40 bg-[#0A0F1A]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm font-light text-slate-400 hover:text-white transition-colors">LogosAI</a>
            <svg className="w-3.5 h-3.5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
            <span className="text-sm text-slate-200 font-medium">System Monitor</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border",
              isStreaming ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20" : "bg-red-500/8 text-red-400 border-red-500/20"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isStreaming ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
              {isStreaming ? 'LIVE' : 'OFFLINE'}
            </div>
            {data && <span className="text-[10px] text-slate-600">{data.uptime}</span>}
            <a href="/admin" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">Admin</a>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] mx-auto w-full px-5 py-4 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* ═══ Error ═══ */}
        {error && !fullscreen && (
          <div className="px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400 text-xs shrink-0">{error}</div>
        )}

        {/* ═══ Service Cards Row ═══ */}
        <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0", fullscreen && "hidden")}>
          {data?.services.map((svc) => {
            const key = mapServiceName(svc.name);
            const meta = SVC_META[key] || { label: svc.name, color: 'slate', dot: 'bg-slate-400', port: 0 };
            const up = svc.status === 'running';
            return (
              <button key={svc.name} onClick={() => setSvcFilter(key === svcFilter ? 'all' : key as ServiceFilter)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all relative overflow-hidden group",
                  svcFilter === key ? `ring-1 ring-${meta.color}-500/30` : '',
                  up ? "bg-slate-900/40 border-slate-800/50 hover:border-slate-700/60" : "bg-red-950/10 border-red-500/15"
                )}>
                {/* Subtle gradient accent */}
                <div className={cn("absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.06]",
                  up ? `bg-gradient-to-br from-${meta.color}-500 to-transparent` : 'bg-gradient-to-br from-red-500 to-transparent'
                )} />
                <div className="relative flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", up ? meta.dot : "bg-red-400",
                      up && "shadow-[0_0_6px_rgba(16,185,129,0.4)]")} />
                    <span className="text-sm font-medium text-slate-200">{meta.label}</span>
                  </div>
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded",
                    up ? "text-emerald-400/70 bg-emerald-500/8" : "text-red-400/70 bg-red-500/8"
                  )}>
                    {up ? `${svc.response_time_ms}ms` : 'DOWN'}
                  </span>
                </div>
                <div className="relative flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-mono">:{meta.port}</span>
                  <span>{svcCounts[key] || 0} logs</span>
                </div>
              </button>
            );
          })}
          {!data && !error && [1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-slate-800/30 bg-slate-900/20 p-4 animate-pulse">
              <div className="h-3 bg-slate-800/50 rounded w-20 mb-3" /><div className="h-2 bg-slate-800/30 rounded w-16" />
            </div>
          ))}
        </div>

        {/* ═══ Log Panel ═══ */}
        <div className="flex-1 rounded-xl border border-slate-800/40 bg-[#0A0E17] flex flex-col overflow-hidden min-h-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/30 bg-slate-900/30 shrink-0 flex-wrap">
            {/* Service tabs */}
            <div className="flex items-center bg-slate-800/30 rounded-lg p-0.5">
              {(['all', 'acp', 'api', 'web'] as const).map(tab => {
                const meta = SVC_META[tab];
                const active = svcFilter === tab;
                return (
                  <button key={tab} onClick={() => setSvcFilter(tab)}
                    className={cn("px-2.5 py-1 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                      active ? "bg-slate-700/80 text-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-300"
                    )}>
                    {meta && <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />}
                    {tab === 'all' ? 'All' : tab.toUpperCase()}
                    {tab !== 'all' && svcCounts[tab] ? <span className="text-slate-600 ml-0.5">{svcCounts[tab]}</span> : null}
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-slate-800/50" />

            {/* Level filters */}
            <div className="flex items-center gap-1">
              {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => {
                const active = levelFilter === level;
                const count = level === 'all' ? null : levelCounts[level];
                const lc = LEVEL_COLORS[level];
                return (
                  <button key={level} onClick={() => setLevelFilter(level)}
                    className={cn("px-2 py-1 text-[10px] rounded-md transition-all",
                      active ? "bg-slate-700/60 text-slate-200" : "text-slate-600 hover:text-slate-400"
                    )}>
                    {level === 'all' ? 'ALL' : level.toUpperCase()}
                    {count !== null && count > 0 && (
                      <span className={cn("ml-1", level === 'error' ? 'text-red-400' : level === 'warn' ? 'text-amber-400' : 'text-slate-600')}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-slate-800/50" />

            {/* Search */}
            <div className="relative flex-1 min-w-[140px] max-w-[280px]">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-[11px] bg-slate-800/30 border border-slate-800/40 rounded-md text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600/60 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Controls */}
            <span className="text-[9px] text-slate-600 font-mono">{filteredLogs.length} / {streamLogs.length}</span>
            <button onClick={() => { setAutoScroll(true); logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
              className={cn("text-[10px] px-2 py-1 rounded-md transition-colors",
                autoScroll ? "text-emerald-500/60" : "text-slate-600 hover:text-slate-400 bg-slate-800/30"
              )}>
              {autoScroll ? 'Auto-scroll' : 'Paused'}
            </button>
            <button onClick={() => setFullscreen(f => !f)}
              className={cn("text-[10px] px-2 py-1 rounded-md transition-colors",
                fullscreen ? "text-blue-400 bg-blue-500/10" : "text-slate-600 hover:text-slate-400 bg-slate-800/30 hover:bg-slate-800/50"
              )} title={fullscreen ? "Exit fullscreen" : "Fullscreen logs"}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {fullscreen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                }
              </svg>
            </button>
            <button onClick={() => setStreamLogs([])}
              className="text-[10px] text-slate-600 hover:text-slate-400 px-2 py-1 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
              Clear
            </button>
          </div>

          {/* Log Content */}
          <div ref={logContainerRef} onScroll={handleLogScroll}
            className="flex-1 overflow-y-auto font-mono text-[11px] leading-[18px] min-h-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1E293B transparent' }}>
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
                <svg className="w-6 h-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-[11px]">{isStreaming ? 'Waiting for new log entries...' : 'Connecting...'}</p>
              </div>
            ) : (
              <div className="p-1">
                {filteredLogs.map((entry, i) => {
                  const level = detectLevel(entry.line);
                  const lc = LEVEL_COLORS[level] || LEVEL_COLORS.info;
                  const meta = SVC_META[entry.service];
                  const time = extractTime(entry.line);
                  const isErr = level === 'error';
                  const isWarn = level === 'warn';

                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-0 px-2 py-[2px] rounded-sm transition-colors hover:bg-white/[0.02]",
                      lc.bg,
                      isErr && "border-l-2 border-red-500/30",
                      isWarn && "border-l-2 border-amber-500/20",
                    )}>
                      {/* Service badge */}
                      <span className={cn("w-7 shrink-0 text-[9px] font-bold tracking-wider pt-[2px]",
                        meta ? `text-${meta.color}-400/70` : 'text-slate-600'
                      )}>
                        {entry.service.toUpperCase().slice(0, 3)}
                      </span>
                      {/* Time */}
                      <span className="w-16 shrink-0 text-slate-600 text-[10px]">{time}</span>
                      {/* Level indicator */}
                      <span className={cn("w-1 h-1 rounded-full mt-[7px] mx-1.5 shrink-0",
                        isErr ? 'bg-red-400' : isWarn ? 'bg-amber-400' : level === 'debug' ? 'bg-slate-700' : 'bg-slate-600/40'
                      )} />
                      {/* Content */}
                      <span className={cn("flex-1 break-all whitespace-pre-wrap", lc.text,
                        searchQuery && "leading-relaxed"
                      )}>
                        {searchQuery ? (() => {
                          const idx = entry.line.toLowerCase().indexOf(searchQuery.toLowerCase());
                          if (idx === -1) return entry.line;
                          return <>{entry.line.slice(0, idx)}<mark className="bg-amber-500/20 text-amber-300 rounded-sm px-0.5">{entry.line.slice(idx, idx + searchQuery.length)}</mark>{entry.line.slice(idx + searchQuery.length)}</>;
                        })() : entry.line}
                      </span>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="shrink-0 px-3 py-1.5 border-t border-slate-800/30 bg-slate-900/20 flex items-center justify-between text-[9px] text-slate-600">
            <div className="flex items-center gap-3">
              <span>{running}/{total} services up</span>
              <span>|</span>
              <span className="text-red-400/60">{levelCounts.error} errors</span>
              <span className="text-amber-400/60">{levelCounts.warn} warnings</span>
            </div>
            <div className="flex items-center gap-2">
              {svcFilter !== 'all' && <span>Filtered: {svcFilter.toUpperCase()}</span>}
              {levelFilter !== 'all' && <span>Level: {levelFilter.toUpperCase()}</span>}
              {searchQuery && <span>Search: &quot;{searchQuery}&quot;</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
