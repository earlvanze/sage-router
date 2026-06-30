#!/usr/bin/env bash
set -euo pipefail

load_local_env_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0

  local key value current
  while IFS='=' read -r -d '' key value; do
    case "$key" in
      PROJECT_ID|SAGE_ROUTER_GCP_PROJECT_ID|REGION|SERVICE_NAME|\
      SAGEROUTER_PROVIDER_RESALE_TERMS_URL|\
      SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL|\
      SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED|\
      SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF|\
      SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS|\
      SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS|\
      SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT|\
      SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC|\
      SAGEROUTER_RUN_READINESS)
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

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

PROJECT_ID="${PROJECT_ID:-${SAGE_ROUTER_GCP_PROJECT_ID:-sage-router-demo-20260428}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-sage-router}"
TERMS_URL="${SAGEROUTER_PROVIDER_RESALE_TERMS_URL:-https://sagerouter.dev/provider-resale-terms}"
MARGIN_POLICY_URL="${SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL:-https://sagerouter.dev/margin-policy}"
TERMS_ACKNOWLEDGED="${SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED:-0}"
AUTHORIZATION_REF="${SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF:-}"
ALLOWED_PROVIDERS="${SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS:-}"
COST_CENTS_PER_1K="${SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS:-}"
MIN_MARGIN="${SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT:-35}"
ENABLE_PUBLIC="${SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC:-0}"
RUN_READINESS="${SAGEROUTER_RUN_READINESS:-1}"
MODE="apply"
RESALE_ELIGIBLE_PROVIDER_FAMILIES="ollama openai anthropic"
DEFAULT_RESALE_ALLOWED_PROVIDERS="ollama,openai,anthropic"
BYOK_ONLY_PROVIDER_FAMILIES="openrouter"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTHORIZATION_LEDGER_TEMPLATE="${ROOT}/docs/launch/execution/provider-authorization-ledger-template.md"

usage() {
  cat >&2 <<'EOF'
Usage: scripts/configure_managed_provider_resale_readiness.sh [--check|--operator-packet|--authorization-packet|--authorization-ledger-template|--provider-outreach-packet|--provider-reply-triage-packet|--terms-approval-packet|--one-subscription-pricing-packet|--stage-public-controls|--unit-economics]

Stage Sage Router managed provider-access readiness on Cloud Run.

Required environment:
  SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS="ollama,openai,anthropic"
  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS="reviewed private cost"

Optional:
  SAGEROUTER_PROVIDER_RESALE_TERMS_URL="https://sagerouter.dev/provider-resale-terms"
  SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL="https://sagerouter.dev/margin-policy"
  SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=0
  SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF="private provider authorization evidence reference"
  SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT=35
  SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0
  PROJECT_ID=sage-router-demo-20260428
  REGION=us-central1
  SERVICE_NAME=sage-router
  SAGEROUTER_RUN_READINESS=0

Options:
  --check                  Report public readiness, Cloud Run bindings, and local
                           input presence without writing secrets or printing
                           the cost model.
  --operator-packet        Print a read-only, no-secret managed resale readiness
                           packet with public blockers, local input presence,
                           Cloud Run binding presence, safe plan thresholds, and
                           next commands. It never prints provider costs or
                           authorization references.
  --authorization-packet   Print the no-secret provider authorization evidence
                           checklist and evidence-reference format. It never
                           prints authorization evidence values or provider
                           cost values.
  --authorization-ledger-template
                           Print a no-secret private-review ledger template for
                           recording provider replies, terms review, evidence
                           references, and cost-review handoffs without
                           exposing agreements, account IDs, credentials, or
                           costs.
  --provider-outreach-packet
                           Print copyable, no-secret provider-facing outreach
                           requests for Ollama, OpenAI, and Anthropic managed
                           access authorization. It does not send email.
  --provider-reply-triage-packet
                           Print a no-secret provider-reply triage matrix for
                           classifying written replies before terms
                           acknowledgment, cost review, or public enablement.
  --terms-approval-packet  Print the no-secret provider-terms acknowledgment
                           review packet. It separates the terms decision from
                           the private cost model and never prints provider
                           authorization reference values.
  --one-subscription-pricing-packet
                           Print the no-secret managed-access pricing packet
                           for one-subscription review. It shows only public
                           plan revenue, public max-safe provider-cost
                           thresholds, packaging decisions, and next commands;
                           it never prints private provider costs or required
                           private prices.
  --stage-public-controls  Bind non-secret terms, margin-policy, allowlist, and
                           disabled public-enable env without requiring or
                           writing the private cost model.
  --unit-economics         Validate the private provider-cost candidate against
                           public plan revenue and minimum-margin thresholds
                           without printing the private cost value. The report
                           names the binding public plan and safe next actions
                           without printing a derived private required price.

The provider cost model is stored in Secret Manager and is not printed.
Managed public resale remains disabled unless
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=1 is explicitly set.
The helper also rejects managed-resale provider allowlists with BYOK-only
families and rejects minimum gross-margin thresholds below the launch floor.
Terms acknowledgment or public enablement also requires
SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF; the helper prints only presence,
never the reference value.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      MODE="check"
      shift
      ;;
    --operator-packet)
      MODE="operator-packet"
      shift
      ;;
    --authorization-packet)
      MODE="authorization-packet"
      shift
      ;;
    --authorization-ledger-template)
      MODE="authorization-ledger-template"
      shift
      ;;
    --provider-outreach-packet)
      MODE="provider-outreach-packet"
      shift
      ;;
    --provider-reply-triage-packet)
      MODE="provider-reply-triage-packet"
      shift
      ;;
    --terms-approval-packet)
      MODE="terms-approval-packet"
      shift
      ;;
    --one-subscription-pricing-packet)
      MODE="one-subscription-pricing-packet"
      shift
      ;;
    --stage-public-controls)
      MODE="stage-public-controls"
      shift
      ;;
    --unit-economics)
      MODE="unit-economics"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

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

presence() {
  if [[ -n "${1:-}" ]]; then
    printf 'present'
  else
    printf 'missing'
  fi
}

allowed_providers_input_state() {
  if [[ -n "${ALLOWED_PROVIDERS:-}" ]]; then
    printf 'present'
  else
    printf 'default:%s' "$DEFAULT_RESALE_ALLOWED_PROVIDERS"
  fi
}

contains_word() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

normalize_provider_list() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr ',' '\n' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
    | awk 'NF && !seen[$0]++ {print}'
}

validate_allowed_providers() {
  local raw="$1"
  local failures=0 family
  local eligible_count=0 byok_count=0 unknown_count=0
  local -a eligible=($RESALE_ELIGIBLE_PROVIDER_FAMILIES)
  local -a byok=($BYOK_ONLY_PROVIDER_FAMILIES)

  while IFS= read -r family; do
    [[ -n "$family" ]] || continue
    if contains_word "$family" "${eligible[@]}"; then
      eligible_count=$((eligible_count + 1))
      continue
    fi
    if contains_word "$family" "${byok[@]}"; then
      byok_count=$((byok_count + 1))
      printf 'Provider allowlist includes BYOK-only family %s; do not include it in managed resale.\n' "$family" >&2
      failures=1
      continue
    fi
    unknown_count=$((unknown_count + 1))
    printf 'Provider allowlist includes unknown/non-resale family %s.\n' "$family" >&2
    failures=1
  done < <(normalize_provider_list "$raw")

  printf 'Provider allowlist preflight: resaleEligible=%s byokOnlyRejected=%s unknownRejected=%s\n' \
    "$eligible_count" "$byok_count" "$unknown_count" >&2
  if [[ "$eligible_count" -le 0 ]]; then
    printf 'Provider allowlist must include at least one resale-eligible family: %s.\n' "$RESALE_ELIGIBLE_PROVIDER_FAMILIES" >&2
    failures=1
  fi
  return "$failures"
}

validate_margin_threshold() {
  if ! [[ "$MIN_MARGIN" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    printf 'SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT must be numeric.\n' >&2
    return 1
  fi
  if ! awk "BEGIN { exit !($MIN_MARGIN >= 30) }"; then
    printf 'SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT must be at least 30 for public launch readiness.\n' >&2
    return 1
  fi
}

validate_authorization_reference() {
  if truthy "$TERMS_ACKNOWLEDGED" || truthy "$ENABLE_PUBLIC"; then
    if [[ -z "$AUTHORIZATION_REF" ]]; then
      printf 'SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF is required before acknowledging provider resale terms or requesting public managed access.\n' >&2
      return 1
    fi
  fi
  return 0
}

check_managed_provider_resale() {
  require_cmd curl
  require_cmd jq

  local failures=0 body code enabled requested readiness status allowed_count auth_evidence cost_configured unit_satisfied missing_count
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"
  if [[ "$code" == "200" ]]; then
    enabled="$(jq -r '.publicLaunch.managedProviderAccess.enabled // false' "$body")"
    requested="$(jq -r '.publicLaunch.managedProviderAccess.requested // false' "$body")"
    readiness="$(jq -r '.publicLaunch.managedProviderAccess.readinessSatisfied // false' "$body")"
    status="$(jq -r '.publicLaunch.managedProviderAccess.status // empty' "$body")"
    allowed_count="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | length' "$body")"
    auth_evidence="$(jq -r '.publicLaunch.managedProviderAccess.providerAuthorizationEvidenceConfigured // false' "$body")"
    cost_configured="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.costModelConfigured // false' "$body")"
    unit_satisfied="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.satisfied // false' "$body")"
    missing_count="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | length' "$body")"
    printf 'Public managed-provider readiness: enabled=%s requested=%s readinessSatisfied=%s status=%s allowedProviderFamilies=%s authorizationEvidence=%s costModel=%s unitEconomics=%s missingControls=%s\n' \
      "$enabled" "$requested" "$readiness" "${status:-missing}" "$allowed_count" "$auth_evidence" "$cost_configured" "$unit_satisfied" "$missing_count"
    if [[ "$readiness" != "true" ]]; then
      failures=1
    fi
  else
    printf 'Public managed-provider readiness: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n' "$code" >&2
    failures=1
  fi
  rm -f "$body"

  printf 'Local apply inputs: termsUrl=%s marginPolicyUrl=%s termsAcknowledged=%s authorizationEvidence=%s allowedProviders=%s costModel=%s minimumMargin=%s enablePublic=%s\n' \
    "$(presence "$TERMS_URL")" "$(presence "$MARGIN_POLICY_URL")" "$TERMS_ACKNOWLEDGED" "$(presence "$AUTHORIZATION_REF")" "$(allowed_providers_input_state)" "$(presence "$COST_CENTS_PER_1K")" "$MIN_MARGIN" "$ENABLE_PUBLIC"
  if [[ -n "$ALLOWED_PROVIDERS" ]] && ! validate_allowed_providers "$ALLOWED_PROVIDERS"; then
    failures=1
  fi
  if [[ -n "$MIN_MARGIN" ]] && ! validate_margin_threshold; then
    failures=1
  fi
  if ! validate_authorization_reference; then
    failures=1
  fi

  if command -v gcloud >/dev/null 2>&1; then
    local service_json service_status enabled_env allowed_env auth_ref_env cost_secret margin_env terms_env ack_env
    service_json="$(mktemp)"
    if gcloud run services describe "$SERVICE_NAME" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --platform managed \
      --format=json >"$service_json" 2>/dev/null; then
      service_status="present"
      enabled_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED") | (.value // empty)' "$service_json" | tail -n1)"
      allowed_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS") | (.value // empty)' "$service_json" | tail -n1)"
      terms_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_TERMS_URL") | (.value // empty)' "$service_json" | tail -n1)"
      margin_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL") | (.value // empty)' "$service_json" | tail -n1)"
      ack_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED") | (.value // empty)' "$service_json" | tail -n1)"
      auth_ref_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF") | (.value // empty)' "$service_json" | tail -n1)"
      cost_secret="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS") | (.valueFrom.secretKeyRef.name // empty)' "$service_json" | tail -n1)"
      printf 'Cloud Run bindings: service=%s enabledEnv=%s allowedProvidersEnv=%s termsUrlEnv=%s termsAckEnv=%s authorizationRefEnv=%s marginPolicyEnv=%s costSecret=%s\n' \
        "$service_status" "$(presence "$enabled_env")" "$(presence "$allowed_env")" "$(presence "$terms_env")" "$(presence "$ack_env")" "$(presence "$auth_ref_env")" "$(presence "$margin_env")" "$(presence "$cost_secret")"
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
Managed provider access is not launch-ready yet.

Use the staged approval flow so public metadata, terms acknowledgment, provider
authorization evidence, and the private cost model stay separated:
  1. Review the no-secret operator packet:
     scripts/configure_managed_provider_resale_readiness.sh --operator-packet
  2. Stage or refresh public terms, margin-policy, allowlist, and disabled
     public-enable controls without writing private provider cost:
     scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls
  3. Generate the terms approval packet before acknowledging terms:
     scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet
  4. Only after written provider authorization and reviewed private cost are
     available, run the unit-economics preflight:
     SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics

Do not run the default apply path until provider authorization evidence and a
reviewed private cost model are available. Keep
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 until every readiness
control passes.

The check prints presence, counts, and binding names only; it never prints the
private provider-cost value.
EOF
    return 1
  fi
  printf 'Managed provider access appears launch-ready. Keep public enable disabled until provider authorization evidence is current.\n'
}

managed_provider_operator_packet() {
  require_cmd curl
  require_cmd jq

  local body code enabled requested readiness status missing allowed eligible byok ready blocked terms_url margin_url terms_ack auth_evidence cost_configured unit_satisfied
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router managed resale operator packet\n'
  printf 'Boundary: read-only review packet; no provider credentials, authorization reference values, actual provider costs, prompts, OAuth tokens, generated API keys, or raw provider responses.\n'
  printf 'Effect: this command does not acknowledge terms, write secrets, enable managed resale, deploy Cloud Run, or send customer email.\n\n'

  if [[ "$code" == "200" ]]; then
    enabled="$(jq -r '.publicLaunch.managedProviderAccess.enabled // false' "$body")"
    requested="$(jq -r '.publicLaunch.managedProviderAccess.requested // false' "$body")"
    readiness="$(jq -r '.publicLaunch.managedProviderAccess.readinessSatisfied // false' "$body")"
    status="$(jq -r '.publicLaunch.managedProviderAccess.status // "unknown"' "$body")"
    missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
    allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
    eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
    byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
    ready="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.readyProviderFamilies // []) | join(", ")' "$body")"
    blocked="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.blockedProviderFamilies // []) | join(", ")' "$body")"
    terms_url="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsUrl // ""' "$body")"
    margin_url="$(jq -r '.publicLaunch.managedProviderAccess.marginPolicyUrl // ""' "$body")"
    terms_ack="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsAcknowledged // false' "$body")"
    auth_evidence="$(jq -r '.publicLaunch.managedProviderAccess.providerAuthorizationEvidenceConfigured // false' "$body")"
    cost_configured="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.costModelConfigured // false' "$body")"
    unit_satisfied="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.satisfied // false' "$body")"

    printf 'Public readiness:\n'
    printf -- '- enabled/requested/ready: %s / %s / %s\n' "$enabled" "$requested" "$readiness"
    printf -- '- status: %s\n' "$status"
    printf -- '- missing controls: %s\n' "${missing:-none}"
    printf -- '- terms URL: %s\n' "${terms_url:-missing}"
    printf -- '- margin policy URL: %s\n' "${margin_url:-missing}"
    printf -- '- terms acknowledged: %s\n' "$terms_ack"
    printf -- '- authorization evidence configured: %s\n' "$auth_evidence"
    printf -- '- cost model configured: %s; unit economics satisfied: %s\n' "$cost_configured" "$unit_satisfied"
    printf -- '- allowed provider families: %s\n' "${allowed:-none}"
    printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
    printf -- '- BYOK-only families excluded from resale: %s\n' "${byok:-none}"
    printf -- '- one-subscription ready families: %s\n' "${ready:-none}"
    printf -- '- one-subscription blocked families: %s\n\n' "${blocked:-none}"

    printf 'Safe public plan thresholds:\n'
    jq -r '
      (.publicLaunch.managedProviderAccess.unitEconomics.evaluatedPlans // [])
      | if length == 0 then ["- none"] else map(
          "- \(.plan): revenueCentsPer1k=\(.revenueCentsPerThousandRequests); maxSafeProviderCostCentsPer1k=\(.maximumProviderCostCentsPerThousandRequests); minimumGrossMarginPercent=\(.minimumGrossMarginPercent); status=\(if .meetsMinimumGrossMargin then "pass" else "waiting_on_private_cost_model" end)"
        ) end
      | .[]
    ' "$body"
    printf '\n'
  else
    printf 'Public readiness: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n\n' "$code"
  fi
  rm -f "$body"

  printf 'Local apply input presence:\n'
  printf -- '- termsUrl=%s marginPolicyUrl=%s termsAcknowledged=%s authorizationEvidence=%s allowedProviders=%s costModel=%s minimumMargin=%s enablePublic=%s\n\n' \
    "$(presence "$TERMS_URL")" "$(presence "$MARGIN_POLICY_URL")" "$TERMS_ACKNOWLEDGED" "$(presence "$AUTHORIZATION_REF")" "$(allowed_providers_input_state)" "$(presence "$COST_CENTS_PER_1K")" "$MIN_MARGIN" "$ENABLE_PUBLIC"

  if command -v gcloud >/dev/null 2>&1; then
    local service_json enabled_env allowed_env auth_ref_env cost_secret margin_env terms_env ack_env
    service_json="$(mktemp)"
    if gcloud run services describe "$SERVICE_NAME" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --platform managed \
      --format=json >"$service_json" 2>/dev/null; then
      enabled_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED") | (.value // empty)' "$service_json" | tail -n1)"
      allowed_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS") | (.value // empty)' "$service_json" | tail -n1)"
      terms_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_TERMS_URL") | (.value // empty)' "$service_json" | tail -n1)"
      margin_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL") | (.value // empty)' "$service_json" | tail -n1)"
      ack_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED") | (.value // empty)' "$service_json" | tail -n1)"
      auth_ref_env="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF") | (.value // empty)' "$service_json" | tail -n1)"
      cost_secret="$(jq -r '(.spec.template.spec.containers[0].env // [])[]? | select(.name == "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS") | (.valueFrom.secretKeyRef.name // empty)' "$service_json" | tail -n1)"
      printf 'Cloud Run binding presence:\n'
      printf -- '- service=present enabledEnv=%s allowedProvidersEnv=%s termsUrlEnv=%s termsAckEnv=%s authorizationRefEnv=%s marginPolicyEnv=%s costSecret=%s\n\n' \
        "$(presence "$enabled_env")" "$(presence "$allowed_env")" "$(presence "$terms_env")" "$(presence "$ack_env")" "$(presence "$auth_ref_env")" "$(presence "$margin_env")" "$(presence "$cost_secret")"
    else
      printf 'Cloud Run binding presence:\n'
      printf -- '- service=unavailable project=%s region=%s service=%s\n\n' "$PROJECT_ID" "$REGION" "$SERVICE_NAME"
    fi
    rm -f "$service_json"
  else
    printf 'Cloud Run binding presence:\n'
    printf -- '- skipped because gcloud is not installed\n\n'
  fi

  printf 'Next operator actions:\n'
  printf -- '- Stage or refresh public controls without terms acknowledgment, provider authorization reference, or private cost:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls\n'
  printf -- '- Review provider resale terms out of band, then set SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=1 only when the terms and authorization evidence are approved.\n'
  printf -- '- Store only a private evidence reference in SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF; do not paste the evidence body into public metadata.\n'
  printf -- '- Run: SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n'
  printf -- '- If the preflight passes, stage the cost model with the default helper while keeping SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 until final approval.\n'
  printf -- '- Re-run: scripts/configure_managed_provider_resale_readiness.sh --check\n\n'

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false.\n'
}

managed_provider_authorization_packet() {
  require_cmd curl
  require_cmd jq

  local body code allowed eligible byok missing auth_evidence terms_ack cost_configured unit_satisfied configured
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router managed provider authorization packet\n'
  printf 'Boundary: read-only authorization-evidence checklist; no provider credentials, authorization evidence values, provider account IDs, actual provider costs, prompts, OAuth tokens, generated API keys, customer data, or raw provider responses.\n'
  printf 'Effect: this command does not acknowledge terms, write secrets, deploy Cloud Run, enable managed resale, or send customer email.\n\n'

  if [[ "$code" == "200" ]]; then
    allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
    eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
    byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
    missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
    auth_evidence="$(jq -r '.publicLaunch.managedProviderAccess.providerAuthorizationEvidenceConfigured // false' "$body")"
    terms_ack="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsAcknowledged // false' "$body")"
    cost_configured="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.costModelConfigured // false' "$body")"
    unit_satisfied="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.satisfied // false' "$body")"
    configured="$(jq -r '(.publicLaunch.managedProviderAccess.configuredProviderFamilies // []) | join(", ")' "$body")"

    printf 'Public decision inputs:\n'
    printf -- '- configured provider families: %s\n' "${configured:-none}"
    printf -- '- allowed managed families: %s\n' "${allowed:-none}"
    printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
    printf -- '- BYOK-only families excluded from managed resale: %s\n' "${byok:-none}"
    printf -- '- missing controls: %s\n' "${missing:-none}"
    printf -- '- authorization evidence configured: %s\n' "$auth_evidence"
    printf -- '- terms acknowledged: %s\n' "$terms_ack"
    printf -- '- cost model configured: %s; unit economics satisfied: %s\n\n' "$cost_configured" "$unit_satisfied"
  else
    printf 'Public decision inputs: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n\n' "$code"
  fi
  rm -f "$body"

  printf 'Evidence reference format:\n'
  printf -- '- Store only a private reference string in SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF, such as provider-review-YYYYMMDD-doc-or-ticket-id.\n'
  printf -- '- Do not paste the agreement, email thread, provider account ID, provider credential, or cost schedule into public metadata, PRs, logs, or support channels.\n'
  printf -- '- The reference should point operators to the private artifact location and review date without revealing the artifact body.\n\n'

  printf 'Provider-family authorization checklist:\n'
  printf -- '- Ollama: confirm written permission or contract terms for any managed Ollama/Ollama Cloud access, allowed account type, quota/capacity limits, redistribution/resale boundary, abuse contact, and any model-family exclusions.\n'
  printf -- '- OpenAI: confirm written permission or contract terms for managed OpenAI API access, resale or service-provider rights, end-customer usage obligations, region/data-processing constraints, rate/capacity limits, and abuse/termination requirements.\n'
  printf -- '- Anthropic: confirm written permission or contract terms for managed Anthropic API access, resale or service-provider rights, customer-use restrictions, content-safety obligations, rate/capacity limits, and abuse/termination requirements.\n'
  printf -- '- OpenRouter and BYOK-compatible gateways: keep them outside managed resale unless separate provider authorization explicitly promotes them into the resale-eligible allowlist.\n\n'

  printf 'Approval checklist:\n'
  printf -- '- Confirm provider authorization covers the exact provider families that will be allowlisted for managed resale.\n'
  printf -- '- Confirm the provider terms do not prohibit bundled access, pooled credentials, resale, commercial proxying, or the planned customer category.\n'
  printf -- '- Confirm customer terms, acceptable-use policy, quota/rate limits, revocation, operator audit events, and abuse review match provider obligations.\n'
  printf -- '- Confirm the private provider cost candidate is reviewed separately with --unit-economics before any cost model is written.\n'
  printf -- '- Keep SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=0 and SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 until authorization evidence and private unit economics both pass.\n\n'

  printf 'Safe next commands:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet\n'
  printf "  SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls\n"
  printf "  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n\n"

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false.\n'
}

managed_provider_outreach_packet() {
  require_cmd curl
  require_cmd jq

  local body code allowed eligible byok missing ready blocked terms_url margin_url unit_satisfied
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router managed provider outreach packet\n'
  printf 'Boundary: read-only provider-facing request templates; no provider credentials, authorization evidence values, private provider costs, prompts, OAuth tokens, generated API keys, customer data, or raw provider responses.\n'
  printf 'Effect: this command does not send email, acknowledge terms, write secrets, deploy Cloud Run, or enable managed resale.\n\n'

  if [[ "$code" == "200" ]]; then
    allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
    eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
    byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
    missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
    ready="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.readyProviderFamilies // []) | join(", ")' "$body")"
    blocked="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.blockedProviderFamilies // []) | join(", ")' "$body")"
    terms_url="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsUrl // ""' "$body")"
    margin_url="$(jq -r '.publicLaunch.managedProviderAccess.marginPolicyUrl // ""' "$body")"
    unit_satisfied="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.satisfied // false' "$body")"

    printf 'Live public context:\n'
    printf -- '- allowed managed families: %s\n' "${allowed:-none}"
    printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
    printf -- '- BYOK-only families excluded from managed resale: %s\n' "${byok:-none}"
    printf -- '- one-subscription ready families: %s\n' "${ready:-none}"
    printf -- '- one-subscription blocked families: %s\n' "${blocked:-none}"
    printf -- '- missing controls: %s\n' "${missing:-none}"
    printf -- '- unit economics currently satisfied: %s\n' "$unit_satisfied"
    printf -- '- public terms boundary: %s\n' "${terms_url:-missing}"
    printf -- '- public margin policy: %s\n\n' "${margin_url:-missing}"
  else
    printf 'Live public context: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n\n' "$code"
  fi
  rm -f "$body"

  printf 'Common provider request points:\n'
  printf -- '- Ask for written confirmation that Sage Router may operate a managed-access service for end customers using the named provider family.\n'
  printf -- '- Ask whether the provider permits service-provider, reseller, marketplace, or hosted-agent routing use cases for the planned customer category.\n'
  printf -- '- Ask for allowed account type, end-customer terms/pass-through obligations, audit/logging expectations, data-processing restrictions, abuse contact, suspension process, rate/capacity limits, model exclusions, and termination requirements.\n'
  printf -- '- Ask for the private commercial cost schedule or billing model separately; run it only through --unit-economics and do not paste the cost into public metadata.\n'
  printf -- '- Store only a private evidence reference in SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF after review.\n\n'

  printf 'Provider-specific copy blocks:\n'
  printf '\n[Ollama / Ollama Cloud]\n'
  printf 'Subject: Sage Router managed access authorization review for Ollama-family routing\n'
  printf 'Body:\n'
  printf 'Sage Router is preparing a private-beta managed access option for customers who want one Sage Router subscription plus quota-bound routing. Before enabling any Ollama-family managed access, we need written confirmation of the allowed commercial use, account type, redistribution/resale or service-provider boundary, model-family restrictions, rate/capacity limits, abuse process, and any end-customer terms we must pass through. Public managed resale stays disabled until authorization, terms acknowledgment, a private cost model, and unit economics pass.\n'
  printf 'Please confirm whether Sage Router may include Ollama or Ollama Cloud access in this managed-access pilot, and identify any required contract, addendum, usage cap, model exclusion, or compliance process.\n'
  printf '\n[OpenAI]\n'
  printf 'Subject: Sage Router managed API access authorization review for OpenAI-family routing\n'
  printf 'Body:\n'
  printf 'Sage Router is preparing a private-beta managed access option for generated API-key customers who want quota-bound routing without bringing their own OpenAI account. Before enabling any OpenAI-family managed access, we need written confirmation of resale/service-provider rights, end-customer obligations, permitted account/billing structure, data-processing and regional constraints, rate/capacity limits, safety/abuse process, model exclusions, and termination requirements. Public managed resale stays disabled until authorization, terms acknowledgment, a private cost model, and unit economics pass.\n'
  printf 'Please confirm whether Sage Router may include OpenAI API access in this managed-access pilot, and identify any required enterprise agreement, reseller agreement, customer terms, usage cap, model exclusion, or compliance process.\n'
  printf '\n[Anthropic]\n'
  printf 'Subject: Sage Router managed API access authorization review for Anthropic-family routing\n'
  printf 'Body:\n'
  printf 'Sage Router is preparing a private-beta managed access option for generated API-key customers who want quota-bound routing without bringing their own Anthropic account. Before enabling any Anthropic-family managed access, we need written confirmation of resale/service-provider rights, customer-use restrictions, permitted account/billing structure, content-safety obligations, data-processing constraints, rate/capacity limits, abuse process, model exclusions, and termination requirements. Public managed resale stays disabled until authorization, terms acknowledgment, a private cost model, and unit economics pass.\n'
  printf 'Please confirm whether Sage Router may include Anthropic API access in this managed-access pilot, and identify any required contract, customer terms, usage cap, model exclusion, or compliance process.\n\n'

  printf 'After provider reply:\n'
  printf -- '- Save the provider reply or contract in a private system of record.\n'
  printf -- '- Record only a private evidence reference, such as provider-review-YYYYMMDD-doc-or-ticket-id.\n'
  printf -- '- Run: scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet\n'
  printf -- '- Run: scripts/configure_managed_provider_resale_readiness.sh --authorization-packet\n'
  printf -- '- Run: scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet\n'
  printf -- '- Run: SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n'
  printf -- '- Keep SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 until every readiness control passes.\n\n'

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false; sendsEmail=false.\n'
}

managed_provider_reply_triage_packet() {
  require_cmd curl
  require_cmd jq

  local body code allowed eligible byok missing ready blocked terms_url margin_url
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router provider reply triage packet\n'
  printf 'Boundary: read-only operator worksheet; no provider agreements, account IDs, provider credentials, OAuth tokens, generated API keys, customer data, prompts, private provider costs, cost schedules, authorization-reference values, or raw provider responses.\n'
  printf 'Effect: this command does not acknowledge terms, write secrets, deploy Cloud Run, change Stripe prices, enable managed resale, or send provider/customer email.\n\n'

  if [[ "$code" == "200" ]]; then
    allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
    eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
    byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
    missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
    ready="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.readyProviderFamilies // []) | join(", ")' "$body")"
    blocked="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.blockedProviderFamilies // []) | join(", ")' "$body")"
    terms_url="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsUrl // "https://sagerouter.dev/provider-resale-terms"' "$body")"
    margin_url="$(jq -r '.publicLaunch.managedProviderAccess.marginPolicyUrl // "https://sagerouter.dev/margin-policy"' "$body")"

    printf 'Live public context:\n'
    printf -- '- allowed managed families: %s\n' "${allowed:-none}"
    printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
    printf -- '- BYOK-only families excluded from managed resale: %s\n' "${byok:-none}"
    printf -- '- one-subscription ready families: %s\n' "${ready:-none}"
    printf -- '- one-subscription blocked families: %s\n' "${blocked:-none}"
    printf -- '- missing controls: %s\n' "${missing:-none}"
    printf -- '- provider terms boundary: %s\n' "${terms_url:-missing}"
    printf -- '- margin policy: %s\n\n' "${margin_url:-missing}"
  else
    printf 'Live public context: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n\n' "$code"
  fi
  rm -f "$body"

  printf 'Reply triage matrix:\n'
  printf -- '| providerFamily | replyReceived | authorizationStatus | termsStatus | allowedAccountType | resaleOrServiceProviderBoundary | endCustomerTermsRequired | quotaOrCapacityLimit | modelExclusions | dataProcessingRestrictions | abuseOrSuspensionProcess | privateEvidenceReference | privateCostReviewReference | managedAccessDecision |\n'
  printf -- '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
  printf -- '| ollama | pending | pending | pending | TBD | TBD | TBD | TBD | TBD | TBD | TBD | private-ref-only | private-ref-only | hold |\n'
  printf -- '| openai | pending | pending | pending | TBD | TBD | TBD | TBD | TBD | TBD | TBD | private-ref-only | private-ref-only | hold |\n'
  printf -- '| anthropic | pending | pending | pending | TBD | TBD | TBD | TBD | TBD | TBD | TBD | private-ref-only | private-ref-only | hold |\n\n'

  printf 'Decision rules:\n'
  printf -- '- Approve a provider family only when written authorization covers the planned managed-access customer category and the provider terms do not prohibit resale, commercial proxying, bundled access, pooled credentials, or the planned account/billing structure.\n'
  printf -- '- Mark hold if the reply is ambiguous, time-limited without renewal terms, excludes required models, lacks abuse/suspension process, lacks end-customer terms, or requires a contract not yet signed.\n'
  printf -- '- Keep OpenRouter and BYOK-compatible gateways outside the managed resale allowlist unless separate written authorization explicitly promotes them later.\n'
  printf -- '- Store provider replies, agreements, cost schedules, and account identifiers only in the private system of record; put only opaque private references in the worksheet/env.\n'
  printf -- '- Run the private cost candidate through --unit-economics before writing the cost model, and do not publish actual costs or derived required private prices.\n\n'

  printf 'Safe next commands after private triage:\n'
  printf -- '- Authorization evidence checklist:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --authorization-packet\n'
  printf -- '- Terms approval checklist:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet\n'
  printf -- '- Unit economics preflight:\n'
  printf "  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n"
  printf -- '- Stage private evidence reference while public resale remains disabled:\n'
  printf "  SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls\n\n"

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false; containsProviderReplyBody=false; mutatesRuntime=false; sendsEmail=false.\n'
}

managed_provider_terms_approval_packet() {
  require_cmd curl
  require_cmd jq

  local body code terms_url margin_url terms_ack auth_evidence missing allowed eligible byok ready blocked
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router managed provider terms approval packet\n'
  printf 'Boundary: read-only approval review; no provider credentials, provider authorization reference values, private provider costs, prompts, OAuth tokens, generated API keys, customer data, or raw provider responses.\n'
  printf 'Effect: this command does not acknowledge terms, write secrets, deploy Cloud Run, enable managed resale, or send customer email.\n\n'

  if [[ "$code" == "200" ]]; then
    terms_url="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsUrl // ""' "$body")"
    margin_url="$(jq -r '.publicLaunch.managedProviderAccess.marginPolicyUrl // ""' "$body")"
    terms_ack="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsAcknowledged // false' "$body")"
    auth_evidence="$(jq -r '.publicLaunch.managedProviderAccess.providerAuthorizationEvidenceConfigured // false' "$body")"
    missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
    allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
    eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
    byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
    ready="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.readyProviderFamilies // []) | join(", ")' "$body")"
    blocked="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.blockedProviderFamilies // []) | join(", ")' "$body")"

    printf 'Public decision inputs:\n'
    printf -- '- provider terms URL: %s\n' "${terms_url:-missing}"
    printf -- '- margin policy URL: %s\n' "${margin_url:-missing}"
    printf -- '- terms already acknowledged: %s\n' "$terms_ack"
    printf -- '- authorization evidence configured: %s\n' "$auth_evidence"
    printf -- '- missing controls: %s\n' "${missing:-none}"
    printf -- '- currently allowed managed families: %s\n' "${allowed:-none}"
    printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
    printf -- '- BYOK-only families excluded from resale: %s\n' "${byok:-none}"
    printf -- '- one-subscription ready families: %s\n' "${ready:-none}"
    printf -- '- one-subscription blocked families: %s\n\n' "${blocked:-none}"
  else
    printf 'Public decision inputs: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n\n' "$code"
  fi
  rm -f "$body"

  printf 'Local approval input presence:\n'
  printf -- '- termsUrl=%s marginPolicyUrl=%s authorizationEvidence=%s allowedProviders=%s costModel=%s minimumMargin=%s enablePublic=%s\n\n' \
    "$(presence "$TERMS_URL")" "$(presence "$MARGIN_POLICY_URL")" "$(presence "$AUTHORIZATION_REF")" "$(allowed_providers_input_state)" "$(presence "$COST_CENTS_PER_1K")" "$MIN_MARGIN" "$ENABLE_PUBLIC"

  printf 'Approval checklist:\n'
  printf -- '- Review provider-resale terms and provider authorization evidence out of band.\n'
  printf -- '- Confirm each managed provider family is resale-eligible: %s.\n' "$RESALE_ELIGIBLE_PROVIDER_FAMILIES"
  printf -- '- Keep BYOK-only families out of the managed resale allowlist: %s.\n' "$BYOK_ONLY_PROVIDER_FAMILIES"
  printf -- '- Confirm the authorization evidence reference exists before setting SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=1.\n'
  printf -- '- Keep SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 until the private cost model and unit economics also pass.\n\n'

  printf 'Safe next commands:\n'
  printf -- '- Stage public controls without terms acknowledgment or private cost:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls\n'
  printf -- '- Generate this packet again after evidence review:\n'
  printf '  scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet\n'
  printf -- '- After written approval, acknowledge terms while keeping public resale disabled and without printing the evidence reference:\n'
  printf "  SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls\n"
  printf -- '- Then run the secret-safe private cost preflight:\n'
  printf "  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n\n"

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false.\n'
}

managed_provider_one_subscription_pricing_packet() {
  require_cmd curl
  require_cmd jq

  local body code missing allowed eligible byok ready blocked min_margin binding_plan terms_url margin_url
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' https://api.sagerouter.dev/pricing || printf '000')"

  printf 'Sage Router one-subscription pricing packet\n'
  printf 'Boundary: read-only pricing review; no private provider costs, provider credentials, authorization reference values, prompts, OAuth tokens, generated API keys, customer data, or raw provider responses.\n'
  printf 'Effect: this command does not acknowledge terms, write secrets, deploy Cloud Run, enable managed resale, change prices, or send customer/provider email.\n\n'

  if [[ "$code" != "200" ]]; then
    printf 'Live public pricing context: unavailable HTTP %s from https://api.sagerouter.dev/pricing\n' "$code"
    rm -f "$body"
    printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsRequiredPrivatePrices=false; mutatesRuntime=false.\n'
    return 0
  fi

  missing="$(jq -r '(.publicLaunch.managedProviderAccess.missingControls // []) | join(", ")' "$body")"
  allowed="$(jq -r '(.publicLaunch.managedProviderAccess.allowedProviderFamilies // []) | join(", ")' "$body")"
  eligible="$(jq -r '(.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []) | join(", ")' "$body")"
  byok="$(jq -r '(.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []) | join(", ")' "$body")"
  ready="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.readyProviderFamilies // []) | join(", ")' "$body")"
  blocked="$(jq -r '(.publicLaunch.managedProviderAccess.oneSubscriptionReadiness.blockedProviderFamilies // []) | join(", ")' "$body")"
  min_margin="$(jq -r '.publicLaunch.managedProviderAccess.unitEconomics.minimumGrossMarginPercent // 35' "$body")"
  binding_plan="$(jq -r '
    (.publicLaunch.managedProviderAccess.unitEconomics.evaluatedPlans // [])
    | sort_by(.maximumProviderCostCentsPerThousandRequests // 999999)
    | .[0].plan // "unknown"
  ' "$body")"
  terms_url="$(jq -r '.publicLaunch.managedProviderAccess.providerTermsUrl // "https://sagerouter.dev/provider-resale-terms"' "$body")"
  margin_url="$(jq -r '.publicLaunch.managedProviderAccess.marginPolicyUrl // "https://sagerouter.dev/margin-policy"' "$body")"

  printf 'Live one-subscription readiness:\n'
  printf -- '- enabled/requested/ready: %s / %s / %s\n' \
    "$(jq -r '.publicLaunch.managedProviderAccess.enabled // false' "$body")" \
    "$(jq -r '.publicLaunch.managedProviderAccess.requested // false' "$body")" \
    "$(jq -r '.publicLaunch.managedProviderAccess.readinessSatisfied // false' "$body")"
  printf -- '- missing controls: %s\n' "${missing:-none}"
  printf -- '- allowed managed families: %s\n' "${allowed:-none}"
  printf -- '- resale-eligible families: %s\n' "${eligible:-none}"
  printf -- '- BYOK-only families excluded from managed resale: %s\n' "${byok:-none}"
  printf -- '- one-subscription ready families: %s\n' "${ready:-none}"
  printf -- '- one-subscription blocked families: %s\n' "${blocked:-none}"
  printf -- '- binding public plan: %s\n' "$binding_plan"
  printf -- '- minimum gross-margin floor: %s%%\n\n' "$min_margin"

  printf 'Public fixed-plan thresholds:\n'
  jq -r '
    (.publicLaunch.managedProviderAccess.unitEconomics.evaluatedPlans // [])
    | sort_by(.constraintRank // 999)
    | .[]
    | "- \(.plan): price=$\(.monthlyPriceUsd)/mo; includedRequests=\(.monthlyRequests); revenueCentsPer1k=\(.revenueCentsPerThousandRequests); maxSafeProviderCostCentsPer1k=\(.maximumProviderCostCentsPerThousandRequests); constraintRank=\(.constraintRank); privateCostStatus=not_printed"
  ' "$body"
  printf '\n'

  printf 'Packaging decision for one-subscription beta:\n'
  printf -- '- Keep BYOK/OpenRouter-compatible routing sellable in Lite/Pro/Max as customer-authorized routing infrastructure.\n'
  printf -- '- Keep public managed provider resale disabled until provider terms, authorization evidence, cost model, and positive unit economics all pass.\n'
  printf -- '- Treat %s as the binding fixed-plan constraint because it has the lowest public max-safe provider-cost threshold.\n' "$binding_plan"
  printf -- '- If a private provider-cost candidate is above any plan threshold, exclude that plan from managed access, lower included managed-access quota, add a managed-access surcharge, or move the buyer to a private Max contract.\n'
  printf -- '- Do not publish actual provider costs, exact gross-margin calculations, or derived required private prices in launch pages, PRs, logs, or support channels.\n\n'

  printf 'Review URLs:\n'
  printf -- '- provider terms: %s\n' "$terms_url"
  printf -- '- margin policy: %s\n\n' "$margin_url"

  printf 'Safe next commands:\n'
  printf -- '- Provider outreach: scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet\n'
  printf -- '- Provider reply triage: scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet\n'
  printf -- '- Terms review: scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet\n'
  printf -- '- Authorization evidence review: scripts/configure_managed_provider_resale_readiness.sh --authorization-packet\n'
  printf -- '- Private cost preflight: SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST scripts/configure_managed_provider_resale_readiness.sh --unit-economics\n'
  printf -- '- Keep public enablement off until every check passes: SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0\n\n'

  printf 'Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsRequiredPrivatePrices=false; containsAuthorizationReference=false; mutatesRuntime=false.\n'
  rm -f "$body"
}

managed_provider_authorization_ledger_template() {
  if [[ -f "$AUTHORIZATION_LEDGER_TEMPLATE" ]]; then
    cat "$AUTHORIZATION_LEDGER_TEMPLATE"
    return 0
  fi

  cat <<'EOF'
# Sage Router Managed Provider Authorization Ledger Template

Boundary: private operator review artifact. Do not paste provider agreements,
provider account IDs, provider credentials, OAuth tokens, generated API keys,
private provider costs, cost schedules, customer data, prompts, or raw provider
responses into this template. Store those artifacts in the private system of
record and put only opaque references here.

Effect: this template does not acknowledge terms, write secrets, deploy Cloud
Run, enable managed resale, or send provider/customer email.

## Review Metadata

- reviewDate:
- reviewer:
- decision: pending
- publicEnableApproved: false
- termsAcknowledgmentApproved: false
- costModelReviewed: false
- unitEconomicsPreflightPassed: false
- privateEvidenceReference: provider-review-YYYYMMDD-doc-or-ticket-id
- privateCostReviewReference:
- notes:

## Provider Family Rows

| providerFamily | authorizationStatus | termsStatus | evidenceReference | costReviewReference | allowedAccountType | allowedUseCase | resaleOrServiceProviderBoundary | quotaOrCapacityLimit | modelExclusions | dataProcessingRestrictions | abuseContactOrProcess | renewalOrExpiry | publicEnableApproved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ollama | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |
| openai | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |
| anthropic | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |

## Approval Checklist

- Provider replies have been classified with:
  scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet
- Provider authorization covers every family in the managed resale allowlist.
- Provider terms permit the planned managed-access customer category.
- BYOK-only providers, including OpenRouter, remain outside managed resale
  unless separately authorized.
- Customer terms, acceptable-use policy, quotas, rate limits, revocation,
  operator audit events, and abuse review match provider obligations.
- Private cost candidate has been reviewed with:
  SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics
- If unit economics pass, stage the cost model while keeping public enablement
  off until final approval.

## Safe Commands After Private Review

SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' \
SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' \
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' \
scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls

SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' \
scripts/configure_managed_provider_resale_readiness.sh --unit-economics

Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false; publicEnableApproved=false.
EOF
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

if [[ "$MODE" == "check" ]]; then
  check_managed_provider_resale
  exit $?
fi

if [[ "$MODE" == "operator-packet" ]]; then
  managed_provider_operator_packet
  exit 0
fi

if [[ "$MODE" == "authorization-packet" ]]; then
  managed_provider_authorization_packet
  exit 0
fi

if [[ "$MODE" == "authorization-ledger-template" ]]; then
  managed_provider_authorization_ledger_template
  exit 0
fi

if [[ "$MODE" == "provider-outreach-packet" ]]; then
  managed_provider_outreach_packet
  exit 0
fi

if [[ "$MODE" == "provider-reply-triage-packet" ]]; then
  managed_provider_reply_triage_packet
  exit 0
fi

if [[ "$MODE" == "terms-approval-packet" ]]; then
  managed_provider_terms_approval_packet
  exit 0
fi

if [[ "$MODE" == "one-subscription-pricing-packet" ]]; then
  managed_provider_one_subscription_pricing_packet
  exit 0
fi

if [[ "$MODE" == "unit-economics" ]]; then
  require_cmd python3
  "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/managed_provider_unit_economics.py"
  exit $?
fi

require_cmd gcloud
require_cmd awk

if [[ "$MODE" == "stage-public-controls" ]]; then
  if [[ -z "$ALLOWED_PROVIDERS" ]]; then
    ALLOWED_PROVIDERS="$DEFAULT_RESALE_ALLOWED_PROVIDERS"
  fi
  validate_allowed_providers "$ALLOWED_PROVIDERS"
  validate_margin_threshold
  validate_authorization_reference
  stage_env_vars="^|^SAGEROUTER_PROVIDER_RESALE_TERMS_URL=${TERMS_URL}|SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL=${MARGIN_POLICY_URL}|SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=${TERMS_ACKNOWLEDGED}|SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS=${ALLOWED_PROVIDERS}|SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT=${MIN_MARGIN}|SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=0"
  if [[ -n "$AUTHORIZATION_REF" ]]; then
    stage_env_vars="${stage_env_vars}|SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF=${AUTHORIZATION_REF}"
  fi
  printf 'Updating Cloud Run service=%s region=%s managed-access non-secret readiness controls\n' "$SERVICE_NAME" "$REGION" >&2
  gcloud run services update "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --update-env-vars "$stage_env_vars"
  printf 'Managed provider-access public controls staged without writing the private cost model. Review terms acknowledgment and unit economics before enabling managed access.\n' >&2
  if [[ "$RUN_READINESS" != "0" ]]; then
    "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/check_sagerouter_launch_readiness.sh"
  fi
  exit 0
fi

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

validate_allowed_providers "$ALLOWED_PROVIDERS"
validate_margin_threshold
validate_authorization_reference

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
  --update-env-vars "^|^SAGEROUTER_PROVIDER_RESALE_TERMS_URL=${TERMS_URL}|SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL=${MARGIN_POLICY_URL}|SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=${TERMS_ACKNOWLEDGED}|SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF=${AUTHORIZATION_REF}|SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS=${ALLOWED_PROVIDERS}|SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT=${MIN_MARGIN}|SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=${managed_enabled}" \
  --update-secrets "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS:latest"

printf 'Managed provider-access readiness staged. Verify /pricing before enabling any private-beta managed access.\n' >&2

if [[ "$RUN_READINESS" != "0" ]]; then
  "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/check_sagerouter_launch_readiness.sh"
fi
