#!/usr/bin/env bash
# Deploy the three Cloud Run services + Firebase Hosting frontend.
#
# Prereqs (one-time, see docs/operations/20-CLOUD-RUN-LAUNCH.md):
#   - gcloud auth login + gcloud config set project <your-project>
#   - firebase login + a Firebase project linked in .firebaserc
#   - All secrets created in Secret Manager (see secrets section in the runbook)
#   - env.api.yaml and env.agents.yaml present at repo root (copy from .example,
#     fill in non-secret URLs/IDs — secrets live in Secret Manager, NOT here)
#
# Usage:
#   ./scripts/deploy.sh all          # full deploy (api + agents + gotenberg + web)
#   ./scripts/deploy.sh api
#   ./scripts/deploy.sh agents
#   ./scripts/deploy.sh gotenberg
#   ./scripts/deploy.sh web
#
# Environment overrides (sensible defaults already set):
#   GCP_PROJECT, GCP_REGION
set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
GCP_REGION="${GCP_REGION:-us-central1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${GCP_PROJECT}" ]]; then
  echo "GCP_PROJECT is not set and gcloud has no default project. Run: gcloud config set project <id>" >&2
  exit 1
fi

echo "Project : ${GCP_PROJECT}"
echo "Region  : ${GCP_REGION}"
echo

cmd="${1:-all}"

# Dedicated runtime service accounts (least-privilege). Created once via
# `gcloud iam service-accounts create cr-api / cr-agents` and granted
# per-secret accessor on Secret Manager. Gotenberg needs no secrets so
# it runs as the default compute SA.
API_SA="${API_SA:-cr-api@${GCP_PROJECT}.iam.gserviceaccount.com}"
AGENTS_SA="${AGENTS_SA:-cr-agents@${GCP_PROJECT}.iam.gserviceaccount.com}"

# Comma-separated list of Secret Manager bindings used by api-service.
# Secrets must exist (gcloud secrets create ...) before first deploy.
API_SECRETS="DATABASE_URL=database-url:latest,\
REDIS_URL=redis-url:latest,\
ELASTICSEARCH_URL=elasticsearch-url:latest,\
JWT_SECRET=jwt-secret:latest,\
PORTAL_JWT_SECRET=portal-jwt-secret:latest,\
INTERNAL_SERVICE_SECRET=internal-secret:latest,\
AI_KEY_ENCRYPTION_KEY=ai-key-enc:latest,\
S3_ACCESS_KEY=gcs-hmac-access:latest,\
S3_SECRET_KEY=gcs-hmac-secret:latest,\
ANTHROPIC_API_KEY=anthropic-key:latest,\
OPENAI_API_KEY=openai-key:latest,\
GOOGLE_API_KEY=google-key:latest,\
SENDGRID_API_KEY=sendgrid-key:latest"

AGENTS_SECRETS="INTERNAL_SERVICE_SECRET=internal-secret:latest,\
REDIS_URL=redis-url:latest,\
ANTHROPIC_API_KEY=anthropic-key:latest,\
OPENAI_API_KEY=openai-key:latest,\
GOOGLE_API_KEY=google-key:latest"

# Wave 4 — apply pending Prisma migrations BEFORE any service that reads the
# new schema goes live. Requires reachability to the database (Cloud SQL public
# IP + authorized network, or run from inside the VPC / via the Cloud SQL Auth
# Proxy). The DB URL comes from Secret Manager, never from a committed file.
migrate_db() {
  echo "--- prisma migrate deploy ---"
  local db_url
  db_url="$(gcloud secrets versions access latest --secret=database-url --project="${GCP_PROJECT}")"
  [[ -n "${db_url}" ]] || { echo "could not read database-url secret" >&2; exit 1; }
  ( cd "${ROOT}/apps/api" && DATABASE_URL="${db_url}" pnpm exec prisma migrate deploy )
}

deploy_api() {
  echo "--- deploy api-service ---"
  [[ -f "${ROOT}/env.api.yaml" ]] || { echo "missing env.api.yaml (copy from env.api.example.yaml)" >&2; exit 1; }
  # The repo root has a symlink `Dockerfile -> apps/api/Dockerfile` because
  # the API build context is the repo root (pnpm workspace), and newer gcloud
  # no longer accepts an explicit --dockerfile flag.
  #
  # WORKERS_ENABLED=false — the dedicated worker-service (deploy_workers) runs
  # the BullMQ workers on an always-on instance, so the scale-to-zero API must
  # NOT also consume jobs. GOTENBERG_REQUIRE_AUTH=true — the API sends an OIDC
  # token to the now-private Gotenberg service.
  gcloud run deploy api-service \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --source "${ROOT}" \
    --service-account "${API_SA}" \
    --min-instances 0 --max-instances 2 \
    --memory 1Gi --cpu 1 --concurrency 80 \
    --timeout 300 \
    --port 8080 \
    --env-vars-file "${ROOT}/env.api.yaml" \
    --set-env-vars "WORKERS_ENABLED=false,GOTENBERG_REQUIRE_AUTH=true" \
    --set-secrets "${API_SECRETS}" \
    --allow-unauthenticated
}

# Wave 4 — dedicated always-on worker service. Same image/source as the API but
# runs worker-entrypoint.ts instead of the Fastify app, with --min-instances 1
# + --no-cpu-throttling so time-based jobs (approval escalation, signature
# reminders, renewal scans) actually fire. Not publicly invocable.
deploy_workers() {
  echo "--- deploy worker-service (always-on BullMQ workers) ---"
  [[ -f "${ROOT}/env.api.yaml" ]] || { echo "missing env.api.yaml (copy from env.api.example.yaml)" >&2; exit 1; }
  gcloud run deploy worker-service \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --source "${ROOT}" \
    --service-account "${API_SA}" \
    --command "node" \
    --args "--import,tsx,src/worker-entrypoint.ts" \
    --min-instances 1 --max-instances 1 \
    --no-cpu-throttling \
    --memory 1Gi --cpu 1 \
    --timeout 300 \
    --port 8080 \
    --env-vars-file "${ROOT}/env.api.yaml" \
    --set-secrets "${API_SECRETS}" \
    --no-allow-unauthenticated
}

deploy_agents() {
  echo "--- deploy agents-service ---"
  [[ -f "${ROOT}/env.agents.yaml" ]] || { echo "missing env.agents.yaml (copy from env.agents.example.yaml)" >&2; exit 1; }
  gcloud run deploy agents-service \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --source "${ROOT}/apps/agents" \
    --service-account "${AGENTS_SA}" \
    --min-instances 0 --max-instances 2 \
    --memory 1Gi --cpu 1 --concurrency 40 \
    --timeout 300 \
    --port 8080 \
    --env-vars-file "${ROOT}/env.agents.yaml" \
    --set-secrets "${AGENTS_SECRETS}" \
    --allow-unauthenticated
  # NOTE: --allow-unauthenticated is paired with an app-level
  # `x-internal-secret` middleware in apps/agents/main.py. The API does not
  # fetch OIDC identity tokens before calling agents, so Cloud Run IAM auth
  # is bypassed; the shared secret is what actually gates access.
}

deploy_gotenberg() {
  echo "--- deploy gotenberg (private) ---"
  gcloud run deploy gotenberg \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --image gotenberg/gotenberg:8 \
    --min-instances 0 --max-instances 1 \
    --memory 512Mi --cpu 1 \
    --port 3000 \
    --args "gotenberg,--api-port=3000" \
    --no-allow-unauthenticated
  # Wave 4 — Gotenberg has no built-in auth, so it is kept PRIVATE and only the
  # API's runtime SA may invoke it, sending an OIDC token (the API runs with
  # GOTENBERG_REQUIRE_AUTH=true). This closes the "public + unauthenticated
  # renderer" hole. Grant the invoker role idempotently.
  gcloud run services add-iam-policy-binding gotenberg \
    --project "${GCP_PROJECT}" --region "${GCP_REGION}" \
    --member "serviceAccount:${API_SA}" \
    --role "roles/run.invoker" --quiet
}

deploy_web() {
  echo "--- build + deploy web app (Firebase Hosting target=app) ---"
  : "${VITE_API_URL:?VITE_API_URL must be set, e.g. export VITE_API_URL=https://app.draft-legal.com}"
  pushd "${ROOT}" >/dev/null
  pnpm --filter web build
  firebase deploy --only hosting:app --project "${GCP_PROJECT}"
  popd >/dev/null
}

deploy_marketing() {
  echo "--- build + deploy marketing site (Firebase Hosting target=marketing) ---"
  pushd "${ROOT}" >/dev/null
  pnpm --filter marketing build
  firebase deploy --only hosting:marketing --project "${GCP_PROJECT}"
  popd >/dev/null
}

case "${cmd}" in
  migrate)    migrate_db ;;
  api)        deploy_api ;;
  agents)     deploy_agents ;;
  gotenberg)  deploy_gotenberg ;;
  workers)    deploy_workers ;;
  web)        deploy_web ;;
  marketing)  deploy_marketing ;;
  all)
    migrate_db          # apply schema changes before any service reads them
    deploy_gotenberg
    deploy_agents
    deploy_api
    deploy_workers      # always-on jobs (escalation, reminders, scans)
    deploy_web
    deploy_marketing
    ;;
  *)
    echo "Usage: $0 {all|migrate|api|agents|gotenberg|workers|web|marketing}" >&2
    exit 1
    ;;
esac

echo
echo "Done."
