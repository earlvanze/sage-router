const SAGE_ROUTER_ACCOUNT_PAGE_URL = 'https://app.sagerouter.dev/account.html?plan=pro';
const SAGE_ROUTER_SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SAGE_ROUTER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';

function loadSageRouterSupabaseClient() {
  return new Promise((resolve, reject) => {
    if (window.supabase?.createClient) {
      resolve(window.supabase);
      return;
    }
    const existing = document.querySelector('script[data-supabase-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.supabase), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.defer = true;
    script.dataset.supabaseJs = 'true';
    script.addEventListener('load', () => resolve(window.supabase), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

function sageRouterAttribution(extra = {}) {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = null;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    referrerHost = referrer && referrer.host !== window.location.host ? referrer.host : null;
  } catch (_error) {
    referrerHost = null;
  }
  return {
    utmSource: params.get('utm_source') || params.get('utmSource') || null,
    utmMedium: params.get('utm_medium') || params.get('utmMedium') || null,
    utmCampaign: params.get('utm_campaign') || params.get('utmCampaign') || null,
    referrerHost,
    landingPath: window.location.pathname,
    ...extra,
  };
}

function trackSageRouterActivationEvent(event, source, data = {}) {
  const payload = JSON.stringify({
    event,
    plan: data.plan || 'pro',
    sourcePage: window.location.href,
    target: data.target || SAGE_ROUTER_ACCOUNT_PAGE_URL,
    metadata: sageRouterAttribution({
      source,
      button: data.button || null,
      state: data.state || null,
    }),
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/funnel-event', blob)) return;
    }
  } catch (_error) {
    // Marketing telemetry must not block activation.
  }
  fetch('/api/funnel-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}

async function submitSageRouterActivationForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById(form.dataset.statusId || '');
  const eventPrefix = form.dataset.eventPrefix;
  const source = form.dataset.source || eventPrefix;
  const email = (emailInput?.value || '').trim();
  const buttonLabel = button?.textContent?.trim() || 'Email me the Pro key link';

  if (!email) {
    if (status) status.textContent = 'Enter an email address to receive the setup link.';
    emailInput?.focus();
    return;
  }
  if (!eventPrefix) {
    window.location.href = SAGE_ROUTER_ACCOUNT_PAGE_URL;
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Sending...';
  }
  if (status) status.textContent = 'Sending setup link...';
  trackSageRouterActivationEvent(`${eventPrefix}_magic_link_requested`, source, {
    button: buttonLabel,
    state: 'email-start',
  });

  try {
    const api = await loadSageRouterSupabaseClient();
    const client = api.createClient(SAGE_ROUTER_SUPABASE_URL, SAGE_ROUTER_SUPABASE_ANON_KEY);
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: SAGE_ROUTER_ACCOUNT_PAGE_URL,
        data: {
          sage_router_onboarding: true,
          signup_source: source,
          selected_plan: 'pro',
          auth_method: 'magic_link',
        },
      },
    });
    if (error) throw error;
    form.reset();
    trackSageRouterActivationEvent(`${eventPrefix}_magic_link_sent`, source, {
      button: buttonLabel,
      state: 'email-start',
    });
    if (status) status.textContent = 'Check your email for a Pro setup link. It opens account setup with the Pro plan selected.';
  } catch (_error) {
    trackSageRouterActivationEvent(`${eventPrefix}_magic_link_failed`, source, {
      button: buttonLabel,
      state: 'email-start',
    });
    if (status) status.textContent = 'Email setup is unavailable right now. Opening account setup instead...';
    setTimeout(() => { window.location.href = SAGE_ROUTER_ACCOUNT_PAGE_URL; }, 900);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  }
}

document.querySelectorAll('[data-email-activation-form]').forEach((form) => {
  form.addEventListener('submit', submitSageRouterActivationForm);
});
