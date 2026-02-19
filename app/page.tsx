'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { ChatView } from '@/components/ChatView';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { MemoryPanel } from '@/components/MemoryPanel';
import { LandingPage } from '@/components/landing/LandingPage';
import { checkHealth, getSessions, getSession, getHeaders, tokenManager } from '@/utils/api';
import { Session, Message as ApiMessage } from '@/types';

export default function Home() {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  // Conversation state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // Key to force ChatView remount when session changes
  const [chatKey, setChatKey] = useState(0);

  // Check server connection
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true);
      try {
        await checkHealth();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
      setIsCheckingConnection(false);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load sessions when authenticated
  useEffect(() => {
    const loadSessions = async () => {
      if (!session?.user?.email) return;

      // Store email in tokenManager for API calls
      tokenManager.setEmail(session.user.email);

      setIsLoadingSessions(true);
      try {
        const sessionList = await getSessions();
        setSessions(sessionList);
      } catch (err) {
        console.error('[Home] Failed to load sessions:', err);
      }
      setIsLoadingSessions(false);
    };

    if (session) {
      loadSessions();
    }
  }, [session]);

  // Handle session selection
  const handleSelectSession = useCallback(async (selectedSession: Session) => {
    setCurrentSessionId(selectedSession.id);
    setChatKey((k) => k + 1); // Force ChatView remount
    setSidebarOpen(false); // Close sidebar on mobile
  }, []);

  // Handle new conversation - just reset to empty state, don't create session yet
  // Session will be created automatically when user sends first message
  const handleNewSession = useCallback(() => {
    setCurrentSessionId(undefined);  // Clear current session
    setChatKey((k) => k + 1);        // Reset ChatView to empty state
    setSidebarOpen(false);           // Close sidebar on mobile
  }, []);

  // Handle session created from chat (first message)
  // This is called when user sends their first message and a new session is auto-created
  // We should NOT remount ChatView here - just update the sidebar
  const handleSessionCreated = useCallback(async (newSessionId: string) => {
    // Skip if this is already the current session
    if (currentSessionId === newSessionId) {
      console.log('[Home] Session already current, just updating sidebar:', newSessionId);
    } else {
      console.log('[Home] New session created from chat:', newSessionId);
      setCurrentSessionId(newSessionId);
    }

    // Fetch session details in background to update sidebar (don't await)
    getSession(newSessionId)
      .then((newSession) => {
        setSessions((prev) => {
          // Check if session already exists
          if (prev.some((s) => s.id === newSessionId)) {
            return prev.map((s) => (s.id === newSessionId ? newSession : s));
          }
          // Add new session at the top
          return [newSession, ...prev];
        });
      })
      .catch((err) => {
        console.error('[Home] Failed to fetch new session:', err);
      });
  }, [currentSessionId]);

  // Handle session deletion - returns Promise for loading state
  const handleDeleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'}/api/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(undefined);
          setChatKey((k) => k + 1);
        }
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (err) {
      console.error('[Home] Failed to delete session:', err);
      throw err; // Re-throw to let sidebar know deletion failed
    }
  }, [currentSessionId]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Landing page (unauthenticated)
  if (!session) {
    return (
      <LandingPage
        onSignIn={() => signIn('google', { callbackUrl: '/' })}
        isConnected={isConnected}
        isCheckingConnection={isCheckingConnection}
      />
    );
  }

  // Main chat interface with sidebar
  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 z-50 relative">
        <div className="flex items-center gap-3">
          <span className="text-lg font-light text-slate-300">LogosAI</span>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </div>

        <div className="flex items-center gap-3">
          {/* User */}
          <div className="flex items-center gap-2">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-slate-300 text-xs">
                  {session.user?.email?.[0].toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm text-slate-400 hidden sm:inline">
              {session.user?.name || session.user?.email}
            </span>
          </div>

          {/* Memories */}
          <button
            onClick={() => setMemoryOpen(!memoryOpen)}
            className={`p-2 transition-colors ${memoryOpen ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            title="Memories"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
            title="Sign out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Conversation Sidebar */}
        <ConversationSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          isLoading={isLoadingSessions}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Chat area - with left margin when sidebar is open */}
        <main
          className={`flex-1 overflow-hidden transition-all duration-300 ${
            sidebarOpen ? 'lg:ml-72' : ''
          } ml-0`}
        >
          <ChatView
            key={chatKey}
            className="h-full"
            email={session.user?.email || ''}
            sessionId={currentSessionId}
            onSessionChange={handleSessionCreated}
          />
        </main>
      </div>

      {/* Memory Panel (right side) */}
      <MemoryPanel isOpen={memoryOpen} onClose={() => setMemoryOpen(false)} />
    </div>
  );
}
