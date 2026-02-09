'use client';

import { useEffect, useState, useRef } from 'react';
import { StreamingState, AgentInfo } from '@/utils/streaming';
import { cn } from '@/utils/cn';

interface SimpleStreamingIndicatorProps {
  state: StreamingState;
}

// Stage messages
const STAGE_MESSAGES: Record<string, string> = {
  connecting: 'Connecting to server',
  initializing: 'Initializing system',
  agents_loaded: 'Agents loaded',
  analyzing: 'Analyzing query',
  selecting: 'Selecting agents',
  agents_ready: 'Agents ready',
  planning: 'Planning execution',
  executing: 'Executing agents',
  integrating: 'Integrating results',
  streaming: 'Generating response',
  completed: 'Completed',
  saved: 'Saved',
  error: 'Error occurred',
};

export function SimpleStreamingIndicator({ state }: SimpleStreamingIndicatorProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [dots, setDots] = useState('');
  const lastStageRef = useRef<string>('');
  const lastAgentRef = useRef<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Animate dots for current action
  useEffect(() => {
    if (state.isProcessing && state.currentStage !== 'completed') {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 400);
      return () => clearInterval(interval);
    }
    setDots('');
  }, [state.isProcessing, state.currentStage]);

  // Add logs based on state changes
  useEffect(() => {
    const addLog = (message: string) => {
      setLogs(prev => [...prev.slice(-20), message]); // Keep last 20 logs
    };

    // Stage change
    if (state.currentStage && state.currentStage !== lastStageRef.current) {
      const stageMessage = STAGE_MESSAGES[state.currentStage] || state.currentStage;

      if (state.currentStage === 'completed') {
        addLog(`✓ ${stageMessage}`);
      } else if (state.currentStage === 'error') {
        addLog(`✗ ${state.message || stageMessage}`);
      } else {
        addLog(`→ ${stageMessage}`);
      }
      lastStageRef.current = state.currentStage;

      // Show memory indicator right after initialization stage
      // memory_context SSE event arrives before initialization, so memoryCount is already set
      if (state.currentStage === 'initializing' && state.memoryCount && state.memoryCount > 0) {
        addLog(`🧠 Loaded ${state.memoryCount} user ${state.memoryCount === 1 ? 'memory' : 'memories'}`);
      }
    }

    // Agent change
    if (state.currentAgent && state.currentAgent !== lastAgentRef.current) {
      const agentName = formatAgentName(state.currentAgent);
      addLog(`  ⎿ ${agentName} started`);
      lastAgentRef.current = state.currentAgent;
    }

    // Custom message from state
    if (state.message && !STAGE_MESSAGES[state.currentStage]) {
      // Only add if it's not a duplicate of stage message
      const lastLog = logs[logs.length - 1];
      if (!lastLog?.includes(state.message)) {
        addLog(`  ${state.message}`);
      }
    }
  }, [state.currentStage, state.currentAgent, state.message]);

  // Agent completion tracking
  useEffect(() => {
    if (state.agents) {
      state.agents.forEach(agent => {
        if (agent.status === 'completed') {
          const agentName = formatAgentName(agent.agent_id || agent.agent_name || 'Agent');
          const logMessage = `  ✓ ${agentName} done`;
          setLogs(prev => {
            if (!prev.includes(logMessage)) {
              return [...prev.slice(-20), logMessage];
            }
            return prev;
          });
        }
      });
    }
  }, [state.agents]);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isProcessing = state.isProcessing && state.currentStage !== 'completed';
  const currentMessage = state.message || STAGE_MESSAGES[state.currentStage] || '';

  return (
    <div className="font-mono text-sm leading-relaxed">
      {/* Log stream */}
      <div className="space-y-0.5 text-slate-500">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={cn(
              'transition-opacity duration-300',
              log.startsWith('🧠') && 'text-purple-400/80',
              log.startsWith('✓') && 'text-slate-400',
              log.startsWith('✗') && 'text-red-400/80',
              idx === logs.length - 1 && !log.startsWith('🧠') && 'text-slate-300'
            )}
          >
            {log}
          </div>
        ))}
      </div>

      {/* Current action with animated dots */}
      {isProcessing && (
        <div className="text-slate-300 mt-1">
          <span className="text-purple-400/70">›</span> {currentMessage}
          <span className="text-slate-500">{dots}</span>
        </div>
      )}

      <div ref={logsEndRef} />
    </div>
  );
}

// Helper function to format agent names
function formatAgentName(name: string): string {
  return name
    .replace(/_agent$/i, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
