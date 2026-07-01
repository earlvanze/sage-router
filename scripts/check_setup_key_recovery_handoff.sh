#!/usr/bin/env bash
set -euo pipefail

APP_BASE="${SAGEROUTER_APP_BASE_URL:-https://app.sagerouter.dev}"
MARKETING_BASE="${SAGEROUTER_MARKETING_BASE_URL:-https://sagerouter.dev}"
FUNNEL_ENDPOINT="${SAGEROUTER_FUNNEL_EVENT_URL:-${APP_BASE%/}/api/funnel-event}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

tmp_body="$(mktemp /tmp/sage-router-setup-key-recovery.XXXXXX)"
trap 'rm -f "$tmp_body"' EXIT

require_cmd curl
require_cmd jq

pass() {
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

http_get() {
  local url="$1"
  curl -sS -L -o "$tmp_body" -w '%{http_code}' "$url"
}

post_smoke_event() {
  local event="$1"
  local origin="$2"
  local source_page="$3"
  local target="$4"
  local state="$5"
  local code ok skipped
  code="$(
    curl -sS -o "$tmp_body" -w '%{http_code}' \
      -H "Origin: ${origin%/}" \
      -H 'Content-Type: application/json' \
      --data "{\"event\":\"${event}\",\"plan\":\"pro\",\"sourcePage\":\"${source_page}\",\"target\":\"${target}\",\"metadata\":{\"source\":\"setup-key-recovery\",\"button\":\"smoke\",\"state\":\"${state}\",\"utmCampaign\":\"signup_to_key_recovery\"}}" \
      "$FUNNEL_ENDPOINT"
  )"
  ok="$(jq -r '.ok // false' "$tmp_body" 2>/dev/null || true)"
  skipped="$(jq -r '.skipped // empty' "$tmp_body" 2>/dev/null || true)"
  if [[ "$code" == "200" && "$ok" == "true" && "$skipped" == "smoke" ]]; then
    pass "${event} smoke accepted without persistence"
  else
    fail "${event} smoke failed: http=${code} ok=${ok:-missing} skipped=${skipped:-missing}"
  fi
}

page_url="${MARKETING_BASE%/}/setup-key-recovery?plan=pro&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&source_surface=operator_activation&smoke=1"
account_target="${APP_BASE%/}/account.html?plan=pro&start=create_key&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&auth=email&setup=setup-key-recovery&source_surface=operator_activation&next=generated-key"
login_target="${APP_BASE%/}/login.html?plan=pro&start=create_key&utm_source=setup-key-recovery&utm_medium=recovery&utm_campaign=signup_to_key_recovery&auth=email"
auth_js_target="${APP_BASE%/}/auth.js"

page_code="$(http_get "$page_url")"
if [[ "$page_code" != "200" ]]; then
  fail "setup-key recovery page returned HTTP ${page_code}"
fi

grep -q 'Finish Sage Router Setup Key' "$tmp_body" || fail 'setup-key recovery page missing title'
grep -q 'same email or GitHub identity' "$tmp_body" || fail 'setup-key recovery page missing same-identity guidance'
grep -q 'operator-auto-account-setup' "$tmp_body" || fail 'setup-key recovery page missing operator auto-account handoff'
grep -q 'api-auth-auto-account-setup' "$tmp_body" || fail 'setup-key recovery page missing API-auth auto-account handoff'
grep -q 'recovery-auto-account-setup' "$tmp_body" || fail 'setup-key recovery page missing recovery auto-account handoff'
grep -q 'setup_key_recovery_auto_account_redirected' "$tmp_body" || fail 'setup-key recovery page missing auto-account telemetry'
grep -q 'setup_key_recovery_fast_account_clicked' "$tmp_body" || fail 'setup-key recovery page missing fast-account telemetry'
grep -q 'setup_key_recovery_fast_account_link_copied' "$tmp_body" || fail 'setup-key recovery page missing fast-account copy telemetry'
grep -q 'setup_key_recovery_next_account_clicked' "$tmp_body" || fail 'setup-key recovery page missing next-account telemetry'
grep -q 'Already signed in? Go straight to API key setup.' "$tmp_body" || fail 'setup-key recovery page missing signed-in fast path'
grep -q 'id="setup-key-recovery-fast-account"' "$tmp_body" || fail 'setup-key recovery page missing signed-in fast account link'
grep -q "sourceSurface === 'recovery'" "$tmp_body" || fail 'setup-key recovery page does not auto-open recovery source_surface traffic'
grep -q "setup === 'login-key-recovery'" "$tmp_body" || fail 'setup-key recovery page does not auto-open login-key-recovery traffic'
grep -q "utmSource === 'api-auth' && utmCampaign === 'signup_to_key_recovery'" "$tmp_body" || fail 'setup-key recovery page does not auto-open API-auth recovery traffic'
grep -q "if (sourceSurface) target.searchParams.set('source_surface', sourceSurface)" "$tmp_body" || fail 'setup-key recovery page does not preserve source_surface'
grep -q "if (setup) target.searchParams.set('setup', setup)" "$tmp_body" || fail 'setup-key recovery page does not preserve setup source'
grep -q 'target.searchParams.set('\''next'\'', '\''generated-key'\'')' "$tmp_body" || fail 'setup-key recovery page does not preserve generated-key next step'
grep -q 'https://app.sagerouter.dev/account.html?plan=pro&start=create_key' "$tmp_body" || fail 'setup-key recovery page does not use canonical account.html handoff'
if grep -q 'https://app.sagerouter.dev/account?plan=pro&start=create_key' "$tmp_body"; then
  fail 'setup-key recovery page still uses non-canonical account handoff'
fi
pass 'setup-key recovery page exposes operator handoff controls and attribution preservation'

login_code="$(http_get "$login_target")"
if [[ "$login_code" != "200" ]]; then
  fail "login recovery page returned HTTP ${login_code}"
fi
grep -q 'href="/account.html?plan=pro&start=create_key' "$tmp_body" || fail 'login recovery page does not use canonical account.html handoff'
if grep -q 'href="/account?plan=pro&start=create_key' "$tmp_body"; then
  fail 'login recovery page still uses non-canonical account handoff'
fi
grep -q 'login-key-recovery-primary-handoff' "$tmp_body" || fail 'login recovery page missing primary account setup handoff'
grep -q 'primary_account_setup_handoff' "$tmp_body" || fail 'login recovery page missing primary handoff telemetry label'
grep -q 'account setup opens automatically after about one second' "$tmp_body" || fail 'login recovery page missing fast auto-handoff copy'

auth_js_code="$(http_get "$auth_js_target")"
if [[ "$auth_js_code" != "200" ]]; then
  fail "auth.js returned HTTP ${auth_js_code}"
fi
grep -q "ACCOUNT_ACTIVATION_PATH = '/account.html?plan=pro&start=create_key" "$tmp_body" || fail 'auth.js does not use canonical account.html activation path'
if grep -q "ACCOUNT_ACTIVATION_PATH = '/account?plan=pro&start=create_key" "$tmp_body"; then
  fail 'auth.js still uses non-canonical account activation path'
fi
grep -q 'KEY_RECOVERY_ACCOUNT_HANDOFF_DELAY_MS = 1000' "$tmp_body" || fail 'auth.js does not use fast key-recovery auto handoff'
pass 'login recovery page and auth.js use canonical account.html handoffs'

endpoint_code="$(http_get "$FUNNEL_ENDPOINT")"
if [[ "$endpoint_code" != "200" ]]; then
  fail "funnel endpoint returned HTTP ${endpoint_code}"
fi
for event in setup_key_recovery_auto_account_redirected setup_key_recovery_fast_account_clicked setup_key_recovery_fast_account_link_copied login_key_recovery_account_setup_auto_redirected account_setup_handoff_viewed; do
  jq -e --arg event "$event" '(.allowedEvents // []) | index($event) != null' "$tmp_body" >/dev/null \
    || fail "funnel endpoint missing allowed event ${event}"
done
pass 'funnel endpoint allows setup-key recovery handoff smoke events'

post_smoke_event \
  'setup_key_recovery_auto_account_redirected' \
  "$MARKETING_BASE" \
  "$page_url" \
  "$account_target" \
  'operator_activation'

post_smoke_event \
  'setup_key_recovery_auto_account_redirected' \
  "$MARKETING_BASE" \
  "${page_url}&setup=login-key-recovery&source_surface=recovery" \
  "$account_target" \
  'login-key-recovery'

post_smoke_event \
  'setup_key_recovery_auto_account_redirected' \
  "$MARKETING_BASE" \
  "${MARKETING_BASE%/}/setup-key-recovery?utm_source=api-auth&utm_medium=recovery&utm_campaign=signup_to_key_recovery&smoke=1" \
  "${APP_BASE%/}/account.html?plan=pro&start=create_key&utm_source=api-auth&utm_medium=recovery&utm_campaign=signup_to_key_recovery&auth=email&setup=setup-key-recovery&source_surface=api-auth&next=generated-key" \
  'api-auth'

post_smoke_event \
  'setup_key_recovery_fast_account_clicked' \
  "$MARKETING_BASE" \
  "$page_url" \
  "$account_target" \
  'signed-in-fast-account-setup'

post_smoke_event \
  'setup_key_recovery_fast_account_link_copied' \
  "$MARKETING_BASE" \
  "$page_url" \
  "$account_target" \
  'copy-fast-account-setup-link'

post_smoke_event \
  'login_key_recovery_account_setup_auto_redirected' \
  "$APP_BASE" \
  "${APP_BASE%/}/login.html?start=create_key&smoke=1" \
  "${APP_BASE%/}/account.html?start=create_key" \
  'smoke'

post_smoke_event \
  'account_setup_handoff_viewed' \
  "$APP_BASE" \
  "${APP_BASE%/}/account.html?start=create_key&setup=login-key-recovery&source_surface=recovery&next=generated-key&smoke=1" \
  '#intent-email' \
  'smoke'

printf 'Setup-key recovery handoff smoke passed. No emails, customer IDs, prompts, generated keys, OAuth tokens, provider credentials, or raw responses were sent or stored.\n'
