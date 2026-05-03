#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-sage-router}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-sage-router}"
IMAGE_TAG="${IMAGE_TAG:-phase2}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "PROJECT_ID is required. Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 2
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location "${REGION}" \
    --description "Sage Router Cloud Run images" \
    --project "${PROJECT_ID}"
fi

gcloud builds submit . \
  --project "${PROJECT_ID}" \
  --config deploy/gcp/cloudbuild.yaml \
  --substitutions _IMAGE="${IMAGE}"

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 20 \
  --timeout 300 \
  --set-env-vars '^|^SAGE_ROUTER_HOME=/app|SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART=0|SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS=|SAGE_ROUTER_PROFILE_OVERLAYS=ollama|SAGE_ROUTER_MAX_PROVIDER_ATTEMPTS=2|SAGE_ROUTER_OLLAMA_TIMEOUT_SECONDS=120|SAGE_ROUTER_FIRESTORE_PROJECT_ID='"${PROJECT_ID}"'|SAGE_ROUTER_SUPABASE_URL=https://awtangrlqqsdpksarhwo.supabase.co|SAGE_ROUTER_SUPABASE_AUTH_ENABLED=1|SAGE_ROUTER_SUPABASE_MIRROR_ENABLED=1|SAGE_ROUTER_CORS_ORIGIN=https://sagerouter.dev,https://www.sagerouter.dev' \
  --set-secrets OLLAMA_API_KEY=OLLAMA_API_KEY:latest,SAGE_ROUTER_ANALYTICS_TOKEN=SAGE_ROUTER_ANALYTICS_TOKEN:latest,SAGE_ROUTER_SUPABASE_ANON_KEY=AOPS_SUPABASE_ANON_KEY:latest,SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY=AOPS_SUPABASE_SERVICE_ROLE_KEY:latest

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format 'value(status.url)'
