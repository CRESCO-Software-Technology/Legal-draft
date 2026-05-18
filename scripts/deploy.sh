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
ANTHROPIC_API_KEY=anthropic-key:latest,\
OPENAI_API_KEY=openai-key:latest,\
GOOGLE_API_KEY=google-key:latest"

deploy_api() {
  echo "--- deploy api-service ---"
  [[ -f "${ROOT}/env.api.yaml" ]] || { echo "missing env.api.yaml (copy from env.api.example.yaml)" >&2; exit 1; }
  gcloud run deploy api-service \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --source "${ROOT}" \
    --dockerfile apps/api/Dockerfile \
    --min-instances 0 --max-instances 2 \
    --memory 1Gi --cpu 1 --concurrency 80 \
    --timeout 300 \
    --port 8080 \
    --env-vars-file "${ROOT}/env.api.yaml" \
    --set-secrets "${API_SECRETS}" \
    --allow-unauthenticated
}

deploy_agents() {
  echo "--- deploy agents-service ---"
  [[ -f "${ROOT}/env.agents.yaml" ]] || { echo "missing env.agents.yaml (copy from env.agents.example.yaml)" >&2; exit 1; }
  gcloud run deploy agents-service \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --source "${ROOT}/apps/agents" \
    --min-instances 0 --max-instances 2 \
    --memory 1Gi --cpu 1 --concurrency 40 \
    --timeout 300 \
    --port 8080 \
    --env-vars-file "${ROOT}/env.agents.yaml" \
    --set-secrets "${AGENTS_SECRETS}" \
    --no-allow-unauthenticated
}

deploy_gotenberg() {
  echo "--- deploy gotenberg ---"
  gcloud run deploy gotenberg \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --image gotenberg/gotenberg:8 \
    --min-instances 0 --max-instances 1 \
    --memory 512Mi --cpu 1 \
    --port 3000 \
    --args "gotenberg,--api-port=3000" \
    --no-allow-unauthenticated
}

deploy_web() {
  echo "--- build + deploy web (Firebase Hosting) ---"
  : "${VITE_API_URL:?VITE_API_URL must be set, e.g. export VITE_API_URL=https://api.your-domain.com}"
  pushd "${ROOT}" >/dev/null
  pnpm --filter web build
  firebase deploy --only hosting
  popd >/dev/null
}

case "${cmd}" in
  api)        deploy_api ;;
  agents)     deploy_agents ;;
  gotenberg)  deploy_gotenberg ;;
  web)        deploy_web ;;
  all)
    deploy_gotenberg
    deploy_agents
    deploy_api
    deploy_web
    ;;
  *)
    echo "Usage: $0 {all|api|agents|gotenberg|web}" >&2
    exit 1
    ;;
esac

echo
echo "Done."
