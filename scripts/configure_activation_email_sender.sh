#!/usr/bin/env bash
set -euo pipefail

load_local_env_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0

  local key value current
  while IFS='=' read -r -d '' key value; do
    case "$key" in
      SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER|SAGE_ROUTER_ACTIVATION_EMAIL_FROM|\
      SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO|SAGE_ROUTER_ACTIVATION_EMAIL_API_KEY|\
      SAGE_ROUTER_RESEND_API_KEY|RESEND_API_KEY|SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH|\
      PROJECT_ID|SAGE_ROUTER_GCP_PROJECT_ID|REGION|SERVICE_NAME|SAGEROUTER_API_BASE)
        ;;
      *)
        continue
        ;;
    esac
    current="${!key:-}"
    if [[ -z "$current" && -n "$value" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < <(set +u; set -a; source "$path" >/dev/null 2>&1; env -0)
}

usage() {
  cat >&2 <<'EOF'
Usage: scripts/configure_activation_email_sender.sh [--check]

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
  SAGEROUTER_SECRET_ENV_FILE=/home/digit/.openclaw/.env

Options:
  --check  Report public readiness, Cloud Run bindings, and local input
           presence without writing secrets or printing values.

The script stores values in Secret Manager, updates Cloud Run secret bindings,
and never prints secret values. When env vars are unset, it silently loads the
known activation-email variable names from SAGEROUTER_SECRET_ENV_FILE or
/home/digit/.openclaw/.env.
EOF
}

MODE="apply"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      MODE="check"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

PROJECT_ID="${PROJECT_ID:-${SAGE_ROUTER_GCP_PROJECT_ID:-sage-router-demo-20260428}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-sage-router}"
PROVIDER="${SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER:-resend}"
FROM_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_FROM:-}"
REPLY_TO_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO:-}"
API_KEY_VALUE="${SAGE_ROUTER_ACTIVATION_EMAIL_API_KEY:-${SAGE_ROUTER_RESEND_API_KEY:-${RESEND_API_KEY:-}}}"
MAX_BATCH="${SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH:-25}"
RUN_READINESS="${SAGEROUTER_RUN_READINESS:-1}"
API_BASE="${SAGEROUTER_API_BASE:-${SAGE_ROUTER_API_BASE:-https://api.sagerouter.dev}}"

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

presence() {
  if [[ -n "${1:-}" ]]; then
    printf 'present'
  else
    printf 'missing'
  fi
}

check_activation_email_sender() {
  require_cmd curl
  require_cmd jq

  local failures=0 body code configured provider from_configured api_key_configured reply_to_configured
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' "${API_BASE%/}/pricing" || printf '000')"
  if [[ "$code" == "200" ]]; then
    configured="$(jq -r '.activationEmailReadiness.configured // false' "$body")"
    provider="$(jq -r '.activationEmailReadiness.provider // "resend"' "$body")"
    from_configured="$(jq -r '.activationEmailReadiness.fromConfigured // false' "$body")"
    api_key_configured="$(jq -r '.activationEmailReadiness.apiKeyConfigured // false' "$body")"
    reply_to_configured="$(jq -r '.activationEmailReadiness.replyToConfigured // false' "$body")"
    printf 'Public activation email readiness: configured=%s provider=%s from=%s apiKey=%s replyTo=%s\n' \
      "$configured" "$provider" "$from_configured" "$api_key_configured" "$reply_to_configured"
    if [[ "$configured" != "true" ]]; then
      failures=1
    fi
  else
    printf 'Public activation email readiness: unavailable HTTP %s from %s/pricing\n' "$code" "${API_BASE%/}" >&2
    failures=1
  fi
  rm -f "$body"

  printf 'Local apply inputs: provider=%s from=%s apiKey=%s replyTo=%s maxBatch=%s\n' \
    "$PROVIDER" "$(presence "$FROM_VALUE")" "$(presence "$API_KEY_VALUE")" "$(presence "$REPLY_TO_VALUE")" "$MAX_BATCH"

  if command -v gcloud >/dev/null 2>&1; then
    local service_json service_status provider_env max_batch_env from_secret key_secret reply_to_secret
    service_json="$(mktemp)"
    if gcloud run services describe "$SERVICE_NAME" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --platform managed \
      --format=json >"$service_json" 2>/dev/null; then
      service_status="present"
      provider_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGE_ROUTER_ACTIVATION_EMAIL_PROVIDER") | (.value // empty)' "$service_json" | tail -n1)"
      max_batch_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGE_ROUTER_ACTIVATION_EMAIL_MAX_BATCH") | (.value // empty)' "$service_json" | tail -n1)"
      from_secret="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGE_ROUTER_ACTIVATION_EMAIL_FROM") | (.valueFrom.secretKeyRef.name // empty)' "$service_json" | tail -n1)"
      key_secret="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGE_ROUTER_RESEND_API_KEY") | (.valueFrom.secretKeyRef.name // empty)' "$service_json" | tail -n1)"
      reply_to_secret="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGE_ROUTER_ACTIVATION_EMAIL_REPLY_TO") | (.valueFrom.secretKeyRef.name // empty)' "$service_json" | tail -n1)"
      printf 'Cloud Run bindings: service=%s providerEnv=%s maxBatchEnv=%s fromSecret=%s apiKeySecret=%s replyToSecret=%s\n' \
        "$service_status" "$(presence "$provider_env")" "$(presence "$max_batch_env")" "$(presence "$from_secret")" "$(presence "$key_secret")" "$(presence "$reply_to_secret")"
      if [[ -z "$from_secret" || -z "$key_secret" ]]; then
        failures=1
      fi
    else
      printf 'Cloud Run bindings: service=unavailable project=%s region=%s service=%s\n' "$PROJECT_ID" "$REGION" "$SERVICE_NAME" >&2
      failures=1
    fi
    rm -f "$service_json"
  else
    printf 'Cloud Run bindings: skipped because gcloud is not installed\n' >&2
  fi

  if [[ "$failures" != "0" ]]; then
    cat >&2 <<'EOF'
Activation email sender is not launch-ready yet.
Set SAGE_ROUTER_ACTIVATION_EMAIL_FROM and SAGE_ROUTER_RESEND_API_KEY, then run:
  scripts/configure_activation_email_sender.sh

The check prints presence and binding names only; it never prints sender values
or API-key values.
EOF
    return 1
  fi

  printf 'Activation email sender appears launch-ready. Run scripts/check_sagerouter_launch_readiness.sh to verify the full hosted gate.\n'
}

if [[ "$MODE" == "check" ]]; then
  check_activation_email_sender
  exit $?
fi

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
