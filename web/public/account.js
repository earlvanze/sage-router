const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
const SAGE_ROUTER_URL = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const show = (id, visible) => { const el = $(id); if (el) el.classList.toggle('hidden', !visible); };
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function session() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

async function api(path, options = {}) {
  const s = await session();
  if (!s) throw new Error('Sign in first.');
  const res = await fetch(`${SAGE_ROUTER_URL}${path}`, {
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

async function refresh() {
  const s = await session();
  show('auth-panel', !s);
  show('account-panel', !!s);
  show('sign-out', !!s);
  if (!s) return;
  set('account-status', 'Loading account...');
  try {
    const [{ customer }, keys] = await Promise.all([api('/account'), api('/account/api-keys')]);
    set('account-status', `${customer.email || customer.user_id} · ${customer.plan} · ${customer.status}`);
    set('routing-status', customer.status === 'active' || customer.status === 'trialing' || customer.status === 'manual' ? 'Routing enabled' : 'Upgrade required before generated API keys can route paid traffic.');
    $('keys').innerHTML = renderKeys(keys.api_keys || []);
  } catch (error) {
    set('account-status', error.message);
  }
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
    set('key-once', `Copy now. This key is only shown once: ${data.key}`);
    refresh();
  } catch (error) {
    set('key-once', error.message);
  }
}

async function stripeCheckout() {
  try {
    set('billing-status', 'Opening checkout...');
    const data = await api('/billing/stripe/checkout', { method: 'POST', body: '{}' });
    if (data.checkout_url) window.location.href = data.checkout_url;
  } catch (error) {
    set('billing-status', error.message);
  }
}

async function cryptoIntent() {
  try {
    set('crypto-status', 'Creating manual payment intent...');
    const data = await api('/billing/crypto/intent', { method: 'POST', body: JSON.stringify({ note: 'Sage Router subscription' }) });
    const i = data.intent || {};
    set('crypto-status', `${i.status}. Send ${i.amount || 'the agreed amount'} ${i.asset || ''} on ${i.network || 'the configured network'} to ${i.address}. Include intent id ${i.id} in the memo/reference. Settlement is manual until a processor is configured.`);
  } catch (error) {
    set('crypto-status', error.message);
  }
}

document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => oauthLogin(button.dataset.oauth)));
$('password-login')?.addEventListener('click', passwordLogin);
$('magic-login')?.addEventListener('click', magicLogin);
$('create-key')?.addEventListener('click', createKey);
$('stripe-checkout')?.addEventListener('click', stripeCheckout);
$('crypto-intent')?.addEventListener('click', cryptoIntent);
$('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refresh(); });
$('keys')?.addEventListener('click', async (event) => {
  const id = event.target?.dataset?.revoke;
  if (!id) return;
  await api(`/account/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
  refresh();
});
sb.auth.onAuthStateChange(() => refresh());
refresh();
