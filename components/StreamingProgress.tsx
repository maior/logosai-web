'use client';

import { cn } from '@/utils/cn';
import { StreamingState, AgentInfo } from '@/utils/streaming';

interface StreamingProgressProps {
  state: StreamingState;
}

export function StreamingProgress({ state }: StreamingProgressProps) {
  const { currentStage, progress, message, agents, error } = state;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5 shadow-xl">
      {/* Header with animated indicator */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none">
              <path d="M12 4L20 8V16L12 20L4 16V8L12 4Z" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="2" fill="currentColor" className="animate-pulse"/>
            </svg>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
            <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-75" />
            <div className="absolute inset-0 bg-purple-500 rounded-full" />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{message}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {currentStage === 'analyzing' && 'Analyzing your query...'}
            {currentStage === 'selecting' && 'Selecting optimal agents...'}
            {currentStage === 'executing' && 'Running agent tasks...'}
            {currentStage === 'integrating' && 'Combining results...'}
            {currentStage === 'completed' && 'Done!'}
          </div>
        </div>
        <div className="text-sm font-mono text-purple-400">{progress}%</div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-slate-700 rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full opacity-50 blur-sm transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Agent list */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            Active Agents
          </div>
          <div className="grid gap-2">
            {agents.map((agent) => (
              <AgentStatus key={agent.agent_id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentStatus({ agent }: { agent: AgentInfo }) {
  const statusConfig = {
    pending: {
      icon: (
        <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
      ),
      color: 'text-slate-500',
      bgColor: 'bg-slate-800/50',
    },
    running: {
      icon: (
        <svg className="w-4 h-4 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
    },
    completed: {
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    },
    failed: {
      icon: (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/20',
    },
  };

  const config = statusConfig[agent.status];

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
      config.bgColor
    )}>
      {config.icon}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium truncate', config.color)}>
          {agent.agent_name}
        </div>
        {agent.purpose && (
          <div className="text-xs text-slate-500 truncate">{agent.purpose}</div>
        )}
      </div>
      {agent.execution_time && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {agent.execution_time.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
