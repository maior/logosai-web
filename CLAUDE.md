# CLAUDE.md - logos_web Development Guidelines

Development guide for the logos_web Next.js frontend.

## Project Overview

| Item | Details |
|------|---------|
| **Project Name** | logos_web |
| **Tech Stack** | Next.js 14 + TypeScript + Tailwind CSS |
| **Port** | 8010 |
| **Backend** | logos_api (8090) |
| **Status** | Development |

## Service Architecture

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

## Key Files

| File | Description |
|------|-------------|
| `app/page.tsx` | Main page (login + chat + sidebar) |
| `app/layout.tsx` | Root layout |
| `components/ChatView.tsx` | Unified chat UI component |
| `components/ConversationSidebar.tsx` | Conversation history sidebar (NEW) |
| `components/MessageList.tsx` | Message list display |
| `components/ChatInput.tsx` | Chat input |
| `components/SimpleStreamingIndicator.tsx` | Single-line SSE streaming status indicator |
| `utils/api.ts` | logos_api client |
| `utils/streaming.ts` | SSE streaming handler (includes answer extraction) |
| `utils/auth.ts` | JWT authentication utilities |
| `hooks/useChat.ts` | Chat state management hook |
| `hooks/useConversations.ts` | Conversation list management hook (NEW) |
| `types/index.ts` | TypeScript type definitions (NEW) |

## Starting the Server

```bash
# Install dependencies
cd logos_web
npm install

# Start development server
npm run dev
# → http://localhost:8010

# Production build
npm run build
npm run start
```

## Environment Configuration

`.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8090
NEXT_PUBLIC_API_VERSION=v1
```

## SSE Event Handling

### Supported Events

| Event | Handled | Description |
|-------|---------|-------------|
| `memory_context` | ✅ | User memory loaded (brain badge + purple log) (NEW) |
| `initialization` | ✅ | System initialization |
| `ontology_init` | ✅ | Ontology analysis started |
| `multi_agent_init` | ✅ | Multi-agent processing started |
| `query_analysis_started` | ✅ | Query analysis started |
| `intent_analysis` | ✅ | Intent analysis |
| `agent_scoring` | ✅ | Agent scoring |
| `agents_selected` | ✅ | Agent selection complete |
| `agent_started` | ✅ | Agent execution started |
| `agent_completed` | ✅ | Agent execution completed |
| `integration_started` | ✅ | Result integration started |
| `integration_completed` | ✅ | Result integration completed |
| `final_result` | ✅ | Final result |
| `message_saved` | ✅ | Message saved |
| `error` | ✅ | Error handling |

### final_result Structure

```javascript
// Triple-nested structure handling
{
  "event": "final_result",
  "data": {
    "code": 0,
    "data": {
      "result": "## Result...",
      "agent_results": [...],
      "metadata": {...}
    }
  }
}
```

## Testing

```bash
# Generate JWT token (Python)
python -c "
from datetime import datetime, timedelta, timezone
from jose import jwt
expire = datetime.now(timezone.utc) + timedelta(hours=24)
payload = {'sub': 'test@example.com', 'exp': expire, 'type': 'access'}
print(jwt.encode(payload, 'your-super-secret-key-change-this-in-production', algorithm='HS256'))
"

# Test server connection
curl http://localhost:8010

# Test logos_api connection
curl http://localhost:8090/health
```

## Important Notes

### 1. JWT Token Required
- logos_api requires JWT authentication
- Generate a token using Python for testing
- The email in the token must exist in the database

### 2. CORS Configuration
- API proxy is configured via Next.js rewrites
- `/api/*` → `http://localhost:8090/api/*`

### 3. SSE Streaming (Important)
- Requires `text/event-stream` Accept header
- Be aware of the triple-nested final_result structure
- **CRLF line handling**: Server sends `\r\n`, `rawLine.trim()` is required

## Streaming System Details (CRITICAL)

### Streaming Architecture

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

### Core Components

#### 1. SimpleStreamingIndicator.tsx
- **Role**: Single-line streaming progress display
- **Features**:
  - Animated pulse dot
  - Stage-specific icons (🔍 analyzing, 🎯 selecting, ⚙️ executing, etc.)
  - Shimmer effect text
  - Current agent badge

```typescript
// Usage in ChatView.tsx
{streamingState && streamingState.isProcessing && (
  <SimpleStreamingIndicator state={streamingState} />
)}
```

#### 2. streaming.ts - Answer Extraction Logic
Extracts clean answers from agent responses:

```typescript
// 1. Try extracting answer from agent_results
extractCleanResponse(agentResults)

// 2. Fall back to extracting from the result field
extractAnswerFromContent(rawResult)

// 3. JSON response handling
// "json\n{\"answer\": \"...\", \"source\": \"...\"}" → "..." extraction
```

#### 3. SSE Line Parsing Notes
```typescript
// CRITICAL: CRLF handling is required
for (const rawLine of lines) {
  const line = rawLine.trim();  // Must remove \r!
  if (line.startsWith('event:')) {
    currentEvent = line.slice(6).trim();
  } else if (line.startsWith('data:')) {
    currentData = line.slice(5).trim();
  } else if (line === '' && currentData) {
    // Process event
  }
}
```

### Streaming Stages (STAGE_CONFIG)

| Stage | Icon | Description |
|-------|------|-------------|
| `connecting` | 🔗 | Connecting |
| `initializing` | ⚡ | Initializing |
| `analyzing` | 🔍 | Analyzing query |
| `selecting` | 🎯 | Selecting agents |
| `agents_ready` | 🤖 | Agents ready |
| `planning` | 📋 | Planning workflow |
| `executing` | ⚙️ | Executing |
| `integrating` | 🔄 | Integrating results |
| `streaming` | 📡 | Generating response |
| `completed` | ✨ | Completed |

### Test Commands

```bash
# Direct SSE streaming test
curl -s -X POST 'http://localhost:8090/api/v1/chat/stream' \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"query": "1+1", "email": "test@example.com"}'

# Count events
curl ... | grep "^event:" | wc -l

# Check final_result only
curl ... | grep "final_result" -A 1
```

### Debugging

Check in browser console:
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

### Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| 0 events received | CRLF line handling missing | Verify `rawLine.trim()` |
| JSON response displayed raw | Answer extraction failed | Check `extractAnswerFromContent` |
| Message appears then disappears | React state issue | Check `messageReceivedRef` |
| Result truncated (e.g., 277 chars) | LLM response truncated at ACP server | See below |

### Result Truncation Issue (CRITICAL)

**Symptom**: Response ends with `"reasoning":...` and is truncated at around 277 characters

**Cause**: LLM response is truncated at the ACP server level
- `agent_results[].result.content` contains incomplete JSON
- Truncated in the form `"answer": "...", "source": "...", "reasoning":...`

**Frontend workaround** (streaming.ts):
```typescript
// Can extract answer even from truncated JSON
const answerMatch = jsonStr.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
if (answerMatch) {
  return answerMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
```

**Root cause fix**: Check response length limits in the ACP server or LLM agents
- Review agent code in `logosai/logosai/examples/agents/`
- Check `max_tokens` settings in LLM API calls (llm_search_agent: 3000, internet_agent: 50000, etc.)

## Related Fixes (2026-01-30)

### task_classifier_agent Template Bug Fix (Resolved)
**File**: `logosai/logosai/examples/agents/task_classifier_agent.py` (lines 318-332)

**Problem**: Langchain ChatPromptTemplate mistakenly treated curly braces as template variables
1. Pydantic's `get_format_instructions()` includes JSON examples (`{...}`)
2. agents.json capabilities stored as dicts, producing curly braces when stringified

**Error**: `'Input to ChatPromptTemplate is missing variables {"'id'"}'`

**Fix (2026-01-31)**:
```python
# Escape curly braces in both format_instructions and agent_descriptions
format_instructions = self.output_parser.get_format_instructions()
format_instructions_escaped = format_instructions.replace("{", "{{").replace("}", "}}")

agent_descriptions_joined = "\n".join(agent_descriptions)
agent_descriptions_escaped = agent_descriptions_joined.replace("{", "{{").replace("}", "}}")

formatted_system_template = system_template.format(
    agent_descriptions=agent_descriptions_escaped,
    format_instructions=format_instructions_escaped
)
```

### Ontology System Verification (Confirmed Working)

- `unified_query_processor.py` uses LLM-based agent selection (`_select_agent_by_llm()`)
- No hardcoded keyword matching (Samsung domain exception for business requirements)
- Agent metadata (description, capabilities, tags) is passed to the LLM for semantic matching

## Conversation History Sidebar (NEW 2026-02-03)

### Features

- **Conversation list**: Displays all user conversation sessions
- **Conversation switching**: Click to load a previous conversation
- **New conversation**: Create a new session with the "New Chat" button
- **Conversation deletion**: Double-click to confirm and delete
- **Collapse/expand**: Toggle button to show/hide the sidebar

### Usage

```
1. After login, click the left arrow button to open the sidebar
2. Select a previous conversation from the list to load message history
3. Click "New Chat" button to start a new conversation
4. Hover over a conversation item to reveal the delete button
5. Click the delete button twice to confirm deletion
```

### Architecture

```
page.tsx (state management)
    ├── ConversationSidebar (conversation list)
    │   ├── New Chat button
    │   ├── Conversation list (Session[])
    │   └── Delete confirmation logic
    │
    └── ChatView (chat UI)
        ├── sessionId prop → load session
        ├── loadMessages → restore messages
        └── sendMessage → send message
```

### API Integration

| Feature | API | Description |
|---------|-----|-------------|
| Session list | `GET /api/v1/sessions` | Retrieve user conversation list |
| Session creation | `POST /api/v1/sessions` | Create a new conversation session |
| Session deletion | `DELETE /api/v1/sessions/{id}` | Delete a conversation session |
| Message retrieval | `GET /api/v1/sessions/{id}/messages` | Retrieve session messages |

### Authentication

logos_api supports both JWT and email-based authentication.
For Google OAuth users, authentication is done via the `X-User-Email` header.

```typescript
// utils/api.ts - getHeaders()
export function getHeaders(): HeadersInit {
  const token = tokenManager.getToken();
  const email = tokenManager.getEmail();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(email ? { 'X-User-Email': email } : {}),
  };
}
```

### logosus Schema Compatibility

Updated to match the logos_api logosus schema migration:
- User identification: UUID `user_id` (internal), `email` (API-compatible)
- Conversation sessions: `Conversation` model (logosus.conversations table)
- Messages: `Message` model (logosus.messages table)

## Backend Changes Require E2E Testing (MANDATORY)

When the SSE response format in logos_api changes, you must verify compatibility with the `streaming.ts` extraction logic in logos_web.

**Key verification items**:
1. `final_result` event triple-nested structure (`data.data.result`) parses correctly
2. `extractCleanResponse(agentResults)` extracts the answer successfully
3. `extractAnswerFromContent(content)` handles JSON/text correctly
4. Actual answer is displayed instead of "No response received."

> For detailed testing procedures, refer to the "Mandatory E2E Test Rules" section in `logos_api/CLAUDE.md`

## Related Documentation

- [../logos_api/CLAUDE.md](../logos_api/CLAUDE.md) - Backend API guide
- [../CLAUDE.md](../CLAUDE.md) - Main project guide

## Memory UI Indicator (NEW 2026-02-08)

When user memories are loaded, visual feedback is displayed in the streaming UI:

### StreamingState Extension

```typescript
// utils/streaming.ts
export interface StreamingState {
  // ... existing fields ...
  memoryCount?: number;  // Number of loaded memories
}
```

### memory_context SSE Event Handling

```typescript
// streaming.ts processEvent()
case 'memory_context':
  return {
    state: { ...currentState, memoryCount: data.memory_count || 0 },
  };
```

### UI Display

| Location | Component | Display |
|----------|-----------|---------|
| Streaming log | `SimpleStreamingIndicator.tsx` | `🧠 User memories: 3 referenced` (purple) |
| Processing label | `MessageList.tsx` (ThinkingMessage) | `🧠 3` badge (purple) |

### SSE Event Order

```
[memory_context] → initialization → ontology_init → ... → final_result → message_saved
```

`memory_context` is only emitted for users with existing memories, and it appears before `initialization`.

---

*Last updated: 2026-02-08 (Memory UI indicator, memory_context event handling)*
