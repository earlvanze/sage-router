#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-awtangrlqqsdpksarhwo}"
AUTH_SITE_URL="${SAGEROUTER_AUTH_SITE_URL:-https://app.sagerouter.dev}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN to a Supabase Management API token.}"
GITHUB_CLIENT_ID="${SAGEROUTER_GITHUB_CLIENT_ID:-${GITHUB_CLIENT_ID:-}}"
GITHUB_CLIENT_SECRET="${SAGEROUTER_GITHUB_CLIENT_SECRET:-${GITHUB_CLIENT_SECRET:-}}"
SUPABASE_URL="${SAGE_ROUTER_SUPABASE_URL:-${PUBLIC_SUPABASE_URL:-${VITE_SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}}}"
SUPABASE_ANON_KEY="${SAGE_ROUTER_SUPABASE_ANON_KEY:-${PUBLIC_SUPABASE_ANON_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}}}"

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
    disable_signup: false,
    external_email_enabled: true,
    external_github_enabled: true,
    external_github_client_id: $client_id,
    external_github_secret: $secret,
    uri_allow_list: $uri_allow_list
  }' > "$payload"

curl -fsS -X PATCH "$api" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @"$payload" >/dev/null

updated="$(curl -fsS "$api" -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")"
site_url="$(printf '%s' "$updated" | jq -r '.site_url // empty')"
github_enabled="$(printf '%s' "$updated" | jq -r '.external_github_enabled // false')"
email_enabled="$(printf '%s' "$updated" | jq -r '.external_email_enabled // false')"
app_redirect="$(printf '%s' "$updated" | jq -r '((.uri_allow_list // "") | contains("https://app.sagerouter.dev/**"))')"
api_redirect="$(printf '%s' "$updated" | jq -r '((.uri_allow_list // "") | contains("https://api.sagerouter.dev/**"))')"

if [[ "$site_url" != "$AUTH_SITE_URL" || "$github_enabled" != "true" || "$email_enabled" != "true" || "$app_redirect" != "true" || "$api_redirect" != "true" ]]; then
  printf 'Supabase GitHub auth verification failed: site_url=%s github=%s email=%s app_redirect=%s api_redirect=%s\n' \
    "${site_url:-missing}" "$github_enabled" "$email_enabled" "$app_redirect" "$api_redirect" >&2
  exit 1
fi

if [[ -n "$SUPABASE_ANON_KEY" ]]; then
  public_settings="$(curl -fsS "${SUPABASE_URL%/}/auth/v1/settings" -H "apikey: ${SUPABASE_ANON_KEY}")"
  public_email="$(printf '%s' "$public_settings" | jq -r '.external.email // false')"
  public_github="$(printf '%s' "$public_settings" | jq -r '.external.github // false')"
  if [[ "$public_email" != "true" || "$public_github" != "true" ]]; then
    printf 'Supabase public auth settings verification failed: email=%s github=%s\n' "$public_email" "$public_github" >&2
    exit 1
  fi
else
  printf 'WARN Supabase anon key not set; skipped public /auth/v1/settings verification.\n' >&2
fi

printf '%s\n' "$updated" |
  jq '{site_url, uri_allow_list, external_email_enabled, external_github_enabled}'
