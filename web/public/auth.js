const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const OAUTH_LABELS = { discord: 'Discord', github: 'GitHub', google: 'Google' };
const OAUTH_PROVIDER_ORDER = ['github', 'google', 'discord'];
const ONBOARDING_CONTEXT_STORAGE_KEY = 'sage_router_onboarding_context';
const KEY_RECOVERY_HANDOFF_STORAGE_KEY = 'sage_router_key_recovery_handoff';
const ACCOUNT_ACTIVATION_PATH = '/account.html?plan=pro&start=create_key&utm_source=login&utm_medium=activation&utm_campaign=sage-router-launch';
const ACTIVATION_PARAM_NAMES = ['plan', 'start', 'auth', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const KEY_RECOVERY_ACCOUNT_HANDOFF_DELAY_MS = 1000;
let keyRecoverySessionRedirecting = false;
let keyRecoveryAccountHandoffScheduled = false;
let keyRecoveryUserInteracted = false;

function setKeyRecoveryHandoffStatus(text) {
  set('login-key-recovery-handoff-status', text);
}

function markKeyRecoveryUserInteraction() {
  if (!isKeyRecoveryLanding()) return;
  keyRecoveryUserInteracted = true;
  setKeyRecoveryHandoffStatus('Automatic account setup paused while you use same-email recovery.');
}

function loginRecoverySetupBundleText() {
  return `# Sage Router setup-key recovery
# 1. Use the same email or same GitHub identity, then create the generated key:
# ${accountActivationUrl()}

export OPENAI_BASE_URL=https://api.sagerouter.dev/v1
export OPENAI_API_KEY=sk_sage_your_key_here
export OPENAI_MODEL=sage-router/frontier

# 2. Verify the generated key before wiring an agent:
curl -i "$OPENAI_BASE_URL/models" \\
  -H "Authorization: Bearer $OPENAI_API_KEY"`;
}

function accountActivationUrl() {
  const url = new URL(ACCOUNT_ACTIVATION_PATH, window.location.origin);
  const params = new URLSearchParams(window.location.search || '');
  for (const name of ACTIVATION_PARAM_NAMES) {
    const value = params.get(name);
    if (value) url.searchParams.set(name, value);
  }
  if (!['checkout', 'create_key'].includes(url.searchParams.get('start'))) {
    url.searchParams.set('start', 'create_key');
  }
  if (isKeyRecoveryLanding()) {
    if (!url.searchParams.get('setup')) url.searchParams.set('setup', 'login-key-recovery');
    if (!url.searchParams.get('source_surface')) url.searchParams.set('source_surface', 'recovery');
    if (!url.searchParams.get('next')) url.searchParams.set('next', 'generated-key');
  }
  return url.toString();
}

function openAccountActivation(target = accountActivationUrl()) {
  window.location.assign(target);
}

function scheduleKeyRecoveryAccountHandoff() {
  if (!isKeyRecoveryLanding() || keyRecoveryAccountHandoffScheduled || keyRecoverySessionRedirecting) return;
  keyRecoveryAccountHandoffScheduled = true;
  const target = accountActivationUrl();
  rememberKeyRecoveryAccountHandoff(target, {
    button: 'auto_account_setup_handoff',
    state: keyRecoveryLandingState(),
  });
  trackLoginFunnelEvent('login_key_recovery_account_setup_scheduled', {
    button: 'auto_account_setup_handoff',
    target,
    state: keyRecoveryLandingState(),
  });
  set('auth-status', 'Enter the same email used at signup. If you do not start recovery here, account setup will open as a fallback.');
  let remainingSeconds = Math.ceil(KEY_RECOVERY_ACCOUNT_HANDOFF_DELAY_MS / 1000);
  setKeyRecoveryHandoffStatus(`Account setup opens automatically in ${remainingSeconds}s unless you start same-email recovery.`);
  const countdown = window.setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds > 0 && !keyRecoveryUserInteracted && !keyRecoverySessionRedirecting) {
      setKeyRecoveryHandoffStatus(`Account setup opens automatically in ${remainingSeconds}s unless you start same-email recovery.`);
    }
  }, 1000);
  window.setTimeout(async () => {
    window.clearInterval(countdown);
    if (keyRecoveryUserInteracted || keyRecoverySessionRedirecting) {
      setKeyRecoveryHandoffStatus('Automatic account setup paused while you use same-email recovery.');
      trackLoginFunnelEvent('login_key_recovery_account_setup_paused', {
        button: 'auto_account_setup_handoff',
        target,
        state: keyRecoveryLandingState(),
      });
      return;
    }
    setKeyRecoveryHandoffStatus('Opening API key setup now...');
    await trackLoginFunnelEventBeforeNavigation('login_key_recovery_account_setup_auto_redirected', {
      button: 'auto_account_setup_handoff',
      target,
      state: keyRecoveryLandingState(),
    });
    openAccountActivation();
  }, KEY_RECOVERY_ACCOUNT_HANDOFF_DELAY_MS);
}

function keyRecoveryLinkTarget() {
  return $('login-key-recovery')?.getAttribute('href') || ACCOUNT_ACTIVATION_PATH;
}

function applyKeyRecoveryLinkTarget() {
  const link = $('login-key-recovery');
  if (!link) return;
  link.setAttribute('href', accountActivationUrl());
}

function isKeyRecoveryLanding() {
  const params = new URLSearchParams(window.location.search || '');
  return params.get('start') === 'create_key'
    || params.get('utm_campaign') === 'signup_to_key_recovery';
}

function keyRecoveryLandingState() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('utm_campaign') === 'signup_to_key_recovery') return 'password_fallback';
  if (params.get('start') === 'create_key') return 'login_create_key';
  return 'login_recovery_cta';
}

function attributionValue(value) {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .slice(0, 80);
  return sanitized || null;
}

function currentReferrerHost() {
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    return referrer && referrer.host !== window.location.host ? attributionValue(referrer.host) : null;
  } catch (_error) {
    return null;
  }
}

function onboardingContext(extra = {}) {
  const params = new URLSearchParams(window.location.search || '');
  return {
    sage_router_onboarding: true,
    signup_source: 'login',
    auth_method: extra.authMethod || null,
    utm_source: attributionValue(params.get('utm_source') || params.get('utmSource')),
    utm_medium: attributionValue(params.get('utm_medium') || params.get('utmMedium')),
    utm_campaign: attributionValue(params.get('utm_campaign') || params.get('utmCampaign')),
    referrer_host: currentReferrerHost(),
    landing_path: window.location.pathname,
  };
}

function rememberOnboardingContext(context) {
  try {
    window.localStorage?.setItem(ONBOARDING_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch (_error) {
    // Onboarding can continue without local persistence.
  }
  return context;
}

function rememberKeyRecoveryAccountHandoff(target, data = {}) {
  try {
    window.localStorage?.setItem(KEY_RECOVERY_HANDOFF_STORAGE_KEY, JSON.stringify({
      createdAt: Date.now(),
      source: 'login-key-recovery',
      target,
      state: data.state || keyRecoveryLandingState(),
      button: data.button || 'account_setup_handoff',
    }));
  } catch (_error) {
    // The account URL still carries recovery attribution when storage is unavailable.
  }
}

function loginFunnelEventPayload(event, data = {}) {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = null;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    referrerHost = referrer && referrer.host !== window.location.host ? referrer.host : null;
  } catch (_error) {
    referrerHost = null;
  }
  const payload = JSON.stringify({
    event,
    plan: null,
    sourcePage: window.location.href,
    target: data.target || null,
    metadata: {
      source: 'login',
      button: data.button || null,
      state: data.state || null,
      enabledProviders: data.enabledProviders || null,
      disabledProviders: data.disabledProviders || null,
      githubEnabled: data.githubEnabled ?? null,
      oauthProviderCount: data.oauthProviderCount ?? null,
      utmSource: params.get('utm_source') || params.get('utmSource') || null,
      utmMedium: params.get('utm_medium') || params.get('utmMedium') || null,
      utmCampaign: params.get('utm_campaign') || params.get('utmCampaign') || null,
      referrerHost,
      landingPath: window.location.pathname,
    },
  });
}
function trackLoginFunnelEvent(event, data = {}) {
  const payload = loginFunnelEventPayload(event, data);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/funnel-event', blob)) return;
    }
  } catch (_error) {
    // Funnel telemetry must never block sign-in.
  }
  fetch('/api/funnel-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}
async function trackLoginFunnelEventBeforeNavigation(event, data = {}, timeoutMs = 650) {
  const payload = loginFunnelEventPayload(event, data);
  try {
    const send = fetch('/api/funnel-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'omit',
    });
    const timeout = new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
    await Promise.race([send.catch(() => undefined), timeout]);
  } catch (_error) {
    // Funnel telemetry must never block sign-in.
    try {
      navigator.sendBeacon?.('/api/funnel-event', new Blob([payload], { type: 'application/json' }));
    } catch (_ignored) {}
  }
}
function trackLoginKeyRecoveryAuthEvent(event, data = {}) {
  if (!isKeyRecoveryLanding()) return;
  trackLoginFunnelEvent(event, {
    target: accountActivationUrl(),
    state: keyRecoveryLandingState(),
    ...data,
  });
}
async function writeLoginClipboardText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy failed');
}
function summarizeOauthProviderState(external = {}) {
  const enabledProviders = OAUTH_PROVIDER_ORDER.filter((provider) => external[provider] === true);
  const disabledProviders = OAUTH_PROVIDER_ORDER.filter((provider) => external[provider] !== true);
  return {
    enabledProviders: enabledProviders.join(',') || 'none',
    disabledProviders: disabledProviders.join(',') || 'none',
    githubEnabled: external.github === true,
    oauthProviderCount: enabledProviders.length,
  };
}
function trackAuthProviderState(external = {}, state = 'loaded') {
  trackLoginFunnelEvent('auth_provider_state_checked', {
    target: '/auth/v1/settings',
    state,
    ...summarizeOauthProviderState(external),
  });
}
function oauthStatusText(external = {}, enabledLabels = [], status = '') {
  if (status) return status;
  if (isKeyRecoveryLanding()) {
    return enabledLabels.length
      ? 'Use same-email magic link or password first. Use OAuth only if it is the same account used at signup.'
      : 'Use same-email magic link or password to recover the setup-key flow.';
  }
  if (enabledLabels.length) {
    return `OAuth enabled: ${enabledLabels.join(', ')}. Email sign-in is also available.`;
  }
  if (external.github === false) {
    return 'GitHub sign-in is pending owner setup. Use email magic link or password.';
  }
  return 'OAuth is temporarily unavailable. Use email magic link or password.';
}
function applyOauthButtons(external = {}, status = '') {
  const enabledLabels = [];
  document.querySelectorAll('[data-oauth]').forEach((button) => {
    const enabled = external[button.dataset.oauth] === true;
    button.classList.toggle('hidden', !enabled);
    button.disabled = !enabled;
    if (enabled) enabledLabels.push(OAUTH_LABELS[button.dataset.oauth] || button.dataset.oauth);
  });
  set('oauth-status', oauthStatusText(external, enabledLabels, status));
}
async function applyAuthSettings() {
  applyOauthButtons({}, 'Checking enabled OAuth providers...');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) {
      applyOauthButtons({}, 'OAuth status is unavailable. Use email magic link or password.');
      trackAuthProviderState({}, 'unavailable');
      return;
    }
    const external = (await res.json()).external || {};
    applyOauthButtons(external);
    trackAuthProviderState(external, 'loaded');
  } catch (_error) {
    applyOauthButtons({}, 'OAuth status is unavailable. Use email magic link or password.');
    trackAuthProviderState({}, 'unavailable');
  }
}
function applyKeyRecoveryLandingMode() {
  if (!isKeyRecoveryLanding()) return;
  activateSameEmailKeyRecovery(keyRecoveryLandingState());
}
function activateSameEmailKeyRecovery(state = keyRecoveryLandingState(), options = {}) {
  const email = $('email');
  const recoveryEmail = $('login-key-recovery-email');
  const passwordSignup = $('password-signup');
  const passwordLogin = $('password-login');
  const magic = $('magic-login');
  if (email) {
    email.placeholder = 'same email used at signup';
    email.setAttribute('aria-label', 'Same email used at signup');
  }
  if (recoveryEmail) {
    recoveryEmail.placeholder = 'same email used at signup';
    recoveryEmail.setAttribute('aria-label', 'Same email used at signup');
  }
  if (passwordSignup) passwordSignup.classList.add('hidden');
  if (passwordLogin) passwordLogin.textContent = 'Sign in with password instead';
  if (magic) {
    magic.textContent = 'Send same-email setup link';
    magic.classList.remove('ghost');
  }
  set('session-status', 'Recover setup-key activation with the same email used at signup.');
  set('login-key-recovery-copy', 'Use the same email you used at signup. The magic link opens generated-key setup first; GitHub/OAuth should only be used if it is the same account.');
  trackLoginFunnelEvent('login_key_recovery_same_account_prompted', {
    button: 'same_email_magic_link',
    target: accountActivationUrl(),
    state,
  });
  if (options.focus !== false) {
    const target = recoveryEmail || email;
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => target?.focus?.(), 100);
  }
}
async function sendSameEmailSetupLink(email, { button = 'magic_login', statusId = 'auth-status', state = 'email' } = {}) {
  keyRecoveryUserInteracted = true;
  const target = accountActivationUrl();
  trackLoginFunnelEvent('account_magic_link_requested', {
    button,
    target: '/auth/v1/otp',
    state,
  });
  trackLoginKeyRecoveryAuthEvent('login_key_recovery_magic_link_requested', {
    button,
    target: '/auth/v1/otp',
    state,
  });
  const metadata = onboardingContext({ authMethod: 'magic_link' });
  rememberOnboardingContext(metadata);
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: target,
      data: metadata,
    },
  });
  if (!error) {
    trackLoginFunnelEvent('account_magic_link_sent', {
      button,
      target,
      state: 'email_key_setup',
    });
    trackLoginKeyRecoveryAuthEvent('login_key_recovery_magic_link_sent', {
      button,
      target,
      state,
    });
  } else {
    trackLoginKeyRecoveryAuthEvent('login_key_recovery_magic_link_failed', {
      button,
      target,
      state,
    });
  }
  set(statusId, error ? error.message : 'Setup key link sent. Check that same-email inbox to continue to generated-key setup.');
  set('auth-status', error ? error.message : 'Setup key link sent. Check that same-email inbox to continue to generated-key setup.');
  return { error };
}
async function refreshSession() { const { data } = await sb.auth.getSession(); const session = data?.session; if (session?.user) { set('session-status', `Signed in as ${session.user.email || session.user.user_metadata?.full_name || session.user.id}`); $('sign-out')?.classList.remove('hidden'); if (isKeyRecoveryLanding() && !keyRecoverySessionRedirecting) { keyRecoverySessionRedirecting = true; rememberKeyRecoveryAccountHandoff(accountActivationUrl(), { button: 'signed_in_recovery_redirect', state: keyRecoveryLandingState() }); trackLoginFunnelEvent('login_key_recovery_session_redirected', { button: 'signed_in_recovery_redirect', target: accountActivationUrl(), state: keyRecoveryLandingState() }); set('auth-status', 'Signed in. Opening API key setup...'); window.setTimeout(openAccountActivation, 250); } } else { set('session-status', isKeyRecoveryLanding() ? 'Opening setup-key activation...' : 'Choose a sign-in method.'); $('sign-out')?.classList.add('hidden'); scheduleKeyRecoveryAccountHandoff(); } }
async function oauthLogin(provider) { markKeyRecoveryUserInteraction(); set('auth-status', `Opening ${provider} sign-in for API key setup...`); rememberOnboardingContext(onboardingContext({ authMethod: provider })); trackLoginFunnelEvent('account_oauth_clicked', { button: provider, target: '/auth/v1/authorize', state: provider }); trackLoginKeyRecoveryAuthEvent('login_key_recovery_oauth_clicked', { button: provider }); const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: accountActivationUrl() } }); if (error) { trackLoginKeyRecoveryAuthEvent('login_key_recovery_oauth_failed', { button: provider }); set('auth-status', error.message); } }
async function passwordLogin() { markKeyRecoveryUserInteraction(); set('auth-status', 'Signing in...'); const email = $('email')?.value.trim(); const password = $('password')?.value; if (!email) { set('auth-status', 'Enter your email first.'); return; } if (!password) { set('auth-status', 'Enter a password, or use Send magic link.'); return; } trackLoginFunnelEvent('account_login_submitted', { button: 'password_login', target: '/auth/v1/token', state: 'password' }); trackLoginKeyRecoveryAuthEvent('login_key_recovery_password_submitted', { button: 'password_login', target: '/auth/v1/token' }); const { error } = await sb.auth.signInWithPassword({ email, password }); set('auth-status', error ? error.message : 'Signed in. Opening API key setup...'); if (!error) { trackLoginFunnelEvent('account_login_succeeded', { button: 'password_login', target: accountActivationUrl(), state: 'password_key_setup' }); trackLoginKeyRecoveryAuthEvent('login_key_recovery_password_succeeded', { button: 'password_login' }); openAccountActivation(); } }
async function passwordSignup() { set('auth-status', 'Creating account...'); const email = $('email')?.value.trim(); const password = $('password')?.value; if (!email) { set('auth-status', 'Enter your email first.'); return; } if (!password) { set('auth-status', 'Enter a password for the new account.'); return; } if (password.length < 8) { set('auth-status', 'Use at least 8 characters for the password.'); return; } trackLoginFunnelEvent('account_signup_submitted', { button: 'password_signup', target: '/auth/v1/signup', state: 'password' }); const metadata = onboardingContext({ authMethod: 'password' }); rememberOnboardingContext(metadata); const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: accountActivationUrl(), data: metadata } }); if (error) { set('auth-status', error.message); return; } trackLoginFunnelEvent('account_signup_succeeded', { button: 'password_signup', target: accountActivationUrl(), state: data?.session ? 'signed_in_key_setup' : 'email_confirmation_key_setup' }); set('auth-status', data?.session ? 'Account created. Opening API key setup...' : 'Account created. Check your email to continue to API key setup.'); if (data?.session) openAccountActivation(); }
async function magicLogin() { set('auth-status', 'Sending magic link...'); const email = $('email')?.value.trim() || $('login-key-recovery-email')?.value.trim(); if (!email) { set('auth-status', 'Enter your email first.'); return; } await sendSameEmailSetupLink(email, { button: 'magic_login', statusId: 'auth-status', state: 'email' }); }
async function walletLogin() { try { set('wallet-status', 'Connecting wallet...'); trackLoginFunnelEvent('login_wallet_clicked', { button: 'wallet_login', target: '/login.html', state: 'algorand' }); if (window.algorand?.enable) { const result = await window.algorand.enable({ genesisID: 'mainnet-v1.0' }); const account = result?.accounts?.[0]?.address || result?.accounts?.[0]; if (!account) throw new Error('No wallet account returned.'); localStorage.setItem('sage_wallet_address', account); trackLoginFunnelEvent('login_wallet_connected', { button: 'wallet_login', target: '/login.html', state: 'algorand' }); set('wallet-status', `Wallet connected: ${account.slice(0, 8)}…${account.slice(-6)}`); return; } throw new Error('Install or unlock an Algorand wallet extension, then try again.'); } catch (error) { set('wallet-status', error.message || 'Wallet connection failed.'); } }
document.querySelectorAll('[data-oauth]').forEach((button) => button.addEventListener('click', () => { if (!button.disabled) oauthLogin(button.dataset.oauth); }));
document.querySelectorAll('[data-key-recovery]').forEach((link) => link.addEventListener('click', async (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  markKeyRecoveryUserInteraction();
  const target = link.getAttribute('href') || ACCOUNT_ACTIVATION_PATH;
  const buttonName = link.dataset.keyRecoveryButton || link.textContent.trim() || 'Open API key setup';
  rememberKeyRecoveryAccountHandoff(target, {
    button: buttonName,
    state: keyRecoveryLandingState(),
  });
  setKeyRecoveryHandoffStatus('Opening API key setup now...');
  set('auth-status', 'Opening API key setup now...');
  await Promise.all([
    trackLoginFunnelEventBeforeNavigation('login_key_recovery_clicked', {
      button: buttonName,
      target,
      state: keyRecoveryLandingState(),
    }, 500),
    trackLoginFunnelEventBeforeNavigation('login_key_recovery_account_setup_clicked', {
      button: buttonName,
      target,
      state: keyRecoveryLandingState(),
    }, 500),
  ]);
  openAccountActivation(target);
}));
$('login-key-recovery-email-focus')?.addEventListener('click', () => {
  markKeyRecoveryUserInteraction();
  activateSameEmailKeyRecovery('manual_same_email_focus');
});
$('login-key-recovery-email-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  markKeyRecoveryUserInteraction();
  const input = $('login-key-recovery-email');
  const button = $('login-key-recovery-email-submit');
  const email = input?.value.trim();
  if (!email) {
    set('login-key-recovery-email-status', 'Enter the same email used at signup first.');
    input?.focus?.();
    return;
  }
  const original = button?.textContent || 'Email setup key link';
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }
    set('login-key-recovery-email-status', 'Sending same-email setup key link...');
    const mainEmail = $('email');
    if (mainEmail && !mainEmail.value) mainEmail.value = email;
    await sendSameEmailSetupLink(email, {
      button: 'inline_same_email_setup_link',
      statusId: 'login-key-recovery-email-status',
      state: 'inline_same_email',
    });
  } finally {
    window.setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }, 1200);
  }
});
['email', 'password', 'login-key-recovery-email'].forEach((id) => {
  $(id)?.addEventListener('input', markKeyRecoveryUserInteraction);
});
$('login-key-recovery-copy-setup')?.addEventListener('click', async () => {
  markKeyRecoveryUserInteraction();
  const button = $('login-key-recovery-copy-setup');
  const original = button?.textContent || 'Copy setup first';
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Copying...';
    }
    await writeLoginClipboardText(loginRecoverySetupBundleText());
    if (button) button.textContent = 'Copied';
    set('auth-status', 'Setup copied. Use the same email or GitHub identity next, then replace the placeholder with the generated sk_sage key.');
    trackLoginFunnelEvent('login_key_recovery_setup_copied', {
      button: 'copy_setup_first',
      target: accountActivationUrl(),
      state: keyRecoveryLandingState(),
      snippet: 'login-key-recovery-setup',
    });
  } catch (_error) {
    if (button) button.textContent = 'Copy failed';
    set('auth-status', 'Copy failed. Use Open API key setup or the quickstart for manual setup.');
  } finally {
    window.setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }, 1800);
  }
});
applyKeyRecoveryLinkTarget();
applyKeyRecoveryLandingMode();
$('wallet-login')?.addEventListener('click', walletLogin); $('password-signup')?.addEventListener('click', passwordSignup); $('password-login')?.addEventListener('click', passwordLogin); $('magic-login')?.addEventListener('click', magicLogin); $('sign-out')?.addEventListener('click', async () => { await sb.auth.signOut(); refreshSession(); }); sb.auth.onAuthStateChange(() => refreshSession()); refreshSession();
trackLoginFunnelEvent('login_key_recovery_shown', {
  button: 'Finish setup key',
  target: keyRecoveryLinkTarget(),
  state: 'login_recovery_cta',
});
if (isKeyRecoveryLanding()) {
  trackLoginFunnelEvent('login_key_recovery_landed', {
    button: 'Email/password fallback',
    target: accountActivationUrl(),
    state: keyRecoveryLandingState(),
  });
  window.setTimeout(scheduleKeyRecoveryAccountHandoff, 350);
}
applyAuthSettings();
