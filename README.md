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

## Running locally

### 1. Infrastructure (PostgreSQL, Redis, Elasticsearch, MinIO, Gotenberg)
```bash
docker compose up -d
docker compose ps   # wait until all services are healthy
```

The default ports in [`docker-compose.yml`](docker-compose.yml) are remapped to
avoid local conflicts:

| Service | Host port | In-container port |
|---|---|---|
| Postgres (+ pgvector) | **5433** | 5432 |
| Redis | **6380** | 6379 |
| Elasticsearch | 9200 | 9200 |
| MinIO S3 API | **9100** | 9000 |
| MinIO console | **9101** | 9001 |
| Gotenberg | 3002 | 3000 |

Update the URLs in your `.env` accordingly:

```
DATABASE_URL=postgresql://clm:clm@localhost:5433/clm_dev
REDIS_URL=redis://localhost:6380
S3_ENDPOINT=http://localhost:9100
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

## Hosting / deploying

The codebase ships three orchestration paths from the same source. Pick the one
that matches where you are:

| Path | When to use | Cost |
|---|---|---|
| **Local Docker Compose** (above) | Dev machines, internal demos on a laptop | $0 |
| **Cloud Run cheap-launch** | First 1–10 users, public demo, hobby cost | ~$0 idle, grows linearly with traffic |
| **EKS / Kubernetes** (vision: [docs/operations/19-DEPLOYMENT-STRATEGY.md](docs/operations/19-DEPLOYMENT-STRATEGY.md)) | Production with paying customers, multi-AZ | Standard SaaS infra cost |

The Dockerfiles are shared — the same images run on Compose, Cloud Run, EKS,
Render, Fly, or any plain Docker host.

### Deploy to Cloud Run (cheap-launch)

The full step-by-step is in [docs/operations/20-CLOUD-RUN-LAUNCH.md](docs/operations/20-CLOUD-RUN-LAUNCH.md).
Short version:

1. **Managed deps (one-time)** — sign up for [Neon](https://neon.tech) (Postgres),
   [Upstash](https://upstash.com) (Redis), [Bonsai](https://bonsai.io) (Elasticsearch).
   Create a GCS bucket with an HMAC key. Free tiers on all four are enough for a demo.
2. **Run migrations once against Neon**:
   ```bash
   DATABASE_URL="<neon-url>" pnpm --filter api prisma migrate deploy
   DATABASE_URL="<neon-url>" pnpm --filter api db:seed
   ```
3. **Put your secrets in Secret Manager** — `DATABASE_URL`, `REDIS_URL`,
   `ELASTICSEARCH_URL`, JWT secrets, LLM API keys. List + commands are in the runbook.
4. **Copy the env templates and fill in non-secret URLs**:
   ```bash
   cp env.api.example.yaml env.api.yaml
   cp env.agents.example.yaml env.agents.yaml
   ```
5. **Set the Firebase project ID** in [.firebaserc](.firebaserc).
6. **Deploy** — runs three Cloud Run services + the Firebase Hosting frontend:
   ```bash
   gcloud auth login
   firebase login
   VITE_API_URL=https://api.your-domain.com ./scripts/deploy.sh all
   ```
7. **DNS** — point `app.your-domain.com` at Firebase Hosting and `api.your-domain.com`
   at Cloud Run via `gcloud beta run domain-mappings create`. Cloudflare or any DNS
   provider works.

Steady-state cost when idle is roughly **$0/month**. Cold starts on first request
are ~1–2 s for the API and ~3–5 s for agents (Python LangChain imports). The
first thing to outgrow is Neon's 0.5 GB free tier — Neon Launch is ~$19/mo.

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
