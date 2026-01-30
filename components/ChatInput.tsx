'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder = '메시지를 입력하세요...',
  className,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        'flex items-end gap-2 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600',
          'bg-white dark:bg-gray-700 px-4 py-3',
          'text-gray-900 dark:text-gray-100 placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200'
        )}
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
        className={cn(
          'flex-shrink-0 p-3 rounded-lg',
          'bg-blue-500 hover:bg-blue-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors duration-200'
        )}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
