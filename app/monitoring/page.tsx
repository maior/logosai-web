'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/utils/cn';

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
  timestamp?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  acp: 'text-emerald-400',
  api: 'text-blue-400',
  web: 'text-purple-400',
};

const SERVICE_BG: Record<string, string> = {
  acp: 'bg-emerald-500/10 border-emerald-500/20',
  api: 'bg-blue-500/10 border-blue-500/20',
  web: 'bg-purple-500/10 border-purple-500/20',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'acp' | 'api' | 'web'>('all');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch service status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/monitoring/services`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      }
    } catch (e) {
      setError('Cannot connect to logos_api');
    }
  }, []);

  // Fetch recent logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/monitoring/logs?lines=100`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || {});
      }
    } catch {
      // Ignore — status already shows connection error
    }
  }, []);

  // Start SSE log streaming
  const startStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(`${API_URL}/api/v1/monitoring/logs/stream`);
      es.onmessage = (event) => {
        try {
          const entry: LogEntry = JSON.parse(event.data);
          setStreamLogs((prev) => {
            const updated = [...prev, entry];
            return updated.slice(-500); // Keep last 500 lines
          });
        } catch {
          // Ignore heartbeats
        }
      };
      es.onerror = () => {
        setIsStreaming(false);
      };
      es.onopen = () => {
        setIsStreaming(true);
      };
      eventSourceRef.current = es;
    } catch {
      setIsStreaming(false);
    }
  }, []);

  // Auto-refresh status every 5 seconds
  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      if (!isStreaming) fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchLogs, isStreaming]);

  // Start streaming on mount
  useEffect(() => {
    startStreaming();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [startStreaming]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs, logs]);

  const getFilteredLogs = (): LogEntry[] => {
    if (isStreaming && streamLogs.length > 0) {
      if (activeTab === 'all') return streamLogs;
      return streamLogs.filter((l) => l.service === activeTab);
    }

    // Fall back to polled logs
    const entries: LogEntry[] = [];
    const services = activeTab === 'all' ? Object.keys(logs) : [activeTab];
    for (const svc of services) {
      if (logs[svc]) {
        for (const line of logs[svc]) {
          entries.push({ service: svc, line });
        }
      }
    }
    return entries.slice(-200);
  };

  const filteredLogs = getFilteredLogs();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header */}
      <header className="border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-lg font-light text-slate-300 hover:text-white transition-colors">
              LogosAI
            </a>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-medium text-slate-400">Monitor</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              isStreaming
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isStreaming ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              )} />
              {isStreaming ? 'Live' : 'Disconnected'}
            </div>
            {data && (
              <span className="text-xs text-slate-500">
                Uptime: {data.uptime}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.services.map((svc) => (
            <div
              key={svc.name}
              className={cn(
                "rounded-xl border p-5 transition-all",
                svc.status === 'running'
                  ? "bg-slate-900/50 border-slate-700/50"
                  : "bg-red-950/20 border-red-500/20"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-slate-200">{svc.name}</span>
                <span className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                  svc.status === 'running'
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    svc.status === 'running' ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  {svc.status}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>URL</span>
                  <span className="text-slate-400 font-mono">{svc.url}</span>
                </div>
                <div className="flex justify-between">
                  <span>HTTP</span>
                  <span className={cn(
                    "font-mono",
                    svc.http_code >= 200 && svc.http_code < 400 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {svc.http_code || '-'}
                  </span>
                </div>
                {svc.response_time_ms !== undefined && (
                  <div className="flex justify-between">
                    <span>Response</span>
                    <span className="text-slate-400 font-mono">{svc.response_time_ms}ms</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* If no data yet, show skeleton */}
          {!data && !error && [1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-5 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-24 mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-800 rounded w-full" />
                <div className="h-3 bg-slate-800 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Logs Panel */}
        <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 overflow-hidden">
          {/* Log Tabs */}
          <div className="flex items-center border-b border-slate-800/50 px-4">
            {(['all', 'acp', 'api', 'web'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-3 text-xs font-medium transition-colors relative",
                  activeTab === tab
                    ? "text-slate-200"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <span className="flex items-center gap-2">
                  {tab !== 'all' && (
                    <span className={cn("w-2 h-2 rounded-full", {
                      "bg-emerald-400": tab === 'acp',
                      "bg-blue-400": tab === 'api',
                      "bg-purple-400": tab === 'web',
                    })} />
                  )}
                  {tab === 'all' ? 'All Services' : tab.toUpperCase()}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                )}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-slate-600 font-mono">
              {filteredLogs.length} lines
            </span>
          </div>

          {/* Log Content */}
          <div className="h-[50vh] overflow-y-auto font-mono text-[12px] leading-5 p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-600">
                {isStreaming ? 'Waiting for log output...' : 'No logs available'}
              </div>
            ) : (
              filteredLogs.map((entry, i) => (
                <div key={i} className="flex hover:bg-slate-800/30 px-2 py-0.5 rounded">
                  <span className={cn(
                    "w-8 flex-shrink-0 font-semibold",
                    SERVICE_COLORS[entry.service] || 'text-slate-500'
                  )}>
                    {entry.service.toUpperCase().slice(0, 3)}
                  </span>
                  <span className="text-slate-600 mx-2">│</span>
                  <span className="text-slate-400 break-all whitespace-pre-wrap">{entry.line}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
