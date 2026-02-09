'use client';

import { cn } from '@/utils/cn';
import { StreamingState, AgentInfo } from '@/utils/streaming';

interface UnifiedStreamingProgressProps {
  state: StreamingState;
}

// Step definitions similar to website's UnifiedStreamingRenderer
const STEPS = [
  { id: 'connecting', label: 'Connecting', icon: '🔌', description: 'Connecting to server' },
  { id: 'initializing', label: 'Initializing', icon: '🖥️', description: 'Initializing system' },
  { id: 'analyzing', label: 'Analyzing', icon: '🔍', description: 'Analyzing query' },
  { id: 'selecting', label: 'Selecting', icon: '🤖', description: 'Selecting optimal agents' },
  { id: 'agents_ready', label: 'Ready', icon: '✅', description: 'Agents ready' },
  { id: 'planning', label: 'Planning', icon: '📋', description: 'Creating execution plan' },
  { id: 'executing', label: 'Executing', icon: '⚡', description: 'Agents working' },
  { id: 'streaming', label: 'Generating', icon: '💬', description: 'Generating response' },
  { id: 'integrating', label: 'Integrating', icon: '🔗', description: 'Integrating results' },
  { id: 'completed', label: 'Complete', icon: '🎉', description: 'Processing complete' },
];

function getStepIndex(stage: string): number {
  const index = STEPS.findIndex(s => s.id === stage);
  return index >= 0 ? index : 0;
}

export function UnifiedStreamingProgress({ state }: UnifiedStreamingProgressProps) {
  const { currentStage, progress, message, agents, error } = state;
  const currentStepIndex = getStepIndex(currentStage);

  return (
    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4L20 8V16L12 20L4 16V8L12 4Z" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="12" cy="12" r="2" fill="currentColor"/>
                </svg>
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
                <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-75" />
                <div className="absolute inset-0 bg-purple-400 rounded-full" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">LogosAI Processing</h3>
              <p className="text-xs text-slate-400">{message}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-mono text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full">
              {progress}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="px-6 py-3 border-b border-white/5">
        <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full opacity-40 blur-sm transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="px-6 py-4">
        <div className="space-y-2">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-xl transition-all duration-300',
                  isCurrent && 'bg-purple-500/10 border border-purple-500/20',
                  isCompleted && 'opacity-60',
                  isPending && 'opacity-30'
                )}
              >
                {/* Step Icon */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0',
                  isCompleted && 'bg-emerald-500/20',
                  isCurrent && 'bg-purple-500/20 animate-pulse',
                  isPending && 'bg-slate-700/50'
                )}>
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <span className="animate-bounce">{step.icon}</span>
                  ) : (
                    <span className="grayscale">{step.icon}</span>
                  )}
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-sm font-medium',
                    isCompleted && 'text-emerald-400',
                    isCurrent && 'text-purple-400',
                    isPending && 'text-slate-500'
                  )}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
                  )}
                </div>

                {/* Status indicator */}
                {isCurrent && (
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 border-t border-white/5 bg-red-500/10">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-400">{error}</span>
          </div>
        </div>
      )}

      {/* Active Agents */}
      {agents.length > 0 && (
        <div className="px-6 py-4 border-t border-white/5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Active Agents ({agents.length})
          </div>
          <div className="grid gap-2">
            {agents.map((agent) => (
              <AgentStatusCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentStatusCard({ agent }: { agent: AgentInfo }) {
  const statusConfig = {
    pending: {
      bg: 'bg-slate-700/30',
      border: 'border-slate-600/30',
      icon: <div className="w-3 h-3 rounded-full border-2 border-slate-500" />,
      textColor: 'text-slate-400',
    },
    running: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      icon: (
        <svg className="w-4 h-4 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ),
      textColor: 'text-purple-400',
    },
    completed: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      textColor: 'text-emerald-400',
    },
    failed: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      textColor: 'text-red-400',
    },
  };

  const config = statusConfig[agent.status];

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
      config.bg,
      config.border
    )}>
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium truncate', config.textColor)}>
          {agent.agent_name}
        </div>
        {agent.purpose && (
          <div className="text-xs text-slate-500 truncate">{agent.purpose}</div>
        )}
      </div>
      {agent.execution_time && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {agent.execution_time.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
