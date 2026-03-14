# logos_web

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**LogosAI 멀티 에이전트 시스템을 위한 Next.js 프론트엔드**

logos_api (FastAPI 백엔드)와 연동하여 실시간 SSE 스트리밍 기반의 AI 채팅 인터페이스를 제공합니다.

## 📋 목차

- [아키텍처](#-아키텍처)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
- [프로젝트 구조](#-프로젝트-구조)
- [환경 설정](#-환경-설정)
- [API 연동](#-api-연동)
- [SSE 이벤트](#-sse-이벤트)
- [개발 가이드](#-개발-가이드)
- [관련 프로젝트](#-관련-프로젝트)

## 🏗 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LogosAI Architecture                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   User Browser                                                       │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────────────┐                                                │
│   │ logos_web (8010)│  Next.js Frontend          ◄── You are here   │
│   │                 │  - React 18                                    │
│   │                 │  - TypeScript                                  │
│   │                 │  - Tailwind CSS                                │
│   └────────┬────────┘                                                │
│            │ HTTP/SSE (JWT Auth)                                     │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ logos_api (8090)│  FastAPI Backend                               │
│   │                 │  - SQLAlchemy 2.0 (async)                      │
│   │                 │  - PostgreSQL                                  │
│   │                 │  - JWT Authentication                          │
│   └────────┬────────┘                                                │
│            │ HTTP/SSE                                                │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ ACP Server(8888)│  Agent Communication Protocol                  │
│   │                 │  - Multi-Agent Orchestration                   │
│   │                 │  - LLM-based Agent Selection                   │
│   │                 │  - 44+ Specialized Agents                      │
│   └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## ✨ 주요 기능

### 🔐 인증
- Google OAuth 로그인 (NextAuth.js)
- 세션 기반 인증 관리
- 이메일 기반 API 인증

### 💬 채팅 인터페이스
- 실시간 메시지 스트리밍
- 마크다운 렌더링 (GFM 지원)
- 코드 블록 하이라이팅
- 테이블, 리스트 등 풍부한 포맷 지원

### 📊 에이전트 모니터링
- 실시간 에이전트 실행 상태 표시
- 프로그레스 바로 진행률 시각화
- 각 에이전트 실행 시간 및 신뢰도 표시
- 멀티 에이전트 협업 결과 시각화

### 🎨 UI/UX
- 다크/라이트 모드 자동 감지
- 반응형 디자인
- 스크롤 자동 이동
- 로딩 상태 인디케이터

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.5 |
| **Styling** | Tailwind CSS 3.4 |
| **Typography** | @tailwindcss/typography |
| **Markdown** | react-markdown + remark-gfm |
| **Icons** | Lucide React |
| **Utilities** | clsx, tailwind-merge |

## 🚀 시작하기

### 사전 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- logos_api 서버 실행 중 (port 8090)
- ACP 서버 실행 중 (port 8888)

### 설치

```bash
# 저장소 클론
git clone git@github.com:maior/logosai-web.git
cd logosai-web

# 의존성 설치
npm install

# 환경 설정
cp .env.example .env.local
# .env.local 파일 수정

# 개발 서버 시작
npm run dev
```

### 접속

브라우저에서 http://localhost:8010 접속

### Google 로그인 테스트

1. `.env.local`에 Google OAuth 환경변수 설정
2. `npm run dev`로 서버 시작
3. http://localhost:8010 접속
4. "Google로 계속하기" 버튼 클릭
5. Google 계정으로 로그인

## 📁 프로젝트 구조

```
logos_web/
├── app/                          # Next.js App Router
│   ├── globals.css               # 전역 스타일
│   ├── layout.tsx                # 루트 레이아웃
│   └── page.tsx                  # 메인 페이지 (로그인 + 채팅)
│
├── components/                   # React 컴포넌트
│   ├── ChatView.tsx              # 채팅 통합 컴포넌트
│   ├── ChatInput.tsx             # 메시지 입력창
│   ├── MessageList.tsx           # 메시지 목록
│   └── StreamingProgress.tsx     # SSE 스트리밍 상태
│
├── hooks/                        # Custom React Hooks
│   └── useChat.ts                # 채팅 상태 관리
│
├── utils/                        # 유틸리티
│   ├── api.ts                    # logos_api 클라이언트
│   ├── auth.ts                   # JWT 인증 유틸리티
│   ├── streaming.ts              # SSE 스트리밍 처리
│   └── cn.ts                     # className 유틸리티
│
├── .env.local                    # 환경 변수 (git 제외)
├── CLAUDE.md                     # Claude Code 개발 가이드
├── next.config.js                # Next.js 설정
├── tailwind.config.ts            # Tailwind 설정
├── tsconfig.json                 # TypeScript 설정
└── package.json                  # 의존성 및 스크립트
```

## ⚙️ 환경 설정

### .env.local

```bash
# logos_api 서버 URL
NEXT_PUBLIC_API_URL=http://localhost:8090

# API 버전
NEXT_PUBLIC_API_VERSION=v1

# Google OAuth (NextAuth.js)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret-key
NEXTAUTH_URL=http://localhost:8010
```

### Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **APIs & Services > Credentials > Create Credentials > OAuth Client ID**
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:8010/api/auth/callback/google`
5. Client ID와 Client Secret을 `.env.local`에 설정

### next.config.js

API 프록시 설정이 포함되어 있어 CORS 문제 없이 logos_api와 통신합니다:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8090/api/:path*',
    },
  ];
}
```

## 🔌 API 연동

### 주요 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 서버 상태 확인 |
| `/api/v1/chat/stream` | POST | 채팅 스트리밍 (SSE) |
| `/api/v1/sessions` | GET | 세션 목록 조회 |
| `/api/v1/sessions` | POST | 새 세션 생성 |
| `/api/v1/sessions/{id}` | GET | 세션 상세 조회 |
| `/api/v1/sessions/{id}/messages` | GET | 메시지 히스토리 |

### 인증 헤더

모든 API 요청에 JWT 토큰이 필요합니다:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## 📡 SSE 이벤트

logos_api로부터 수신하는 Server-Sent Events:

| 이벤트 | 설명 | 처리 |
|--------|------|------|
| `initialization` | 시스템 초기화 | 프로그레스 10% |
| `ontology_init` | 온톨로지 분석 시작 | 프로그레스 10% |
| `multi_agent_init` | 멀티 에이전트 처리 시작 | 상태 업데이트 |
| `query_analysis_started` | 쿼리 분석 시작 | 프로그레스 20% |
| `intent_analysis` | 의도 분석 중/완료 | 프로그레스 20% |
| `agent_scoring` | 에이전트 점수화 | 프로그레스 30% |
| `agents_selected` | 에이전트 선택 완료 | 에이전트 목록 표시 |
| `agent_started` | 에이전트 실행 시작 | 상태: running |
| `agent_completed` | 에이전트 실행 완료 | 상태: completed |
| `integration_started` | 결과 통합 시작 | 프로그레스 85% |
| `integration_completed` | 결과 통합 완료 | 프로그레스 90% |
| `final_result` | 최종 결과 | 메시지 표시 |
| `message_saved` | 메시지 저장 완료 | 프로그레스 100% |
| `error` | 에러 발생 | 에러 메시지 표시 |

### final_result 구조

```json
{
  "event": "final_result",
  "data": {
    "code": 0,
    "msg": "success",
    "data": {
      "result": "## 결과 마크다운...",
      "reasoning": "에이전트 협업 설명",
      "agent_results": [
        {
          "agent_id": "calculator_agent",
          "agent_name": "계산기 에이전트",
          "result": { "title": "...", "content": "..." },
          "execution_time": 0.42,
          "confidence": 0.8
        }
      ],
      "metadata": {
        "total_agents": 1,
        "successful_agents": 1,
        "execution_time": 0.49
      }
    }
  }
}
```

## 👨‍💻 개발 가이드

### 스크립트

```bash
# 개발 서버 (포트 8010)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버
npm run start

# 린트 검사
npm run lint
```

### 새 컴포넌트 추가

```typescript
// components/MyComponent.tsx
'use client';

import { cn } from '@/utils/cn';

interface MyComponentProps {
  className?: string;
}

export function MyComponent({ className }: MyComponentProps) {
  return (
    <div className={cn('base-classes', className)}>
      {/* 내용 */}
    </div>
  );
}
```

### 새 API 유틸리티 추가

```typescript
// utils/api.ts에 추가
export async function myApiCall(param: string): Promise<MyResponse> {
  const response = await fetch(`${API_BASE}/endpoint`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ param }),
  });
  if (!response.ok) throw new Error('API call failed');
  return response.json();
}
```

## 🔗 관련 프로젝트

| 프로젝트 | 설명 | 저장소 |
|----------|------|--------|
| **logosai-api** | FastAPI 백엔드 서버 | [github.com/maior/logosai-api](https://github.com/maior/logosai-api) |
| **logosai-framework** | Python SDK + Agent Runtime | [github.com/maior/logosai-framework](https://github.com/maior/logosai-framework) |
| **logosai-ontology** | 온톨로지 멀티에이전트 오케스트레이션 | [github.com/maior/logosai-ontology](https://github.com/maior/logosai-ontology) |

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

**LogosAI Team** - [https://logosai.info](https://logosai.info)
