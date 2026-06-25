const ALLOWED_EVENTS = new Set([
  'calculator_viewed',
  'calculator_checkout_clicked',
  'calculator_checkout_unavailable',
  'calculator_compare_plans_clicked',
  'calculator_audit_brief_copied',
  'pricing_viewed',
  'pricing_checkout_clicked',
  'pricing_account_clicked',
  'pricing_quickstart_clicked',
  'pricing_magic_link_requested',
  'pricing_magic_link_sent',
  'pricing_magic_link_failed',
  'fusion_viewed',
  'fusion_checkout_clicked',
  'fusion_quickstart_clicked',
  'fusion_gateway_migration_clicked',
  'fusion_pricing_clicked',
  'fusion_models_clicked',
  'managed_access_interest_clicked',
  'managed_access_viewed',
  'managed_access_form_started',
  'managed_access_request_submitted',
  'managed_access_request_received',
  'quickstart_viewed',
  'quickstart_account_clicked',
  'quickstart_api_reference_clicked',
  'quickstart_gateway_migration_clicked',
  'quickstart_models_clicked',
  'quickstart_codex_clicked',
  'quickstart_troubleshooting_clicked',
  'quickstart_pricing_clicked',
  'quickstart_status_clicked',
  'quickstart_snippet_copied',
  'codex_docs_viewed',
  'codex_docs_account_clicked',
  'codex_docs_api_reference_clicked',
  'codex_docs_quickstart_clicked',
  'codex_docs_troubleshooting_clicked',
  'codex_docs_models_clicked',
  'codex_docs_status_clicked',
  'codex_docs_snippet_copied',
  'launch_plan_viewed',
  'launch_plan_checkout_clicked',
  'launch_plan_managed_access_clicked',
  'launch_plan_conversion_clicked',
  'gateway_compare_viewed',
  'gateway_compare_checkout_clicked',
  'gateway_compare_account_clicked',
  'gateway_compare_pricing_clicked',
  'gateway_compare_migration_clicked',
  'gateway_compare_calculator_clicked',
  'gateway_compare_managed_access_clicked',
  'content_article_viewed',
  'content_article_quickstart_clicked',
  'content_article_checkout_clicked',
  'content_article_compare_clicked',
  'content_article_calculator_clicked',
  'content_article_codex_clicked',
  'content_article_github_clicked',
  'model_catalog_viewed',
  'model_catalog_search_bucketed',
  'model_catalog_filter_clicked',
  'model_catalog_account_clicked',
  'model_catalog_quickstart_clicked',
  'model_catalog_pricing_clicked',
  'model_catalog_codex_clicked',
  'model_catalog_gateway_clicked',
  'model_catalog_json_clicked',
  'account_viewed',
  'account_plan_selected',
  'auth_provider_state_checked',
  'account_oauth_clicked',
  'account_login_submitted',
  'account_login_succeeded',
  'account_signup_submitted',
  'account_signup_succeeded',
  'account_magic_link_requested',
  'account_magic_link_sent',
  'login_wallet_clicked',
  'login_wallet_connected',
  'account_checkout_clicked',
  'account_checkout_failed',
  'account_checkout_returned',
  'account_billing_portal_clicked',
  'account_billing_portal_failed',
  'account_billing_portal_returned',
  'account_crypto_intent_clicked',
  'account_crypto_intent_created',
  'account_crypto_intent_failed',
  'account_crypto_status_clicked',
  'account_crypto_status_checked',
  'account_crypto_status_failed',
  'account_usage_upgrade_clicked',
  'account_api_key_create_clicked',
  'account_api_key_created',
  'account_api_key_revoke_clicked',
  'account_api_key_revoked',
  'account_api_key_revoke_failed',
  'account_key_verify_clicked',
  'account_key_verified',
  'account_first_request_clicked',
  'account_first_request_succeeded',
  'account_snippet_copied',
  'account_support_context_copied',
  'billing_payment_recovery_clicked',
  'billing_account_clicked',
  'billing_pricing_clicked',
  'billing_support_clicked',
  'billing_quickstart_clicked',
  'billing_status_clicked',
  'billing_troubleshooting_clicked',
  'landing_viewed',
  'landing_account_clicked',
  'landing_pricing_clicked',
  'landing_billing_clicked',
  'landing_quickstart_clicked',
  'landing_integrations_clicked',
  'landing_status_clicked',
  'landing_gateway_compare_clicked',
  'landing_article_clicked',
  'landing_models_clicked',
  'landing_calculator_clicked',
  'landing_managed_access_clicked',
  'landing_security_clicked',
  'landing_analytics_clicked',
  'landing_login_clicked',
  'landing_github_clicked',
  'landing_waitlist_submitted',
]);

const ALLOWED_PLANS = new Set(['lite', 'pro', 'max', 'trial', 'manual']);
const ALLOWED_METADATA_KEYS = new Set([
  'score',
  'volumeBucket',
  'riskLevel',
  'savingsBucket',
  'source',
  'intent',
  'button',
  'state',
  'billing',
  'enabledProviders',
  'disabledProviders',
  'githubEnabled',
  'oauthProviderCount',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'referrerHost',
  'landingPath',
  'deployment',
  'monthlyVolume',
  'providerAccess',
  'targetProviderFamily',
  'commercialPreference',
  'supportNeed',
  'targetLaunchWindow',
  'modelFamily',
  'queryBucket',
  'catalogSource',
  'resultCount',
  'snippet',
]);

const DEFAULT_ALLOWED_ORIGIN_HOSTS = new Set([
  'sagerouter.dev',
  'www.sagerouter.dev',
  'app.sagerouter.dev',
  'localhost',
  '127.0.0.1',
]);

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

const sanitizedUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://sagerouter.dev');
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};

const sanitizePlan = (value) => {
  const plan = String(value || '').trim().toLowerCase();
  return ALLOWED_PLANS.has(plan) ? plan : null;
};

const sanitizeMetadata = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  for (const key of ALLOWED_METADATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === 'boolean') {
      out[key] = raw;
    } else {
      out[key] = String(raw).slice(0, 80);
    }
  }
  return out;
};

const attributionValue = (value) => {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .slice(0, 80);
  return sanitized || null;
};

const configuredAllowedOrigins = (env) => String(env.SAGEROUTER_FUNNEL_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, '').toLowerCase())
  .filter(Boolean);

const originForHeader = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
};

const originForRequest = (request) => {
  return originForHeader(request.headers.get('origin'));
};

const allowedOrigin = (origin, env) => {
  if (!origin) return null;
  const configured = configuredAllowedOrigins(env);
  if (configured.includes(origin)) return origin;
  try {
    const url = new URL(origin);
    if (DEFAULT_ALLOWED_ORIGIN_HOSTS.has(url.hostname)) return origin;
    if (url.hostname.endsWith('.sage-router-web.pages.dev')) return origin;
    return null;
  } catch {
    return null;
  }
};

const corsHeadersForOrigin = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'Origin',
});

const funnelConfig = (env) => {
  const supabaseUrl = env.SAGEROUTER_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SAGEROUTER_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceKey };
};

const insert = async (supabaseUrl, serviceKey, record) => fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/sage_router_funnel_events`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    prefer: 'return=minimal',
  },
  body: JSON.stringify(record),
});

export async function onRequestOptions({ request, env }) {
  const requestOrigin = originForRequest(request);
  const acceptedOrigin = allowedOrigin(requestOrigin, env);
  if (!acceptedOrigin) return json({ error: 'origin_not_allowed' }, 403);
  return new Response(null, {
    status: 204,
    headers: corsHeadersForOrigin(acceptedOrigin),
  });
}

export async function onRequestGet({ env }) {
  const { supabaseUrl, serviceKey } = funnelConfig(env);
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 500);
  return json({
    ok: true,
    service: 'sage-router-funnel-event',
    storage: 'supabase',
    primaryTable: 'sage_router_funnel_events',
    allowedEvents: Array.from(ALLOWED_EVENTS).sort(),
    allowedPlans: Array.from(ALLOWED_PLANS).sort(),
    privacy: {
      containsEmails: false,
      promptsStored: false,
      messageBodiesStored: false,
      containsApiKeys: false,
      containsProviderCredentials: false,
    },
    writeGuard: {
      browserOriginRequired: true,
      refererFallbackAccepted: false,
      allowedHosts: Array.from(DEFAULT_ALLOWED_ORIGIN_HOSTS).sort(),
      previewHostSuffix: '.sage-router-web.pages.dev',
      configurableOriginsEnv: 'SAGEROUTER_FUNNEL_ALLOWED_ORIGINS',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const requestOrigin = originForRequest(request);
  const acceptedOrigin = allowedOrigin(requestOrigin, env);
  if (!acceptedOrigin) return json({ error: 'origin_not_allowed' }, 403);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const event = String(payload.event || '').trim().toLowerCase();
  if (!ALLOWED_EVENTS.has(event)) return json({ error: 'invalid_event' }, 400);

  const { supabaseUrl, serviceKey } = funnelConfig(env);
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_not_configured' }, 500);

  const record = {
    event,
    plan: sanitizePlan(payload.plan),
    source_page: sanitizedUrl(payload.sourcePage) || 'https://sagerouter.dev',
    target: sanitizedUrl(payload.target),
    metadata: {
      ...sanitizeMetadata(payload.metadata),
      utmSource: attributionValue(payload.metadata?.utmSource),
      utmMedium: attributionValue(payload.metadata?.utmMedium),
      utmCampaign: attributionValue(payload.metadata?.utmCampaign),
      referrerHost: attributionValue(payload.metadata?.referrerHost),
      landingPath: attributionValue(payload.metadata?.landingPath),
      user_agent: String(request.headers.get('user-agent') || '').slice(0, 160) || null,
      referer: sanitizedUrl(request.headers.get('referer')),
      origin: sanitizedUrl(request.headers.get('origin')),
    },
  };

  const response = await insert(supabaseUrl, serviceKey, record);
  if (!response.ok) {
    const details = await response.text();
    return json({ error: 'supabase_insert_failed', details }, 502, corsHeadersForOrigin(acceptedOrigin));
  }

  return json({ ok: true }, 200, corsHeadersForOrigin(acceptedOrigin));
}
