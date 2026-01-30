'use client';

import { useState, useEffect } from 'react';
import { ChatView } from '@/components/ChatView';
import { tokenManager, checkHealth } from '@/utils/api';
import { isAuthenticated, getCurrentUserEmail } from '@/utils/auth';
import { Bot, LogOut, Wifi, WifiOff, Settings } from 'lucide-react';
import { cn } from '@/utils/cn';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 초기 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      // 토큰 확인
      if (isAuthenticated()) {
        setIsLoggedIn(true);
        setEmail(getCurrentUserEmail() || '');
      }

      // 서버 연결 확인
      try {
        await checkHealth();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    if (!loginEmail.trim() || !loginToken.trim()) return;

    tokenManager.setToken(loginToken);
    tokenManager.setEmail(loginEmail);
    setEmail(loginEmail);
    setIsLoggedIn(true);
    setLoginEmail('');
    setLoginToken('');
  };

  const handleLogout = () => {
    tokenManager.removeToken();
    setIsLoggedIn(false);
    setEmail('');
  };

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500 text-white mb-4">
              <Bot className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              LogosAI
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              멀티 에이전트 AI 시스템
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  JWT 토큰
                </label>
                <textarea
                  value={loginToken}
                  onChange={(e) => setLoginToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  logos_api에서 발급받은 JWT 토큰을 입력하세요
                </p>
              </div>
              <button
                onClick={handleLogin}
                disabled={!loginEmail.trim() || !loginToken.trim()}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                로그인
              </button>
            </div>

            {/* 서버 상태 */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      logos_api 서버 연결됨
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      서버 연결 안됨
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 토큰 생성 안내 */}
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              테스트 토큰 생성 방법
            </h3>
            <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
{`python -c "
from datetime import datetime, timedelta, timezone
from jose import jwt
expire = datetime.now(timezone.utc) + timedelta(hours=24)
payload = {'sub': 'your@email.com', 'exp': expire, 'type': 'access'}
print(jwt.encode(payload, 'your-super-secret-key-change-this-in-production', algorithm='HS256'))
"`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // 메인 채팅 화면
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">
              LogosAI
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              멀티 에이전트 시스템
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 연결 상태 */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
          </div>

          {/* 사용자 정보 */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {email}
          </div>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 채팅 영역 */}
      <main className="flex-1 overflow-hidden">
        <ChatView className="h-full" />
      </main>
    </div>
  );
}
