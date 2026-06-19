#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-awtangrlqqsdpksarhwo}"
AUTH_SITE_URL="${SAGEROUTER_AUTH_SITE_URL:-https://app.sagerouter.dev}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN to a Supabase Management API token.}"
GITHUB_CLIENT_ID="${SAGEROUTER_GITHUB_CLIENT_ID:-${GITHUB_CLIENT_ID:-}}"
GITHUB_CLIENT_SECRET="${SAGEROUTER_GITHUB_CLIENT_SECRET:-${GITHUB_CLIENT_SECRET:-}}"

if [[ -z "$GITHUB_CLIENT_ID" || -z "$GITHUB_CLIENT_SECRET" ]]; then
  cat >&2 <<EOF
Missing GitHub OAuth credentials.

Create a GitHub OAuth App with:
  Homepage URL: https://app.sagerouter.dev
  Authorization callback URL: https://${PROJECT_REF}.supabase.co/auth/v1/callback

Then rerun with:
  SAGEROUTER_GITHUB_CLIENT_ID=...
  SAGEROUTER_GITHUB_CLIENT_SECRET=...
EOF
  exit 2
fi

api="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"
current="$(curl -fsS "$api" -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")"
allow_list="$(printf '%s' "$current" | jq -r '.uri_allow_list // ""')"

merged_allow_list="$(
  ALLOW_LIST="$allow_list" python3 - <<'PY'
import os

items = [item.strip() for item in os.environ.get("ALLOW_LIST", "").split(",") if item.strip()]
for item in (
    "https://sagerouter.dev/**",
    "https://www.sagerouter.dev/**",
    "https://app.sagerouter.dev/**",
    "https://api.sagerouter.dev/**",
    "http://localhost:3000/**",
    "http://localhost:5173/**",
):
    if item not in items:
        items.append(item)
print(",".join(items))
PY
)"

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

jq -n \
  --arg site_url "$AUTH_SITE_URL" \
  --arg uri_allow_list "$merged_allow_list" \
  --arg client_id "$GITHUB_CLIENT_ID" \
  --arg secret "$GITHUB_CLIENT_SECRET" \
  '{
    site_url: $site_url,
    external_github_enabled: true,
    external_github_client_id: $client_id,
    external_github_secret: $secret,
    uri_allow_list: $uri_allow_list
  }' > "$payload"

curl -fsS -X PATCH "$api" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @"$payload" >/dev/null

curl -fsS "$api" -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" |
  jq '{site_url, uri_allow_list, external_github_enabled}'
