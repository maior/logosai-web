'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { KnowledgeGraphPopup } from './KnowledgeGraphPopup';
import { KnowledgeGraphData } from '@/utils/streaming';
import { uploadFileForRAG, getSessionMessages } from '@/utils/api';
import { cn } from '@/utils/cn';

interface ChatViewProps {
  email: string;
  sessionId?: string;
  projectId?: string;
  className?: string;
  onSessionChange?: (sessionId: string) => void;
}

// Simple example prompts
const EXAMPLE_PROMPTS = [
  "What's the weather in Seoul?",
  "Calculate 100 + 250 * 3",
  "Search for latest AI trends",
  "Write a Fibonacci function in Python",
  "Show my schedule for tomorrow",
  "What's the USD exchange rate?",
];

export function ChatView({ email, sessionId, projectId = 'default', className, onSessionChange }: ChatViewProps) {
  const { messages, streamingState, isLoading, error, currentSessionId, sendMessage, loadMessages, clearMessages } =
    useChat(email, sessionId, {
      onSessionCreated: (newSessionId) => {
        console.log('[ChatView] Session created/updated:', newSessionId);
        onSessionChange?.(newSessionId);
      },
    });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [knowledgeGraphData, setKnowledgeGraphData] = useState<KnowledgeGraphData | null>(null);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Track if this is an explicit session switch (from sidebar)
  const lastLoadedSessionRef = useRef<string | undefined>(undefined);
  const isNewSessionCreationRef = useRef(false);

  // Load messages when sessionId changes (only for explicit session switches)
  useEffect(() => {
    const loadSessionMessages = async () => {
      // Skip if no sessionId
      if (!sessionId) {
        lastLoadedSessionRef.current = undefined;
        return;
      }

      // Skip if this session was already loaded
      if (lastLoadedSessionRef.current === sessionId) {
        console.log('[ChatView] Session already loaded, skipping fetch:', sessionId);
        return;
      }

      // Skip if we already have messages for this session (created during this conversation)
      // This prevents re-fetching when a new session is created mid-conversation
      if (messages.length > 0 && currentSessionId === sessionId) {
        console.log('[ChatView] Messages already exist for session, skipping fetch:', sessionId);
        lastLoadedSessionRef.current = sessionId;
        return;
      }

      console.log('[ChatView] Loading session messages:', sessionId);
      setIsLoadingSession(true);

      try {
        const response = await getSessionMessages(sessionId);
        if (response.messages && response.messages.length > 0) {
          loadMessages(response.messages);
        } else {
          // Clear messages for empty session (switching to new empty session)
          clearMessages();
        }
        lastLoadedSessionRef.current = sessionId;
      } catch (err) {
        console.error('[ChatView] Failed to load session messages:', err);
      }
      setIsLoadingSession(false);
    };

    loadSessionMessages();
  }, [sessionId]); // Intentionally minimal dependencies to control when this runs

  const handleShowKnowledgeGraph = (data: KnowledgeGraphData) => {
    setKnowledgeGraphData(data);
    setShowKnowledgeGraph(true);
  };

  // File upload handler - uploads to RAG system
  const handleFileUpload = useCallback(async (file: File): Promise<{ success: boolean; fileId?: string; error?: string }> => {
    try {
      console.log(`[ChatView] Uploading file: ${file.name} to RAG...`);
      const response = await uploadFileForRAG(file, projectId);
      console.log(`[ChatView] File uploaded successfully: ${response.file.file_id}`);

      // Track uploaded file IDs
      setUploadedFileIds(prev => [...prev, response.file.file_id]);

      return {
        success: true,
        fileId: response.file.file_id,
      };
    } catch (error) {
      console.error('[ChatView] File upload failed:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }, [projectId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingState]);

  // Show loading spinner only when:
  // 1. isLoadingSession is true
  // 2. We don't have any messages yet (not mid-conversation)
  // 3. We're not currently streaming
  const showLoadingSpinner = isLoadingSession && messages.length === 0 && !streamingState && !isLoading;

  return (
    <div className={cn('flex flex-col h-full bg-slate-900', className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showLoadingSpinner ? (
          // Loading session messages (only for session switches)
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-slate-500 text-sm">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 && !streamingState ? (
          // Empty State - Minimal
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="max-w-2xl w-full text-center">
              {/* Simple greeting */}
              <h2 className="text-2xl text-slate-300 font-light mb-2">
                How can I help you?
              </h2>
              <p className="text-slate-500 text-sm mb-10">
                Multiple AI agents collaborate to provide answers
              </p>

              {/* Example prompts - subtle */}
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300
                      border border-slate-700/50 hover:border-slate-600
                      rounded-full transition-colors duration-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <MessageList
              messages={messages}
              onShowKnowledgeGraph={handleShowKnowledgeGraph}
              streamingState={streamingState}
            />

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2">
          <p className="text-sm text-red-400/80 px-4 py-2">
            {error}
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            placeholder="Type your message or drop files for RAG..."
          />
        </div>
      </div>

      {/* Knowledge Graph Popup */}
      <KnowledgeGraphPopup
        data={knowledgeGraphData}
        isOpen={showKnowledgeGraph}
        onClose={() => setShowKnowledgeGraph(false)}
      />
    </div>
  );
}
