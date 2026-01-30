'use client';

import { useState, useCallback } from 'react';
import { startChatStream, StreamingState, StreamMessage } from '@/utils/streaming';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentResults?: any[];
  metadata?: any;
}

export interface UseChatReturn {
  messages: Message[];
  streamingState: StreamingState | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
}

export function useChat(email: string, sessionId?: string): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    if (!email) {
      setError('이메일 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const result = await startChatStream({
        query,
        email,
        sessionId,
        onStateChange: (state) => {
          setStreamingState(state);
        },
        onMessage: (message) => {
          // 어시스턴트 메시지 추가
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: message.content,
            timestamp: new Date(),
            agentResults: message.agentResults,
            metadata: message.metadata,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        },
        onError: (err) => {
          setError(err.message);
        },
      });

      // 스트리밍이 완료되었지만 onMessage가 호출되지 않은 경우
      if (result && !messages.some((m) => m.content === result.content)) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          agentResults: result.agentResults,
          metadata: result.metadata,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setStreamingState(null);
    }
  }, [isLoading, email, sessionId, messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStreamingState(null);
  }, []);

  return {
    messages,
    streamingState,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
