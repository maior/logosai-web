'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';

// ══════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'team';
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const PERSONAL_EMAIL = process.env.NEXT_PUBLIC_PERSONAL_USER_EMAIL || '';
const ACP_URL = 'http://localhost:8888';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface AgentInfo { agent_id: string; name: string; type: string; description: string; }
interface ServerInfo { version: string; uptime: string; num_agents: number; auto_agent_selection: boolean; }
interface FailureStats { [agentId: string]: { total: number; success: number; failure: number; success_rate: number; }; }
interface ServiceStatus { name: string; port: number; status: 'up' | 'down' | 'checking'; responseTime?: number; }

type Section = 'overview' | 'agents' | 'services' | 'pipeline' | 'links';

interface PipelineEvent { type: string; data: Record<string, unknown>; timestamp: number; }

const NAV_ITEMS: { id: Section; label: string; icon: JSX.Element }[] = [
  {
    id: 'overview', label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>,
  },
  {
    id: 'agents', label: 'Agents',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    id: 'services', label: 'Services',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>,
  },
  {
    id: 'pipeline', label: 'Pipeline',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
  {
    id: 'links', label: 'Quick Links',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  },
];

const PIPELINE_EVENT_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  query_received: { icon: '\ud83d\udcdd', color: 'text-blue-400', label: 'Query' },
  agent_selected: { icon: '\u2705', color: 'text-emerald-400', label: 'Selected' },
  agent_failed: { icon: '\u26a0\ufe0f', color: 'text-red-400', label: 'Failed' },
  gap_detection_started: { icon: '\ud83d\udd0d', color: 'text-amber-400', label: 'Gap Detection' },
  forge_generated: { icon: '\ud83c\udfed', color: 'text-purple-400', label: 'FORGE Generated' },
  hot_registered: { icon: '\ud83d\ude80', color: 'text-cyan-400', label: 'Hot Registered' },
  forge_agent_executed: { icon: '\u2728', color: 'text-emerald-400', label: 'FORGE Executed' },
};

// ══════════════════════════════════════════════════════════════
// Sub-components
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

function AgentRow({ agent, stats, selected, onClick }: { agent: AgentInfo; stats?: FailureStats[string]; selected?: boolean; onClick?: () => void }) {
  const rate = stats ? stats.success_rate : null;
  const rateColor = rate === null ? 'text-slate-600' : rate >= 90 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400';
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors cursor-pointer ${
        selected ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-slate-800/30 border border-transparent'
      }`}
    >
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
        {stats && <span className="text-xs text-slate-500">{stats.total} calls</span>}
        <span className={`text-sm font-mono ${rateColor}`}>
          {rate !== null ? `${rate.toFixed(0)}%` : '\u2014'}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Donut Chart (SVG)
// ══════════════════════════════════════════════════════════════

function DonutChart({ percentage, size = 120, strokeWidth = 10, color }: { percentage: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(30 41 59 / 0.6)" strokeWidth={strokeWidth} />
      <circle
        cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// Agent Detail Panel
// ══════════════════════════════════════════════════════════════

function getGrade(rate: number): { grade: string; color: string; bg: string; label: string } {
  if (rate >= 95) return { grade: 'A+', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Excellent' };
  if (rate >= 90) return { grade: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Great' };
  if (rate >= 80) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Good' };
  if (rate >= 70) return { grade: 'C', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Fair' };
  if (rate >= 50) return { grade: 'D', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Needs Improvement' };
  return { grade: 'F', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Critical' };
}

function AgentDetailPanel({ agent, stats, allStats, totalAgents, onClose }: {
  agent: AgentInfo;
  stats?: FailureStats[string];
  allStats: FailureStats;
  totalAgents: number;
  onClose: () => void;
}) {
  const hasStats = !!stats && stats.total > 0;
  const rate = hasStats ? stats.success_rate : 0;
  const grade = hasStats ? getGrade(rate) : null;
  const totalSystemCalls = Object.values(allStats).reduce((s, v) => s + v.total, 0);
  const callShare = hasStats && totalSystemCalls > 0 ? (stats.total / totalSystemCalls * 100) : 0;

  // Rank by call volume
  const sortedByVolume = Object.entries(allStats).sort((a, b) => b[1].total - a[1].total);
  const volumeRank = sortedByVolume.findIndex(([id]) => id === agent.agent_id) + 1;

  // Rank by success rate (only agents with calls)
  const sortedByRate = Object.entries(allStats)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => b[1].success_rate - a[1].success_rate);
  const rateRank = sortedByRate.findIndex(([id]) => id === agent.agent_id) + 1;

  // Top callers comparison (top 5 agents by volume for context)
  const top5 = sortedByVolume.slice(0, 5);
  const maxCalls = top5.length > 0 ? top5[0][1].total : 1;

  const donutColor = !hasStats ? 'rgb(100 116 139)' : rate >= 90 ? 'rgb(52 211 153)' : rate >= 70 ? 'rgb(251 191 36)' : 'rgb(248 113 113)';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-200">{agent.agent_id}</h3>
          {agent.name && agent.name !== agent.agent_id && (
            <p className="text-xs text-slate-500 mt-0.5">{agent.name}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{agent.type}</span>
            {grade && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${grade.bg} ${grade.color}`}>
                Grade {grade.grade}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Description */}
      {agent.description && (
        <div className="mb-5 p-3 rounded-lg bg-slate-800/30 border border-slate-800/40">
          <p className="text-xs text-slate-400 leading-relaxed">{agent.description}</p>
        </div>
      )}

      {hasStats ? (
        <>
          {/* Success Rate Donut + Stats */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative shrink-0">
              <DonutChart percentage={rate} size={100} strokeWidth={8} color={donutColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-slate-200">{rate.toFixed(0)}%</span>
                <span className="text-[9px] text-slate-500">success</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="rounded-lg bg-slate-800/30 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Calls</p>
                <p className="text-lg font-bold text-slate-200">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-slate-800/30 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Successes</p>
                <p className="text-lg font-bold text-emerald-400">{stats.success}</p>
              </div>
              <div className="rounded-lg bg-slate-800/30 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Failures</p>
                <p className={`text-lg font-bold ${stats.failure > 0 ? 'text-red-400' : 'text-slate-400'}`}>{stats.failure}</p>
              </div>
              <div className="rounded-lg bg-slate-800/30 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Call Share</p>
                <p className="text-lg font-bold text-blue-400">{callShare.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-slate-800/40 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volume Rank</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-200">#{volumeRank}</span>
                <span className="text-[10px] text-slate-600">of {Object.keys(allStats).length}</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800/40 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Quality Rank</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-200">#{rateRank}</span>
                <span className="text-[10px] text-slate-600">of {sortedByRate.length}</span>
              </div>
            </div>
          </div>

          {/* Performance Grade Bar */}
          {grade && (
            <div className="mb-6 p-3 rounded-lg border border-slate-800/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Performance Rating</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${rate}%`,
                        background: rate >= 90 ? 'rgb(52 211 153)' : rate >= 70 ? 'rgb(251 191 36)' : 'rgb(248 113 113)',
                      }}
                    />
                  </div>
                  {/* Grade scale */}
                  <div className="flex justify-between mt-1">
                    {['F', 'D', 'C', 'B', 'A', 'A+'].map((g) => (
                      <span key={g} className={`text-[8px] ${grade.grade === g ? grade.color : 'text-slate-700'}`}>{g}</span>
                    ))}
                  </div>
                </div>
                <span className={`text-2xl font-bold ${grade.color}`}>{grade.grade}</span>
              </div>
              <p className={`text-[10px] mt-1.5 ${grade.color}`}>{grade.label}</p>
            </div>
          )}

          {/* Call Volume Comparison (Top 5) */}
          <div className="rounded-lg border border-slate-800/40 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Call Volume (Top 5)</p>
            <div className="space-y-2">
              {top5.map(([aid, s]) => {
                const isCurrent = aid === agent.agent_id;
                const barWidth = (s.total / maxCalls) * 100;
                return (
                  <div key={aid} className="flex items-center gap-2">
                    <span className={`text-[10px] w-32 truncate ${isCurrent ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>{aid}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isCurrent ? 'bg-blue-500' : 'bg-slate-600'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={`text-[10px] w-10 text-right font-mono ${isCurrent ? 'text-blue-400' : 'text-slate-600'}`}>{s.total}</span>
                  </div>
                );
              })}
              {volumeRank > 5 && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/40">
                  <span className="text-[10px] w-32 truncate text-blue-400 font-medium">{agent.agent_id}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(stats.total / maxCalls) * 100}%` }} />
                  </div>
                  <span className="text-[10px] w-10 text-right font-mono text-blue-400">{stats.total}</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm text-slate-400">No usage data available</p>
          <p className="text-xs text-slate-600 mt-1">This agent has not been called yet</p>
        </div>
      )}

      {/* Agent Info Footer */}
      <div className="mt-5 pt-4 border-t border-slate-800/40">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div><span className="text-slate-600">Agent ID:</span> <span className="text-slate-400 font-mono">{agent.agent_id}</span></div>
          <div><span className="text-slate-600">Type:</span> <span className="text-slate-400">{agent.type}</span></div>
          <div><span className="text-slate-600">Total Agents:</span> <span className="text-slate-400">{totalAgents}</span></div>
          <div><span className="text-slate-600">Has Stats:</span> <span className="text-slate-400">{hasStats ? 'Yes' : 'No'}</span></div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// Login Screen
// ══════════════════════════════════════════════════════════════

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      sessionStorage.setItem('admin_auth', 'true');
      onLogin();
    } else {
      setError('Invalid credentials');
      setTimeout(() => setError(''), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-medium text-slate-200">Admin Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">LogosAI System Administration</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                placeholder="Enter username"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                placeholder="Enter password"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">Back to Home</a>
          </div>
        </div>
      </motion.div>
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
        <p className="text-4xl mb-4">&#x1f512;</p>
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
  const [adminAuth, setAdminAuth] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [failureStats, setFailureStats] = useState<FailureStats>({});
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [pipelineConnected, setPipelineConnected] = useState(false);
  const pipelineRef = useRef<EventSource | null>(null);

  // ── Check sessionStorage for admin auth ──
  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setAdminAuth(true);
    }
  }, []);

  // ── Access Control ──
  const isPersonalMode = AUTH_MODE === 'personal';
  const userEmail = isPersonalMode ? PERSONAL_EMAIL : session?.user?.email || '';

  const hasAccess = isPersonalMode
    ? true
    : (!!session && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(userEmail)));

  // ── Data Fetching ──
  const fetchData = useCallback(async () => {
    try {
      const infoResp = await fetch(`${ACP_URL}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_server_info' }),
      });
      if (infoResp.ok) {
        const infoData = await infoResp.json();
        setServerInfo(infoData.result);
      }

      const agentResp = await fetch(`${ACP_URL}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'list_agents' }),
      });
      if (agentResp.ok) {
        const agentData = await agentResp.json();
        setAgents(agentData.result?.agents || []);
      }

      try {
        const statsResp = await fetch(`${ACP_URL}/api/failures/stats`);
        if (statsResp.ok) setFailureStats(await statsResp.json());
      } catch { /* not critical */ }

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
            : svc.port === 8010
              ? `http://localhost:${svc.port}/api/health`
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
    if (hasAccess && adminAuth) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [hasAccess, adminAuth, fetchData]);

  // Pipeline SSE connection
  useEffect(() => {
    if (!hasAccess || !adminAuth || section !== 'pipeline') {
      if (pipelineRef.current) { pipelineRef.current.close(); pipelineRef.current = null; setPipelineConnected(false); }
      return;
    }
    // Load history first
    fetch(`${ACP_URL}/api/pipeline/history`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setPipelineEvents(data);
    }).catch(() => {});
    // Connect SSE — all events come as "pipeline" type
    const es = new EventSource(`${ACP_URL}/api/pipeline/events`);
    pipelineRef.current = es;
    es.addEventListener('connected', () => setPipelineConnected(true));
    es.addEventListener('pipeline', (e: MessageEvent) => {
      try {
        const evt: PipelineEvent = JSON.parse(e.data);
        setPipelineEvents(prev => [...prev.slice(-199), evt]);
      } catch {}
    });
    es.onerror = () => { setPipelineConnected(false); };
    return () => { es.close(); pipelineRef.current = null; setPipelineConnected(false); };
  }, [hasAccess, adminAuth, section]);

  // ── Auth Loading ──
  if (!isPersonalMode && status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) return <AccessDenied />;
  if (!adminAuth) return <AdminLogin onLogin={() => setAdminAuth(true)} />;

  // ── Stats ──
  const totalCalls = Object.values(failureStats).reduce((s, v) => s + v.total, 0);
  const totalFailures = Object.values(failureStats).reduce((s, v) => s + v.failure, 0);
  const overallRate = totalCalls > 0 ? ((totalCalls - totalFailures) / totalCalls * 100) : 0;
  const servicesUp = services.filter(s => s.status === 'up').length;

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAdminAuth(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      {/* ═══ Sidebar ═══ */}
      <aside className={`sticky top-0 h-screen border-r border-slate-800/60 bg-slate-950 flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-slate-800/60 shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-300">Admin</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors ${sidebarCollapsed ? 'mx-auto' : 'ml-auto'}`}
          >
            <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                section === item.id
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
              {!sidebarCollapsed && item.id === 'agents' && agents.length > 0 && (
                <span className="ml-auto text-[10px] font-mono text-slate-600">{agents.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-slate-800/60 shrink-0 space-y-1">
          <a
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {!sidebarCollapsed && <span>Back to Home</span>}
          </a>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-14 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-slate-200">{NAV_ITEMS.find(n => n.id === section)?.label}</h2>
            {section === 'overview' && serverInfo && (
              <span className="text-[10px] text-slate-600 font-mono">v{serverInfo.version}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{userEmail || 'admin'}</span>
            <span className="text-slate-700">|</span>
            <span>{AUTH_MODE}</span>
            <button onClick={fetchData} className="ml-2 p-1.5 rounded-md hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ═══ Overview ═══ */}
              {section === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {/* ── KPI Row ── */}
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Services', value: `${servicesUp}/${services.length}`, color: servicesUp === services.length ? '#10B981' : '#F59E0B', sub: 'online' },
                      { label: 'Agents', value: agents.length, color: '#3B82F6', sub: 'registered' },
                      { label: 'Calls', value: totalCalls, color: '#8B5CF6', sub: 'lifetime' },
                      { label: 'Success', value: `${overallRate.toFixed(1)}%`, color: overallRate >= 80 ? '#10B981' : '#EF4444', sub: `${totalCalls - totalFailures} ok` },
                      { label: 'Errors', value: totalFailures, color: totalFailures > 0 ? '#EF4444' : '#1E293B', sub: totalFailures > 0 ? 'action needed' : 'none' },
                      { label: 'Uptime', value: serverInfo?.uptime?.split('.')[0] || '\u2014', color: '#06B6D4', sub: `v${serverInfo?.version || '?'}` },
                    ].map((s, i) => (
                      <div key={i} className="rounded-xl border border-slate-800/30 bg-[#0B1120] p-3.5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent 10%, ${s.color}30 50%, transparent 90%)` }} />
                        <p className="text-[8px] uppercase tracking-[0.15em] text-slate-600 mb-0.5">{s.label}</p>
                        <p className="text-lg font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[9px] text-slate-600">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Services + Donut + System ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_260px] gap-4">
                    {/* Services */}
                    <div className="rounded-xl border border-slate-800/30 bg-[#0B1120] p-4">
                      <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">Infrastructure</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {services.map((svc) => {
                          const up = svc.status === 'up';
                          return (
                            <div key={svc.name} className="rounded-lg border border-slate-800/20 bg-slate-950/40 px-3 py-2.5 flex items-center justify-between group hover:border-slate-700/30 transition-all">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${up ? 'bg-emerald-400' : 'bg-red-400'}`} style={up ? { boxShadow: '0 0 6px rgba(16,185,129,0.4)' } : { boxShadow: '0 0 6px rgba(239,68,68,0.4)' }} />
                                <span className="text-xs text-slate-300">{svc.name}</span>
                              </div>
                              <span className="text-[9px] font-mono text-slate-600">
                                {svc.responseTime ? `${svc.responseTime}ms` : (up ? 'ok' : 'down')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* D3 Donut Chart — Success/Fail ratio */}
                    <div className="rounded-xl border border-slate-800/30 bg-[#0B1120] p-4 flex flex-col items-center justify-center">
                      <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-2 self-start">Health</h3>
                      {(() => {
                        const success = totalCalls - totalFailures;
                        const fail = totalFailures;
                        const idle = agents.length - Object.keys(failureStats).length;
                        const data = [
                          { label: 'Success', value: success, color: '#10B981' },
                          { label: 'Failed', value: fail, color: '#EF4444' },
                          { label: 'Idle', value: idle, color: '#1E293B' },
                        ].filter(d => d.value > 0);
                        if (data.length === 0) data.push({ label: 'No data', value: 1, color: '#1E293B' });
                        const size = 120;
                        const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>().innerRadius(38).outerRadius(52);
                        const pie = d3.pie<typeof data[0]>().value(d => d.value).sort(null).padAngle(0.04);
                        const arcs = pie(data);
                        return (
                          <div className="relative">
                            <svg width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`}>
                              {arcs.map((a, i) => (
                                <path key={i} d={arc(a) || ''} fill={a.data.color} opacity={0.85} />
                              ))}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-lg font-bold text-slate-200">{overallRate.toFixed(0)}%</span>
                              <span className="text-[8px] text-slate-600">health</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex gap-3 mt-2">
                        {[
                          { label: 'OK', color: '#10B981', val: totalCalls - totalFailures },
                          { label: 'Fail', color: '#EF4444', val: totalFailures },
                          { label: 'Idle', color: '#334155', val: agents.length - Object.keys(failureStats).length },
                        ].map(l => (
                          <div key={l.label} className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                            <span className="text-[8px] text-slate-600">{l.label} {l.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* System Panel */}
                    <div className="rounded-xl border border-slate-800/30 bg-[#0B1120] p-4">
                      <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">System</h3>
                      <div className="space-y-2">
                        {[
                          { k: 'Version', v: serverInfo?.version || '-' },
                          { k: 'Agents', v: `${agents.length} total` },
                          { k: 'Auto-Select', v: serverInfo?.auto_agent_selection ? 'ON' : 'OFF', c: serverInfo?.auto_agent_selection ? '#10B981' : '#64748B' },
                          { k: 'With Stats', v: `${Object.keys(failureStats).length} / ${agents.length}` },
                          { k: 'Uptime', v: serverInfo?.uptime?.split('.')[0] || '-' },
                        ].map((r, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] py-0.5">
                            <span className="text-slate-600">{r.k}</span>
                            <span className="font-mono" style={{ color: r.c || '#CBD5E1' }}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-800/20 grid grid-cols-2 gap-1">
                        {[
                          { label: 'Monitor', href: '/monitoring' },
                          { label: 'ML', href: '/ml-dashboard' },
                          { label: 'Arch', href: '/architecture' },
                          { label: 'Reports', href: '/auto-reports' },
                        ].map(l => (
                          <a key={l.href} href={l.href} className="text-[9px] text-slate-600 hover:text-slate-300 text-center py-1 rounded bg-slate-800/20 hover:bg-slate-800/40 transition-colors">{l.label}</a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── D3 Agent Performance Chart ── */}
                  <div className="rounded-xl border border-slate-800/30 bg-[#0B1120] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Agent Performance</h3>
                      <span className="text-[9px] text-slate-600">{Object.keys(failureStats).length} active / {agents.length} total</span>
                    </div>
                    {Object.keys(failureStats).length === 0 ? (
                      <div className="text-center py-10 text-slate-700 text-xs">No call data yet</div>
                    ) : (() => {
                      const sorted = Object.entries(failureStats).sort((a, b) => b[1].total - a[1].total);
                      const maxCalls = sorted[0]?.[1].total || 1;
                      const margin = { top: 4, right: 80, bottom: 4, left: 180 };
                      const barH = 20;
                      const gap = 3;
                      const h = sorted.length * (barH + gap) + margin.top + margin.bottom;
                      const w = 700;
                      const chartW = w - margin.left - margin.right;
                      const x = d3.scaleLinear().domain([0, maxCalls]).range([0, chartW]);

                      return (
                        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: Math.min(h, 500) }}>
                          <defs>
                            <linearGradient id="bar-success" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#10B981" stopOpacity={0.5} />
                            </linearGradient>
                            <linearGradient id="bar-warn" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.5} />
                            </linearGradient>
                            <linearGradient id="bar-fail" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#EF4444" stopOpacity={0.5} />
                            </linearGradient>
                          </defs>
                          {sorted.map(([aid, stats], i) => {
                            const y = margin.top + i * (barH + gap);
                            const rate = stats.success_rate;
                            const totalW = x(stats.total);
                            const successW = totalW * (rate / 100);
                            const grad = rate >= 80 ? 'url(#bar-success)' : rate >= 50 ? 'url(#bar-warn)' : 'url(#bar-fail)';
                            const textColor = rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444';

                            return (
                              <g key={aid}>
                                {/* Zebra stripe */}
                                {i % 2 === 0 && <rect x={0} y={y - 1} width={w} height={barH + 2} fill="#ffffff" opacity={0.008} rx={2} />}
                                {/* Agent label */}
                                <text x={margin.left - 8} y={y + barH / 2} fontSize={9} fill="#64748B" textAnchor="end" dominantBaseline="central" fontFamily="ui-monospace, monospace">
                                  {aid.length > 24 ? aid.slice(0, 22) + '\u2026' : aid}
                                </text>
                                {/* Track */}
                                <rect x={margin.left} y={y + 3} width={chartW} height={barH - 6} rx={3} fill="#0F172A" stroke="#1E293B" strokeWidth={0.5} />
                                {/* Success bar */}
                                <rect x={margin.left} y={y + 3} width={Math.max(successW, 2)} height={barH - 6} rx={3} fill={grad}>
                                  <animate attributeName="width" from={0} to={Math.max(successW, 2)} dur="0.6s" fill="freeze" />
                                </rect>
                                {/* Fail overlay */}
                                {stats.failure > 0 && (
                                  <rect x={margin.left + successW} y={y + 3} width={totalW - successW} height={barH - 6} fill="#EF4444" opacity={0.15} rx={totalW - successW > 3 ? 0 : 3} />
                                )}
                                {/* Rate */}
                                <text x={w - margin.right + 8} y={y + barH / 2} fontSize={10} fill={textColor} dominantBaseline="central" fontFamily="ui-monospace, monospace" fontWeight={600}>
                                  {rate.toFixed(0)}%
                                </text>
                                {/* Calls count */}
                                <text x={w - 4} y={y + barH / 2} fontSize={8} fill="#475569" dominantBaseline="central" textAnchor="end" fontFamily="ui-monospace, monospace">
                                  {stats.total}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}

                    {/* Idle agents */}
                    {(() => {
                      const active = new Set(Object.keys(failureStats));
                      const idle = agents.filter(a => !active.has(a.agent_id));
                      if (idle.length === 0) return null;
                      return (
                        <div className="mt-4 pt-3 border-t border-slate-800/20">
                          <p className="text-[9px] text-slate-600 mb-1.5">{idle.length} idle agents (no calls recorded)</p>
                          <div className="flex flex-wrap gap-1">
                            {idle.map(a => (
                              <span key={a.agent_id} className="text-[8px] text-slate-700 bg-slate-800/25 px-1.5 py-0.5 rounded">{a.agent_id}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}

              {/* ═══ Agents ═══ */}
              {section === 'agents' && (
                <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className={`grid gap-5 ${selectedAgent ? 'grid-cols-1 lg:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>
                    {/* Agent List */}
                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-300">Registered Agents ({agents.length})</h3>
                        <span className="text-[10px] text-slate-600">
                          Auto Selection: {serverInfo?.auto_agent_selection ? '\u2705 ON' : '\u274c OFF'}
                        </span>
                      </div>
                      <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {agents.map((agent) => (
                          <AgentRow
                            key={agent.agent_id}
                            agent={agent}
                            stats={failureStats[agent.agent_id]}
                            selected={selectedAgent?.agent_id === agent.agent_id}
                            onClick={() => setSelectedAgent(selectedAgent?.agent_id === agent.agent_id ? null : agent)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Agent Detail Panel */}
                    <AnimatePresence>
                      {selectedAgent && (
                        <AgentDetailPanel
                          key={selectedAgent.agent_id}
                          agent={selectedAgent}
                          stats={failureStats[selectedAgent.agent_id]}
                          allStats={failureStats}
                          totalAgents={agents.length}
                          onClose={() => setSelectedAgent(null)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* ═══ Services ═══ */}
              {section === 'services' && (
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
                            {svc.responseTime && <span className="text-xs text-slate-500">{svc.responseTime}ms</span>}
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

              {/* ═══ Pipeline Monitor ═══ */}
              {section === 'pipeline' && (
                <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {(() => {
                    /* Stage definitions with two paths: normal + self-healing */
                    const NORMAL = [
                      { id: 'query_received', label: 'Query', color: '#3B82F6', desc: 'User query received and parsed' },
                      { id: 'agent_selected', label: 'Agent Select', color: '#10B981', desc: 'Best agent chosen by classifier' },
                    ];
                    const HEAL = [
                      { id: 'agent_failed',          label: 'Failure Detected',  color: '#EF4444', desc: 'Agent execution failed after 3 retries' },
                      { id: 'gap_detection_started',  label: 'Gap Analysis',      color: '#F59E0B', desc: 'LLM analyzes if new agent is needed' },
                      { id: 'forge_generated',        label: 'FORGE Generate',    color: '#A855F7', desc: 'New agent code auto-generated' },
                      { id: 'hot_registered',         label: 'Hot Deploy',        color: '#06B6D4', desc: 'Agent loaded into runtime (no restart)' },
                      { id: 'forge_agent_executed',   label: 'Execute',           color: '#22D3EE', desc: 'New agent handles the original query' },
                    ];
                    const ALL = [...NORMAL, ...HEAL];
                    const latestQuery = [...pipelineEvents].reverse().find(e => e.type === 'query_received');
                    const queryTs = latestQuery?.timestamp || 0;
                    const activeSet = new Set(pipelineEvents.filter(e => e.timestamp >= queryTs).map(e => e.type));
                    const healingTriggered = activeSet.has('agent_failed');
                    let furthestIdx = -1;
                    ALL.forEach((s, i) => { if (activeSet.has(s.id)) furthestIdx = i; });

                    const Node = ({ stage, cx, cy, idx }: { stage: typeof ALL[0]; cx: number; cy: number; idx: number }) => {
                      const r = 20;
                      const isActive = activeSet.has(stage.id);
                      const isCurrent = idx === furthestIdx;
                      const isErr = stage.id === 'agent_failed';
                      return (
                        <g>
                          {isActive && (
                            <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={stage.color} strokeWidth={0.8} opacity={0.12}>
                              <animate attributeName="r" values={`${r + 3};${r + 8};${r + 3}`} dur="3s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.12;0.04;0.12" dur="3s" repeatCount="indefinite" />
                            </circle>
                          )}
                          <circle cx={cx} cy={cy} r={r}
                            fill={isActive ? `${stage.color}12` : '#0C1222'}
                            stroke={isActive ? stage.color : '#1E293B'}
                            strokeWidth={isActive ? 1.5 : 0.8}
                            strokeDasharray={isErr && isActive ? '4 2' : 'none'}
                          />
                          {isCurrent && <circle cx={cx} cy={cy} r={r} fill="none" stroke={stage.color} strokeWidth={2} opacity={0.5}>
                            <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
                          </circle>}
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={11}
                            fill={isActive ? stage.color : '#334155'}>
                            {PIPELINE_EVENT_STYLES[stage.id]?.icon || '\u2022'}
                          </text>
                          <text x={cx} y={cy + r + 13} textAnchor="middle" fontSize={7.5}
                            fill={isActive ? '#94A3B8' : '#334155'} fontWeight={isCurrent ? 600 : 400}>
                            {stage.label}
                          </text>
                          {isActive && <circle cx={cx + r - 3} cy={cy - r + 3} r={3}
                            fill={isErr ? '#EF4444' : '#10B981'} stroke="#0C1222" strokeWidth={1.5}>
                            {isCurrent && <animate attributeName="fill-opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />}
                          </circle>}
                        </g>
                      );
                    };

                    const Conn = ({ x1, y1, x2, y2, color, active, current, dashed }: { x1:number;y1:number;x2:number;y2:number;color:string;active:boolean;current:boolean;dashed?:boolean }) => (
                      <g>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1E293B" strokeWidth={1.5} strokeLinecap="round" strokeDasharray={dashed ? '4 3' : 'none'} />
                        {active && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={0.5} strokeDasharray={dashed ? '4 3' : 'none'}>
                          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                        </line>}
                        {active && current && <circle r={2} fill={color} opacity={0.9}>
                          <animateMotion dur="1.2s" repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
                        </circle>}
                      </g>
                    );

                    // Layout: normal path top row, self-healing bottom row with arrow down
                    const W = 700, topY = 38, botY = 108, normSpacing = 200, healSpacing = 100;
                    const normX = (i: number) => 80 + i * normSpacing;
                    const healStartX = 130;
                    const healX = (i: number) => healStartX + i * healSpacing;

                    return (
                      <>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${pipelineConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`} />
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">{pipelineConnected ? 'Live' : 'Offline'}</span>
                            {pipelineEvents.length > 0 && <span className="text-[9px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{pipelineEvents.length}</span>}
                          </div>
                          <button onClick={() => setPipelineEvents([])}
                            className="text-[10px] text-slate-600 hover:text-slate-300 px-2 py-0.5 rounded bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
                            Clear
                          </button>
                        </div>

                        {/* SVG Flow Diagram */}
                        <div className="rounded-2xl border border-slate-800/40 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#0B1120] p-5 mb-4 relative overflow-hidden">
                          <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'20px 20px'}} />

                          <svg viewBox={`0 0 ${W} 150`} className="w-full relative" style={{ maxHeight: 160 }}>
                            <defs>
                              {ALL.map(s => (
                                <filter key={s.id} id={`g-${s.id}`} x="-40%" y="-40%" width="180%" height="180%">
                                  <feGaussianBlur stdDeviation="3" result="b" />
                                  <feFlood floodColor={s.color} floodOpacity="0.3" result="c" />
                                  <feComposite in="c" in2="b" operator="in" result="g" />
                                  <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                              ))}
                            </defs>

                            {/* Path labels */}
                            <text x={normX(0) - 30} y={topY - 20} fontSize={8} fill="#475569" fontWeight={500}>NORMAL PATH</text>
                            <text x={healStartX - 30} y={botY - 20} fontSize={8} fill={healingTriggered ? '#F59E0B' : '#1E293B'} fontWeight={500}>SELF-HEALING PATH</text>

                            {/* Normal path: Query → Select */}
                            <Conn x1={normX(0) + 20} y1={topY} x2={normX(1) - 20} y2={topY}
                              color={NORMAL[1].color} active={activeSet.has('agent_selected')} current={furthestIdx === 1} />
                            {NORMAL.map((s, i) => <Node key={s.id} stage={s} cx={normX(i)} cy={topY} idx={i} />)}

                            {/* Success label after Select */}
                            {activeSet.has('agent_selected') && !healingTriggered && (
                              <text x={normX(1) + 32} y={topY + 4} fontSize={8} fill="#10B981" fontWeight={600}>SUCCESS</text>
                            )}

                            {/* Arrow down from Select → Failed (self-healing trigger) */}
                            <Conn x1={normX(1)} y1={topY + 20} x2={healX(0)} y2={botY - 20}
                              color="#EF4444" active={healingTriggered} current={furthestIdx === 2} dashed />

                            {/* Self-healing path */}
                            {HEAL.map((s, i) => {
                              const globalIdx = NORMAL.length + i;
                              return (
                                <g key={s.id}>
                                  {i > 0 && <Conn x1={healX(i - 1) + 20} y1={botY} x2={healX(i) - 20} y2={botY}
                                    color={s.color} active={activeSet.has(s.id)} current={furthestIdx === globalIdx} />}
                                  <Node stage={s} cx={healX(i)} cy={botY} idx={globalIdx} />
                                </g>
                              );
                            })}
                          </svg>

                          {/* Stage descriptions */}
                          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                            {ALL.filter(s => activeSet.has(s.id)).map(s => (
                              <div key={s.id} className="flex items-center gap-2 py-0.5">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-[10px] text-slate-500"><span style={{ color: s.color }} className="font-medium">{s.label}</span> &mdash; {s.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Event Timeline */}
                        <div className="rounded-2xl border border-slate-800/40 bg-gradient-to-b from-slate-900/50 to-slate-950/50 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-slate-800/30">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Event Log</span>
                          </div>
                          <div className="max-h-[calc(100vh-440px)] overflow-y-auto">
                            {pipelineEvents.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-14 text-slate-700">
                                <svg className="w-6 h-6 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <p className="text-[10px]">Waiting for pipeline activity</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-800/20">
                                {[...pipelineEvents].reverse().map((evt, i) => {
                                  const style = PIPELINE_EVENT_STYLES[evt.type] || { icon: '\u2022', color: 'text-slate-500', label: evt.type };
                                  const ts = new Date(evt.timestamp * 1000).toLocaleTimeString('ko-KR', { hour12: false });
                                  const d = evt.data || {};
                                  const sc = ALL.find(s => s.id === evt.type)?.color || '#475569';
                                  const isHl = ['forge_generated', 'hot_registered'].includes(evt.type);
                                  const isErr = evt.type === 'agent_failed';
                                  return (
                                    <div key={pipelineEvents.length - 1 - i} className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/[0.015] ${isHl ? 'bg-purple-500/[0.02]' : isErr ? 'bg-red-500/[0.02]' : ''}`}>
                                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc, boxShadow: `0 0 5px ${sc}30` }} />
                                      <span className="text-[10px] text-slate-600 font-mono w-14 shrink-0">{ts}</span>
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0"
                                        style={{ color: sc, borderColor: `${sc}25`, backgroundColor: `${sc}06` }}>
                                        {style.label}
                                      </span>
                                      <span className="text-[11px] text-slate-400 truncate">
                                        {evt.type === 'query_received' && (d.query as string)?.slice(0, 65)}
                                        {evt.type === 'agent_selected' && <><span className="text-emerald-400/80">{d.agent_id as string}</span> <span className="text-slate-600">{typeof d.confidence === 'number' ? (d.confidence as number).toFixed(2) : ''}</span></>}
                                        {evt.type === 'agent_failed' && <span className="text-red-400/80">{d.agent_id as string}: {(d.reason as string)?.slice(0, 40)}</span>}
                                        {evt.type === 'gap_detection_started' && <span className="text-amber-400/70">Analyzing capability gap...</span>}
                                        {evt.type === 'forge_generated' && <><span className="text-purple-400">{d.name as string}</span> <span className="text-slate-600">{d.code_length as number} chars</span></>}
                                        {evt.type === 'hot_registered' && <><span className="text-cyan-400">{d.class as string}</span> <span className="text-slate-600">{d.total_agents as number} agents</span></>}
                                        {evt.type === 'forge_agent_executed' && <span className="text-emerald-400">{d.agent_id as string}</span>}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}

              {/* ═══ Quick Links ═══ */}
              {section === 'links' && (
                <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Auto Reports', href: '/auto-reports', icon: '\u23f0', desc: 'Scheduled report generation and delivery' },
                      { label: 'Architecture', href: '/architecture', icon: '\ud83c\udfd7\ufe0f', desc: 'System architecture visualization' },
                      { label: 'ML Dashboard', href: '/ml-dashboard', icon: '\ud83e\udde0', desc: 'Machine learning metrics and models' },
                      { label: 'Monitoring', href: '/monitoring', icon: '\ud83d\udcca', desc: 'Real-time system monitoring' },
                    ].map((link) => (
                      <a key={link.href} href={link.href}
                        className="flex items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:bg-slate-800/30 hover:border-slate-700/60 transition-colors group">
                        <span className="text-2xl">{link.icon}</span>
                        <div>
                          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{link.label}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{link.desc}</p>
                        </div>
                        <svg className="w-4 h-4 ml-auto text-slate-700 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
