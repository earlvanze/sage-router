#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${SAGE_ROUTER_GCP_PROJECT_ID:-sage-router-demo-20260428}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-sage-router}"
PROVIDER="${SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER:-resend}"
FROM_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_FROM:-}"
REPLY_TO_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO:-}"
API_KEY_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_API_KEY:-${SAGE_ROUTER_RESEND_API_KEY:-${RESEND_API_KEY:-}}}"
MAX_BATCH="${SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH:-25}"
RUN_READINESS="${SAGEROUTER_RUN_READINESS:-1}"

usage() {
  cat >&2 <<'EOF'
Configure Sage Router activation follow-up email sending on Cloud Run.

Required environment:
  SAGE_ROUTER_ACTIVATION_EMAIL_FROM="Sage Router <activation@sagerouter.dev>"
  SAGE_ROUTER_RESEND_API_KEY="re_..."

Optional:
  SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO="support@sagerouter.dev"
  SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH=25
  PROJECT_ID=sage-router-demo-20260428
  REGION=us-central1
  SERVICE_NAME=sage-router
  SAGEROUTER_RUN_READINESS=0

The script stores values in Secret Manager, updates Cloud Run secret bindings,
and never prints secret values.
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
require_value SAGE_ROUTER_ACTIVATION_EMAIL_FROM "$FROM_VALUE"
require_value "SAGE_ROUTER_RESEND_API_KEY or SAGE_ROUTER_ACTIVATION_EMAIL_API_KEY" "$API_KEY_VALUE"

if [[ "$PROVIDER" != "resend" ]]; then
  printf 'Unsupported SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER=%s; only resend is currently supported.\n' "$PROVIDER" >&2
  exit 2
fi

gcloud services enable secretmanager.googleapis.com run.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

printf 'Writing activation email Secret Manager versions in project=%s\n' "$PROJECT_ID" >&2
put_secret SAGE_ROUTER_ACTIVATION_EMAIL_FROM "$FROM_VALUE"
put_secret SAGE_ROUTER_RESEND_API_KEY "$API_KEY_VALUE"

secret_bindings=(
  "SAGE_ROUTER_ACTIVATION_EMAIL_FROM=SAGE_ROUTER_ACTIVATION_EMAIL_FROM:latest"
  "SAGE_ROUTER_RESEND_API_KEY=SAGE_ROUTER_RESEND_API_KEY:latest"
)

if [[ -n "$REPLY_TO_VALUE" ]]; then
  put_secret SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO "$REPLY_TO_VALUE"
  secret_bindings+=("SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO=SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO:latest")
fi

printf 'Updating Cloud Run service=%s region=%s activation email bindings\n' "$SERVICE_NAME" "$REGION" >&2
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --update-env-vars "SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER=resend,SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH=${MAX_BATCH}" \
  --update-secrets "$(IFS=,; printf '%s' "${secret_bindings[*]}")"

printf 'Activation email sender configured. Verify with /analytics/funnel emailReadiness before sending a real batch.\n' >&2

if [[ "$RUN_READINESS" != "0" ]]; then
  "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/check_sagerouter_launch_readiness.sh"
fi
