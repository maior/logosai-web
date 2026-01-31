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
| `components/SimpleStreamingIndicator.tsx` | 단일 라인 SSE 스트리밍 상태 표시 ⭐ |
| `utils/api.ts` | logos_api 클라이언트 |
| `utils/streaming.ts` | SSE 스트리밍 처리 (answer 추출 포함) ⭐ |
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

### 3. SSE 스트리밍 ⭐ 중요
- `text/event-stream` Accept 헤더 필요
- 3중 중첩된 final_result 구조 주의
- **CRLF 라인 처리**: 서버가 `\r\n` 전송, `rawLine.trim()` 필수

## 스트리밍 시스템 상세 ⭐⭐ CRITICAL

### 스트리밍 아키텍처

```
User Input → useChat.ts → startChatStream() → SSE Events → UI Update
                              ↓
                    streaming.ts (processEvent)
                              ↓
               ┌──────────────┼──────────────┐
               ↓              ↓              ↓
        State Update    Final Message    Error Handle
               ↓              ↓
     SimpleStreamingIndicator  MessageList
```

### 핵심 컴포넌트

#### 1. SimpleStreamingIndicator.tsx
- **역할**: 단일 라인 스트리밍 진행상황 표시
- **기능**:
  - 애니메이션 펄스 도트
  - 단계별 아이콘 (🔍 분석, 🎯 선택, ⚙️ 실행 등)
  - 시머 효과 텍스트
  - 현재 에이전트 뱃지

```typescript
// ChatView.tsx에서 사용
{streamingState && streamingState.isProcessing && (
  <SimpleStreamingIndicator state={streamingState} />
)}
```

#### 2. streaming.ts - Answer 추출 로직
에이전트 응답에서 깔끔한 answer만 추출:

```typescript
// 1. agent_results에서 answer 추출 시도
extractCleanResponse(agentResults)

// 2. 실패하면 result 필드에서 시도
extractAnswerFromContent(rawResult)

// 3. JSON 응답 처리
// "json\n{\"answer\": \"...\", \"source\": \"...\"}" → "..." 추출
```

#### 3. SSE 라인 파싱 주의사항
```typescript
// ⚠️ CRITICAL: CRLF 처리 필수
for (const rawLine of lines) {
  const line = rawLine.trim();  // \r 제거 필수!
  if (line.startsWith('event:')) {
    currentEvent = line.slice(6).trim();
  } else if (line.startsWith('data:')) {
    currentData = line.slice(5).trim();
  } else if (line === '' && currentData) {
    // 이벤트 처리
  }
}
```

### 스트리밍 단계 (STAGE_CONFIG)

| 단계 | 아이콘 | 설명 |
|------|--------|------|
| `connecting` | 🔗 | 연결 중 |
| `initializing` | ⚡ | 초기화 중 |
| `analyzing` | 🔍 | 쿼리 분석 중 |
| `selecting` | 🎯 | 에이전트 선택 중 |
| `agents_ready` | 🤖 | 에이전트 준비 완료 |
| `planning` | 📋 | 워크플로우 계획 중 |
| `executing` | ⚙️ | 실행 중 |
| `integrating` | 🔄 | 결과 통합 중 |
| `streaming` | 📡 | 응답 생성 중 |
| `completed` | ✨ | 완료 |

### 테스트 명령어

```bash
# SSE 스트리밍 직접 테스트
curl -s -X POST 'http://localhost:8090/api/v1/chat/stream' \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"query": "1+1", "email": "test@example.com"}'

# 이벤트 수 확인
curl ... | grep "^event:" | wc -l

# final_result만 확인
curl ... | grep "final_result" -A 1
```

### 디버깅

브라우저 콘솔에서 확인:
```
[useChat] Starting chat stream...
[SSE] Event: initialization
[SSE] Event: agents_selected
[SSE] Event: agent_started
[SSE] Event: agent_completed
[SSE] Event: final_result
[Streaming] final_result parsed: {hasAnswer: true, answerLength: 123, ...}
[useChat] Received message via onMessage callback
```

### 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| 0 events 수신 | CRLF 라인 처리 안됨 | `rawLine.trim()` 확인 |
| JSON 응답 그대로 표시 | answer 추출 실패 | `extractAnswerFromContent` 확인 |
| 메시지 나타났다 사라짐 | React 상태 문제 | `messageReceivedRef` 확인 |
| 결과 잘림 (277자 등) | ACP 서버에서 LLM 응답 잘림 | 아래 참조 |

### ⚠️ 결과 잘림 문제 (CRITICAL)

**증상**: 응답이 `"reasoning":...`로 끝나며 277자 정도에서 잘림

**원인**: ACP 서버에서 LLM 응답이 잘려서 전달됨
- `agent_results[].result.content`에 불완전한 JSON 포함
- `"answer": "...", "source": "...", "reasoning":...` 형태로 잘림

**프론트엔드 대응** (streaming.ts):
```typescript
// 잘린 JSON에서도 answer 추출 가능
const answerMatch = jsonStr.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
if (answerMatch) {
  return answerMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
```

**근본 해결**: ACP 서버 또는 LLM 에이전트의 응답 길이 제한 확인 필요
- `logosai/logosai/examples/agents/` 에이전트 코드 확인
- LLM API 호출 시 `max_tokens` 설정 확인 (llm_search_agent: 3000, internet_agent: 50000 등)

## 관련 수정 사항 (2026-01-30)

### ✅ task_classifier_agent 템플릿 버그 수정 (완료)
**파일**: `logosai/logosai/examples/agents/task_classifier_agent.py` (lines 318-332)

**문제**: Langchain ChatPromptTemplate이 중괄호를 템플릿 변수로 오인
1. Pydantic의 `get_format_instructions()`가 JSON 예시(`{...}`) 포함
2. agents.json의 capabilities가 dict로 저장되어 문자열화 시 중괄호 포함

**에러**: `'Input to ChatPromptTemplate is missing variables {"'id'"}'`

**수정 (2026-01-31)**:
```python
# format_instructions와 agent_descriptions 모두 중괄호 이스케이프 처리
format_instructions = self.output_parser.get_format_instructions()
format_instructions_escaped = format_instructions.replace("{", "{{").replace("}", "}}")

agent_descriptions_joined = "\n".join(agent_descriptions)
agent_descriptions_escaped = agent_descriptions_joined.replace("{", "{{").replace("}", "}}")

formatted_system_template = system_template.format(
    agent_descriptions=agent_descriptions_escaped,
    format_instructions=format_instructions_escaped
)
```

### ✅ 온톨로지 시스템 확인
**상태**: 정상 작동

- `unified_query_processor.py`가 LLM 기반 에이전트 선택 (`_select_agent_by_llm()`) 사용
- 하드코딩된 키워드 매칭 없음 (Samsung 도메인 예외 - 비즈니스 요구사항)
- 에이전트 메타데이터(description, capabilities, tags)를 LLM에 전달하여 의미론적 매칭

## 관련 문서

- [../logos_api/CLAUDE.md](../logos_api/CLAUDE.md) - 백엔드 API 가이드
- [../CLAUDE.md](../CLAUDE.md) - 메인 프로젝트 가이드

---

*최종 업데이트: 2026-01-31*
