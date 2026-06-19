const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
let sageRouterUrl = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setNote(text) { const el = $('dashboard-note'); if (!el) return; el.textContent = text || ''; el.classList.toggle('hidden', !text); }
function show(id, visible) { const el = $(id); if (el) el.classList.toggle('hidden', !visible); }
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtMs(v) { return v == null ? '—' : `${Math.round(v).toLocaleString()} ms`; }
function fmtPct(v) { return v == null ? '—' : `${Math.round(v * 1000) / 10}%`; }

function table(rows, cols, empty='No data yet') {
  if (!rows?.length) return `<p class="muted">${empty}</p>`;
  return `<table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

async function session() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

async function applyLaunchMetadata() {
  try {
    const res = await fetch(`${sageRouterUrl}/pricing`);
    if (!res.ok) return;
    const data = await res.json();
    sageRouterUrl = data.apiBaseUrl || sageRouterUrl;
  } catch (_error) {}
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

async function fetchAnalytics(s) {
  const days = $('window-days')?.value || '7';
  const res = await fetch(`${sageRouterUrl}/analytics?days=${encodeURIComponent(days)}`, {
    headers: { Authorization: `Bearer ${s.access_token}` }
  });
  if (!res.ok) throw new Error(`Analytics API HTTP ${res.status}`);
  return res.json();
}

async function fetchSnapshotFallback() {
  const { data, error } = await sb.from('sage_router_analytics_snapshots').select('snapshot').order('generated_at_epoch', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.snapshot || null;
}

function render(snapshot) {
  const providers = snapshot.providers || [];
  const models = snapshot.models || [];
  const recs = snapshot.recommendations || {};
  setText('kpi-events', (snapshot.eventsAnalyzed ?? 0).toLocaleString());
  setText('kpi-providers', providers.length.toLocaleString());
  setText('kpi-models', models.length.toLocaleString());
  setText('kpi-source', snapshot.source || '—');
  setText('dashboard-status', `Generated ${new Date((snapshot.generatedAt || 0) * 1000).toLocaleString()} · prompts stored: ${snapshot.privacy?.promptsStored ? 'yes' : 'no'}`);
  const modelCols = [
    { label:'Model', render:r => `<span class="pill">${esc(r.id)}</span>` },
    { label:'Success', render:r => `<span class="${(r.successRate ?? 0) >= .95 ? 'good' : 'bad'}">${fmtPct(r.successRate)}</span>` },
    { label:'P50', render:r => fmtMs(r.p50Ms) },
    { label:'P95', render:r => fmtMs(r.p95Ms) },
    { label:'Requests', render:r => esc(r.requests ?? 0) }
  ];
  $('fastest-table').innerHTML = table(recs.fastestModels || [], modelCols);
  $('reliable-table').innerHTML = table(recs.mostReliableModels || [], modelCols);
  $('degraded-table').innerHTML = table(recs.degradedModels || [], [
    ...modelCols.slice(0,2),
    { label:'Attempt fail', render:r => fmtPct(r.attemptFailureRate) },
    { label:'Attempts', render:r => esc(r.attempts ?? 0) }
  ], 'No degraded models detected.');
  $('providers-table').innerHTML = table(providers, [
    { label:'Provider', render:r => `<span class="pill">${esc(r.id)}</span>` },
    { label:'Success', render:r => fmtPct(r.successRate) },
    { label:'P50', render:r => fmtMs(r.p50Ms) },
    { label:'Requests', render:r => esc(r.requests ?? 0) }
  ]);
}

async function refresh() {
  const s = await session();
  if (!s) { show('auth-panel', true); show('dashboard', false); show('sign-out', false); return; }
  show('auth-panel', false); show('dashboard', true); show('sign-out', true);
  setText('dashboard-status', 'Loading analytics...');
  setNote('');
  try {
    render(await fetchAnalytics(s));
    setNote('Live backend analytics loaded.');
  } catch (e) {
    const fallback = await fetchSnapshotFallback();
    if (fallback) {
      render({ ...fallback, source: fallback.source || 'supabase-snapshot' });
      setNote('Showing the latest mirrored snapshot while live backend analytics is unavailable.');
    } else {
      setText('dashboard-status', 'Analytics temporarily unavailable.');
      setNote('No mirrored snapshot is available yet.');
    }
  }
}


async function oauthLogin(provider) {
  setText('auth-status', `Opening ${provider} sign-in...`);
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.href }
  });
  if (error) setText('auth-status', error.message);
}

async function walletLogin() {
  const status = $('wallet-status') || $('auth-status');
  if (!status) return;
  try {
    status.textContent = 'Connecting wallet...';
    if (window.algorand?.enable) {
      const result = await window.algorand.enable({ genesisID: 'mainnet-v1.0' });
      const account = result?.accounts?.[0]?.address || result?.accounts?.[0];
      if (!account) throw new Error('No wallet account returned.');
      localStorage.setItem('sage_wallet_address', account);
      status.textContent = `Wallet connected: ${account.slice(0, 8)}…${account.slice(-6)}`;
      return;
    }
    throw new Error('Install or unlock an Algorand wallet extension, then try again.');
  } catch (error) {
    status.textContent = error.message || 'Wallet connection failed.';
  }
}

async function passwordLogin() {
  setText('auth-status', 'Signing in...');
  const email = $('email').value.trim();
  const password = $('password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  setText('auth-status', error ? error.message : 'Signed in.');
  if (!error) refresh();
}

async function magicLogin() {
  setText('auth-status', 'Sending magic link...');
  const email = $('email').value.trim();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
  setText('auth-status', error ? error.message : 'Magic link sent. Check your email.');
}

document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) oauthLogin(button.dataset.oauth); }));
$('wallet-login')?.addEventListener('click', walletLogin);
$('password-login')?.addEventListener('click', passwordLogin);
$('magic-login')?.addEventListener('click', magicLogin);
$('refresh')?.addEventListener('click', refresh);
$('window-days')?.addEventListener('change', refresh);
$('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refresh(); });
sb.auth.onAuthStateChange(() => refresh());
applyAuthSettings();
applyLaunchMetadata().finally(() => refresh());
