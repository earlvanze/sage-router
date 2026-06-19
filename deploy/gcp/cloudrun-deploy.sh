#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-sage-router}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-sage-router}"
IMAGE_TAG="${IMAGE_TAG:-phase2}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
PUBLIC_BASE_URL="${SAGE_ROUTER_PUBLIC_BASE_URL:-https://app.sagerouter.dev}"
API_BASE_URL="${SAGE_ROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
CORS_ORIGIN="${SAGE_ROUTER_CORS_ORIGIN:-https://sagerouter.dev,https://www.sagerouter.dev,https://app.sagerouter.dev}"
STRIPE_PRICE_IDS="${SAGE_ROUTER_STRIPE_PRICE_IDS:-}"

if [[ -z "${STRIPE_PRICE_IDS}" && -n "${STRIPE_SECRET_KEY:-}" ]]; then
  STRIPE_PRICE_IDS="$(
    python3 - <<'PY'
import json
import os
import urllib.parse
import urllib.request

key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("SAGE_ROUTER_STRIPE_SECRET_KEY")
if not key:
    raise SystemExit(0)

url = "https://api.stripe.com/v1/prices?" + urllib.parse.urlencode(
    {"active": "true", "limit": "100", "expand[]": "data.product"}
)
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
with urllib.request.urlopen(req, timeout=20) as resp:
    prices = json.load(resp).get("data", [])

lookup_to_plan = {
    "sage_router_lite_monthly": "lite",
    "sage_router_pro_monthly": "pro",
    "sage_router_max_monthly": "max",
}
mapped = {}
for price in prices:
    plan = lookup_to_plan.get(price.get("lookup_key") or "")
    if plan and price.get("id"):
        mapped[plan] = price["id"]

print(",".join(f"{plan}={mapped[plan]}" for plan in ("lite", "pro", "max") if plan in mapped))
PY
  )"
fi

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

BUILD_ID="$(
  gcloud builds submit . \
    --async \
    --project "${PROJECT_ID}" \
    --config deploy/gcp/cloudbuild.yaml \
    --substitutions _IMAGE="${IMAGE}" \
    --format 'value(id)'
)"

echo "Cloud Build started: ${BUILD_ID}"
while true; do
  BUILD_STATUS="$(gcloud builds describe "${BUILD_ID}" --project "${PROJECT_ID}" --format 'value(status)')"
  case "${BUILD_STATUS}" in
    SUCCESS)
      break
      ;;
    FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
      echo "Cloud Build ${BUILD_ID} ended with status ${BUILD_STATUS}" >&2
      exit 1
      ;;
    *)
      echo "Cloud Build status: ${BUILD_STATUS}"
      sleep 5
      ;;
  esac
done

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
  --set-env-vars '^|^SAGE_ROUTER_HOME=/app|SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART=0|SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS=|SAGE_ROUTER_PROFILE_OVERLAYS=ollama|SAGE_ROUTER_MAX_PROVIDER_ATTEMPTS=2|SAGE_ROUTER_OLLAMA_TIMEOUT_SECONDS=120|SAGE_ROUTER_FIRESTORE_PROJECT_ID='"${PROJECT_ID}"'|SAGE_ROUTER_SUPABASE_URL=https://awtangrlqqsdpksarhwo.supabase.co|SAGE_ROUTER_SUPABASE_AUTH_ENABLED=1|SAGE_ROUTER_SUPABASE_MIRROR_ENABLED=1|SAGE_ROUTER_CLIENT_AUTH_REQUIRED=1|SAGE_ROUTER_PUBLIC_BASE_URL='"${PUBLIC_BASE_URL}"'|SAGE_ROUTER_API_BASE_URL='"${API_BASE_URL}"'|SAGE_ROUTER_CORS_ORIGIN='"${CORS_ORIGIN}"'|SAGE_ROUTER_STRIPE_PRICE_IDS='"${STRIPE_PRICE_IDS}" \
  --set-secrets OLLAMA_API_KEY=OLLAMA_API_KEY:latest,SAGE_ROUTER_OLLAMA_API_KEY=SAGE_ROUTER_OLLAMA_API_KEY:latest,SAGE_ROUTER_OPENAI_API_KEY=SAGE_ROUTER_OPENAI_API_KEY:latest,SAGE_ROUTER_OPENROUTER_API_KEY=SAGE_ROUTER_OPENROUTER_API_KEY:latest,SAGE_ROUTER_ANALYTICS_TOKEN=SAGE_ROUTER_ANALYTICS_TOKEN:latest,SAGE_ROUTER_SUPABASE_ANON_KEY=AOPS_SUPABASE_ANON_KEY:latest,SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY=AOPS_SUPABASE_SERVICE_ROLE_KEY:latest,SAGE_ROUTER_CLIENT_API_KEYS=SAGE_ROUTER_CLIENT_API_KEYS:latest,SAGE_ROUTER_API_KEY_HASH_PEPPER=SAGE_ROUTER_API_KEY_HASH_PEPPER:latest,SAGE_ROUTER_SIGNING_SECRET=SAGE_ROUTER_API_KEY_HASH_PEPPER:latest,SAGE_ROUTER_STRIPE_SECRET_KEY=SAGE_ROUTER_STRIPE_SECRET_KEY:latest,SAGE_ROUTER_STRIPE_WEBHOOK_SECRET=SAGE_ROUTER_STRIPE_WEBHOOK_SECRET:latest,NVIDIA_API_KEY=NVIDIA_API_KEY:latest,SAGE_ROUTER_NVIDIA_API_KEY=NVIDIA_API_KEY:latest

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format 'value(status.url)'
