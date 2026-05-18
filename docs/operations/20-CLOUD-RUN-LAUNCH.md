# 20 — Cloud Run cheap-launch runbook

> Sister doc to [19-DEPLOYMENT-STRATEGY.md](19-DEPLOYMENT-STRATEGY.md).
> #19 is the future EKS/multi-AZ vision for paying customers; #20 is the
> $0-when-idle path for getting one to two users on the platform tomorrow.
> Both share the same Dockerfiles — the runtime target swaps, the build
> artefacts don't.

## What this runbook ships

Three Cloud Run services (api, agents, gotenberg) + a static SPA on
Firebase Hosting + four managed dependencies (Neon, Upstash, Bonsai, GCS).
Steady-state cost at idle: **$0/month**. The biggest line item once you
have real data is Neon Postgres at ~$19/mo once you cross 0.5 GB.

## One-time setup

### 1. GCP project
```bash
gcloud auth login
gcloud projects create draftlegal-prod   # or use an existing project
gcloud config set project draftlegal-prod
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com
```

### 2. Managed dependencies

| Service | Get | Output |
|---|---|---|
| **Neon** | https://neon.tech free project. Enable `pgvector`. | `DATABASE_URL` |
| **Upstash** | https://upstash.com free Redis DB, region nearest us-central1. | `rediss://...` URL |
| **Bonsai** | https://bonsai.io free sandbox. | ES URL with embedded creds |
| **GCS** | `gsutil mb -l US gs://draftlegal-documents-$(uuidgen \| cut -c1-8 \| tr A-Z a-z)`. Console → Settings → Interoperability → create HMAC key. | bucket name + HMAC access/secret |

### 3. Secrets in Secret Manager
```bash
for s in database-url redis-url elasticsearch-url \
         jwt-secret portal-jwt-secret internal-secret ai-key-enc \
         gcs-hmac-access gcs-hmac-secret \
         anthropic-key openai-key google-key sendgrid-key; do
  gcloud secrets create "$s" --replication-policy=automatic 2>/dev/null || true
done

# Then add a version to each (run once per secret):
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-
# ... repeat for each
```

Generate fresh random values for the JWT / encryption secrets:
```bash
openssl rand -base64 32   # for each of jwt-secret, portal-jwt-secret, internal-secret
openssl rand -base64 32   # for ai-key-enc (must be 32 raw bytes base64'd)
```

### 4. Database schema

Point Prisma at Neon once, locally, before the first API deploy:
```bash
DATABASE_URL="<neon-url>" pnpm --filter api prisma migrate deploy
DATABASE_URL="<neon-url>" pnpm --filter api db:seed
DATABASE_URL="<neon-url>" pnpm --filter api tsx scripts/seed-ai-demo.ts  # optional demo data
```

### 5. Firebase project
```bash
firebase login
firebase projects:create draftlegal-web   # or pick existing
# Edit .firebaserc and put the project ID under projects.default
```

### 6. Env files
```bash
cp env.api.example.yaml env.api.yaml
cp env.agents.example.yaml env.agents.yaml
# Fill in non-secret URLs (FRONTEND_URL, AGENTS_URL, GOTENBERG_URL, S3_BUCKET).
# AGENTS_URL / GOTENBERG_URL aren't known until those services are first deployed —
# leave the REPLACE placeholders, run a first deploy (api will be broken),
# read the URLs from the Cloud Run console, then redeploy api.
```

## Deploy

```bash
./scripts/deploy.sh gotenberg     # standalone, no deps
./scripts/deploy.sh agents        # standalone, no deps
# Update env.api.yaml with the URLs printed by the two commands above
./scripts/deploy.sh api
./scripts/deploy.sh web           # requires VITE_API_URL env var
```

Or all at once after the URLs are filled in:
```bash
VITE_API_URL=https://api.your-domain.com ./scripts/deploy.sh all
```

## DNS (Cloudflare)

- `app.<domain>` → CNAME → Firebase Hosting target (Firebase console gives the value). Proxy can be on.
- `api.<domain>` → Cloud Run domain mapping:
  ```bash
  gcloud beta run domain-mappings create \
    --service api-service \
    --domain api.your-domain.com \
    --region us-central1
  ```
  Add the CNAME records Cloud Run prints into Cloudflare with **proxy OFF**
  (grey cloud) until Let's Encrypt verification finishes. After mapping is
  `Ready`, the proxy can be turned back on with TLS mode "Full (strict)".

## Verification (from the approved plan)

1. **Frontend loads**: `curl -I https://app.<domain>` → 200, HTML.
2. **API health**: `curl https://api.<domain>/health` → 200. First request will cold-start (~1–2s).
3. **DB connected**: hit a route that touches Postgres (e.g. `/auth/login` with bad creds → 401, not 500).
4. **Agents reachable**: trigger an agent flow from the UI; Cloud Run logs for `agents-service` show the internal call.
5. **Search works**: upload a doc, run a portfolio search. Bonsai UI shows doc count > 0.
6. **PDF generation**: generate a contract PDF. Cloud Run logs show `gotenberg` invoked.
7. **Scale-to-zero**: idle for 15 min, all three services show `0` instances in the Cloud Run console.
8. **Cost dashboard**: GCP Billing → today → pennies, not dollars.

## Known issues (pre-existing, not blockers for deploy)

These are real bugs in the source that existed before this runbook landed.
None of them stop the Cloud Run deploy because the API image uses **tsx at
runtime** rather than a pre-compiled `dist/`. Fix when convenient:

- **TypeScript strict-mode errors** (`pnpm typecheck` won't pass): `nodemailer`
  import in `src/workers/notification.worker.ts` (the dep is intentionally
  lazy-loaded but it's a typing miss); ioredis dual-resolve to 5.9.3 + 5.10.0
  in `src/workers/*.worker.ts`; Prisma `conditionalLogic` JSON null mismatch
  in `src/routes/templates.ts:165`.
- **Hocuspocus collab WebSocket** is disabled in this deployment (`COLLAB_DISABLED=1`).
  Cloud Run exposes one port per service. For two-user real-time collab,
  either merge Hocuspocus into the Fastify HTTP server on the same `$PORT`
  or run a fourth Cloud Run service.
- **BullMQ scheduled jobs** only fire when a request hits the API (cold-start
  triggers the worker import). For reliable timed jobs, hook Cloud Scheduler
  to a `/cron/tick` HTTP endpoint every 5–10 minutes — still in free tier.

## Cost ceiling

| Service | Cost at idle / demo |
|---|---|
| Cloud Run (api + agents + gotenberg) | $0 — free 2M req, 360k GB-s, 180k vCPU-s |
| Firebase Hosting | $0 — 10 GB bandwidth, 360 MB/day |
| Neon Postgres free | $0 — 0.5 GB, auto-suspend |
| Upstash Redis free | $0 — 10k commands/day, 256 MB |
| Bonsai sandbox | $0 — 1 GB |
| GCS | $0 — 5 GB-mo, 1 GB egress/mo |
| Cloudflare DNS | $0 |
| Artifact Registry | $0 — 0.5 GB |
| Secret Manager | $0 — 6 active secrets, 10k accesses/mo |
| **Total** | **~$0/mo** |

First upgrade: Neon Launch tier ~$19/mo when Postgres data passes 0.5 GB.
Everything else has comfortable free headroom.
