'use client';

import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { StreamingProgress } from './StreamingProgress';
import { cn } from '@/utils/cn';

interface ChatViewProps {
  sessionId?: string;
  className?: string;
}

export function ChatView({ sessionId, className }: ChatViewProps) {
  const { messages, streamingState, isLoading, error, sendMessage, clearMessages } =
    useChat(sessionId);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />

        {/* 스트리밍 상태 표시 */}
        {streamingState && streamingState.isProcessing && (
          <div className="px-4 pb-4">
            <StreamingProgress state={streamingState} />
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 입력 영역 */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        placeholder="LogosAI에게 무엇이든 물어보세요..."
      />
    </div>
  );
}
