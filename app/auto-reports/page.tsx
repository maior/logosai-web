"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock, Search, Send, Mail, MessageSquare, Plus, Trash2,
  Play, Pause, RefreshCw, CheckCircle, AlertCircle, X, Save,
  Zap, Calendar, ChevronRight, Bot, Edit3, Settings
} from "lucide-react";

const ACP_URL = "http://localhost:8888";

interface HistoryEntry {
  timestamp: string;
  success: boolean;
  search_result: string;
  delivery: string;
}

interface AutoReport {
  id: string;
  name: string;
  search_query: string;
  deliver_via: "kakaotalk" | "email" | "telegram";
  recipient: string;
  recipient_email: string;
  hour: number;
  minute: number;
  days: string;
  enabled: boolean;
  created_at: string;
  last_run: string | null;
  last_result: string | null;
  history?: HistoryEntry[];
}

const DELIVER_OPTIONS = [
  { value: "kakaotalk", label: "KakaoTalk", icon: MessageSquare, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", iconBg: "bg-yellow-500/20" },
  { value: "email", label: "Gmail", icon: Mail, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", iconBg: "bg-red-500/20" },
  { value: "telegram", label: "Telegram", icon: Send, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", iconBg: "bg-blue-500/20" },
];

const DAY_OPTIONS = [
  { value: "매일", label: "Every Day" },
  { value: "평일", label: "Weekdays (Mon-Fri)" },
  { value: "주말", label: "Weekends (Sat-Sun)" },
  { value: "월", label: "Monday" }, { value: "화", label: "Tuesday" },
  { value: "수", label: "Wednesday" }, { value: "목", label: "Thursday" },
  { value: "금", label: "Friday" }, { value: "토", label: "Saturday" }, { value: "일", label: "Sunday" },
  { value: "월/수/금", label: "Mon / Wed / Fri" },
  { value: "화/목", label: "Tue / Thu" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30, 45];

type ModalMode = "create" | "edit" | null;

export default function AutoReportsPage() {
  const [reports, setReports] = useState<AutoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const emptyForm: Partial<AutoReport> = {
    name: "", search_query: "", deliver_via: "kakaotalk",
    recipient: "", recipient_email: "", hour: 8, minute: 0, days: "매일",
  };
  const [form, setForm] = useState<Partial<AutoReport>>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${ACP_URL}/api/auto-reports`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch { /* ACP not ready */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReports(); const i = setInterval(fetchReports, 15000); return () => clearInterval(i); }, [fetchReports]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  const openCreate = () => { setForm(emptyForm); setEditId(null); setModalMode("create"); };
  const openEdit = (r: AutoReport) => { setForm({ ...r }); setEditId(r.id); setModalMode("edit"); };
  const closeModal = () => { setModalMode(null); setEditId(null); };

  const handleSave = async () => {
    if (!form.name || !form.search_query) { showToast("이름과 검색어를 입력해주세요.", "error"); return; }
    try {
      if (modalMode === "create") {
        const res = await fetch(`${ACP_URL}/api/auto-reports`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
        if (res.ok) showToast("리포트가 등록되었습니다!", "success");
      } else if (modalMode === "edit" && editId) {
        const res = await fetch(`${ACP_URL}/api/auto-reports/${editId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
        if (res.ok) showToast("리포트가 수정되었습니다!", "success");
      }
      closeModal(); fetchReports();
    } catch { showToast("저장에 실패했습니다.", "error"); }
  };

  const handleToggle = async (r: AutoReport) => {
    await fetch(`${ACP_URL}/api/auto-reports/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !r.enabled }),
    }); fetchReports();
  };

  const handleDelete = async (r: AutoReport) => {
    if (!confirm(`'${r.name}' 리포트를 삭제하시겠습니까?`)) return;
    await fetch(`${ACP_URL}/api/auto-reports/${r.id}`, { method: "DELETE" });
    showToast("삭제되었습니다.", "success"); fetchReports();
  };

  const handleRun = async (r: AutoReport) => {
    setRunningId(r.id);
    try {
      const res = await fetch(`${ACP_URL}/api/auto-reports/${r.id}/run`, { method: "POST" });
      const data = await res.json();
      showToast(data.success ? "실행 완료!" : "실행 실패", data.success ? "success" : "error");
      fetchReports();
    } catch { showToast("실행 실패", "error"); }
    finally { setRunningId(null); }
  };

  const getOpt = (via: string) => DELIVER_OPTIONS.find(o => o.value === via) || DELIVER_OPTIONS[0];
  const fmtTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // ─── Render ───
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-sm border transition-all
          ${toast.type === "success" ? "bg-emerald-900/80 border-emerald-600/30" : "bg-red-900/80 border-red-600/30"}`}
          style={{ animation: "slideIn .3s ease-out" }}>
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* ─── Modal (Create / Edit) ─── */}
      {modalMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#12121a] rounded-2xl w-[600px] border border-gray-700/40 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-8 pt-7 pb-4 border-b border-gray-800/60 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20 flex items-center justify-center">
                  {modalMode === "create" ? <Plus className="w-4 h-4 text-purple-400" /> : <Settings className="w-4 h-4 text-purple-400" />}
                </div>
                <h2 className="text-lg font-bold">{modalMode === "create" ? "New Auto Report" : "Edit Report"}</h2>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-800/60 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Name + Search */}
              <div className="grid grid-cols-2 gap-5">
                <Field label="Report Name" placeholder="e.g. 아침 날씨 리포트"
                  value={form.name || ""} onChange={v => setForm({ ...form, name: v })} />
                <Field label="Search Query" placeholder="e.g. 오늘 서울 날씨"
                  value={form.search_query || ""} onChange={v => setForm({ ...form, search_query: v })} />
              </div>

              {/* Delivery Channel */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Delivery Channel</label>
                <div className="flex gap-3">
                  {DELIVER_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const sel = form.deliver_via === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setForm({ ...form, deliver_via: opt.value as any })}
                        className={`flex-1 py-3.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2.5
                          ${sel ? `${opt.bg} ${opt.color} shadow-lg` : "bg-gray-800/20 border-gray-700/30 text-gray-500 hover:text-gray-300 hover:border-gray-600/40"}`}>
                        <Icon className="w-4.5 h-4.5" /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recipient */}
              <div>
                {form.deliver_via === "email" ? (
                  <Field label="Recipient Email" placeholder="user@gmail.com" icon={<Mail className="w-4 h-4 text-gray-500" />}
                    value={form.recipient_email || ""} onChange={v => setForm({ ...form, recipient_email: v })} />
                ) : (
                  <Field label={form.deliver_via === "kakaotalk" ? "KakaoTalk Name" : "Telegram Username"} icon={
                    form.deliver_via === "kakaotalk" ? <MessageSquare className="w-4 h-4 text-gray-500" /> : <Send className="w-4 h-4 text-gray-500" />
                  } placeholder={form.deliver_via === "kakaotalk" ? "e.g. 이성정" : "e.g. @username"}
                    value={form.recipient || ""} onChange={v => setForm({ ...form, recipient: v })} />
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Schedule</label>
                <div className="grid grid-cols-3 gap-4">
                  {/* Days */}
                  <div className="col-span-1">
                    <label className="text-[11px] text-gray-500 mb-1.5 block">Repeat</label>
                    <select value={form.days || "매일"} onChange={e => setForm({ ...form, days: e.target.value })}
                      className="w-full px-3 py-3 bg-gray-800/40 rounded-xl border border-gray-700/40 outline-none text-sm focus:border-purple-500/40 transition-colors">
                      {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  {/* Hour */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block">Hour</label>
                    <select value={form.hour ?? 8} onChange={e => setForm({ ...form, hour: parseInt(e.target.value) })}
                      className="w-full px-3 py-3 bg-gray-800/40 rounded-xl border border-gray-700/40 outline-none text-sm focus:border-purple-500/40 transition-colors">
                      {HOUR_OPTIONS.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}시</option>)}
                    </select>
                  </div>
                  {/* Minute */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block">Minute</label>
                    <select value={form.minute ?? 0} onChange={e => setForm({ ...form, minute: parseInt(e.target.value) })}
                      className="w-full px-3 py-3 bg-gray-800/40 rounded-xl border border-gray-700/40 outline-none text-sm focus:border-purple-500/40 transition-colors">
                      {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {form.days} {fmtTime(form.hour ?? 8, form.minute ?? 0)} 에 자동 실행됩니다
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-gray-800/60 flex justify-between items-center bg-gray-900/30">
              <button onClick={closeModal} className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSave}
                className="px-7 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2">
                <Save className="w-4 h-4" /> {modalMode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="border-b border-gray-800/40 bg-gradient-to-b from-gray-900/40 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-purple-500/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Auto Reports</h1>
                <p className="text-gray-500 text-sm mt-0.5">Scheduled search &amp; delivery via KakaoTalk, Gmail, Telegram</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchReports}
                className="p-2.5 bg-gray-800/40 border border-gray-700/40 rounded-xl hover:bg-gray-700/40 transition-all">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={openCreate}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center gap-2 text-sm font-semibold shadow-lg shadow-purple-500/20">
                <Plus className="w-4 h-4" /> New Report
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-8 mt-6">
            {[
              { label: "Total", value: reports.length, color: "text-gray-200" },
              { label: "Active", value: reports.filter(r => r.enabled).length, color: "text-emerald-400" },
              { label: "KakaoTalk", value: reports.filter(r => r.deliver_via === "kakaotalk").length, color: "text-yellow-400" },
              { label: "Gmail", value: reports.filter(r => r.deliver_via === "email").length, color: "text-red-400" },
              { label: "Telegram", value: reports.filter(r => r.deliver_via === "telegram").length, color: "text-blue-400" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Report List ─── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32"><RefreshCw className="w-6 h-6 animate-spin text-gray-600" /></div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-600">
            <div className="w-20 h-20 rounded-3xl bg-gray-800/30 flex items-center justify-center mb-6"><Clock className="w-10 h-10 opacity-40" /></div>
            <p className="text-lg font-medium text-gray-400">No reports yet</p>
            <p className="text-sm text-gray-600 mt-1 mb-6">Create your first auto report to get started</p>
            <button onClick={openCreate} className="px-5 py-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-600/30 transition-colors">
              <Plus className="w-4 h-4 inline mr-2" />Create Report
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {reports.map(r => {
              const opt = getOpt(r.deliver_via);
              const Icon = opt.icon;
              const isRunning = runningId === r.id;
              return (
                <div key={r.id}
                  className={`group relative rounded-2xl border transition-all duration-200
                    ${r.enabled ? "bg-gray-900/60 border-gray-800/60 hover:border-gray-600/40 hover:bg-gray-900/80" : "bg-gray-900/20 border-gray-800/30 opacity-40 hover:opacity-60"}`}>
                  <div className="p-5 flex items-center gap-5">
                    {/* Channel Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${opt.bg}`}>
                      <Icon className={`w-5 h-5 ${opt.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-semibold text-gray-100 truncate">{r.name}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider
                          ${r.enabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-gray-800/50 text-gray-500 border border-gray-700/30"}`}>
                          {r.enabled ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /><span className="truncate max-w-[180px]">{r.search_query}</span></span>
                        <span className="text-gray-700">→</span>
                        <span className={`flex items-center gap-1.5 ${opt.color}`}>{r.recipient || r.recipient_email}</span>
                        <span className="flex items-center gap-1.5 text-gray-600"><Clock className="w-3.5 h-3.5" />{r.days} {fmtTime(r.hour, r.minute)}</span>
                      </div>
                      {r.last_run && (
                        <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="text-[11px] text-gray-500 mt-1 hover:text-gray-300 transition-colors cursor-pointer flex items-center gap-1">
                          <span>Last: {r.last_run}</span>
                          {r.history && r.history.length > 0 && (
                            <span className="text-gray-600">({r.history.length} runs) {expandedId === r.id ? "▲" : "▼"}</span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionBtn onClick={() => openEdit(r)} title="Edit" icon={<Edit3 className="w-4 h-4 text-gray-400" />} />
                      <ActionBtn onClick={() => handleToggle(r)} title={r.enabled ? "Pause" : "Resume"}
                        icon={r.enabled ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />} />
                      <ActionBtn onClick={() => handleRun(r)} title="Run Now" disabled={isRunning}
                        icon={isRunning ? <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" /> : <Zap className="w-4 h-4 text-purple-400" />} />
                      <ActionBtn onClick={() => handleDelete(r)} title="Delete" icon={<Trash2 className="w-4 h-4 text-red-400/60" />} hoverBg="hover:bg-red-950/40" />
                    </div>
                  </div>

                  {/* Execution History (expandable) */}
                  {expandedId === r.id && r.history && r.history.length > 0 && (
                    <div className="border-t border-gray-800/40 px-5 py-3 bg-gray-950/50">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Execution History</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {r.history.map((h, hi) => (
                          <div key={hi} className="flex items-start gap-3 text-xs text-gray-500 py-1">
                            <span className={`mt-0.5 ${h.success ? "text-emerald-500" : "text-red-500"}`}>
                              {h.success ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-gray-500 shrink-0 w-28">{h.timestamp}</span>
                            <span className="text-gray-400 truncate">{h.search_result}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───

function Field({ label, placeholder, value, onChange, icon }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</div>}
        <input value={value} onChange={e => onChange(e.target.value)}
          className={`w-full py-3 bg-gray-800/40 rounded-xl border border-gray-700/40 outline-none text-sm focus:border-purple-500/40 transition-colors ${icon ? "pl-10 pr-4" : "px-4"}`}
          placeholder={placeholder} />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, title, icon, disabled, hoverBg }: {
  onClick: () => void; title: string; icon: React.ReactNode; disabled?: boolean; hoverBg?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`p-2.5 rounded-xl transition-colors ${hoverBg || "hover:bg-gray-800/60"} disabled:opacity-50`}>
      {icon}
    </button>
  );
}
