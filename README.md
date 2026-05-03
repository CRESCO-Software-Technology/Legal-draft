# CLM Platform

An agent-first Contract Lifecycle Management platform. Covers the full contract journey — intake, drafting, negotiation, approval, execution, and post-signature obligations — with AI agents embedded at every stage.

Built as a monorepo with a React frontend, Fastify API, and a Python FastAPI agent service.

> **Build reference:** All phases, decisions, and progress are tracked in [`BUILD_TRACKER.md`](./BUILD_TRACKER.md). Always refer to it before starting new work.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| API | Node 22, Fastify, Prisma, PostgreSQL |
| Agents | Python 3.11, FastAPI, LangGraph |
| AI Providers | Anthropic, OpenAI, Google Gemini (switchable) |
| Queue | BullMQ + Redis |
| Storage | MinIO (S3-compatible) |
| Auth | JWT (RS256) |

---

## Prerequisites

- Node.js 22 LTS — [`nvm install 22 && nvm use 22`](https://github.com/nvm-sh/nvm)
- pnpm 9+ — `npm i -g pnpm`
- Python 3.11+
- Docker Desktop (running)

---

## Setup

```bash
# 1. Clone and enter the project
cd draft-legal

# 2. Copy environment config
cp .env.example .env
# Edit .env — set JWT_SECRET (min 32 chars)
# Add at least one LLM key when ready (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)

# 3. Install Node dependencies (all workspaces)
pnpm install

# 4. Set up the Python environment
cd apps/agents
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

---

## Running

### 1. Infrastructure (PostgreSQL, Redis, MinIO, etc.)
```bash
docker compose up -d
docker compose ps   # wait until all services are healthy
```

### 2. Database
```bash
pnpm --filter api db:generate   # generate Prisma client
pnpm --filter api db:migrate    # run migrations
pnpm --filter api db:seed       # creates admin@demo.com / password123
```

### 3. API — http://localhost:3001
```bash
pnpm --filter api dev
```

### 4. Frontend — http://localhost:5173
```bash
pnpm --filter web dev
```

### 5. Agent service — http://localhost:8000 (optional without LLM key)
```bash
cd apps/agents
source .venv/bin/activate
uvicorn main:app --port 8000 --reload
```

---

## Switching AI Provider / Model

In the chat panel, use the provider and model dropdowns to switch between:
- **Anthropic** — claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5
- **OpenAI** — gpt-4o, gpt-4o-mini, gpt-4-turbo
- **Google** — gemini-1.5-pro, gemini-1.5-flash

Set the corresponding key in `.env` to activate a provider.

---

## Signing

The platform uses a built-in open-source signing system. DocuSign and other third-party e-sign integrations are available in Phase 10 (integrations) and are not required for core platform functionality.

---

## Project structure

```
draft-legal/
├── apps/
│   ├── api/          # Fastify REST API + Prisma
│   ├── web/          # React frontend
│   └── agents/       # Python FastAPI + LangGraph
├── packages/
│   └── types/        # Shared TypeScript types + Zod schemas
├── docs/             # Architecture and phase docs
├── BUILD_TRACKER.md  # Single source of truth for build progress
└── docker-compose.yml
```

---

## Build progress

See [`BUILD_TRACKER.md`](./BUILD_TRACKER.md) for current phase status, decisions log, and what's next.
