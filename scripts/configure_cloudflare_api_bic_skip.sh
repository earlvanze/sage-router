#!/usr/bin/env bash
set -euo pipefail

load_local_env_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0

  local key value current
  while IFS='=' read -r -d '' key value; do
    case "$key" in
      CLOUDFLARE_API_TOKEN|CLOUDFLARE_ZONE_ID|SAGEROUTER_CLOUDFLARE_ZONE_ID|SAGEROUTER_API_HOST)
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
  cat <<'EOF'
Usage: scripts/configure_cloudflare_api_bic_skip.sh [--check]

Creates or verifies a host-scoped Cloudflare configuration rule that disables
Browser Integrity Check for api.sagerouter.dev only.

Options:
  --check   Verify token permissions and the existing rule without modifying Cloudflare.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

cloudflare_error_summary() {
  local body="$1"
  if jq -e '.errors? | length > 0' "$body" >/dev/null 2>&1; then
    jq -r '.errors[] | "- " + ((.code // "unknown")|tostring) + ": " + (.message // "unknown error")' "$body" >&2
  fi
}

api_get() {
  local url="$1"
  local label="${2:-Cloudflare API request}"
  local body status
  body="$(mktemp)"
  status="$(curl -sS -o "$body" -w '%{http_code}' "$url" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    cat "$body"
    rm -f "$body"
    return 0
  fi
  printf '%s failed with HTTP %s.\n' "$label" "$status" >&2
  cloudflare_error_summary "$body"
  rm -f "$body"
  return 1
}

api_put_json() {
  local url="$1"
  local payload="$2"
  local body status
  body="$(mktemp)"
  status="$(curl -sS -o "$body" -w '%{http_code}' -X PUT "$url" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @"$payload")"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    cat "$body"
    rm -f "$body"
    return 0
  fi
  printf 'Cloudflare ruleset update failed with HTTP %s.\n' "$status" >&2
  printf 'The token must have Zone:Zone:Read and Zone Rulesets:Edit for %s.\n' "$ZONE_NAME" >&2
  cloudflare_error_summary "$body"
  rm -f "$body"
  return 1
}

api_get_ruleset_entrypoint() {
  local url="$1"
  local body status
  body="$(mktemp)"
  status="$(curl -sS -o "$body" -w '%{http_code}' "$url" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    cat "$body"
    rm -f "$body"
    return 0
  fi
  if [[ "$status" == "404" ]]; then
    rm -f "$body"
    return 2
  fi
  printf 'Cloudflare %s ruleset lookup for %s failed with HTTP %s.\n' "$PHASE" "$ZONE_NAME" "$status" >&2
  printf 'The token must have Zone:Zone:Read and Zone Rulesets:Read/Edit for %s.\n' "$ZONE_NAME" >&2
  cloudflare_error_summary "$body"
  rm -f "$body"
  return 1
}

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

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

require_cmd curl
require_cmd jq

CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN with Zone Rulesets read/edit permissions.}"
ZONE_NAME="${SAGEROUTER_CLOUDFLARE_ZONE_NAME:-sagerouter.dev}"
API_HOST="${SAGEROUTER_API_HOST:-api.sagerouter.dev}"
RULE_REF="${SAGEROUTER_CLOUDFLARE_API_BIC_RULE_REF:-sage-router-api-disable-bic}"
RULE_DESCRIPTION="${SAGEROUTER_CLOUDFLARE_API_BIC_RULE_DESCRIPTION:-Disable Browser Integrity Check for Sage Router API clients}"
PHASE="http_config_settings"

ZONE_ID="${SAGEROUTER_CLOUDFLARE_ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}"
if [[ -z "$ZONE_ID" ]]; then
  ZONE_ID="$(
    api_get "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" "Cloudflare zone lookup for ${ZONE_NAME}" \
      | jq -r '.result[0].id // empty'
  )"
fi
if [[ -z "$ZONE_ID" ]]; then
  printf 'Could not resolve Cloudflare zone id for %s. The token must have Zone:Zone:Read for this zone, or set SAGEROUTER_CLOUDFLARE_ZONE_ID/CLOUDFLARE_ZONE_ID.\n' "$ZONE_NAME" >&2
  exit 2
fi

entrypoint_url="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint"
current="$(mktemp)"
payload="$(mktemp)"
trap 'rm -f "$current" "$payload"' EXIT

set +e
api_get_ruleset_entrypoint "$entrypoint_url" >"$current"
entrypoint_status="$?"
set -e
if [[ "$entrypoint_status" == "2" ]]; then
  if [[ "$MODE" == "check" ]]; then
    printf 'Cloudflare %s ruleset entrypoint does not exist for %s; run this script without --check to create the host-scoped BIC skip rule.\n' "$PHASE" "$ZONE_NAME" >&2
    exit 1
  fi
  cat >"$current" <<'JSON'
{
  "success": true,
  "result": {
    "name": "default",
    "description": "Zone configuration rules",
    "kind": "zone",
    "phase": "http_config_settings",
    "rules": []
  }
}
JSON
elif [[ "$entrypoint_status" != "0" ]]; then
  exit "$entrypoint_status"
fi

if [[ "$MODE" == "check" ]]; then
  rule_ok="$(
    jq -r \
      --arg host "$API_HOST" \
      --arg ref "$RULE_REF" \
      --arg description "$RULE_DESCRIPTION" \
      '
      ((.result.rules // .rules // []) | any(
        ((.ref // "") == $ref or (.description // "") == $description) and
        (.enabled != false) and
        (.action == "set_config") and
        (.action_parameters.bic == false) and
        ((.expression // "") | contains($host))
      ))
      ' "$current"
  )"
  if [[ "$rule_ok" == "true" ]]; then
    printf 'Cloudflare Browser Integrity Check is disabled for %s by a host-scoped configuration rule.\n' "$API_HOST"
    exit 0
  fi
  printf 'Cloudflare Browser Integrity Check skip rule is missing or disabled for %s; run this script without --check to apply it.\n' "$API_HOST" >&2
  exit 1
fi

jq \
  --arg phase "$PHASE" \
  --arg host "$API_HOST" \
  --arg ref "$RULE_REF" \
  --arg description "$RULE_DESCRIPTION" \
  '
  def new_rule:
    {
      ref: $ref,
      description: $description,
      expression: "(http.host eq \"" + $host + "\")",
      action: "set_config",
      action_parameters: {bic: false},
      enabled: true
    };

  (.result // .) as $root
  | {
      name: ($root.name // "default"),
      description: ($root.description // "Zone configuration rules"),
      kind: ($root.kind // "zone"),
      phase: ($root.phase // $phase),
      rules: ((($root.rules // []) | map(select((.ref // "") != $ref and (.description // "") != $description))) + [new_rule])
    }
  ' "$current" >"$payload"

result="$(api_put_json "$entrypoint_url" "$payload")"
success="$(printf '%s' "$result" | jq -r '.success // false')"
if [[ "$success" != "true" ]]; then
  printf '%s\n' "$result" | jq >&2
  exit 1
fi

printf 'Configured Cloudflare Browser Integrity Check skip for %s in zone %s\n' "$API_HOST" "$ZONE_NAME"
