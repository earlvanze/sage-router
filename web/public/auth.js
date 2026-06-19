const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const OAUTH_LABELS = { discord: 'Discord', github: 'GitHub', google: 'Google' };
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
async function refreshSession() { const { data } = await sb.auth.getSession(); const session = data?.session; if (session?.user) { set('session-status', `Signed in as ${session.user.email || session.user.user_metadata?.full_name || session.user.id}`); $('sign-out')?.classList.remove('hidden'); } else { set('session-status', 'Choose a sign-in method.'); $('sign-out')?.classList.add('hidden'); } }
async function oauthLogin(provider) { set('auth-status', `Opening ${provider} sign-in...`); const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/login.html` } }); if (error) set('auth-status', error.message); }
async function passwordLogin() { set('auth-status', 'Signing in...'); const email = $('email')?.value.trim(); const password = $('password')?.value; if (!email) { set('auth-status', 'Enter your email first.'); return; } if (!password) { set('auth-status', 'Enter a password, or use Send magic link.'); return; } const { error } = await sb.auth.signInWithPassword({ email, password }); set('auth-status', error ? error.message : 'Signed in.'); if (!error) refreshSession(); }
async function passwordSignup() { set('auth-status', 'Creating account...'); const email = $('email')?.value.trim(); const password = $('password')?.value; if (!email) { set('auth-status', 'Enter your email first.'); return; } if (!password) { set('auth-status', 'Enter a password for the new account.'); return; } if (password.length < 8) { set('auth-status', 'Use at least 8 characters for the password.'); return; } const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login.html` } }); if (error) { set('auth-status', error.message); return; } set('auth-status', data?.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm, then sign in.'); refreshSession(); }
async function magicLogin() { set('auth-status', 'Sending magic link...'); const email = $('email')?.value.trim(); if (!email) { set('auth-status', 'Enter your email first.'); return; } const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/login.html` } }); set('auth-status', error ? error.message : 'Magic link sent. Check your email.'); }
async function walletLogin() { try { set('wallet-status', 'Connecting wallet...'); if (window.algorand?.enable) { const result = await window.algorand.enable({ genesisID: 'mainnet-v1.0' }); const account = result?.accounts?.[0]?.address || result?.accounts?.[0]; if (!account) throw new Error('No wallet account returned.'); localStorage.setItem('sage_wallet_address', account); set('wallet-status', `Wallet connected: ${account.slice(0, 8)}…${account.slice(-6)}`); return; } throw new Error('Install or unlock an Algorand wallet extension, then try again.'); } catch (error) { set('wallet-status', error.message || 'Wallet connection failed.'); } }
document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) oauthLogin(button.dataset.oauth); }));
$('wallet-login')?.addEventListener('click', walletLogin); $('password-signup')?.addEventListener('click', passwordSignup); $('password-login')?.addEventListener('click', passwordLogin); $('magic-login')?.addEventListener('click', magicLogin); $('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refreshSession(); }); sb.auth.onAuthStateChange(() => refreshSession()); refreshSession();
applyAuthSettings();
