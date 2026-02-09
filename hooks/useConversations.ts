'use client';

import { useState, useCallback, useEffect } from 'react';
import { Session, Message } from '@/types';
import { getSessions, createSession, getSessionMessages, tokenManager } from '@/utils/api';

export interface UseConversationsReturn {
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  selectSession: (session: Session) => Promise<Message[]>;
  startNewSession: () => Promise<Session | null>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all sessions
  const loadSessions = useCallback(async () => {
    const token = tokenManager.getToken();
    if (!token) {
      // No token yet, skip loading
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const sessionList = await getSessions();
      setSessions(sessionList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
      console.error('[useConversations] Load sessions error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select a session and load its messages
  const selectSession = useCallback(async (session: Session): Promise<Message[]> => {
    setCurrentSession(session);
    try {
      const response = await getSessionMessages(session.id);
      return response.messages || [];
    } catch (err) {
      console.error('[useConversations] Load messages error:', err);
      return [];
    }
  }, []);

  // Start a new session
  const startNewSession = useCallback(async (): Promise<Session | null> => {
    try {
      const newSession = await createSession();
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      console.error('[useConversations] Create session error:', err);
      return null;
    }
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'}/api/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tokenManager.getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If deleted session was current, clear it
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      console.error('[useConversations] Delete session error:', err);
    }
  }, [currentSession]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    currentSession,
    isLoading,
    error,
    loadSessions,
    selectSession,
    startNewSession,
    deleteSession,
  };
}
