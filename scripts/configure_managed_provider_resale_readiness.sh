#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${SAGE_ROUTER_GCP_PROJECT_ID:-sage-router-demo-20260428}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-sage-router}"
TERMS_URL="${SAGEROUTER_PROVIDER_RESALE_TERMS_URL:-https://sagerouter.dev/provider-resale-terms}"
MARGIN_POLICY_URL="${SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL:-https://sagerouter.dev/margin-policy}"
TERMS_ACKNOWLEDGED="${SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED:-0}"
ALLOWED_PROVIDERS="${SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS:-}"
COST_CENTS_PER_1K="${SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS:-}"
MIN_MARGIN="${SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT:-35}"
ENABLE_PUBLIC="${SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC:-0}"
RUN_READINESS="${SAGEROUTER_RUN_READINESS:-1}"

usage() {
  cat >&2 <<'EOF'
Stage Sage Router managed provider-access readiness on Cloud Run.

Required environment:
  SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS="ollama,openai,anthropic"
  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS="reviewed private cost"

Optional:
  SAGEROUTER_PROVIDER_RESALE_TERMS_URL="https://sagerouter.dev/provider-resale-terms"
  SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL="https://sagerouter.dev/margin-policy"
  SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=0
  SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT=35
  SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0
  PROJECT_ID=sage-router-demo-20260428
  REGION=us-central1
  SERVICE_NAME=sage-router
  SAGEROUTER_RUN_READINESS=0

The provider cost model is stored in Secret Manager and is not printed.
Managed public resale remains disabled unless
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=1 is explicitly set.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

require_value() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    printf 'Missing required env: %s\n\n' "$name" >&2
    usage
    exit 2
  fi
}

truthy() {
  case "${1,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

secret_exists() {
  gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1
}

put_secret() {
  local name="$1"
  local value="$2"
  if ! secret_exists "$name"; then
    gcloud secrets create "$name" \
      --project "$PROJECT_ID" \
      --replication-policy automatic >/dev/null
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" \
    --project "$PROJECT_ID" \
    --data-file=- >/dev/null
}

require_cmd gcloud
require_value SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS "$ALLOWED_PROVIDERS"
require_value SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS "$COST_CENTS_PER_1K"

if ! [[ "$COST_CENTS_PER_1K" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  printf 'SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS must be a positive numeric value.\n' >&2
  exit 2
fi

if ! awk "BEGIN { exit !($COST_CENTS_PER_1K > 0) }"; then
  printf 'SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS must be greater than zero.\n' >&2
  exit 2
fi

if truthy "$ENABLE_PUBLIC" && ! truthy "$TERMS_ACKNOWLEDGED"; then
  printf 'Refusing to request public managed resale without SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=1.\n' >&2
  exit 2
fi

gcloud services enable secretmanager.googleapis.com run.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

printf 'Writing managed provider-access cost-model Secret Manager version in project=%s\n' "$PROJECT_ID" >&2
put_secret SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS "$COST_CENTS_PER_1K"

managed_enabled=0
if truthy "$ENABLE_PUBLIC"; then
  managed_enabled=1
fi

printf 'Updating Cloud Run service=%s region=%s managed-access readiness env\n' "$SERVICE_NAME" "$REGION" >&2
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --update-env-vars "^|^SAGEROUTER_PROVIDER_RESALE_TERMS_URL=${TERMS_URL}|SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL=${MARGIN_POLICY_URL}|SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=${TERMS_ACKNOWLEDGED}|SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS=${ALLOWED_PROVIDERS}|SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT=${MIN_MARGIN}|SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=${managed_enabled}" \
  --update-secrets "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS:latest"

printf 'Managed provider-access readiness staged. Verify /pricing before enabling any private-beta managed access.\n' >&2

if [[ "$RUN_READINESS" != "0" ]]; then
  "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/check_sagerouter_launch_readiness.sh"
fi
