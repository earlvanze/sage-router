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

SECRET_MAPPINGS=(
  "OLLAMA_API_KEY=OLLAMA_API_KEY"
  "SAGE_ROUTER_OLLAMA_API_KEY=SAGE_ROUTER_OLLAMA_API_KEY"
  "SAGE_ROUTER_OPENAI_API_KEY=SAGE_ROUTER_OPENAI_API_KEY"
  "SAGE_ROUTER_OPENROUTER_API_KEY=SAGE_ROUTER_OPENROUTER_API_KEY"
  "SAGE_ROUTER_ANTHROPIC_API_KEY=SAGE_ROUTER_ANTHROPIC_API_KEY"
  "SAGE_ROUTER_GOOGLE_API_KEY=SAGE_ROUTER_GOOGLE_API_KEY"
  "SAGE_ROUTER_XAI_API_KEY=SAGE_ROUTER_XAI_API_KEY"
  "SAGE_ROUTER_ZAI_API_KEY=SAGE_ROUTER_ZAI_API_KEY"
  "SAGE_ROUTER_CLOUDFLARE_API_TOKEN=SAGE_ROUTER_CLOUDFLARE_API_TOKEN"
  "SAGE_ROUTER_OPENAI_CODEX_ACCESS_TOKEN=SAGE_ROUTER_OPENAI_CODEX_ACCESS_TOKEN"
  "SAGE_ROUTER_ANALYTICS_TOKEN=SAGE_ROUTER_ANALYTICS_TOKEN"
  "SAGE_ROUTER_SUPABASE_ANON_KEY=SAGE_ROUTER_SUPABASE_ANON_KEY|AOPS_SUPABASE_ANON_KEY"
  "SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY=SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY|AOPS_SUPABASE_SERVICE_ROLE_KEY"
  "SAGE_ROUTER_CLIENT_API_KEYS=SAGE_ROUTER_CLIENT_API_KEYS"
  "SAGE_ROUTER_API_KEY_HASH_PEPPER=SAGE_ROUTER_API_KEY_HASH_PEPPER"
  "SAGE_ROUTER_SIGNING_SECRET=SAGE_ROUTER_SIGNING_SECRET"
  "SAGE_ROUTER_STRIPE_SECRET_KEY=SAGE_ROUTER_STRIPE_SECRET_KEY"
  "SAGE_ROUTER_STRIPE_WEBHOOK_SECRET=SAGE_ROUTER_STRIPE_WEBHOOK_SECRET"
  "SAGE_ROUTER_CRYPTO_PAYMENT_ADDRESS=SAGE_ROUTER_CRYPTO_PAYMENT_ADDRESS"
  "NVIDIA_API_KEY=NVIDIA_API_KEY"
  "SAGE_ROUTER_NVIDIA_API_KEY=NVIDIA_API_KEY"
)

SET_SECRETS=()
for mapping in "${SECRET_MAPPINGS[@]}"; do
  env_name="${mapping%%=*}"
  secret_candidates="${mapping#*=}"
  IFS='|' read -r -a candidates <<< "${secret_candidates}"
  selected_secret=""
  for secret_name in "${candidates[@]}"; do
    if gcloud secrets describe "${secret_name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
      selected_secret="${secret_name}"
      break
    fi
  done
  if [[ -n "${selected_secret}" ]]; then
    SET_SECRETS+=("${env_name}=${selected_secret}:latest")
  else
    echo "Skipping missing Secret Manager secret candidates: ${secret_candidates} -> ${env_name}" >&2
  fi
done

DEPLOY_ARGS=(
  "${SERVICE_NAME}"
  --image "${IMAGE}"
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
  --memory 512Mi
  --cpu 1
  --min-instances 0
  --max-instances 1
  --concurrency 20
  --timeout 300
  --set-env-vars '^|^SAGE_ROUTER_HOME=/app|SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART=0|SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS=|SAGE_ROUTER_PROFILE_OVERLAYS=ollama|SAGE_ROUTER_MAX_PROVIDER_ATTEMPTS=2|SAGE_ROUTER_OLLAMA_TIMEOUT_SECONDS=120|SAGE_ROUTER_FIRESTORE_PROJECT_ID='"${PROJECT_ID}"'|SAGE_ROUTER_SUPABASE_URL=https://awtangrlqqsdpksarhwo.supabase.co|SAGE_ROUTER_SUPABASE_AUTH_ENABLED=1|SAGE_ROUTER_SUPABASE_MIRROR_ENABLED=1|SAGE_ROUTER_CLIENT_AUTH_REQUIRED=1|SAGE_ROUTER_PUBLIC_BASE_URL=https://sagerouter.dev|SAGE_ROUTER_API_BASE_URL=https://api.sagerouter.dev|SAGE_ROUTER_STRIPE_PRICE_ID='"${SAGE_ROUTER_STRIPE_PRICE_ID:-}"'|SAGE_ROUTER_CLOUDFLARE_ACCOUNT_ID=26c0875e051c10ad3a29a1ac7fca295c|SAGE_ROUTER_CORS_ORIGIN=https://sagerouter.dev,https://www.sagerouter.dev'
)

if [[ ${#SET_SECRETS[@]} -gt 0 ]]; then
  SET_SECRETS_CSV=$(IFS=,; echo "${SET_SECRETS[*]}")
  DEPLOY_ARGS+=(--set-secrets "${SET_SECRETS_CSV}")
fi

gcloud run deploy "${DEPLOY_ARGS[@]}"

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format 'value(status.url)'
