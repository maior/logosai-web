'use client';

import { useState, useRef, KeyboardEvent, useEffect, DragEvent, ChangeEvent } from 'react';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/json',
];

const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.csv', '.json'];

const FILE_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pdf: { icon: '📄', color: 'from-red-500/20 to-red-600/10 border-red-500/30', label: 'PDF' },
  txt: { icon: '📝', color: 'from-slate-500/20 to-slate-600/10 border-slate-500/30', label: 'Text' },
  md: { icon: '📑', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30', label: 'Markdown' },
  docx: { icon: '📃', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30', label: 'Word' },
  csv: { icon: '📊', color: 'from-green-500/20 to-green-600/10 border-green-500/30', label: 'CSV' },
  json: { icon: '📋', color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30', label: 'JSON' },
  default: { icon: '📎', color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30', label: 'File' },
};

interface UploadingFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  fileId?: string;
}

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  onFileUpload?: (file: File) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  onFileUpload,
  isLoading = false,
  placeholder = 'Type your message...',
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUploadHint, setShowUploadHint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleSubmit = () => {
    if ((!message.trim() && uploadingFiles.length === 0) || isLoading) return;

    const successFiles = uploadingFiles
      .filter(f => f.status === 'success')
      .map(f => f.file);

    onSend(message.trim(), successFiles.length > 0 ? successFiles : undefined);
    setMessage('');
    setUploadingFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  const isValidFile = (file: File): boolean => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_FILE_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(extension);
  };

  const getFileConfig = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return FILE_TYPE_CONFIG[ext] || FILE_TYPE_CONFIG.default;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(isValidFile);

    if (validFiles.length === 0) {
      return;
    }

    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    for (const file of validFiles) {
      setUploadingFiles(prev =>
        prev.map(f => f.file === file ? { ...f, status: 'uploading' as const, progress: 30 } : f)
      );

      if (onFileUpload) {
        try {
          const result = await onFileUpload(file);
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file
                ? { ...f, status: result.success ? 'success' : 'error', progress: 100, fileId: result.fileId, error: result.error }
                : f
            )
          );
        } catch (error) {
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file ? { ...f, status: 'error', progress: 0, error: (error as Error).message } : f
            )
          );
        }
      } else {
        setUploadingFiles(prev =>
          prev.map(f => f.file === file ? { ...f, status: 'success', progress: 100 } : f)
        );
      }
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasContent = message.trim().length > 0 || uploadingFiles.some(f => f.status === 'success');
  const hasUploadingFiles = uploadingFiles.some(f => f.status === 'uploading');

  return (
    <div
      className={cn('relative p-4', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Elegant Drop Zone Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-2 z-50 rounded-2xl overflow-hidden"
          >
            {/* Animated gradient border */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-gradient-x opacity-80" />
            <div className="absolute inset-[2px] bg-slate-900/95 rounded-2xl backdrop-blur-xl flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </motion.div>
                <p className="text-lg font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Drop files here
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  PDF, TXT, MD, DOCX, CSV, JSON
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded Files - Premium Cards */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 space-y-2"
          >
            {uploadingFiles.map((uploadFile, index) => {
              const fileConfig = getFileConfig(uploadFile.file.name);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, x: -20 }}
                  className={cn(
                    'group relative flex items-center gap-3 px-4 py-3 rounded-xl',
                    'bg-gradient-to-r border backdrop-blur-sm',
                    'transition-all duration-300',
                    uploadFile.status === 'success' && 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
                    uploadFile.status === 'error' && 'from-red-500/10 to-red-600/5 border-red-500/20',
                    uploadFile.status === 'uploading' && 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
                    uploadFile.status === 'pending' && fileConfig.color
                  )}
                >
                  {/* File Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                    'bg-gradient-to-br',
                    uploadFile.status === 'success' && 'from-emerald-500/20 to-emerald-600/10',
                    uploadFile.status === 'error' && 'from-red-500/20 to-red-600/10',
                    uploadFile.status === 'uploading' && 'from-blue-500/20 to-blue-600/10',
                    uploadFile.status === 'pending' && 'from-slate-500/20 to-slate-600/10'
                  )}>
                    {fileConfig.icon}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {formatFileSize(uploadFile.file.size)}
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className={cn(
                        'text-xs font-medium',
                        uploadFile.status === 'success' && 'text-emerald-400',
                        uploadFile.status === 'error' && 'text-red-400',
                        uploadFile.status === 'uploading' && 'text-blue-400',
                        uploadFile.status === 'pending' && 'text-slate-500'
                      )}>
                        {uploadFile.status === 'uploading' && 'Indexing for RAG...'}
                        {uploadFile.status === 'success' && 'Ready'}
                        {uploadFile.status === 'error' && (uploadFile.error || 'Failed')}
                        {uploadFile.status === 'pending' && 'Waiting...'}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    {uploadFile.status === 'uploading' && (
                      <div className="relative w-5 h-5">
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                          <path className="text-blue-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                                d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      </div>
                    )}
                    {uploadFile.status === 'success' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                    {uploadFile.status === 'error' && (
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFile(index)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-700/50 transition-all duration-200"
                    >
                      <svg className="w-4 h-4 text-slate-500 hover:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {uploadFile.status === 'uploading' && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-b-xl overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'easeInOut' }}
                      />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SUPPORTED_EXTENSIONS.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Unified Input Container - Industry Standard Design */}
      <div className={cn(
        'relative flex items-end',
        'bg-slate-800/60 rounded-2xl',
        'border border-slate-700/50',
        'focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20',
        'transition-all duration-200'
      )}>
        {/* Attachment Button - Inside Left */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setShowUploadHint(true)}
            onMouseLeave={() => setShowUploadHint(false)}
            disabled={isLoading || hasUploadingFiles}
            className={cn(
              'group relative w-11 h-11 m-1.5 rounded-xl',
              'flex items-center justify-center',
              'transition-all duration-200 ease-out',
              'hover:bg-slate-700/50',
              'active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          {/* Tooltip */}
          <AnimatePresence>
            {showUploadHint && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/50 shadow-xl whitespace-nowrap z-50"
              >
                <div className="text-xs font-medium text-slate-200">Upload for RAG</div>
                <div className="text-[10px] text-slate-500 mt-0.5">PDF, TXT, MD, DOCX, CSV, JSON</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="border-4 border-transparent border-t-slate-800" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text Input - Center */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className={cn(
            'flex-1 min-h-[44px] max-h-[200px] py-3.5 px-1',
            'bg-transparent',
            'text-slate-200 text-[15px] leading-relaxed',
            'placeholder-slate-500 resize-none',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />

        {/* Send Button - Inside Right */}
        <button
          onClick={handleSubmit}
          disabled={!hasContent || isLoading || hasUploadingFiles}
          className={cn(
            'relative w-10 h-10 m-1.5 rounded-xl overflow-hidden flex-shrink-0',
            'flex items-center justify-center',
            'transition-all duration-200 ease-out',
            hasContent && !isLoading && !hasUploadingFiles
              ? 'bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/20 active:scale-95'
              : 'bg-transparent'
          )}
        >
          {isLoading ? (
            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
              <path className="opacity-80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg
              className={cn(
                'w-5 h-5 transition-all duration-200',
                hasContent && !hasUploadingFiles ? 'text-white' : 'text-slate-500'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Keyboard Hints - Minimal */}
      <div className="flex items-center justify-center gap-4 mt-2.5 text-[11px] text-slate-600">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-slate-800/50 text-slate-500 font-mono text-[10px]">↵</kbd>
          send
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-slate-800/50 text-slate-500 font-mono text-[10px]">⇧↵</kbd>
          new line
        </span>
      </div>
    </div>
  );
}
