'use client';

import { cn } from '@/utils/cn';
import { StreamingState, AgentInfo } from '@/utils/streaming';
import { Loader2, CheckCircle, Circle, AlertCircle, Zap } from 'lucide-react';

interface StreamingProgressProps {
  state: StreamingState;
}

export function StreamingProgress({ state }: StreamingProgressProps) {
  const { currentStage, progress, message, agents, error } = state;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      {/* 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">{message}</span>
          <span className="text-gray-500 dark:text-gray-500">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              error ? 'bg-red-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm mb-4">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 에이전트 목록 */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            에이전트 실행 현황
          </h4>
          {agents.map((agent) => (
            <AgentStatus key={agent.agent_id} agent={agent} />
          ))}
        </div>
      )}

      {/* 처리 중 표시 */}
      {currentStage !== 'completed' && currentStage !== 'error' && (
        <div className="flex items-center gap-2 text-blue-500 mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">처리 중...</span>
        </div>
      )}
    </div>
  );
}

function AgentStatus({ agent }: { agent: AgentInfo }) {
  const statusIcons = {
    pending: <Circle className="w-4 h-4 text-gray-400" />,
    running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const statusColors = {
    pending: 'text-gray-500',
    running: 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600',
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      {statusIcons[agent.status]}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium', statusColors[agent.status])}>
          {agent.agent_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {agent.purpose}
        </div>
      </div>
      {agent.execution_time && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Zap className="w-3 h-3" />
          {agent.execution_time.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
