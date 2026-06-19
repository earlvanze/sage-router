const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
let sageRouterUrl = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
let openaiBaseUrl = `${sageRouterUrl}/v1`;
let anthropicBaseUrl = sageRouterUrl;
const DEFAULT_PLAN_ORDER = ['lite', 'pro', 'max'];
const FALLBACK_PLANS = {
  lite: { name: 'Lite', price: '$6/month', features: ['agent-native routing', 'API keys', 'usage analytics'] },
  pro: { name: 'Pro', price: '$30/month', features: ['frontier routing', 'agentic tool-use preference', 'analytics snapshots'] },
  max: { name: 'Max', price: '$72/month', features: ['highest quality routing', 'priority fallback budget', 'team/automation use'] },
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
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let selectedPlan = 'pro';
let currentRawKey = '';

function applyLaunchMetadata(data) {
  if (!data) return;
  sageRouterUrl = data.apiBaseUrl || sageRouterUrl;
  openaiBaseUrl = data.openaiBaseUrl || `${sageRouterUrl}/v1`;
  anthropicBaseUrl = data.anthropicBaseUrl || sageRouterUrl;
  set('openai-base-url', `OPENAI_BASE_URL=${openaiBaseUrl}`);
  set('anthropic-base-url', `ANTHROPIC_BASE_URL=${anthropicBaseUrl}`);
}

async function applyAuthSettings() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) return;
    const external = (await res.json()).external || {};
    document.querySelectorAll('[data-oauth]').forEach((button) => {
      const enabled = external[button.dataset.oauth] !== false;
      button.classList.toggle('hidden', !enabled);
      button.disabled = !enabled;
    });
  } catch (_error) {}
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function markStep(id, done) {
  const el = $(id);
  if (el) el.textContent = done ? 'ok' : el.dataset.step || el.textContent;
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

function renderQuickstart(key) {
  currentRawKey = key || currentRawKey;
  set('quickstart-code', quickstartText(currentRawKey || 'sk_sage_your_key_here'));
}

async function refresh() {
  const s = await session();
  show('auth-panel', !s);
  show('account-panel', !!s);
  show('sign-out', !!s);
  markStep('step-auth', !!s);
  try {
    const metadata = await fetch(`${sageRouterUrl}/pricing`).then(response => response.ok ? response.json() : null);
    applyLaunchMetadata(metadata);
  } catch (_error) {
    applyLaunchMetadata(null);
  }
  renderQuickstart();
  if (!s) return;
  set('account-status', 'Loading account...');
  try {
    const [{ customer }, keys, planData] = await Promise.all([
      api('/account'),
      api('/account/api-keys'),
      api('/account/plan').catch(() => null),
    ]);
    applyLaunchMetadata(planData);
    const accountPlan = planData?.plan || customer.plan || 'free';
    const accountStatus = planData?.status || customer.status || 'inactive';
    const routingEnabled = planData?.routing_enabled ?? ['active', 'trialing', 'manual'].includes(accountStatus);
    set('account-status', `${customer.email || customer.user_id} · ${accountPlan} · ${accountStatus}`);
    set('routing-status', routingEnabled ? 'Routing enabled for generated API keys.' : 'Upgrade required before generated API keys can route paid traffic.');
    renderPlans(planData?.plans || FALLBACK_PLANS, accountPlan);
    $('keys').innerHTML = renderKeys(keys.api_keys || []);
    markStep('step-plan', accountPlan !== 'free' && routingEnabled);
    markStep('step-key', (keys.api_keys || []).length > 0);
  } catch (error) {
    set('account-status', error.message);
    renderPlans(FALLBACK_PLANS, 'free');
  }
}

function renderPlans(plans, currentPlan) {
  const el = $('plans');
  if (!el) return;
  const order = DEFAULT_PLAN_ORDER.filter(name => plans?.[name]);
  if (!order.includes(selectedPlan)) selectedPlan = order.includes(currentPlan) ? currentPlan : 'pro';
  el.innerHTML = order.map((name) => {
    const plan = plans[name] || {};
    const features = (plan.features || []).slice(0, 3).map(feature => `<li>${esc(feature)}</li>`).join('');
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
  return `<table><thead><tr><th>Name</th><th>Prefix</th><th>Status</th><th>Plan</th><th></th></tr></thead><tbody>${keys.map(k => `<tr><td>${esc(k.name)}</td><td><span class="pill">${esc(k.prefix)}</span></td><td>${esc(k.status)}</td><td>${esc(k.plan || 'free')}</td><td><button class="btn ghost" data-revoke="${esc(k.id)}">Revoke</button></td></tr>`).join('')}</tbody></table>`;
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
  const { error } = await sb.auth.signInWithPassword({ email, password });
  set('auth-status', error ? error.message : 'Signed in.');
  if (!error) refresh();
}

async function magicLogin() {
  set('auth-status', 'Sending magic link...');
  const email = $('email')?.value.trim();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/account.html` } });
  set('auth-status', error ? error.message : 'Magic link sent. Check your email.');
}

async function createKey() {
  set('key-once', '');
  try {
    const name = $('key-name')?.value || 'Default';
    const data = await api('/account/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
    const key = data.key || '';
    renderQuickstart(key);
    const target = 'quickstart-code';
    $('key-once').innerHTML = `<p>Copy now. This key is only shown once.</p><div class="codeBox"><pre>${esc(key)}</pre><div class="copyRow"><button class="btn ghost" data-copy-target="${target}">Copy quickstart</button></div></div>`;
    refresh();
  } catch (error) {
    set('key-once', error.message);
  }
}

async function stripeCheckout() {
  try {
    set('billing-status', `Opening ${selectedPlan} checkout...`);
    const data = await api('/billing/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan: selectedPlan }) });
    if (data.checkout_url) window.location.href = data.checkout_url;
  } catch (error) {
    set('billing-status', `${error.message}. If Stripe is not configured yet, use crypto/manual settlement or try again after billing setup is complete.`);
  }
}

async function cryptoIntent() {
  try {
    set('crypto-status', 'Creating manual payment intent...');
    const data = await api('/billing/crypto/intent', { method: 'POST', body: JSON.stringify({ note: `Sage Router ${selectedPlan} subscription`, plan: selectedPlan }) });
    const i = data.intent || {};
    set('crypto-status', `${i.status}. Send ${i.amount || 'the agreed amount'} ${i.asset || ''} on ${i.network || 'the configured network'} to ${i.address}. Include intent id ${i.id} in the memo/reference. Settlement is manual until a processor is configured.`);
  } catch (error) {
    set('crypto-status', error.message);
  }
}

document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) oauthLogin(button.dataset.oauth); }));
$('password-login')?.addEventListener('click', passwordLogin);
$('magic-login')?.addEventListener('click', magicLogin);
$('create-key')?.addEventListener('click', createKey);
$('stripe-checkout')?.addEventListener('click', stripeCheckout);
$('crypto-intent')?.addEventListener('click', cryptoIntent);
$('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refresh(); });
$('plans')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-plan]');
  if (!button) return;
  selectedPlan = button.dataset.plan;
  document.querySelectorAll('.planCard').forEach(card => card.classList.toggle('active', card.dataset.plan === selectedPlan));
  set('billing-status', `Selected ${selectedPlan}.`);
});
$('keys')?.addEventListener('click', async (event) => {
  const id = event.target?.dataset?.revoke;
  if (!id) return;
  await api(`/account/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
  refresh();
});
document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-copy-target]');
  if (!button) return;
  const target = $(button.dataset.copyTarget);
  const text = target?.textContent || '';
  if (!text) return;
  await navigator.clipboard.writeText(text);
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = button.dataset.copyLabel || 'Copy'; }, 1200);
});
sb.auth.onAuthStateChange(() => refresh());
refresh();
applyAuthSettings();
