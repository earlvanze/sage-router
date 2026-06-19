const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
let sageRouterUrl = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
let openaiBaseUrl = `${sageRouterUrl}/v1`;
let anthropicBaseUrl = sageRouterUrl;
const DEFAULT_PLAN_ORDER = ['lite', 'pro', 'max'];
const SELECTED_PLAN_STORAGE_KEY = 'sage_router_selected_plan';
const FALLBACK_PLANS = {
  lite: { name: 'Lite', price: '$6/month', limits: { monthlyRequests: 10000, rateLimitPerMinute: 60 }, features: ['agent-native routing', 'API keys', 'usage analytics'] },
  pro: { name: 'Pro', price: '$30/month', limits: { monthlyRequests: 50000, rateLimitPerMinute: 180 }, features: ['frontier routing', 'agentic tool-use preference', 'analytics snapshots'] },
  max: { name: 'Max', price: '$72/month', limits: { monthlyRequests: 200000, rateLimitPerMinute: 600 }, features: ['highest quality routing', 'priority fallback budget', 'team/automation use'] },
};

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const set = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};
const show = (id, visible) => {
  const el = $(id);
  if (el) el.classList.toggle('hidden', !visible);
};
const setElementBusy = (el, busy, label = '') => {
  if (!el) return;
  if (busy) {
    if (!el.dataset.idleText) el.dataset.idleText = el.textContent;
    el.disabled = true;
    if (label) el.textContent = label;
  } else {
    el.disabled = false;
    el.textContent = el.dataset.idleText || el.textContent;
    delete el.dataset.idleText;
  }
};
const setBusy = (id, busy, label = '') => setElementBusy($(id), busy, label);
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtNumber = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '';
const OAUTH_LABELS = { discord: 'Discord', github: 'GitHub', google: 'Google' };

function normalizePlan(plan) {
  const normalized = String(plan || '').trim().toLowerCase();
  return DEFAULT_PLAN_ORDER.includes(normalized) ? normalized : '';
}

function storedPlan() {
  try {
    return normalizePlan(window.localStorage?.getItem(SELECTED_PLAN_STORAGE_KEY));
  } catch (_error) {
    return '';
  }
}

function rememberSelectedPlan(plan) {
  const normalized = normalizePlan(plan);
  if (!normalized) return '';
  try {
    window.localStorage?.setItem(SELECTED_PLAN_STORAGE_KEY, normalized);
  } catch (_error) {
    // Storage can be unavailable in private or locked-down browser sessions.
  }
  return normalized;
}

function requestedPlanFromUrl() {
  const params = new URLSearchParams(window.location.search || '');
  return normalizePlan(params.get('plan'));
}

function planDisplay(plan) {
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Pro';
}

let selectedPlan = storedPlan() || 'pro';
let recommendedUpgradePlan = '';
let currentRawKey = '';
let billingReturnHandled = false;
let keyVerifiedThisSession = false;
let activationState = {
  signedIn: false,
  routingEnabled: false,
  keyCount: 0,
  keyVerified: false,
  requestCount: 0,
};

function applyLaunchMetadata(data) {
  if (!data) return;
  sageRouterUrl = data.apiBaseUrl || sageRouterUrl;
  openaiBaseUrl = data.openaiBaseUrl || `${sageRouterUrl}/v1`;
  anthropicBaseUrl = data.anthropicBaseUrl || sageRouterUrl;
  set('openai-base-url', `OPENAI_BASE_URL=${openaiBaseUrl}`);
  set('anthropic-base-url', `ANTHROPIC_BASE_URL=${anthropicBaseUrl}`);
  if (data.maxActiveApiKeysPerCustomer) {
    set('key-limit-note', `Limit: ${data.maxActiveApiKeysPerCustomer} active keys per account.`);
  }
}

function applyOauthButtons(external = {}, status = '') {
  const enabledLabels = [];
  document.querySelectorAll('[data-oauth]').forEach((button) => {
    const enabled = external[button.dataset.oauth] === true;
    button.classList.toggle('hidden', !enabled);
    button.disabled = !enabled;
    if (enabled) enabledLabels.push(OAUTH_LABELS[button.dataset.oauth] || button.dataset.oauth);
  });
  set('oauth-status', status || (enabledLabels.length
    ? `OAuth enabled: ${enabledLabels.join(', ')}. Email sign-in is also available.`
    : 'OAuth is temporarily unavailable. Use email magic link or password.'));
}

async function applyAuthSettings() {
  applyOauthButtons({}, 'Checking enabled OAuth providers...');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) {
      applyOauthButtons({}, 'OAuth status is unavailable. Use email magic link or password.');
      return;
    }
    const external = (await res.json()).external || {};
    applyOauthButtons(external);
  } catch (_error) {
    applyOauthButtons({}, 'OAuth status is unavailable. Use email magic link or password.');
  }
}

async function session() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

async function api(path, options = {}) {
  const s = await session();
  if (!s) throw new Error('Sign in first.');
  const res = await fetch(`${sageRouterUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.access_token}`,
      ...(options.headers || {})
    }
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = { message: raw.slice(0, 240) };
  }
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

function markStep(id, done) {
  const el = $(id);
  if (el) el.textContent = done ? 'ok' : el.dataset.step || el.textContent;
}

function activationBadge(id, done) {
  const el = $(id);
  if (el) el.textContent = done ? 'Ready' : 'Waiting';
}

function renderLaunchNextAction(patch = {}) {
  activationState = { ...activationState, ...patch };
  const keyVerified = activationState.keyVerified || activationState.requestCount > 0;
  activationBadge('launch-auth-status', activationState.signedIn);
  activationBadge('launch-plan-status', activationState.routingEnabled);
  activationBadge('launch-key-status', activationState.keyCount > 0);
  activationBadge('launch-verify-status', keyVerified);
  activationBadge('launch-first-request-status', activationState.requestCount > 0);
  markStep('step-auth', activationState.signedIn);
  markStep('step-plan', activationState.routingEnabled);
  markStep('step-key', activationState.keyCount > 0);
  markStep('step-verify', keyVerified);
  markStep('step-first-request', activationState.requestCount > 0);

  if (!activationState.signedIn) {
    set('launch-next-action', 'Next: sign in or create an account.');
  } else if (!activationState.routingEnabled) {
    set('launch-next-action', 'Next: choose a paid plan or finish checkout so generated keys can route.');
  } else if (!activationState.keyCount) {
    set('launch-next-action', 'Next: create an sk_sage key.');
  } else if (!keyVerified) {
    set('launch-next-action', 'Next: test the key against /v1/models using the verifier below.');
  } else if (!activationState.requestCount) {
    set('launch-next-action', 'Next: copy the quickstart and send the first sage-router/frontier chat completion.');
  } else {
    set('launch-next-action', `Activated: ${fmtNumber(activationState.requestCount)} routed request${activationState.requestCount === 1 ? '' : 's'} recorded this period.`);
  }
}

function quickstartText(key = 'sk_sage_your_key_here') {
  return `export OPENAI_BASE_URL="${openaiBaseUrl}"
export OPENAI_API_KEY="${key}"

curl "$OPENAI_BASE_URL/chat/completions" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "sage-router/frontier",
    "messages": [{"role": "user", "content": "Say hello from Sage Router"}]
  }'`;
}

function openaiSdkSetupText(key = 'sk_sage_your_key_here') {
  return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${openaiBaseUrl}",
  apiKey: "${key}",
});

const response = await client.chat.completions.create({
  model: "sage-router/frontier",
  messages: [{ role: "user", content: "Route this through Sage Router" }],
});`;
}

function codexSetupText(key = 'sk_sage_your_key_here') {
  return `mkdir -p ~/.codex
cat >> ~/.codex/config.toml <<'TOML'
[model_providers.sage-router-hosted]
name = "Sage Router Hosted"
base_url = "${openaiBaseUrl}/"
wire_api = "responses"
TOML

cat > ~/.codex/sage-router-hosted.config.toml <<'TOML'
model_provider = "sage-router-hosted"
model = "sage-router/frontier"
TOML

export OPENAI_API_KEY="${key}"
codex --profile sage-router-hosted`;
}

function anthropicSetupText(key = 'sk_sage_your_key_here') {
  return `export ANTHROPIC_BASE_URL="${anthropicBaseUrl}"
export ANTHROPIC_API_KEY="${key}"

curl "$ANTHROPIC_BASE_URL/v1/messages" \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "sage-router/frontier",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "Say hello from Sage Router"}]
  }'`;
}

function renderQuickstart(key) {
  currentRawKey = key || currentRawKey;
  if (currentRawKey && $('test-api-key') && !$('test-api-key').value) {
    $('test-api-key').value = currentRawKey;
  }
  const displayKey = currentRawKey || 'sk_sage_your_key_here';
  set('quickstart-code', quickstartText(displayKey));
  set('client-openai-code', openaiSdkSetupText(displayKey));
  set('client-codex-code', codexSetupText(displayKey));
  set('client-anthropic-code', anthropicSetupText(displayKey));
}

function planLabel(plans, name) {
  return plans?.[name]?.name || (name ? name.charAt(0).toUpperCase() + name.slice(1) : 'plan');
}

function nextPaidPlan(currentPlan, plans = FALLBACK_PLANS) {
  const available = DEFAULT_PLAN_ORDER.filter(name => plans?.[name]);
  if (!available.length) return '';
  const index = available.indexOf(currentPlan);
  if (index < 0) return available[0];
  return available[Math.min(index + 1, available.length - 1)] || '';
}

function selectPlan(plan, status = '') {
  const normalized = normalizePlan(plan);
  if (!normalized) return;
  selectedPlan = rememberSelectedPlan(normalized);
  document.querySelectorAll('.planCard').forEach(card => card.classList.toggle('active', card.dataset.plan === selectedPlan));
  if (status) set('billing-status', status);
}

function applyRequestedPlanFromUrl() {
  const requested = requestedPlanFromUrl();
  if (!requested) return '';
  selectedPlan = rememberSelectedPlan(requested);
  set('billing-status', `${planDisplay(selectedPlan)} selected. Sign in or continue to checkout when ready.`);
  return selectedPlan;
}

function renderUpgradeRecommendation(usage, plans = FALLBACK_PLANS, currentPlan = 'free', routingEnabled = false) {
  const button = $('usage-upgrade');
  const current = currentPlan || usage?.plan || 'free';
  const nextPlan = nextPaidPlan(current, plans);
  recommendedUpgradePlan = '';
  if (button) button.classList.add('hidden');
  set('usage-recommendation', '');

  if (!routingEnabled) {
    recommendedUpgradePlan = nextPlan || 'lite';
    set('usage-recommendation', `Upgrade to ${planLabel(plans, recommendedUpgradePlan)} to enable generated-key routing.`);
  } else if (usage && !usage.unlimited) {
    const used = Number(usage.requests || 0);
    const quota = Number(usage.quota || 0);
    const percent = quota > 0 ? (used / quota) * 100 : 0;
    if (percent >= 90 && nextPlan && nextPlan !== current) {
      recommendedUpgradePlan = nextPlan;
      set('usage-recommendation', `Usage is above 90% of this period. Select ${planLabel(plans, nextPlan)} before quota blocks agent traffic.`);
    } else if (percent >= 75 && nextPlan && nextPlan !== current) {
      recommendedUpgradePlan = nextPlan;
      set('usage-recommendation', `Usage is above 75% of this period. ${planLabel(plans, nextPlan)} gives more request headroom.`);
    } else if (percent >= 90 && current === 'max') {
      set('usage-recommendation', 'Usage is above 90% of Max. Use billing management or manual support before adding more production traffic.');
    }
  }

  if (button && recommendedUpgradePlan) {
    button.textContent = `Select ${planLabel(plans, recommendedUpgradePlan)}`;
    button.classList.remove('hidden');
  }
}

function renderUsage(usage, plans = FALLBACK_PLANS, currentPlan = '', routingEnabled = true) {
  const fill = $('usage-fill');
  if (!usage) {
    set('usage-status', 'Usage is unavailable.');
    set('usage-used', '--');
    set('usage-remaining', '--');
    set('usage-rate', '--');
    if (fill) fill.style.width = '0%';
    recommendedUpgradePlan = '';
    $('usage-upgrade')?.classList.add('hidden');
    set('usage-recommendation', '');
    return;
  }
  const used = Number(usage.requests || 0);
  const quota = Number(usage.quota || 0);
  const remaining = usage.unlimited ? null : Number(usage.remaining || 0);
  const percent = quota > 0 ? Math.min(100, Math.max(0, (used / quota) * 100)) : 0;
  set('usage-status', usage.unlimited
    ? `${usage.period || 'Current period'} · ${usage.plan || 'free'} has no monthly cap configured.`
    : `${usage.period || 'Current period'} · ${fmtNumber(quota)} requests included.`);
  set('usage-used', fmtNumber(used));
  set('usage-remaining', usage.unlimited ? 'Unlimited' : fmtNumber(remaining));
  set('usage-rate', usage.rateLimitPerMinute ? `${fmtNumber(usage.rateLimitPerMinute)}/min` : '--');
  if (fill) fill.style.width = `${percent}%`;
  renderUpgradeRecommendation(usage, plans, currentPlan, routingEnabled);
}

async function refresh() {
  const s = await session();
  show('auth-panel', !s);
  show('account-panel', !!s);
  show('sign-out', !!s);
  renderLaunchNextAction({ signedIn: !!s, routingEnabled: false, keyCount: 0, keyVerified: keyVerifiedThisSession, requestCount: 0 });
  try {
    const metadata = await fetch(`${sageRouterUrl}/pricing`).then(response => response.ok ? response.json() : null);
    applyLaunchMetadata(metadata);
  } catch (_error) {
    applyLaunchMetadata(null);
  }
  renderQuickstart();
  if (!s) return;
  set('account-status', 'Loading account...');
  renderUsage(null);
  try {
    const [{ customer }, keys, planData, usageData] = await Promise.all([
      api('/account'),
      api('/account/api-keys'),
      api('/account/plan').catch(() => null),
      api('/account/usage').catch(() => null),
    ]);
    applyLaunchMetadata(planData);
    renderQuickstart();
    const accountPlan = planData?.plan || customer.plan || 'free';
    const accountStatus = planData?.status || customer.status || 'inactive';
    const routingEnabled = planData?.routing_enabled ?? ['active', 'trialing', 'manual'].includes(accountStatus);
    set('account-status', `${customer.email || customer.user_id} · ${accountPlan} · ${accountStatus}`);
    set('routing-status', routingEnabled ? 'Routing enabled for generated API keys.' : 'Upgrade required before generated API keys can route paid traffic.');
    const plans = planData?.plans || FALLBACK_PLANS;
    renderPlans(plans, accountPlan);
    const usage = usageData?.usage || null;
    const keyCount = (keys.api_keys || []).length;
    const requestCount = Number(usage?.requests || 0);
    const keyVerified = keyVerifiedThisSession || requestCount > 0;
    renderUsage(usage, plans, accountPlan, routingEnabled);
    $('keys').innerHTML = renderKeys(keys.api_keys || []);
    renderLaunchNextAction({
      signedIn: true,
      routingEnabled: accountPlan !== 'free' && routingEnabled,
      keyCount,
      keyVerified,
      requestCount,
    });
  } catch (error) {
    set('account-status', error.message);
    renderPlans(FALLBACK_PLANS, 'free');
    renderUsage(null, FALLBACK_PLANS, 'free', false);
    renderLaunchNextAction({ signedIn: true, routingEnabled: false, keyCount: 0, keyVerified: keyVerifiedThisSession, requestCount: 0 });
  }
}

function handleBillingReturn() {
  if (billingReturnHandled) return;
  billingReturnHandled = true;
  const params = new URLSearchParams(window.location.search || '');
  const state = params.get('checkout');
  const billing = params.get('billing');
  const requested = normalizePlan(params.get('plan'));
  if (requested) selectedPlan = rememberSelectedPlan(requested);
  if (!state && !billing) return;
  if (state) {
    if (state === 'success') {
      set('billing-status', `Stripe checkout returned for ${planDisplay(selectedPlan)}. Activation can take a moment while the webhook confirms the subscription.`);
      setTimeout(() => refresh(), 3000);
      setTimeout(() => refresh(), 10000);
    } else if (state === 'cancel') {
      set('billing-status', `Checkout cancelled. ${planDisplay(selectedPlan)} is still selected.`);
    }
  } else if (billing === 'portal') {
    set('billing-status', 'Returned from Stripe billing management.');
    setTimeout(() => refresh(), 1500);
  }
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function renderPlans(plans, currentPlan) {
  const el = $('plans');
  if (!el) return;
  const order = DEFAULT_PLAN_ORDER.filter(name => plans?.[name]);
  if (!order.includes(selectedPlan)) {
    selectedPlan = rememberSelectedPlan(order.includes(currentPlan) ? currentPlan : 'pro');
  }
  el.innerHTML = order.map((name) => {
    const plan = plans[name] || {};
    const limits = plan.limits || {};
    const limitItems = [
      limits.monthlyRequests ? `${fmtNumber(limits.monthlyRequests)} requests/month` : '',
      limits.rateLimitPerMinute ? `${fmtNumber(limits.rateLimitPerMinute)} requests/minute` : '',
    ].filter(Boolean);
    const featureItems = [...limitItems, ...(plan.features || [])].slice(0, 4);
    const features = featureItems.map(feature => `<li>${esc(feature)}</li>`).join('');
    const configured = plan.stripeConfigured === undefined || plan.stripeConfigured;
    const badge = currentPlan === name ? 'Current' : (configured ? 'Ready' : 'Manual');
    return `<button class="planCard ${selectedPlan === name ? 'active' : ''}" data-plan="${esc(name)}" type="button">
      <div class="planName"><span>${esc(plan.name || name)}</span><span class="pill">${esc(badge)}</span></div>
      <div class="price">${esc(plan.price || '')}</div>
      <ul class="features">${features}</ul>
    </button>`;
  }).join('');
}

function renderKeys(keys) {
  if (!keys.length) return '<p class="muted">No API keys yet.</p>';
  return `<table><thead><tr><th>Name</th><th>Prefix</th><th>Status</th><th>Plan</th><th>Routing</th><th></th></tr></thead><tbody>${keys.map(k => {
    const routing = k.routing_enabled ? 'Ready' : 'Blocked';
    return `<tr><td>${esc(k.name)}</td><td><span class="pill">${esc(k.prefix)}</span></td><td>${esc(k.status)}</td><td>${esc(k.plan || 'free')}</td><td>${esc(routing)}</td><td><button class="btn ghost" data-revoke="${esc(k.id)}">Revoke</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

async function oauthLogin(provider) {
  set('auth-status', `Opening ${provider} sign-in...`);
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/account.html` } });
  if (error) set('auth-status', error.message);
}

async function passwordLogin() {
  set('auth-status', 'Signing in...');
  const email = $('email')?.value.trim();
  const password = $('password')?.value;
  if (!email) {
    set('auth-status', 'Enter your email first.');
    return;
  }
  if (!password) {
    set('auth-status', 'Enter a password, or use Send magic link.');
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  set('auth-status', error ? error.message : 'Signed in.');
  if (!error) refresh();
}

async function passwordSignup() {
  set('auth-status', 'Creating account...');
  const email = $('email')?.value.trim();
  const password = $('password')?.value;
  if (!email) {
    set('auth-status', 'Enter your email first.');
    return;
  }
  if (!password) {
    set('auth-status', 'Enter a password for the new account.');
    return;
  }
  if (password.length < 8) {
    set('auth-status', 'Use at least 8 characters for the password.');
    return;
  }
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/account.html` },
  });
  if (error) {
    set('auth-status', error.message);
    return;
  }
  set('auth-status', data?.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm, then sign in.');
  refresh();
}

async function magicLogin() {
  set('auth-status', 'Sending magic link...');
  const email = $('email')?.value.trim();
  if (!email) {
    set('auth-status', 'Enter your email first.');
    return;
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/account.html` } });
  set('auth-status', error ? error.message : 'Magic link sent. Check your email.');
}

async function createKey() {
  set('key-once', '');
  set('test-api-key-status', '');
  setBusy('create-key', true, 'Creating...');
  try {
    const name = $('key-name')?.value || 'Default';
    const data = await api('/account/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
    const key = data.key || '';
    renderQuickstart(key);
    $('key-once').innerHTML = `<p>Copy now. This key is only shown once.</p><div class="codeBox"><pre id="raw-api-key-once">${esc(key)}</pre><div class="copyRow"><button class="btn ghost" data-copy-target="raw-api-key-once" data-copy-label="Copy key">Copy key</button><button class="btn ghost" data-copy-target="quickstart-code" data-copy-label="Copy quickstart">Copy quickstart</button></div></div>`;
    refresh();
  } catch (error) {
    set('key-once', error.message);
  } finally {
    setBusy('create-key', false);
  }
}

function explainModelProbeFailure(status, data = {}) {
  const detail = data.error || data.message || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return `${detail}. Check that this is an active sk_sage key and has not been revoked.`;
  }
  if (status === 402) {
    return `${detail}. Choose a plan or finish checkout before routing generated keys.`;
  }
  if (status === 429) {
    return `${detail}. The key is valid, but the current rate limit or quota was reached.`;
  }
  if (status >= 500) {
    return `${detail}. The public edge or selected backend is degraded; check /status before retrying.`;
  }
  return detail;
}

async function testApiKey() {
  const key = $('test-api-key')?.value.trim() || currentRawKey;
  if (!key) {
    set('test-api-key-status', 'Create a key or paste an sk_sage key first.');
    return;
  }
  set('test-api-key-status', 'Checking /v1/models through the public edge...');
  setBusy('test-api-key-button', true, 'Testing...');
  try {
    const res = await fetch(`${openaiBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      set('test-api-key-status', explainModelProbeFailure(res.status, data));
      return;
    }
    const models = Array.isArray(data.data) ? data.data : [];
    const suffix = models.length ? ` ${fmtNumber(models.length)} models visible.` : ' The key reached the model API.';
    keyVerifiedThisSession = true;
    set('test-api-key-status', `Success: /v1/models returned HTTP ${res.status}.${suffix}`);
    renderLaunchNextAction({ keyVerified: true });
  } catch (_error) {
    set('test-api-key-status', 'Could not reach the public edge from this browser. Check network access, CORS, or https://app.sagerouter.dev/status.');
  } finally {
    setBusy('test-api-key-button', false);
  }
}

async function stripeCheckout() {
  let redirecting = false;
  setBusy('stripe-checkout', true, 'Opening...');
  try {
    set('billing-status', `Opening ${selectedPlan} checkout...`);
    const data = await api('/billing/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan: selectedPlan }) });
    if (data.checkout_url) {
      redirecting = true;
      window.location.href = data.checkout_url;
    }
  } catch (error) {
    set('billing-status', `${error.message}. If Stripe is not configured yet, use crypto/manual settlement or try again after billing setup is complete.`);
  } finally {
    if (!redirecting) setBusy('stripe-checkout', false);
  }
}

async function billingPortal() {
  let redirecting = false;
  setBusy('stripe-portal', true, 'Opening...');
  try {
    set('billing-status', 'Opening Stripe billing management...');
    const data = await api('/billing/stripe/portal', { method: 'POST', body: '{}' });
    if (data.portal_url) {
      redirecting = true;
      window.location.href = data.portal_url;
    }
  } catch (error) {
    set('billing-status', `${error.message}. Complete Stripe checkout before opening billing management.`);
  } finally {
    if (!redirecting) setBusy('stripe-portal', false);
  }
}

async function cryptoIntent() {
  setBusy('crypto-intent', true, 'Creating...');
  try {
    set('crypto-status', 'Creating manual payment intent...');
    const data = await api('/billing/crypto/intent', { method: 'POST', body: JSON.stringify({ note: `Sage Router ${selectedPlan} subscription`, plan: selectedPlan }) });
    const i = data.intent || {};
    set('crypto-status', `${i.status}. Send ${i.amount || 'the agreed amount'} ${i.asset || ''} on ${i.network || 'the configured network'} to ${i.address}. Include intent id ${i.id} in the memo/reference. Settlement is manual until a processor is configured.`);
  } catch (error) {
    set('crypto-status', error.message);
  } finally {
    setBusy('crypto-intent', false);
  }
}

document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) oauthLogin(button.dataset.oauth); }));
$('password-signup')?.addEventListener('click', passwordSignup);
$('password-login')?.addEventListener('click', passwordLogin);
$('magic-login')?.addEventListener('click', magicLogin);
$('create-key')?.addEventListener('click', createKey);
$('test-api-key-button')?.addEventListener('click', testApiKey);
$('stripe-checkout')?.addEventListener('click', stripeCheckout);
$('stripe-portal')?.addEventListener('click', billingPortal);
$('crypto-intent')?.addEventListener('click', cryptoIntent);
$('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refresh(); });
$('plans')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-plan]');
  if (!button) return;
  const plan = normalizePlan(button.dataset.plan);
  selectPlan(plan, `Selected ${planDisplay(plan)}.`);
});
$('usage-upgrade')?.addEventListener('click', () => {
  if (!recommendedUpgradePlan) return;
  selectPlan(recommendedUpgradePlan, `Selected ${recommendedUpgradePlan}. Continue to Stripe when ready.`);
  $('stripe-checkout')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('keys')?.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-revoke]');
  const id = button?.dataset?.revoke;
  if (!id) return;
  setElementBusy(button, true, 'Revoking...');
  try {
    await api(`/account/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
    refresh();
  } catch (error) {
    set('account-status', error.message);
    setElementBusy(button, false);
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-copy-target]');
  if (!button) return;
  const target = $(button.dataset.copyTarget);
  const text = target?.textContent || '';
  if (!text) return;
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch (_error) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = 'Selected';
  }
  setTimeout(() => { button.textContent = button.dataset.copyLabel || original || 'Copy'; }, 1200);
});
sb.auth.onAuthStateChange(() => refresh());
applyRequestedPlanFromUrl();
refresh();
handleBillingReturn();
applyAuthSettings();
