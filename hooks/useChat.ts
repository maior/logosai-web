'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { startChatStream, StreamingState, StreamMessage, KnowledgeGraphData } from '@/utils/streaming';
import { Message as ApiMessage } from '@/types';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentResults?: any[];
  metadata?: any;
  knowledgeGraph?: KnowledgeGraphData | null;
}

export interface UseChatOptions {
  onSessionCreated?: (sessionId: string) => void;
}

export interface UseChatReturn {
  messages: Message[];
  streamingState: StreamingState | null;
  isLoading: boolean;
  error: string | null;
  currentSessionId: string | undefined;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
  loadMessages: (apiMessages: ApiMessage[]) => void;
}

export function useChat(
  email: string,
  initialSessionId?: string,
  options?: UseChatOptions
): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId);

  // Ref to track if message was already added via onMessage callback
  const messageReceivedRef = useRef(false);

  // Update currentSessionId when initialSessionId changes
  useEffect(() => {
    setCurrentSessionId(initialSessionId);
  }, [initialSessionId]);

  // Load messages from API response (for session restore)
  const loadMessages = useCallback((apiMessages: ApiMessage[]) => {
    const convertedMessages: Message[] = apiMessages.map((msg) => {
      let content = msg.content;

      // If DB content lacks images but agent_results has rich content, use that instead
      const agentResults = msg.extra_data?.agent_results;
      const isRich = (s: string) => s.includes('![') || s.includes('<img') || s.includes('<!--SHOP_DATA:');
      if (content && !isRich(content) && agentResults?.length) {
        let bestRich = '';
        for (const ar of agentResults) {
          const ac = typeof ar.result === 'string'
            ? ar.result
            : ar.result?.content || ar.result?.answer || '';
          if (typeof ac === 'string' && ac.length > bestRich.length && isRich(ac)) {
            bestRich = ac;
          }
        }
        if (bestRich && bestRich.length > content.length) {
          content = bestRich;
        }
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content,
        timestamp: new Date(msg.created_at),
        metadata: msg.extra_data,
        agentResults: agentResults || undefined,
        knowledgeGraph: msg.extra_data?.knowledge_graph || null,
      };
    });
    setMessages(convertedMessages);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    if (!email) {
      setError('Email information not found. Please sign in again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    messageReceivedRef.current = false;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      console.log('[useChat] Starting chat stream...', { query, email, sessionId: currentSessionId });

      const result = await startChatStream({
        query,
        email,
        sessionId: currentSessionId,
        onStateChange: (state) => {
          console.log('[useChat] State change:', state.currentStage, state.progress + '%');
          setStreamingState(state);

          // Handle final result from streaming state
          if (state.currentStage === 'completed' && state.progress === 100) {
            console.log('[useChat] Stream completed via state');
          }
        },
        onSessionCreated: (newSessionId) => {
          // 새 세션이 생성되었을 때
          console.log('[useChat] New session created:', newSessionId);
          setCurrentSessionId(newSessionId);
          options?.onSessionCreated?.(newSessionId);
        },
        onMessage: (message) => {
          // Mark that we received the message via callback
          messageReceivedRef.current = true;
          console.log('[useChat] Received message via onMessage callback:', {
            contentLength: message.content?.length,
            hasAgentResults: !!message.agentResults?.length,
            hasKnowledgeGraph: !!message.knowledgeGraph,
            knowledgeGraphNodes: message.knowledgeGraph?.nodes?.length || 0,
            sessionId: message.sessionId,
          });

          // 세션 ID 업데이트 (메시지에 포함된 경우)
          if (message.sessionId && message.sessionId !== currentSessionId) {
            setCurrentSessionId(message.sessionId);
            options?.onSessionCreated?.(message.sessionId);
          }

          // 어시스턴트 메시지 추가
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: message.content,
            timestamp: new Date(),
            agentResults: message.agentResults,
            metadata: message.metadata,
            knowledgeGraph: message.knowledgeGraph,
          };
          setMessages((prev) => {
            console.log('[useChat] Adding assistant message, previous count:', prev.length);
            return [...prev, assistantMessage];
          });
        },
        onError: (err) => {
          console.error('[useChat] Stream error:', err.message);
          setError(err.message);
        },
      });

      console.log('[useChat] Stream finished, result:', {
        hasResult: !!result,
        hasContent: !!result?.content,
        messageReceived: messageReceivedRef.current,
        sessionId: result?.sessionId,
      });

      // Fallback: if onMessage wasn't called but we have a result
      if (result && result.content && !messageReceivedRef.current) {
        console.log('[useChat] Using fallback to add message from result');
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          agentResults: result.agentResults,
          metadata: result.metadata,
          knowledgeGraph: result.knowledgeGraph,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // 세션 ID 업데이트
        if (result.sessionId && result.sessionId !== currentSessionId) {
          setCurrentSessionId(result.sessionId);
          options?.onSessionCreated?.(result.sessionId);
        }
      } else if (!result && !messageReceivedRef.current) {
        console.warn('[useChat] No result received and no message callback triggered');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setStreamingState(null);
    }
  }, [isLoading, email, currentSessionId, options]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStreamingState(null);
    setCurrentSessionId(undefined);
  }, []);

  return {
    messages,
    streamingState,
    isLoading,
    error,
    currentSessionId,
    sendMessage,
    clearMessages,
    loadMessages,
  };
}
