#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SAGEROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
APP_BASE="${SAGEROUTER_APP_BASE_URL:-https://app.sagerouter.dev}"
MARKETING_BASE="${SAGEROUTER_MARKETING_BASE_URL:-https://sagerouter.dev}"
ORIGIN_BASE="${SAGEROUTER_ORIGIN_BASE_URL:-}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-awtangrlqqsdpksarhwo}"
SUPABASE_URL="${SAGE_ROUTER_SUPABASE_URL:-${PUBLIC_SUPABASE_URL:-https://${SUPABASE_PROJECT_REF}.supabase.co}}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SUPABASE_SERVICE_ROLE_KEY="${SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
ADMIN_TOKEN="${SAGE_ROUTER_API_KEY:-${SAGE_ROUTER_EDGE_TOKEN:-}}"
FAILURES=0

pass() {
  printf 'PASS %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

http_code() {
  local url="$1"
  shift
  curl -sS -o /tmp/sage-router-readiness-body -w '%{http_code}' "$url" "$@"
}

http_code_follow() {
  local url="$1"
  shift
  curl -sSL -o /tmp/sage-router-readiness-body -w '%{http_code}' "$url" "$@"
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
  local code analytics_code funnel_code account_analytics_code
  code="$(http_code "${API_BASE%/}/v1/models")"
  rm -f /tmp/sage-router-readiness-body
  analytics_code="$(http_code "${API_BASE%/}/analytics?days=7")"
  rm -f /tmp/sage-router-readiness-body
  funnel_code="$(http_code "${API_BASE%/}/analytics/funnel?days=30")"
  rm -f /tmp/sage-router-readiness-body
  account_analytics_code="$(http_code "${API_BASE%/}/account/analytics?days=7")"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "401" && "$analytics_code" == "401" && "$funnel_code" == "401" && "$account_analytics_code" == "401" ]]; then
    pass "anonymous model and analytics APIs are blocked"
  else
    fail "anonymous auth gate incomplete: /v1/models=${code} /analytics=${analytics_code} /analytics/funnel=${funnel_code} /account/analytics=${account_analytics_code}, expected 401"
  fi
}

check_public_pricing_metadata() {
  local code plans api_base openai_base checkout_path portal_path api_key_limit limits_ok stripe_ok launch_ok
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
  api_key_limit="$(jq -r '.maxActiveApiKeysPerCustomer // 0' /tmp/sage-router-readiness-body)"
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
  launch_ok="$(jq -r '
    (.publicLaunch.targetMrrUsd == 10000) and
    (.publicLaunch.recommendedMix.monthlyRevenueUsd == 10200) and
    (.publicLaunch.primaryRevenueModel == "hosted_routing_control_plane") and
    (.publicLaunch.pricingPage == "https://sagerouter.dev/pricing") and
    ((.publicLaunch.complianceBoundary // "") | contains("does not grant unauthorized model access"))
  ' /tmp/sage-router-readiness-body)"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$plans" =~ ^[0-9]+$ && "$plans" -gt 0 && "$api_key_limit" =~ ^[0-9]+$ && "$api_key_limit" -gt 0 && "$api_base" == "${API_BASE%/}" && "$openai_base" == "${API_BASE%/}/v1" && "$checkout_path" == "/billing/stripe/checkout" && "$portal_path" == "/billing/stripe/portal" && "$limits_ok" == "true" && "$stripe_ok" == "true" && "$launch_ok" == "true" ]]; then
    pass "public /pricing exposes hosted plan, Stripe billing, endpoint, limit, and launch metadata"
  else
    fail "public /pricing metadata incomplete: plans=${plans:-missing} apiBaseUrl=${api_base:-missing} openaiBaseUrl=${openai_base:-missing} checkoutPath=${checkout_path:-missing} billingPortalPath=${portal_path:-missing} apiKeyLimit=${api_key_limit:-missing} limits=${limits_ok:-missing} stripe=${stripe_ok:-missing} launch=${launch_ok:-missing}"
  fi
}

check_stripe_webhook_guard() {
  local code error
  code="$(http_code "${API_BASE%/}/billing/stripe/webhook" \
    -H "Content-Type: application/json" \
    --data '{"id":"evt_readiness_unsigned","type":"readiness.probe"}')"
  error="$(jq -r '.error // empty' /tmp/sage-router-readiness-body 2>/dev/null || true)"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "400" && "$error" == "invalid_signature" ]]; then
    pass "Stripe webhook endpoint is configured and rejects unsigned events"
  else
    fail "Stripe webhook guard returned HTTP ${code} error=${error:-missing}, expected 400 invalid_signature"
  fi
}

check_hosted_onboarding_pages() {
  local login_code account_code analytics_code manifest_code
  login_code="$(http_code_follow "${APP_BASE%/}/login.html")"
  if [[ "$login_code" == "200" ]] && ! grep -q "Login · Sage Router" /tmp/sage-router-readiness-body; then
    login_code="200:unexpected-body"
  fi
  rm -f /tmp/sage-router-readiness-body

  account_code="$(http_code_follow "${APP_BASE%/}/account.html")"
  if [[ "$account_code" == "200" ]] && ! grep -q "Sage Router Account" /tmp/sage-router-readiness-body; then
    account_code="200:unexpected-body"
  fi
  if [[ "$account_code" == "200" ]] && ! grep -q "Verify API key" /tmp/sage-router-readiness-body; then
    account_code="200:missing-api-key-verification"
  fi
  rm -f /tmp/sage-router-readiness-body

  analytics_code="$(http_code_follow "${APP_BASE%/}/analytics.html")"
  if [[ "$analytics_code" == "200" ]] && ! grep -q "Router analytics that prove the best route" /tmp/sage-router-readiness-body; then
    analytics_code="200:unexpected-body"
  fi
  rm -f /tmp/sage-router-readiness-body

  local analytics_js_code
  analytics_js_code="$(http_code_follow "${APP_BASE%/}/analytics.js")"
  if [[ "$analytics_js_code" == "200" ]] && ! grep -q "/account/analytics" /tmp/sage-router-readiness-body; then
    analytics_js_code="200:missing-account-analytics"
  fi
  rm -f /tmp/sage-router-readiness-body

  local account_js_code
  account_js_code="$(http_code_follow "${APP_BASE%/}/account.js")"
  if [[ "$account_js_code" == "200" ]] && ! grep -q "testApiKey" /tmp/sage-router-readiness-body; then
    account_js_code="200:missing-api-key-test"
  fi
  rm -f /tmp/sage-router-readiness-body

  manifest_code="$(http_code_follow "${APP_BASE%/}/github-app-manifest.html")"
  if [[ "$manifest_code" == "200" ]] && ! grep -q "Finish GitHub auth setup" /tmp/sage-router-readiness-body; then
    manifest_code="200:unexpected-body"
  fi
  rm -f /tmp/sage-router-readiness-body

  if [[ "$login_code" == "200" && "$account_code" == "200" && "$analytics_code" == "200" && "$analytics_js_code" == "200" && "$account_js_code" == "200" && "$manifest_code" == "200" ]]; then
    pass "hosted login, account, API-key verification, analytics, and GitHub auth callback pages are live"
  else
    fail "hosted onboarding pages incomplete: login=${login_code} account=${account_code} account.js=${account_js_code} analytics=${analytics_code} analytics.js=${analytics_js_code} github-app-manifest=${manifest_code}"
  fi
}

check_waitlist_endpoint() {
  local code ok service
  code="$(http_code "${APP_BASE%/}/api/waitlist")"
  ok="$(jq -r '.ok // false' /tmp/sage-router-readiness-body 2>/dev/null || true)"
  service="$(jq -r '.service // empty' /tmp/sage-router-readiness-body 2>/dev/null || true)"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "200" && "$ok" == "true" && "$service" == "sage-router-waitlist" ]]; then
    pass "hosted waitlist endpoint is configured"
  else
    fail "hosted waitlist endpoint returned HTTP ${code} ok=${ok:-missing} service=${service:-missing}"
  fi
}

check_marketing_comparison_page() {
  local page_code sitemap_code
  page_code="$(http_code_follow "${MARKETING_BASE%/}/compare/openrouter")"
  if [[ "$page_code" == "200" ]] && ! grep -q "Sage Router vs OpenRouter" /tmp/sage-router-readiness-body; then
    page_code="200:unexpected-body"
  fi
  rm -f /tmp/sage-router-readiness-body

  sitemap_code="$(http_code_follow "${MARKETING_BASE%/}/sitemap.xml")"
  if [[ "$sitemap_code" == "200" ]] && ! grep -q "${MARKETING_BASE%/}/compare/openrouter" /tmp/sage-router-readiness-body; then
    sitemap_code="200:missing-compare-url"
  fi
  rm -f /tmp/sage-router-readiness-body

  if [[ "$page_code" == "200" && "$sitemap_code" == "200" ]]; then
    pass "marketing OpenRouter comparison page is live and in sitemap"
  else
    fail "marketing OpenRouter comparison incomplete: page=${page_code} sitemap=${sitemap_code}"
  fi
}

check_marketing_pricing_page() {
  local page_code sitemap_code
  page_code="$(http_code_follow "${MARKETING_BASE%/}/pricing")"
  if [[ "$page_code" == "200" ]] && ! grep -q "Sage Router Hosted Pricing" /tmp/sage-router-readiness-body; then
    page_code="200:unexpected-body"
  fi
  rm -f /tmp/sage-router-readiness-body

  sitemap_code="$(http_code_follow "${MARKETING_BASE%/}/sitemap.xml")"
  if [[ "$sitemap_code" == "200" ]] && ! grep -q "${MARKETING_BASE%/}/pricing" /tmp/sage-router-readiness-body; then
    sitemap_code="200:missing-pricing-url"
  fi
  rm -f /tmp/sage-router-readiness-body

  if [[ "$page_code" == "200" && "$sitemap_code" == "200" ]]; then
    pass "marketing hosted pricing page is live and in sitemap"
  else
    fail "marketing hosted pricing page incomplete: page=${page_code} sitemap=${sitemap_code}"
  fi
}

check_admin_token() {
  if [[ -z "$ADMIN_TOKEN" ]]; then
    warn "SAGE_ROUTER_API_KEY/SAGE_ROUTER_EDGE_TOKEN not set; skipped private admin token probe"
    return
  fi
  local code funnel_code funnel_ok
  code="$(http_code "${API_BASE%/}/v1/models" -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  rm -f /tmp/sage-router-readiness-body
  funnel_code="$(http_code "${API_BASE%/}/analytics/funnel?days=30" -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  funnel_ok="$(jq -r '((.stages // {}) | has("signups")) and ((.privacy // {}) | .containsEmails == false)' /tmp/sage-router-readiness-body 2>/dev/null || true)"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$code" == "200" && "$funnel_code" == "200" && "$funnel_ok" == "true" ]]; then
    pass "private admin token can reach /v1/models and privacy-safe launch funnel"
  else
    fail "private admin token probe failed: /v1/models=${code} /analytics/funnel=${funnel_code} funnel=${funnel_ok:-missing}, expected 200/true"
  fi
}

check_origin_auth_gate() {
  if [[ -z "$ORIGIN_BASE" ]]; then
    warn "SAGEROUTER_ORIGIN_BASE_URL not set; skipped direct origin auth-gate probe"
    return
  fi
  local models_code setup_code admin_code
  models_code="$(http_code "${ORIGIN_BASE%/}/v1/models")"
  rm -f /tmp/sage-router-readiness-body
  setup_code="$(http_code "${ORIGIN_BASE%/}/setup/state")"
  rm -f /tmp/sage-router-readiness-body
  admin_code="$(http_code "${ORIGIN_BASE%/}/admin/blocks")"
  rm -f /tmp/sage-router-readiness-body
  if [[ "$models_code" == "401" && "$setup_code" == "401" && "$admin_code" == "401" ]]; then
    pass "direct hosted origin blocks anonymous model, setup, and admin routes"
  else
    fail "direct hosted origin auth gate incomplete: /v1/models=${models_code} /setup/state=${setup_code} /admin/blocks=${admin_code}"
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
check_stripe_webhook_guard
check_hosted_onboarding_pages
check_waitlist_endpoint
check_marketing_comparison_page
check_marketing_pricing_page
check_admin_token
check_origin_auth_gate
check_supabase_auth_config
check_quota_schema

if [[ "$FAILURES" -gt 0 ]]; then
  exit 1
fi
