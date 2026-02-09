/**
 * logos_api SSE 스트리밍 처리
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const API_BASE = `${API_URL}/api/${API_VERSION}`;

/**
 * JSON 응답에서 answer 필드 추출
 * 에이전트 응답이 "json\n{...}" 또는 "```json\n{...}\n```" 형식일 때 answer만 추출
 * 이중 중첩 JSON도 처리 가능 (```json\n{"answer": "..."}\n```)
 */
function extractAnswerFromContent(content: string): string {
  if (!content) return '';

  console.log('[extractAnswer] Input:', content.substring(0, 200));

  // Step 1: Remove markdown code block markers
  let jsonStr = content;
  if (content.startsWith('```json')) {
    jsonStr = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (content.startsWith('json\n')) {
    jsonStr = content.slice(5);
  }

  // Step 2: Also check for embedded json blocks
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  }

  // Step 3: Try to parse as JSON
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.answer) {
      console.log('[extractAnswer] Found answer via JSON parse:', parsed.answer.substring(0, 100));
      return parsed.answer;
    }
    // If no answer field, return original content
    return content;
  } catch {
    // JSON parsing failed - try regex extraction
  }

  // Step 4: Use regex to extract "answer": "..." pattern (handles escaped characters)
  // This works even with truncated/malformed JSON
  const answerPatterns = [
    /"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/,  // Standard pattern
    /"answer":\s*"([^"]+)"/,                // Simple pattern without escapes
  ];

  for (const pattern of answerPatterns) {
    const match = jsonStr.match(pattern);
    if (match) {
      const extracted = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      console.log('[extractAnswer] Found answer via regex:', extracted.substring(0, 100));
      return extracted;
    }
  }

  // Step 5: Fallback - remove json prefix and return
  if (content.startsWith('json\n')) {
    return content.slice(5).trim();
  }

  console.log('[extractAnswer] No answer found, returning original');
  return content;
}

/**
 * 에이전트 결과에서 깔끔한 응답 추출
 * 다양한 중첩 구조 처리:
 * - ar.result?.content
 * - ar.result
 * - ar.data.data.result.answer (새로운 WorkflowOrchestrator 형식)
 * - ar.data.result.answer
 */
function extractCleanResponse(agentResults: any[]): string {
  if (!agentResults || agentResults.length === 0) return '';

  const answers: string[] = [];

  for (const ar of agentResults) {
    let content: string | undefined;

    // 1. 새로운 중첩 구조 처리: ar.data.data.result.answer 또는 ar.data.result.answer
    if (ar.data) {
      const nestedData = ar.data.data || ar.data;
      if (nestedData?.result?.answer) {
        content = nestedData.result.answer;
      } else if (nestedData?.result?.content) {
        content = nestedData.result.content;
      } else if (typeof nestedData?.result === 'string') {
        content = nestedData.result;
      }
    }

    // 2. 기존 구조: ar.result?.content 또는 ar.result
    if (!content) {
      if (ar.result?.content) {
        content = ar.result.content;
      } else if (ar.result?.answer) {
        content = ar.result.answer;
      } else if (typeof ar.result === 'string') {
        content = ar.result;
      }
    }

    // 3. answer 필드 직접 확인
    if (!content && ar.answer) {
      content = ar.answer;
    }

    if (typeof content === 'string') {
      const answer = extractAnswerFromContent(content);
      // answer가 추출되었으면 사용 (원본과 다르거나 JSON이 아닌 경우)
      if (answer) {
        // JSON 마커가 없으면 그대로 사용
        if (!answer.startsWith('json') && !answer.startsWith('{')) {
          answers.push(answer);
        } else if (answer !== content) {
          // 원본과 다르면 추출된 것을 사용
          answers.push(answer);
        }
      }
    }
  }

  return answers.join('\n\n');
}

export interface StreamingState {
  isConnected: boolean;
  isProcessing: boolean;
  currentStage: string;
  progress: number;
  message: string;
  agents: AgentInfo[];
  currentAgent?: string;
  error?: string;
  // 🆕 워크플로우 정보
  availableAgents?: AgentInfo[];
  workflowVisualization?: string;
  totalStages?: number;
  // 🆕 메모리 컨텍스트
  memoryCount?: number;
}

export interface AgentInfo {
  agent_id: string;
  agent_name: string;
  purpose: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  execution_time?: number;
  icon?: string;  // 🆕 에이전트 아이콘
  progressPercent?: number;  // 🆕 에이전트 내부 진행률
  progressMessage?: string;  // 🆕 에이전트 내부 진행 메시지
}

// Knowledge Graph types
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  size: number;
  color?: string;
  properties?: Record<string, any>;
  confidence?: number;
  x?: number;
  y?: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: string;
  weight: number;
  size: number;
  color?: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  metadata?: {
    totalNodes?: number;
    totalEdges?: number;
    categories?: string[];
    query?: string;
  };
}

export interface StreamMessage {
  role: 'user' | 'assistant';
  content: string;
  agentResults?: AgentResult[];
  metadata?: any;
  knowledgeGraph?: KnowledgeGraphData | null;
  sessionId?: string;  // 서버에서 생성/반환된 세션 ID
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
  onSessionCreated?: (sessionId: string) => void;  // 새 세션 생성 시 콜백
  onError?: (error: Error) => void;
}

/**
 * 채팅 스트리밍 시작
 */
export async function startChatStream(options: ChatStreamOptions): Promise<StreamMessage | null> {
  const { query, email, sessionId, onStateChange, onMessage, onSessionCreated, onError } = options;

  const initialState: StreamingState = {
    isConnected: false,
    isProcessing: false,
    currentStage: 'connecting',
    progress: 0,
    message: 'Connecting...',
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
    let capturedSessionId: string | undefined = sessionId;  // 서버에서 반환된 세션 ID 추적
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

      for (const rawLine of lines) {
        const line = rawLine.trim();  // Handle \r\n line endings
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.slice(5).trim();
        } else if (line === '' && currentData) {
          // Process when we have data (event header is optional)
          try {
            const parsed = JSON.parse(currentData);
            // Extract event type from multiple sources (like website does)
            const eventType = parsed.event || currentEvent || parsed.type || 'unknown';

            // 🔧 FIX: 백엔드 응답 구조에 맞게 수정
            // - 백엔드는 agents, workflow_visualization 등을 최상위에 보냄
            // - parsed.data는 workflow_strategy 등 메타데이터만 포함
            // - 따라서 parsed 전체를 eventData로 사용
            const eventData = parsed;

            console.log(`[SSE] Event: ${eventType}`, {
              hasData: !!eventData,
              dataKeys: eventData ? Object.keys(eventData).slice(0, 10) : [],
              hasAgents: !!eventData?.agents,
              hasWorkflowViz: !!eventData?.workflow_visualization
            });

            // 🆕 세션 ID 캡처 (initialization 또는 message_saved 이벤트에서)
            const newSessionId: string | undefined = eventData?.data?.session_id || eventData?.session_id;
            if (newSessionId && newSessionId !== capturedSessionId) {
              capturedSessionId = newSessionId;
              console.log('[SSE] Session ID captured:', capturedSessionId);
              onSessionCreated?.(newSessionId);
            }

            const result = processEvent(eventType, eventData, currentState);
            currentState = result.state;
            onStateChange?.(currentState);

            if (result.finalMessage) {
              // 세션 ID를 최종 메시지에 포함
              finalResult = {
                ...result.finalMessage,
                sessionId: capturedSessionId,
              };
              onMessage?.(finalResult);
              console.log('[SSE] Final message received:', {
                contentLength: result.finalMessage.content?.length,
                hasAgentResults: !!result.finalMessage.agentResults?.length,
                sessionId: capturedSessionId,
              });
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
      message: 'Completed',
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
  // 🔧 eventData 자체에 agents, workflow_visualization 등이 있음
  // data 필드가 있어도 top-level 필드를 우선 사용
  const data = eventData;

  switch (eventType) {
    case 'memory_context':
      return {
        state: {
          ...currentState,
          memoryCount: data.memory_count || 0,
          message: data.message || '',
        },
      };

    case 'initialization':
    case 'ontology_init':
    case 'multi_agent_init':
      return {
        state: {
          ...currentState,
          currentStage: 'initializing',
          progress: data.progress || 10,
          message: 'Initializing...',
        },
      };

    case 'agents_loading':
      return {
        state: {
          ...currentState,
          currentStage: 'initializing',
          progress: 12,
          message: 'Loading agents...',
        },
      };

    // 🆕 사용 가능한 에이전트 목록 (워크플로우 시각화용)
    case 'agents_available':
      const availableAgents: AgentInfo[] = (data.agents || []).map((a: any, idx: number) => ({
        agent_id: a.agent_id || '',
        agent_name: a.agent_name || a.agent_id || '',
        purpose: a.description || '',
        order: idx,
        status: 'pending' as const,
        icon: a.icon,
      }));
      return {
        state: {
          ...currentState,
          currentStage: 'agents_loaded',
          progress: 15,
          message: `${availableAgents.length} agents available`,
          availableAgents,
        },
      };

    case 'log':
      return {
        state: {
          ...currentState,
          progress: currentState.progress,
          message: currentState.message,
        },
      };

    case 'query_analysis_started':
    case 'intent_analysis':
      return {
        state: {
          ...currentState,
          currentStage: 'analyzing',
          progress: 20,
          message: 'Analyzing query...',
        },
      };

    case 'agent_scoring':
    case 'analysis_complete':
      return {
        state: {
          ...currentState,
          currentStage: 'selecting',
          progress: 30,
          message: 'Selecting agents...',
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
          message: `${agents.length} agents selected`,
          agents,
        },
      };

    // WorkflowOrchestrator planning events
    case 'planning_start':
      return {
        state: {
          ...currentState,
          currentStage: 'planning',
          progress: 15,
          message: 'Creating execution plan...',
        },
      };

    case 'planning_complete':
      // 🆕 강화된 워크플로우 정보 처리
      console.log('[SSE] planning_complete raw data:', {
        hasAgents: !!data.agents,
        agentsLength: data.agents?.length,
        hasSelectedAgents: !!data.selected_agents,
        selectedAgentsLength: data.selected_agents?.length,
        workflowViz: data.workflow_visualization,
        totalStages: data.total_stages,
      });

      const selectedAgents: AgentInfo[] = (data.agents || data.selected_agents || []).map((a: any) => ({
        agent_id: a.agent_id || '',
        agent_name: a.agent_name || a.agent_id || '',
        purpose: a.purpose || a.description || '',
        order: a.order || a.stage || 0,
        status: 'pending' as const,
        icon: a.icon,
      }));

      const workflowViz = data.workflow_visualization || '';
      const totalStages = data.total_stages || selectedAgents.length;

      console.log('[SSE] planning_complete parsed:', {
        selectedAgentsCount: selectedAgents.length,
        workflowViz,
        totalStages,
        agentNames: selectedAgents.map(a => a.agent_name),
      });

      return {
        state: {
          ...currentState,
          currentStage: 'planning',
          progress: 25,
          message: workflowViz
            ? `Workflow: ${workflowViz}`
            : 'Planning complete',
          agents: selectedAgents.length > 0 ? selectedAgents : currentState.agents,
          workflowVisualization: workflowViz,
          totalStages,
        },
      };

    case 'validation_start':
    case 'validation_complete':
      return {
        state: {
          ...currentState,
          currentStage: 'planning',
          progress: 25,
          message: 'Validating plan...',
        },
      };

    case 'workflow_start':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: 30,
          message: 'Starting workflow execution',
        },
      };

    case 'stage_start':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: Math.min(currentState.progress + 5, 80),
          message: 'Executing stage...',
        },
      };

    case 'stage_complete':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: Math.min(currentState.progress + 10, 85),
          message: 'Stage complete',
        },
      };

    case 'agent_queued':
      // 🆕 undefined 방어
      const queuedAgentId = data.agent_id || '';
      const queuedAgentName = data.agent_name || data.display_name || queuedAgentId || 'Agent';
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: currentState.progress,
          message: `${queuedAgentName} queued...`,
        },
      };

    case 'transform_start':
    case 'transform_complete':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: currentState.progress,
          message: 'Transforming data...',
        },
      };

    // Agent execution events (handle both old and new naming)
    case 'agent_start':
    case 'agent_started':
      // 🆕 undefined 방어: agent_name/agent_id가 없으면 안전한 기본값 사용
      const startAgentId = data.agent_id || '';
      const startAgentName = data.agent_name || data.display_name || startAgentId || 'Agent';
      const startAgentIcon = data.icon || '🤖';
      console.log('[SSE] agent_start:', {
        agent_id: startAgentId,
        agent_name: startAgentName,
        icon: startAgentIcon,
        rawData: { agent_id: data.agent_id, agent_name: data.agent_name, display_name: data.display_name }
      });
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: 50,
          message: `${startAgentName} running...`,
          currentAgent: startAgentId,
          agents: currentState.agents.map((a) =>
            a.agent_id === startAgentId ? { ...a, status: 'running' as const } : a
          ),
        },
      };

    // 🆕 에이전트 내부 진행상황 (long-running agent용)
    case 'agent_progress':
      const progressAgentId = data.agent_id || '';
      const progressAgentName = data.agent_name || data.display_name || progressAgentId || 'Agent';
      const progressPercent = data.progress_percent || data.progress || 0;
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: currentState.progress,
          message: `${progressAgentName} processing... ${progressPercent}%`,
          agents: currentState.agents.map((a) =>
            a.agent_id === progressAgentId
              ? {
                  ...a,
                  status: 'running' as const,
                  progressPercent,
                  progressMessage: undefined,
                }
              : a
          ),
        },
      };

    case 'agent_complete':
    case 'agent_completed':
      // 🆕 undefined 방어: agent_name/agent_id가 없으면 안전한 기본값 사용
      const completeAgentId = data.agent_id || '';
      const completeAgentName = data.agent_name || data.display_name || completeAgentId || 'Agent';
      const completedCount = data.completed_count || 1;
      const totalCount = data.total_count || currentState.agents.length || 1;
      const agentProgress = 50 + (completedCount / totalCount) * 30;
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: agentProgress,
          message: `${completeAgentName} done (${completedCount}/${totalCount})`,
          agents: currentState.agents.map((a) =>
            a.agent_id === completeAgentId
              ? {
                  ...a,
                  status: 'completed' as const,
                  result: data.result || data.data?.full_result,
                  execution_time: data.execution_time || data.elapsed_time_ms,
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
          message: 'Integrating results...',
        },
      };

    case 'integration_completed':
      return {
        state: {
          ...currentState,
          currentStage: 'integrating',
          progress: 90,
          message: 'Integration complete',
        },
      };

    case 'final_result':
      // 다양한 응답 구조 처리 (ACP 서버 응답 형식에 따라)
      const level1 = data.data || data;
      const level2 = level1.data || level1;

      const agentResults = level2.agent_results || level1.agent_results || data.agent_results || [];
      const metadata = level2.metadata || level1.metadata || data.metadata || {};

      // 1. 먼저 agent_results에서 answer 추출 시도
      let cleanAnswer = extractCleanResponse(agentResults);

      // 2. agent_results에서 못 찾으면 result 필드에서 시도
      if (!cleanAnswer) {
        const rawResult = level2.result || level1.result || data.result || '';

        // result 필드에 JSON이 포함되어 있으면 answer 추출 시도
        if (rawResult && typeof rawResult === 'string' && rawResult.includes('"answer"')) {
          // 마크다운 안에 포함된 JSON에서 answer 추출
          const answerMatch = rawResult.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (answerMatch) {
            cleanAnswer = answerMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        }

        // answer를 못 찾았으면 result 그대로 사용
        if (!cleanAnswer && typeof rawResult === 'string') {
          cleanAnswer = extractAnswerFromContent(rawResult);

          // JSON 마커만 제거 (마크다운 헤더는 유지)
          if (cleanAnswer.includes('json\n{')) {
            const lines = cleanAnswer.split('\n');
            const cleanLines = lines.filter(line =>
              !line.includes('Agent collaboration') &&
              !line.includes('Confidence:') &&
              !line.startsWith('json') &&
              !line.match(/^\s*[{}[\]]/) &&
              !line.match(/^\s*"[^"]+":/)
            );
            if (cleanLines.length > 0) {
              cleanAnswer = cleanLines.join('\n').trim();
            }
          }
        }
      }

      // 3. agentResults 배열에서 deep extraction (새로운 WorkflowOrchestrator 형식)
      if (!cleanAnswer && agentResults.length > 0) {
        const deepExtracted: string[] = [];
        for (const ar of agentResults) {
          // ar.data.data.result.answer 또는 ar.data.result.answer 형식 처리
          const nestedData = ar.data?.data || ar.data;
          const answer = nestedData?.result?.answer ||
                        nestedData?.answer ||
                        ar.result?.answer ||
                        ar.answer;
          if (answer && typeof answer === 'string') {
            deepExtracted.push(answer);
          }
        }
        if (deepExtracted.length > 0) {
          cleanAnswer = deepExtracted.join('\n\n');
        }
      }

      // 4. 에러 응답인 경우
      if (!cleanAnswer && (level2.error || level1.error || data.error)) {
        const errorMsg = level2.error || level1.error || data.error;
        cleanAnswer = `Error: ${errorMsg}`;
      }

      // 5. content 필드 확인 (fallback)
      if (!cleanAnswer && (level2.content || level1.content || data.content)) {
        cleanAnswer = extractAnswerFromContent(level2.content || level1.content || data.content);
      }

      // 6. 최후의 fallback: 전체 데이터에서 answer 패턴 검색
      if (!cleanAnswer) {
        const fullStr = JSON.stringify(data);
        // Python 스타일 ('answer':) 과 JSON 스타일 ("answer":) 모두 지원
        const patterns = [
          /"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/,  // JSON 스타일
          /'answer'\s*:\s*'((?:[^'\\]|\\.)*)'/,  // Python 스타일
        ];
        for (const pattern of patterns) {
          const match = fullStr.match(pattern);
          if (match) {
            cleanAnswer = match[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'")
              .replace(/\\\\/g, '\\');
            break;
          }
        }
      }

      // Extract knowledge graph visualization
      const knowledgeGraph = level2.knowledge_graph_visualization ||
                             level1.knowledge_graph_visualization ||
                             data.knowledge_graph_visualization || null;

      console.log('[Streaming] final_result parsed:', {
        hasAnswer: !!cleanAnswer,
        answerLength: cleanAnswer?.length,
        agentCount: agentResults.length,
        hasKnowledgeGraph: !!knowledgeGraph,
        knowledgeGraphNodes: knowledgeGraph?.nodes?.length || 0,
        preview: cleanAnswer?.substring(0, 100),
      });

      return {
        state: {
          ...currentState,
          currentStage: 'completed',
          progress: 100,
          message: 'Completed',
        },
        finalMessage: {
          role: 'assistant',
          content: cleanAnswer || 'No response received.',
          agentResults: agentResults.map((ar: any) => ({
            agent_id: ar.agent_id,
            agent_name: ar.agent_name,
            result: ar.result,
            execution_time: ar.execution_time,
            confidence: ar.confidence,
          })),
          metadata,
          knowledgeGraph,
        },
      };

    case 'message_saved':
      return {
        state: {
          ...currentState,
          currentStage: 'saved',
          progress: 100,
          message: 'Saved',
        },
      };

    case 'error':
    case 'stream_error':
      // Return error as a message so user sees feedback
      const errorMessage = data.message || data.error || 'An error occurred';
      const errorCode = data.error_code || 'UNKNOWN_ERROR';

      console.log('[SSE] Error event:', { errorCode, errorMessage });

      return {
        state: {
          ...currentState,
          currentStage: 'error',
          error: errorMessage,
        },
        // Provide error as final message for user feedback
        finalMessage: {
          role: 'assistant',
          content: `⚠️ ${errorMessage}`,
          agentResults: [],
          metadata: { error: true, errorCode },
        },
      };

    case 'workflow_plan_created':
    case 'workflow_planning':
      return {
        state: {
          ...currentState,
          currentStage: 'planning',
          progress: 35,
          message: 'Creating workflow plan...',
        },
      };

    case 'step_executing':
    case 'step_started':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: 50,
          message: 'Executing step...',
        },
      };

    case 'step_complete':
    case 'step_completed':
      return {
        state: {
          ...currentState,
          currentStage: 'executing',
          progress: Math.min(currentState.progress + 10, 80),
          message: 'Step complete',
        },
      };

    case 'content_delta':
    case 'streaming':
      return {
        state: {
          ...currentState,
          currentStage: 'streaming',
          progress: data.progress || 60,
          message: 'Generating response...',
        },
      };

    // WorkflowOrchestrator completion event - CRITICAL for final result
    case 'workflow_complete': {
      console.log('[SSE] workflow_complete received:', JSON.stringify(data).substring(0, 500));

      // Navigate deeply nested structure: data.data.final_output.data.result.answer
      // Or: data.final_output.data.result.answer
      const innerData = data.data || data;
      const finalOutput = innerData.final_output || data.final_output || {};
      const outputData = finalOutput.data || finalOutput;
      const resultObj = outputData.result || outputData;

      // Try to extract answer from various formats
      let cleanAnswer = '';

      // 1. Check for result.answer (most common path)
      if (resultObj && typeof resultObj === 'object' && resultObj.answer) {
        cleanAnswer = extractAnswerFromContent(resultObj.answer);
      }
      // 2. Check for direct answer in outputData
      else if (outputData && outputData.answer) {
        cleanAnswer = extractAnswerFromContent(outputData.answer);
      }
      // 3. Check for message field in finalOutput
      else if (finalOutput.message && typeof finalOutput.message === 'string' && finalOutput.message.length > 50) {
        cleanAnswer = extractAnswerFromContent(finalOutput.message);
      }
      // 4. Try to extract from result if it's a string
      else if (typeof resultObj === 'string') {
        cleanAnswer = extractAnswerFromContent(resultObj);
      }
      // 5. Deep search: stringify and extract answer pattern
      if (!cleanAnswer) {
        const fullStr = JSON.stringify(data);
        // Look for "answer": "..." pattern
        const answerMatch = fullStr.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (answerMatch) {
          cleanAnswer = answerMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
      }

      console.log('[SSE] workflow_complete parsed:', {
        hasAnswer: !!cleanAnswer,
        answerLength: cleanAnswer?.length,
        preview: cleanAnswer?.substring(0, 150)
      });

      if (cleanAnswer) {
        return {
          state: {
            ...currentState,
            currentStage: 'completed',
            progress: 100,
            message: 'Completed',
          },
          finalMessage: {
            role: 'assistant',
            content: cleanAnswer,
            agentResults: [],
            metadata: data.metadata || {},
          },
        };
      }

      // If no clean answer, return completed state without message
      // This allows the stream to end gracefully
      console.warn('[SSE] workflow_complete: No answer extracted');
      return {
        state: {
          ...currentState,
          currentStage: 'completed',
          progress: 100,
          message: 'Completed',
        },
      };
    }

    case 'end':
    case 'completion':
    case 'done':
      // These can also signal final result
      const endResult = data?.result || data?.content || '';
      if (endResult) {
        return {
          state: {
            ...currentState,
            currentStage: 'completed',
            progress: 100,
            message: 'Completed',
          },
          finalMessage: {
            role: 'assistant',
            content: endResult,
            agentResults: data.agent_results || [],
            metadata: data.metadata || {},
          },
        };
      }
      return {
        state: {
          ...currentState,
          currentStage: 'completed',
          progress: 100,
          message: 'Completed',
        },
      };

    default:
      // Log unknown events for debugging
      console.log(`[SSE] Unhandled event: ${eventType}`, data);
      return { state: currentState };
  }
}
