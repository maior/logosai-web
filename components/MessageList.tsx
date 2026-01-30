'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils/cn';
import { Message } from '@/hooks/useChat';
import { User, Bot, Clock, Zap } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  className?: string;
}

export function MessageList({ messages, className }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">LogosAI에게 무엇이든 물어보세요</p>
          <p className="text-sm mt-2">
            멀티 에이전트 시스템이 최적의 답변을 제공합니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-4', className)}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* 아바타 */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* 메시지 내용 */}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* 에이전트 결과 상세 (어시스턴트 메시지만) */}
        {!isUser && message.agentResults && message.agentResults.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              참여 에이전트
            </h4>
            <div className="space-y-2">
              {message.agentResults.map((ar, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  <Bot className="w-3 h-3" />
                  <span className="font-medium">{ar.agent_name}</span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {ar.execution_time?.toFixed(2)}s
                  </span>
                  <span className="text-gray-400">
                    ({Math.round((ar.confidence || 0.8) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 타임스탬프 */}
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            isUser ? 'text-blue-100' : 'text-gray-400'
          )}
        >
          <Clock className="w-3 h-3" />
          {message.timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
