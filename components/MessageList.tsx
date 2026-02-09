'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/utils/cn';
import { Message } from '@/hooks/useChat';
import { KnowledgeGraphData, StreamingState } from '@/utils/streaming';
import { SimpleStreamingIndicator } from './SimpleStreamingIndicator';

interface MessageListProps {
  messages: Message[];
  className?: string;
  onShowKnowledgeGraph?: (data: KnowledgeGraphData) => void;
  streamingState?: StreamingState | null;
}

export function MessageList({ messages, className, onShowKnowledgeGraph, streamingState }: MessageListProps) {
  // Show thinking bubble when streaming is active and the last message is from the user
  // When onMessage fires (assistant message added), last message becomes 'assistant' → bubble disappears
  const showThinking = !!(
    streamingState?.isProcessing &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'user'
  );

  return (
    <div className={cn('py-6 space-y-6', className)}>
      {messages.map((message, idx) => (
        <MessageItem
          key={message.id}
          message={message}
          isLast={idx === messages.length - 1 && !showThinking}
          onShowKnowledgeGraph={onShowKnowledgeGraph}
        />
      ))}
      {showThinking && streamingState && (
        <ThinkingMessage streamingState={streamingState} />
      )}
    </div>
  );
}

// Thinking bubble - renders in assistant message position during streaming
function ThinkingMessage({ streamingState }: { streamingState: StreamingState }) {
  return (
    <div className="px-4">
      <div className="max-w-3xl mx-auto">
        <div className="space-y-2">
          {/* Processing label with ping animation */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            Processing
            {streamingState.memoryCount != null && streamingState.memoryCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                🧠 {streamingState.memoryCount}
              </span>
            )}
          </div>
          {/* Streaming logs with accent border */}
          <div className="pl-3 border-l-2 border-purple-500/20">
            <SimpleStreamingIndicator state={streamingState} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  message,
  isLast,
  onShowKnowledgeGraph
}: {
  message: Message;
  isLast: boolean;
  onShowKnowledgeGraph?: (data: KnowledgeGraphData) => void;
}) {
  const isUser = message.role === 'user';
  const [showDetails, setShowDetails] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const hasKnowledgeGraph = message.knowledgeGraph && message.knowledgeGraph.nodes?.length > 0;

  // Detect if content is HTML that should be rendered in iframe
  const contentType = useMemo(() => {
    if (!message.content || typeof message.content !== 'string') return 'markdown';

    const content = message.content;

    // Full HTML document
    if (content.includes('<html') || content.includes('<!DOCTYPE')) return 'html';

    // HTML fragments with substantial structure
    const htmlPatterns = [/<table[\s>]/i, /<div[\s>]/i, /<style[\s>]/i];
    const hasHtmlTags = htmlPatterns.some(p => p.test(content));
    const hasClosingTags = /<\/[a-z]+>/i.test(content);

    if (hasHtmlTags && hasClosingTags) return 'html';

    return 'markdown';
  }, [message.content]);

  // User message - simple and clean
  if (isUser) {
    return (
      <div className="px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              <p className="text-[15px] text-slate-300 leading-relaxed whitespace-pre-wrap text-right">
                {message.content}
              </p>
              <p className="text-[11px] text-slate-600 mt-1 text-right">
                {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AI Response - natural flow
  return (
    <div className="px-4">
      <div className="max-w-3xl mx-auto">
        {/* Response content */}
        <div className="space-y-3">
          {contentType === 'html' ? (
            <HtmlContent content={message.content} iframeHeight={iframeHeight} setIframeHeight={setIframeHeight} />
          ) : (
            <div className="prose prose-invert prose-slate max-w-none
              prose-p:text-slate-300 prose-p:leading-7 prose-p:text-[15px] prose-p:my-2
              prose-headings:text-slate-200 prose-headings:font-medium prose-headings:mt-4 prose-headings:mb-2
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-strong:text-slate-200 prose-strong:font-medium
              prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-purple-300 prose-code:bg-slate-800/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0 prose-pre:my-3
              prose-ul:text-slate-300 prose-ol:text-slate-300 prose-ul:my-2 prose-ol:my-2
              prose-li:text-slate-300 prose-li:leading-7 prose-li:my-0.5
              prose-blockquote:border-slate-600 prose-blockquote:text-slate-400 prose-blockquote:not-italic
              prose-table:text-sm prose-table:my-3
              prose-th:text-slate-400 prose-th:font-medium prose-th:bg-slate-800/30 prose-th:px-3 prose-th:py-2
              prose-td:text-slate-400 prose-td:px-3 prose-td:py-2 prose-td:border-slate-700/30
              prose-hr:border-slate-700/30 prose-hr:my-4
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code({ node, className, children }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const isInline = !match && !String(children).includes('\n');

                    if (isInline) {
                      return (
                        <code className="text-purple-300 bg-slate-800/50 px-1.5 py-0.5 rounded text-sm">
                          {children}
                        </code>
                      );
                    }

                    return (
                      <CodeBlock language={language}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Timestamp and agent info */}
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span>
              {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.agentResults && message.agentResults.length > 0 && (
              <>
                <span>•</span>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="hover:text-slate-400 transition-colors"
                >
                  {message.agentResults.length} agent{message.agentResults.length > 1 ? 's' : ''} {showDetails ? '▴' : '▾'}
                </button>
              </>
            )}
            {hasKnowledgeGraph && onShowKnowledgeGraph && (
              <>
                <span>•</span>
                <button
                  onClick={() => onShowKnowledgeGraph(message.knowledgeGraph!)}
                  className="flex items-center gap-1 text-purple-400/70 hover:text-purple-400 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                    <path strokeWidth="2" d="M12 1v6m0 6v6M1 12h6m6 0h6" />
                  </svg>
                  Knowledge Graph
                </button>
              </>
            )}
          </div>

          {/* Agent Details - Minimal */}
          {showDetails && message.agentResults && (
            <div className="text-xs text-slate-500 space-y-1 pl-3 border-l border-slate-700/30">
              {message.agentResults.map((ar, idx) => (
                <AgentResultLine key={idx} result={ar} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// HTML content renderer
function HtmlContent({
  content,
  iframeHeight,
  setIframeHeight
}: {
  content: string;
  iframeHeight: number;
  setIframeHeight: (h: number) => void;
}) {
  const isFullDoc = content.includes('<html') || content.includes('<!DOCTYPE');
  const htmlContent = isFullDoc ? content : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: transparent;
      color: #cbd5e1;
      line-height: 1.6;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid rgba(51, 65, 85, 0.3);
    }
    th {
      color: #94a3b8;
      font-weight: 500;
      font-size: 12px;
    }
    tr:last-child td { border-bottom: none; }
    a { color: #a78bfa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1, h2, h3 { color: #e2e8f0; margin: 16px 0 8px; font-weight: 500; }
    h1 { font-size: 18px; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }
    code {
      background: rgba(30, 41, 59, 0.5);
      color: #a78bfa;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 13px;
    }
    pre {
      background: rgba(30, 41, 59, 0.3);
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  return (
    <div className="w-full rounded-lg overflow-hidden">
      <iframe
        srcDoc={htmlContent}
        className="w-full border-0 bg-transparent"
        style={{ height: `${iframeHeight}px`, minHeight: '150px' }}
        onLoad={(e) => {
          const iframe = e.target as HTMLIFrameElement;
          try {
            const h = iframe.contentDocument?.body.scrollHeight || 300;
            setIframeHeight(Math.min(h + 20, 600));
          } catch {
            setIframeHeight(300);
          }
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

// Code block with syntax highlighting
function CodeBlock({ children, language }: { children: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Language display names
  const languageNames: Record<string, string> = {
    python: 'Python',
    py: 'Python',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    cs: 'C#',
    go: 'Go',
    rust: 'Rust',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    sql: 'SQL',
    bash: 'Bash',
    shell: 'Shell',
    sh: 'Shell',
    json: 'JSON',
    yaml: 'YAML',
    xml: 'XML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    markdown: 'Markdown',
    md: 'Markdown',
  };

  const displayLanguage = languageNames[language.toLowerCase()] || language.toUpperCase() || 'Code';

  return (
    <div className="relative group rounded-lg overflow-hidden my-3">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <span className="text-xs font-medium text-slate-400">{displayLanguage}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '16px',
          background: 'rgba(30, 41, 59, 0.5)',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
        showLineNumbers={children.split('\n').length > 5}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: 'rgba(148, 163, 184, 0.4)',
          userSelect: 'none',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// Minimal agent result line
function AgentResultLine({ result }: { result: any }) {
  const agentName = result.agent_name || result.agent_id || 'Agent';
  const confidence = Math.round((result.confidence || 0.8) * 100);
  const executionTime = result.execution_time?.toFixed(1) || '?';

  const formatName = (name: string) => {
    return name
      .replace(/_agent$/i, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{formatName(agentName)}</span>
      <span className="text-slate-600">•</span>
      <span>{executionTime}s</span>
      <span className="text-slate-600">•</span>
      <span className={cn(
        confidence >= 80 ? 'text-slate-400' : confidence >= 60 ? 'text-amber-500/70' : 'text-red-500/70'
      )}>
        {confidence}%
      </span>
    </div>
  );
}
