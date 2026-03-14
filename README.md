# logos_web

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Next.js frontend for the LogosAI multi-agent system.**

Provides a real-time AI chat interface powered by SSE streaming, integrated with logos_api (FastAPI backend).

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Integration](#api-integration)
- [SSE Events](#sse-events)
- [Development Guide](#development-guide)
- [Related Projects](#related-projects)

## Architecture

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

## Features

### Authentication
- Google OAuth sign-in (NextAuth.js)
- Session-based authentication management
- Email-based API authentication

### Chat Interface
- Real-time message streaming
- Markdown rendering (GFM support)
- Syntax-highlighted code blocks
- Rich formatting support for tables, lists, and more

### Agent Monitoring
- Real-time agent execution status display
- Progress bar visualization
- Per-agent execution time and confidence score display
- Multi-agent collaboration result visualization

### UI/UX
- Automatic dark/light mode detection
- Responsive design
- Auto-scroll to latest messages
- Loading state indicators

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.5 |
| **Styling** | Tailwind CSS 3.4 |
| **Typography** | @tailwindcss/typography |
| **Markdown** | react-markdown + remark-gfm |
| **Icons** | Lucide React |
| **Utilities** | clsx, tailwind-merge |

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- [logos_api](https://github.com/maior/logosai-api) server running (port 8090)
- ACP server running (port 8888) — use `SimpleACPServer` or `samples/sample_acp_server.py` from [logosai-framework](https://github.com/maior/logosai-framework)

### Installation

```bash
# Clone the repository
git clone git@github.com:maior/logosai-web.git
cd logosai-web

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your settings

# Start the development server
npm run dev
```

### Access

Open http://localhost:8010 in your browser.

### Testing Google Sign-In

1. Set Google OAuth environment variables in `.env.local`
2. Start the server with `npm run dev`
3. Navigate to http://localhost:8010
4. Click "Continue with Google"
5. Sign in with your Google account

## Project Structure

```
logos_web/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page (login + chat)
│
├── components/                   # React components
│   ├── ChatView.tsx              # Chat integration component
│   ├── ChatInput.tsx             # Message input field
│   ├── MessageList.tsx           # Message list display
│   └── StreamingProgress.tsx     # SSE streaming status
│
├── hooks/                        # Custom React Hooks
│   └── useChat.ts                # Chat state management
│
├── utils/                        # Utilities
│   ├── api.ts                    # logos_api client
│   ├── auth.ts                   # JWT authentication utilities
│   ├── streaming.ts              # SSE streaming handler
│   └── cn.ts                     # className utility
│
├── .env.local                    # Environment variables (git-ignored)
├── CLAUDE.md                     # Claude Code development guide
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## Configuration

### .env.local

```bash
# logos_api server URL
NEXT_PUBLIC_API_URL=http://localhost:8090

# API version
NEXT_PUBLIC_API_VERSION=v1

# Google OAuth (NextAuth.js)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret-key
NEXTAUTH_URL=http://localhost:8010
```

### Google OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **APIs & Services > Credentials > Create Credentials > OAuth Client ID**
3. Set Application type to **Web application**
4. Add Authorized redirect URI: `http://localhost:8010/api/auth/callback/google`
5. Copy the Client ID and Client Secret into `.env.local`

### next.config.js

The configuration includes API proxy rewrites to avoid CORS issues when communicating with logos_api:

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

## API Integration

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/api/v1/chat/stream` | POST | Chat streaming (SSE) |
| `/api/v1/sessions` | GET | List sessions |
| `/api/v1/sessions` | POST | Create a new session |
| `/api/v1/sessions/{id}` | GET | Get session details |
| `/api/v1/sessions/{id}/messages` | GET | Get message history |

### Authentication Headers

All API requests require a JWT token:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## SSE Events

Server-Sent Events received from logos_api:

| Event | Description | Action |
|-------|-------------|--------|
| `initialization` | System initialization | Progress 10% |
| `ontology_init` | Ontology analysis started | Progress 10% |
| `multi_agent_init` | Multi-agent processing started | Status update |
| `query_analysis_started` | Query analysis started | Progress 20% |
| `intent_analysis` | Intent analysis in progress/completed | Progress 20% |
| `agent_scoring` | Agent scoring | Progress 30% |
| `agents_selected` | Agent selection completed | Display agent list |
| `agent_started` | Agent execution started | Status: running |
| `agent_completed` | Agent execution completed | Status: completed |
| `integration_started` | Result integration started | Progress 85% |
| `integration_completed` | Result integration completed | Progress 90% |
| `final_result` | Final result | Display message |
| `message_saved` | Message saved | Progress 100% |
| `error` | Error occurred | Display error message |

### final_result Structure

```json
{
  "event": "final_result",
  "data": {
    "code": 0,
    "msg": "success",
    "data": {
      "result": "## Result in markdown...",
      "reasoning": "Agent collaboration explanation",
      "agent_results": [
        {
          "agent_id": "calculator_agent",
          "agent_name": "Calculator Agent",
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

## Development Guide

### Scripts

```bash
# Development server (port 8010)
npm run dev

# Production build
npm run build

# Production server
npm run start

# Lint check
npm run lint
```

### Adding a New Component

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
      {/* Content */}
    </div>
  );
}
```

### Adding a New API Utility

```typescript
// Add to utils/api.ts
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

## Related Projects

| Project | Description | Repository |
|---------|-------------|------------|
| **logosai-api** | FastAPI backend server | [github.com/maior/logosai-api](https://github.com/maior/logosai-api) |
| **logosai-framework** | Python SDK + Agent Runtime | [github.com/maior/logosai-framework](https://github.com/maior/logosai-framework) |
| **logosai-ontology** | Ontology-based multi-agent orchestration | [github.com/maior/logosai-ontology](https://github.com/maior/logosai-ontology) |

## License

MIT License - See the [LICENSE](LICENSE) file for details.

---

**LogosAI Team** - [https://logosai.info](https://logosai.info)
