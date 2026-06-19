const ALLOWED_EVENTS = new Set([
  'calculator_checkout_clicked',
  'calculator_compare_plans_clicked',
  'calculator_audit_brief_copied',
  'pricing_checkout_clicked',
  'pricing_account_clicked',
  'pricing_quickstart_clicked',
  'managed_access_interest_clicked',
  'openrouter_compare_checkout_clicked',
  'openrouter_compare_account_clicked',
  'openrouter_compare_pricing_clicked',
  'openrouter_compare_calculator_clicked',
  'openrouter_compare_managed_access_clicked',
  'account_plan_selected',
  'account_checkout_clicked',
  'account_checkout_returned',
  'account_billing_portal_clicked',
  'account_billing_portal_returned',
  'account_crypto_intent_clicked',
]);

const ALLOWED_PLANS = new Set(['lite', 'pro', 'max', 'trial', 'manual']);
const ALLOWED_METADATA_KEYS = new Set([
  'score',
  'volumeBucket',
  'riskLevel',
  'savingsBucket',
  'source',
  'button',
  'state',
  'billing',
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
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
  });
}

export async function onRequestPost({ request, env }) {
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
      user_agent: String(request.headers.get('user-agent') || '').slice(0, 160) || null,
      referer: sanitizedUrl(request.headers.get('referer')),
      origin: sanitizedUrl(request.headers.get('origin')),
    },
  };

  const response = await insert(supabaseUrl, serviceKey, record);
  if (!response.ok) {
    const details = await response.text();
    return json({ error: 'supabase_insert_failed', details }, 502);
  }

  return json({ ok: true });
}
