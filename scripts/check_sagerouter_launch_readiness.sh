#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SAGEROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-awtangrlqqsdpksarhwo}"
SUPABASE_URL="${SAGE_ROUTER_SUPABASE_URL:-${PUBLIC_SUPABASE_URL:-https://${SUPABASE_PROJECT_REF}.supabase.co}}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SUPABASE_SERVICE_ROLE_KEY="${SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
ADMIN_TOKEN="${SAGE_ROUTER_API_KEY:-${SAGE_ROUTER_EDGE_TOKEN:-}}"

pass() {
  printf 'PASS %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
}

http_code() {
  local url="$1"
  shift
  curl -sS -o /tmp/sage-router-readiness-body -w '%{http_code}' "$url" "$@"
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    fail "jq is required"
    exit 2
  fi
}

check_edge_health() {
  local body
  body="$(curl -fsS "${API_BASE%/}/edge/health")"
  local status auth_mode selected
  status="$(printf '%s' "$body" | jq -r '.status // empty')"
  auth_mode="$(printf '%s' "$body" | jq -r '.authMode // empty')"
  selected="$(printf '%s' "$body" | jq -r '.selected // empty')"
  if [[ "$status" == "ok" && "$auth_mode" == "supabase" && -n "$selected" ]]; then
    pass "edge healthy, supabase auth enabled, selected ${selected}"
  else
    fail "edge health unexpected: status=${status:-missing} authMode=${auth_mode:-missing} selected=${selected:-missing}"
  fi
}

check_public_auth_gate() {
  local code
  code="$(http_code "${API_BASE%/}/v1/models")"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "401" ]]; then
    pass "anonymous /v1/models is blocked"
  else
    fail "anonymous /v1/models returned HTTP ${code}, expected 401"
  fi
}

check_public_pricing_metadata() {
  local code plans api_base openai_base checkout_path portal_path limits_ok stripe_ok
  code="$(http_code "${API_BASE%/}/pricing")"
  if [[ "$code" != "200" ]]; then
    rm -f /tmp/sage-router-readiness-body
    fail "public /pricing returned HTTP ${code}, expected 200"
    return
  fi
  plans="$(jq -r '((.plans // {}) | keys | length)' /tmp/sage-router-readiness-body)"
  api_base="$(jq -r '.apiBaseUrl // empty' /tmp/sage-router-readiness-body)"
  openai_base="$(jq -r '.openaiBaseUrl // empty' /tmp/sage-router-readiness-body)"
  checkout_path="$(jq -r '.checkoutPath // empty' /tmp/sage-router-readiness-body)"
  portal_path="$(jq -r '.billingPortalPath // empty' /tmp/sage-router-readiness-body)"
  limits_ok="$(jq -r '
    (.plans.lite.limits.monthlyRequests == 10000) and
    (.plans.lite.limits.rateLimitPerMinute == 60) and
    (.plans.pro.limits.monthlyRequests == 50000) and
    (.plans.pro.limits.rateLimitPerMinute == 180) and
    (.plans.max.limits.monthlyRequests == 200000) and
    (.plans.max.limits.rateLimitPerMinute == 600)
  ' /tmp/sage-router-readiness-body)"
  stripe_ok="$(jq -r '
    (.plans.lite.stripeConfigured == true) and
    (.plans.pro.stripeConfigured == true) and
    (.plans.max.stripeConfigured == true)
  ' /tmp/sage-router-readiness-body)"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$plans" =~ ^[0-9]+$ && "$plans" -gt 0 && "$api_base" == "${API_BASE%/}" && "$openai_base" == "${API_BASE%/}/v1" && "$checkout_path" == "/billing/stripe/checkout" && "$portal_path" == "/billing/stripe/portal" && "$limits_ok" == "true" && "$stripe_ok" == "true" ]]; then
    pass "public /pricing exposes hosted plan, Stripe billing, endpoint, and limit metadata"
  else
    fail "public /pricing metadata incomplete: plans=${plans:-missing} apiBaseUrl=${api_base:-missing} openaiBaseUrl=${openai_base:-missing} checkoutPath=${checkout_path:-missing} billingPortalPath=${portal_path:-missing} limits=${limits_ok:-missing} stripe=${stripe_ok:-missing}"
  fi
}

check_admin_token() {
  if [[ -z "$ADMIN_TOKEN" ]]; then
    warn "SAGE_ROUTER_API_KEY/SAGE_ROUTER_EDGE_TOKEN not set; skipped private admin token probe"
    return
  fi
  local code
  code="$(http_code "${API_BASE%/}/v1/models" -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "200" ]]; then
    pass "private admin token can reach /v1/models"
  else
    fail "private admin token returned HTTP ${code}, expected 200"
  fi
}

check_supabase_auth_config() {
  if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
    warn "SUPABASE_ACCESS_TOKEN not set; skipped Supabase auth config probe"
    return
  fi
  local config
  config="$(curl -fsS "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")"
  local site signup_disabled email_enabled github app_redirect api_redirect
  site="$(printf '%s' "$config" | jq -r '.site_url // empty')"
  signup_disabled="$(printf '%s' "$config" | jq -r 'if has("disable_signup") then .disable_signup else true end')"
  email_enabled="$(printf '%s' "$config" | jq -r '.external_email_enabled // false')"
  github="$(printf '%s' "$config" | jq -r '.external_github_enabled // false')"
  app_redirect="$(printf '%s' "$config" | jq -r '((.uri_allow_list // "") | contains("https://app.sagerouter.dev/**"))')"
  api_redirect="$(printf '%s' "$config" | jq -r '((.uri_allow_list // "") | contains("https://api.sagerouter.dev/**"))')"

  [[ "$site" == "https://app.sagerouter.dev" ]] && pass "Supabase site_url is app.sagerouter.dev" || fail "Supabase site_url is ${site:-missing}"
  [[ "$signup_disabled" == "false" && "$email_enabled" == "true" ]] && pass "Supabase email signup is enabled" || fail "Supabase email signup disabled: disable_signup=${signup_disabled:-missing} external_email_enabled=${email_enabled:-missing}"
  [[ "$app_redirect" == "true" && "$api_redirect" == "true" ]] && pass "Supabase redirect allow-list includes app/api hosts" || fail "Supabase redirect allow-list missing app/api hosts"
  [[ "$github" == "true" ]] && pass "GitHub OAuth provider enabled" || warn "GitHub OAuth provider disabled; run bash scripts/bootstrap_github_supabase_auth.sh"
}

check_quota_schema() {
  if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    warn "Supabase service role key not set; skipped quota schema probe"
    return
  fi
  local table_code rpc_code
  table_code="$(http_code "${SUPABASE_URL%/}/rest/v1/sage_router_usage_counters?select=id&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")"
  rm -f /tmp/sage-router-readiness-body
  rpc_code="$(http_code "${SUPABASE_URL%/}/rest/v1/rpc/sage_router_increment_usage" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data '{"p_customer_id":"readiness-probe","p_user_id":"readiness-probe","p_plan":"readiness","p_period":"2099-01","p_increment":1,"p_quota":1}')"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$table_code" == "200" && ( "$rpc_code" == "200" || "$rpc_code" == "409" ) ]]; then
    pass "Supabase quota table and RPC are installed"
  else
    warn "Supabase quota schema not ready: table HTTP ${table_code}, RPC HTTP ${rpc_code}; apply supabase/migrations/20260619021500_sage_router_usage_quotas.sql before enabling quotas"
  fi
}

require_jq
check_edge_health
check_public_auth_gate
check_public_pricing_metadata
check_admin_token
check_supabase_auth_config
check_quota_schema
