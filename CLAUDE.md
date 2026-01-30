# CLAUDE.md - logos_web Development Guidelines

logos_web Next.js 프론트엔드 개발 가이드입니다.

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | logos_web |
| **기술 스택** | Next.js 14 + TypeScript + Tailwind CSS |
| **포트** | 8010 |
| **백엔드** | logos_api (8090) |
| **상태** | 🚧 Development |

## 서비스 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     logos_web Service Architecture                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   User Browser                                                       │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────────────┐                                                │
│   │ logos_web (8010)│  Next.js Frontend                              │
│   │   app/          │                                                │
│   └────────┬────────┘                                                │
│            │ HTTP/SSE                                                │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ logos_api (8090)│  FastAPI Backend                               │
│   │   /api/v1/      │                                                │
│   └────────┬────────┘                                                │
│            │                                                         │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ ACP Server(8888)│  Agent Execution Runtime                       │
│   └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 핵심 파일

| 파일 | 설명 |
|------|------|
| `app/page.tsx` | 메인 페이지 (로그인 + 채팅) |
| `app/layout.tsx` | 루트 레이아웃 |
| `components/ChatView.tsx` | 채팅 UI 통합 컴포넌트 |
| `components/MessageList.tsx` | 메시지 목록 표시 |
| `components/ChatInput.tsx` | 채팅 입력 |
| `components/StreamingProgress.tsx` | SSE 스트리밍 상태 표시 |
| `utils/api.ts` | logos_api 클라이언트 |
| `utils/streaming.ts` | SSE 스트리밍 처리 |
| `utils/auth.ts` | JWT 인증 유틸리티 |
| `hooks/useChat.ts` | 채팅 상태 관리 훅 |

## 서버 시작

```bash
# 의존성 설치
cd logos_web
npm install

# 개발 서버 시작
npm run dev
# → http://localhost:8010

# 프로덕션 빌드
npm run build
npm run start
```

## 환경 설정

`.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8090
NEXT_PUBLIC_API_VERSION=v1
```

## SSE 이벤트 처리

### 지원하는 이벤트

| 이벤트 | 처리 | 설명 |
|--------|------|------|
| `initialization` | ✅ | 시스템 초기화 |
| `ontology_init` | ✅ | 온톨로지 분석 시작 |
| `multi_agent_init` | ✅ | 멀티 에이전트 처리 시작 |
| `query_analysis_started` | ✅ | 쿼리 분석 시작 |
| `intent_analysis` | ✅ | 의도 분석 |
| `agent_scoring` | ✅ | 에이전트 점수화 |
| `agents_selected` | ✅ | 에이전트 선택 완료 |
| `agent_started` | ✅ | 에이전트 실행 시작 |
| `agent_completed` | ✅ | 에이전트 실행 완료 |
| `integration_started` | ✅ | 결과 통합 시작 |
| `integration_completed` | ✅ | 결과 통합 완료 |
| `final_result` | ✅ | 최종 결과 |
| `message_saved` | ✅ | 메시지 저장 완료 |
| `error` | ✅ | 에러 처리 |

### final_result 구조

```javascript
// 3중 중첩 구조 처리
{
  "event": "final_result",
  "data": {
    "code": 0,
    "data": {
      "result": "## 결과...",
      "agent_results": [...],
      "metadata": {...}
    }
  }
}
```

## 테스트

```bash
# JWT 토큰 생성 (Python)
python -c "
from datetime import datetime, timedelta, timezone
from jose import jwt
expire = datetime.now(timezone.utc) + timedelta(hours=24)
payload = {'sub': 'test@example.com', 'exp': expire, 'type': 'access'}
print(jwt.encode(payload, 'your-super-secret-key-change-this-in-production', algorithm='HS256'))
"

# 서버 연결 테스트
curl http://localhost:8010

# logos_api 연결 테스트
curl http://localhost:8090/health
```

## 주의사항

### 1. JWT 토큰 필요
- logos_api는 JWT 인증 필수
- 테스트 시 Python으로 토큰 생성 후 사용
- 토큰에 포함된 이메일이 DB에 존재해야 함

### 2. CORS 설정
- Next.js rewrites로 API 프록시 설정됨
- `/api/*` → `http://localhost:8090/api/*`

### 3. SSE 스트리밍
- `text/event-stream` Accept 헤더 필요
- 3중 중첩된 final_result 구조 주의

## 관련 문서

- [../logos_api/CLAUDE.md](../logos_api/CLAUDE.md) - 백엔드 API 가이드
- [../CLAUDE.md](../CLAUDE.md) - 메인 프로젝트 가이드

---

*최종 업데이트: 2026-01-30*
