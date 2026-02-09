'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { ChatView } from '@/components/ChatView';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { checkHealth, getSessions, getSession, getHeaders, tokenManager } from '@/utils/api';
import { Session, Message as ApiMessage } from '@/types';

// Google Icon
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  // Conversation state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Login page
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-sm">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light text-slate-200">LogosAI</h1>
            <p className="mt-1 text-slate-500 text-sm">Multi-Agent System</p>
          </div>

          {/* Login */}
          <div className="space-y-4">
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            {/* Connection status */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <div className={`w-1.5 h-1.5 rounded-full ${
                isCheckingConnection ? 'bg-yellow-500' :
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`} />
              <span>
                {isCheckingConnection ? 'Checking...' :
                 isConnected ? 'Server connected' : 'Server unavailable'}
              </span>
            </div>
          </div>
        </div>
      </div>
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
    </div>
  );
}
