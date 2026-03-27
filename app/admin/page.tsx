'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';

// ══════════════════════════════════════════════════════════════
// Access Control
// ══════════════════════════════════════════════════════════════

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'team';
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const PERSONAL_EMAIL = process.env.NEXT_PUBLIC_PERSONAL_USER_EMAIL || '';
const ACP_URL = 'http://localhost:8888';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface AgentInfo { agent_id: string; name: string; type: string; description: string; }
interface ServerInfo { version: string; uptime: string; num_agents: number; auto_agent_selection: boolean; }
interface FailureStats { [agentId: string]: { total: number; success: number; failure: number; success_rate: number; }; }
interface ServiceStatus { name: string; port: number; status: 'up' | 'down' | 'checking'; responseTime?: number; }

type Tab = 'overview' | 'agents' | 'services';

// ══════════════════════════════════════════════════════════════
// Components
// ══════════════════════════════════════════════════════════════

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ServiceDot({ status }: { status: 'up' | 'down' | 'checking' }) {
  const colors = { up: 'bg-emerald-500', down: 'bg-red-500', checking: 'bg-amber-500 animate-pulse' };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

function AgentRow({ agent, stats }: { agent: AgentInfo; stats?: FailureStats[string] }) {
  const rate = stats ? stats.success_rate : null;
  const rateColor = rate === null ? 'text-slate-600' : rate >= 90 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-200 font-medium">{agent.agent_id}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{agent.type}</span>
        </div>
        {agent.name && agent.name !== agent.agent_id && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{agent.name}</p>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {stats && (
          <span className="text-xs text-slate-500">{stats.total} calls</span>
        )}
        <span className={`text-sm font-mono ${rateColor}`}>
          {rate !== null ? `${rate.toFixed(0)}%` : '—'}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Access Denied
// ══════════════════════════════════════════════════════════════

function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-slate-400">You don&apos;t have permission to access the admin dashboard.</p>
        <a href="/" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">Back to Home</a>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Dashboard
// ══════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [failureStats, setFailureStats] = useState<FailureStats>({});
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Access Control ──
  const isPersonalMode = AUTH_MODE === 'personal';
  const userEmail = isPersonalMode ? PERSONAL_EMAIL : session?.user?.email || '';

  const hasAccess = isPersonalMode
    ? true
    : (!!session && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(userEmail)));

  // ── Data Fetching ──
  const fetchData = useCallback(async () => {
    try {
      // ACP server info
      const infoResp = await fetch(`${ACP_URL}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_server_info' }),
      });
      if (infoResp.ok) {
        const infoData = await infoResp.json();
        setServerInfo(infoData.result);
      }

      // Agent list
      const agentResp = await fetch(`${ACP_URL}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'list_agents' }),
      });
      if (agentResp.ok) {
        const agentData = await agentResp.json();
        setAgents(agentData.result?.agents || []);
      }

      // Failure stats
      try {
        const statsResp = await fetch(`${ACP_URL}/api/failures/stats`);
        if (statsResp.ok) setFailureStats(await statsResp.json());
      } catch { /* not critical */ }

      // Service health checks
      const svcChecks: ServiceStatus[] = [
        { name: 'ACP Server', port: 8888, status: 'checking' },
        { name: 'logos_api', port: 8090, status: 'checking' },
        { name: 'logos_web', port: 8010, status: 'checking' },
        { name: 'FORGE', port: 8030, status: 'checking' },
      ];

      const checked = await Promise.all(svcChecks.map(async (svc) => {
        try {
          const start = Date.now();
          const url = svc.port === 8888
            ? `${ACP_URL}/jsonrpc`
            : `http://localhost:${svc.port}/health`;
          const opts: RequestInit = svc.port === 8888
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'get_server_info' }) }
            : {};
          const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(5000) });
          return { ...svc, status: r.ok ? 'up' as const : 'down' as const, responseTime: Date.now() - start };
        } catch {
          return { ...svc, status: 'down' as const };
        }
      }));
      setServices(checked);
    } catch (e) {
      console.error('Admin fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [hasAccess, fetchData]);

  // ── Auth Loading ──
  if (!isPersonalMode && status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) return <AccessDenied />;

  // ── Stats ──
  const totalCalls = Object.values(failureStats).reduce((s, v) => s + v.total, 0);
  const totalFailures = Object.values(failureStats).reduce((s, v) => s + v.failure, 0);
  const overallRate = totalCalls > 0 ? ((totalCalls - totalFailures) / totalCalls * 100) : 0;
  const servicesUp = services.filter(s => s.status === 'up').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <h1 className="text-base font-light">
              <span className="text-slate-400">LogosAI</span>
              <span className="text-slate-700 mx-2">/</span>
              <span className="text-slate-200">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{userEmail}</span>
            <span className="text-slate-700">|</span>
            <span>{AUTH_MODE} mode</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-slate-900/60 rounded-lg p-1 w-fit border border-slate-800/60">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'agents', label: `Agents (${agents.length})` },
            { id: 'services', label: 'Services' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                tab === t.id ? 'bg-slate-800 text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ═══ Overview ═══ */}
            {tab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                  <StatCard label="Services" value={`${servicesUp}/${services.length}`} sub="running" color={servicesUp === services.length ? 'text-emerald-400' : 'text-amber-400'} />
                  <StatCard label="Agents" value={agents.length} sub="registered" color="text-blue-400" />
                  <StatCard label="Total Calls" value={totalCalls} sub="all time" />
                  <StatCard label="Success Rate" value={`${overallRate.toFixed(0)}%`} color={overallRate >= 90 ? 'text-emerald-400' : 'text-amber-400'} />
                  <StatCard label="Failures" value={totalFailures} color={totalFailures > 0 ? 'text-red-400' : 'text-slate-400'} />
                  <StatCard label="Uptime" value={serverInfo?.uptime?.split('.')[0] || '—'} sub={serverInfo?.version || ''} />
                </div>

                {/* Services status */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 mb-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Services</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {services.map((svc) => (
                      <div key={svc.name} className="flex items-center justify-between rounded-lg border border-slate-800/40 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ServiceDot status={svc.status} />
                          <span className="text-sm text-slate-300">{svc.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500">:{svc.port}</span>
                          {svc.responseTime && (
                            <p className="text-[10px] text-slate-600">{svc.responseTime}ms</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Auto Reports', href: '/auto-reports', icon: '⏰' },
                    { label: 'Architecture', href: '/architecture', icon: '🏗️' },
                    { label: 'ML Dashboard', href: '/ml-dashboard', icon: '🧠' },
                    { label: 'Monitoring', href: '/monitoring', icon: '📊' },
                  ].map((link) => (
                    <a key={link.href} href={link.href}
                      className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 hover:bg-slate-800/30 transition-colors">
                      <span className="text-xl">{link.icon}</span>
                      <span className="text-sm text-slate-300">{link.label}</span>
                    </a>
                  ))}
                </div>

                {/* Top failures */}
                {Object.keys(failureStats).length > 0 && (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Agent Performance</h3>
                    <div className="space-y-1">
                      {Object.entries(failureStats)
                        .sort((a, b) => b[1].total - a[1].total)
                        .slice(0, 10)
                        .map(([aid, stats]) => {
                          const rate = stats.success_rate;
                          const barColor = rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div key={aid} className="flex items-center gap-3 py-1.5">
                              <span className="text-xs text-slate-400 w-40 truncate">{aid}</span>
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${rate}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 w-20 text-right">{stats.success}/{stats.total} ({rate.toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ Agents ═══ */}
            {tab === 'agents' && (
              <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">Registered Agents ({agents.length})</h3>
                    <span className="text-[10px] text-slate-600">
                      Auto Selection: {serverInfo?.auto_agent_selection ? '✅ ON' : '❌ OFF'}
                    </span>
                  </div>
                  <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
                    {agents.map((agent) => (
                      <AgentRow key={agent.agent_id} agent={agent} stats={failureStats[agent.agent_id]} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ Services ═══ */}
            {tab === 'services' && (
              <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-4">
                  {services.map((svc) => (
                    <div key={svc.name} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ServiceDot status={svc.status} />
                          <h3 className="text-sm font-semibold text-slate-200">{svc.name}</h3>
                          <span className="text-xs font-mono text-slate-600">:{svc.port}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {svc.responseTime && (
                            <span className="text-xs text-slate-500">{svc.responseTime}ms</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            svc.status === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {svc.status === 'up' ? 'Running' : 'Stopped'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        <a href={`http://localhost:${svc.port}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400/60 hover:text-blue-400">
                          http://localhost:{svc.port}
                        </a>
                      </div>
                    </div>
                  ))}

                  {/* ACP details */}
                  {serverInfo && (
                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">ACP Server Details</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-slate-500">Version:</span> <span className="text-slate-300">{serverInfo.version}</span></div>
                        <div><span className="text-slate-500">Agents:</span> <span className="text-slate-300">{serverInfo.num_agents}</span></div>
                        <div><span className="text-slate-500">Uptime:</span> <span className="text-slate-300">{serverInfo.uptime?.split('.')[0]}</span></div>
                        <div><span className="text-slate-500">Auto Select:</span> <span className="text-slate-300">{serverInfo.auto_agent_selection ? 'ON' : 'OFF'}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 px-6 py-4 border-t border-slate-800/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>LogosAI Admin Dashboard</span>
          <span>Refreshes every 30s</span>
        </div>
      </footer>
    </div>
  );
}
