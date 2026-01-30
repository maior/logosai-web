'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { ChatView } from '@/components/ChatView';
import { checkHealth } from '@/utils/api';
import { Bot, LogOut, Wifi, WifiOff } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

export default function Home() {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);

  // 서버 연결 상태 확인
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await checkHealth();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    // 30초마다 연결 상태 확인
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/' });
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  // 로딩 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500 text-white mb-4 animate-pulse">
            <Bot className="w-10 h-10" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 화면
  if (!session) {
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
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              <FcGoogle className="w-5 h-5" />
              Google로 계속하기
            </button>

            <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
              Google 계정으로 로그인하여 LogosAI의 모든 기능을 사용하세요
            </p>

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
          <div className="flex items-center gap-2">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || ''}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {session.user?.email}
            </span>
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
        <ChatView className="h-full" email={session.user?.email || ''} />
      </main>
    </div>
  );
}
