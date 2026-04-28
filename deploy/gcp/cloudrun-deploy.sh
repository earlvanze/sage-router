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
  --set-env-vars SAGE_ROUTER_HOME=/app,SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART=0,SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS=

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format 'value(status.url)'
