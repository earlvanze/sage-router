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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

api_get() {
  curl -fsS "$1" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
}

api_put_json() {
  local url="$1"
  local payload="$2"
  curl -fsS -X PUT "$url" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @"$payload"
}

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

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
    api_get "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" \
      | jq -r '.result[0].id // empty'
  )"
fi
if [[ -z "$ZONE_ID" ]]; then
  printf 'Could not resolve Cloudflare zone id for %s\n' "$ZONE_NAME" >&2
  exit 2
fi

entrypoint_url="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint"
current="$(mktemp)"
payload="$(mktemp)"
trap 'rm -f "$current" "$payload"' EXIT

if ! api_get "$entrypoint_url" >"$current"; then
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
