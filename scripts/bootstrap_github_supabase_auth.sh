#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-awtangrlqqsdpksarhwo}"
AUTH_SITE_URL="${SAGEROUTER_AUTH_SITE_URL:-https://app.sagerouter.dev}"
APP_NAME="${SAGEROUTER_GITHUB_APP_NAME:-Sage Router Auth}"
APP_OWNER="${SAGEROUTER_GITHUB_APP_OWNER:-}"
MANIFEST_CODE="${SAGEROUTER_GITHUB_APP_MANIFEST_CODE:-${GITHUB_APP_MANIFEST_CODE:-}}"
GITHUB_CLIENT_ID="${SAGEROUTER_GITHUB_CLIENT_ID:-${GITHUB_CLIENT_ID:-}}"
GITHUB_CLIENT_SECRET="${SAGEROUTER_GITHUB_CLIENT_SECRET:-${GITHUB_CLIENT_SECRET:-}}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN to a Supabase Management API token.}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

callback_url="https://${PROJECT_REF}.supabase.co/auth/v1/callback"

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

configure_supabase() {
  SAGEROUTER_AUTH_SITE_URL="$AUTH_SITE_URL" \
  SUPABASE_PROJECT_REF="$PROJECT_REF" \
  SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" \
  SAGEROUTER_GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  SAGEROUTER_GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
    bash "${script_dir}/configure_supabase_github_auth.sh"
}

if [[ -n "$GITHUB_CLIENT_ID" && -n "$GITHUB_CLIENT_SECRET" ]]; then
  configure_supabase
  exit 0
fi

if [[ -n "$MANIFEST_CODE" ]]; then
  response="$(
    curl -fsS -X POST "https://api.github.com/app-manifests/${MANIFEST_CODE}/conversions" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2026-03-10"
  )"
  GITHUB_CLIENT_ID="$(printf '%s' "$response" | jq -r '.client_id // empty')"
  GITHUB_CLIENT_SECRET="$(printf '%s' "$response" | jq -r '.client_secret // empty')"
  [[ -n "$GITHUB_CLIENT_ID" && -n "$GITHUB_CLIENT_SECRET" ]] || die "GitHub manifest conversion did not return a client id and secret."
  configure_supabase
  printf 'Configured Supabase GitHub auth for app id %s.\n' "$(printf '%s' "$response" | jq -r '.id // "unknown"')"
  exit 0
fi

state="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)"
manifest="$(
  jq -n \
    --arg name "$APP_NAME" \
    --arg url "$AUTH_SITE_URL" \
    --arg redirect_url "$AUTH_SITE_URL/github-app-manifest.html" \
    --arg callback_url "$callback_url" \
    '{
      name: $name,
      url: $url,
      redirect_url: $redirect_url,
      callback_urls: [$callback_url],
      description: "Sage Router hosted account authentication",
      public: true,
      request_oauth_on_install: false,
      default_permissions: {},
      default_events: []
    }'
)"

target="https://github.com/settings/apps/new?state=${state}"
if [[ -n "$APP_OWNER" ]]; then
  target="https://github.com/organizations/${APP_OWNER}/settings/apps/new?state=${state}"
fi

form="${TMPDIR:-/tmp}/sage-router-github-auth-app.html"
python3 - "$target" "$manifest" > "$form" <<'PY'
import html
import sys

target, manifest = sys.argv[1], sys.argv[2]
print(f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Create Sage Router GitHub Auth App</title></head>
<body>
  <form id="github-app-form" action="{html.escape(target, quote=True)}" method="post">
    <input type="hidden" name="manifest" value="{html.escape(manifest, quote=True)}">
    <button type="submit">Create Sage Router GitHub Auth App</button>
  </form>
  <script>document.getElementById('github-app-form').submit();</script>
</body>
</html>""")
PY

cat <<EOF
GitHub requires an owner-approved browser step before it returns app credentials.

1. Open this local form in a browser signed into the GitHub owner account:
   ${form}
2. Approve the app named "${APP_NAME}".
3. GitHub redirects to ${AUTH_SITE_URL}/github-app-manifest.html?code=...
4. Rerun this script with:
   SAGEROUTER_GITHUB_APP_MANIFEST_CODE=<code> bash scripts/bootstrap_github_supabase_auth.sh

The callback configured for Supabase will be:
  ${callback_url}
EOF

if command -v powershell.exe >/dev/null 2>&1; then
  windows_form="$form"
  if command -v wslpath >/dev/null 2>&1; then
    windows_form="$(wslpath -w "$form")"
  fi
  powershell.exe -NoProfile -Command "Start-Process '$windows_form'" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$form" >/dev/null 2>&1 || true
fi
