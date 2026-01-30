import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LogosAI - Intelligent Multi-Agent System',
  description: 'LogosAI 멀티 에이전트 AI 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
