/**
 * logos_web 타입 정의
 */

// Session (Conversation) types
export interface Session {
  id: string;
  user_id: string;
  project_id?: string;
  title?: string;
  summary?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_type?: string;
  tokens_used?: number;
  extra_data?: Record<string, any>;
  created_at: string;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentResults?: AgentResult[];
  metadata?: Record<string, any>;
  knowledgeGraph?: KnowledgeGraphData | null;
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

// Streaming types
export interface StreamingState {
  isConnected: boolean;
  isProcessing: boolean;
  currentStage: string;
  progress: number;
  message: string;
  agents: AgentInfo[];
  currentAgent?: string;
  error?: string;
  availableAgents?: AgentInfo[];
  workflowVisualization?: string;
  totalStages?: number;
}

export interface AgentInfo {
  agent_id: string;
  agent_name: string;
  purpose: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  execution_time?: number;
  icon?: string;
  progressPercent?: number;
  progressMessage?: string;
}

// Memory types
export interface Memory {
  id: string;
  user_id: string;
  memory_type: 'fact' | 'preference' | 'context' | 'instruction';
  content: string;
  category?: string;
  importance: number;
  source_conversation_id?: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
