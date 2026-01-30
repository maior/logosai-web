/**
 * logos_api SSE 스트리밍 처리
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const API_BASE = `${API_URL}/api/${API_VERSION}`;

export interface StreamingState {
  isConnected: boolean;
  isProcessing: boolean;
  currentStage: string;
  progress: number;
  message: string;
  agents: AgentInfo[];
  currentAgent?: string;
  error?: string;
}

export interface AgentInfo {
  agent_id: string;
  agent_name: string;
  purpose: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  execution_time?: number;
}

export interface StreamMessage {
  role: 'user' | 'assistant';
  content: string;
  agentResults?: AgentResult[];
  metadata?: any;
}

export interface AgentResult {
  agent_id: string;
  agent_name: string;
  result: {
    title: string;
    content: string;
  };
  execution_time: number;
  confidence: number;
}

export interface ChatStreamOptions {
  query: string;
  email: string;
  sessionId?: string;
  onStateChange?: (state: StreamingState) => void;
  onMessage?: (message: StreamMessage) => void;
  onError?: (error: Error) => void;
}

/**
 * 채팅 스트리밍 시작
 */
export async function startChatStream(options: ChatStreamOptions): Promise<StreamMessage | null> {
  const { query, email, sessionId, onStateChange, onMessage, onError } = options;

  const initialState: StreamingState = {
    isConnected: false,
    isProcessing: false,
    currentStage: 'connecting',
    progress: 0,
    message: '연결 중...',
    agents: [],
  };

  onStateChange?.(initialState);

  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        query,
        email,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: StreamMessage | null = null;
    let currentState: StreamingState = {
      ...initialState,
      isConnected: true,
      isProcessing: true,
    };

    onStateChange?.(currentState);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.slice(5).trim();
        } else if (line === '' && currentEvent && currentData) {
          try {
            const eventData = JSON.parse(currentData);
            const result = processEvent(currentEvent, eventData, currentState);
            currentState = result.state;
            onStateChange?.(currentState);

            if (result.finalMessage) {
              finalResult = result.finalMessage;
              onMessage?.(result.finalMessage);
            }
          } catch (e) {
            console.warn('SSE parse error:', e, currentData);
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }

    // 스트림 완료
    onStateChange?.({
      ...currentState,
      isProcessing: false,
      currentStage: 'completed',
      progress: 100,
      message: '완료',
    });

    return finalResult;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    onStateChange?.({
      ...initialState,
      isConnected: false,
      isProcessing: false,
      currentStage: 'error',
      error: err.message,
    });
    return null;
  }
}

/**
 * SSE 이벤트 처리
 */
function processEvent(
  eventType: string,
  eventData: any,
  currentState: StreamingState
): { state: StreamingState; finalMessage?: StreamMessage } {
  const data = eventData.data || eventData;

  switch (eventType) {
    case 'initialization':
    case 'ontology_init':
    case 'multi_agent_init':
      return {
        state: {
          ...currentState,
          currentStage: 'initializing',
          progress: data.progress || 10,
          message: data.message || '초기화 중...',
        },
      };

    case 'query_analysis_started':
    case 'intent_analysis':
      return {
        state: {
          ...currentState,
          currentStage: 'analyzing',
          progress: 20,
          message: data.message || '쿼리 분석 중...',
        },
      };

    case 'agent_scoring':
    case 'analysis_complete':
      return {
        state: {
          ...currentState,
          currentStage: 'selecting',
          progress: 30,
          message: data.message || '에이전트 선택 중...',
        },
      };

    case 'agents_selected':
      const agents: AgentInfo[] = (data.agents || []).map((a: any) => ({
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        purpose: a.purpose,
        order: a.order,
        status: 'pending' as const,
      }));
      return {
        state: {
          ...currentState,
          currentStage: 'agents_ready',
          progress: 40,
          message: `${agents.length}개 에이전트 선택됨`,
          agents,
        },
      };

    case 'agent_started':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: 50,
          message: `${data.agent_name || data.agent_id} 실행 중...`,
          currentAgent: data.agent_id,
          agents: currentState.agents.map((a) =>
            a.agent_id === data.agent_id ? { ...a, status: 'running' as const } : a
          ),
        },
      };

    case 'agent_completed':
      const completedCount = data.completed_count || 1;
      const totalCount = data.total_count || 1;
      const agentProgress = 50 + (completedCount / totalCount) * 30;
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: agentProgress,
          message: `${data.agent_name || data.agent_id} 완료 (${completedCount}/${totalCount})`,
          agents: currentState.agents.map((a) =>
            a.agent_id === data.agent_id
              ? {
                  ...a,
                  status: 'completed' as const,
                  result: data.result,
                  execution_time: data.execution_time,
                }
              : a
          ),
        },
      };

    case 'integration_started':
      return {
        state: {
          ...currentState,
          currentStage: 'integrating',
          progress: 85,
          message: '결과 통합 중...',
        },
      };

    case 'integration_completed':
      return {
        state: {
          ...currentState,
          currentStage: 'integrating',
          progress: 90,
          message: '결과 통합 완료',
        },
      };

    case 'final_result':
      // 3중 중첩 구조 처리
      const level1 = data.data || data;
      const level2 = level1.data || level1;
      const result = level2.result || '';
      const agentResults = level2.agent_results || [];
      const metadata = level2.metadata || {};

      return {
        state: {
          ...currentState,
          currentStage: 'completed',
          progress: 100,
          message: '완료',
        },
        finalMessage: {
          role: 'assistant',
          content: result,
          agentResults: agentResults.map((ar: any) => ({
            agent_id: ar.agent_id,
            agent_name: ar.agent_name,
            result: ar.result,
            execution_time: ar.execution_time,
            confidence: ar.confidence,
          })),
          metadata,
        },
      };

    case 'message_saved':
      return {
        state: {
          ...currentState,
          currentStage: 'saved',
          progress: 100,
          message: '저장 완료',
        },
      };

    case 'error':
    case 'stream_error':
      return {
        state: {
          ...currentState,
          currentStage: 'error',
          error: data.message || data.error || 'Unknown error',
        },
      };

    default:
      // 알 수 없는 이벤트는 무시
      return { state: currentState };
  }
}
