let sageRouterUrl = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
const FOUNDER_SALES_KIT_URL = 'https://sagerouter.dev/founder-sales-kit?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch';

const $ = (id) => document.getElementById(id);
const set = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const host = (url) => {
  try {
    return new URL(url).host;
  } catch (_error) {
    return url || 'unknown';
  }
};
const fmtLatency = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : '--';
const fmtNumber = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '';
const fmtBool = (value) => value ? 'enabled' : 'disabled';
const fmtRetryStatuses = (statuses = []) => {
  const values = (Array.isArray(statuses) ? statuses : [])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  return values.length ? values.join('/') : 'configured retry statuses';
};

function trackStatusFunnelEvent(event, data = {}) {
  const params = new URLSearchParams(window.location.search);
  const payload = JSON.stringify({
    event,
    sourcePage: window.location.href,
    target: data.target || null,
    metadata: {
      source: 'status',
      button: data.button || null,
      state: data.state || null,
      snippet: data.snippet || null,
      utmSource: params.get('utm_source') || params.get('utmSource') || null,
      utmMedium: params.get('utm_medium') || params.get('utmMedium') || null,
      utmCampaign: params.get('utm_campaign') || params.get('utmCampaign') || null,
      landingPath: window.location.pathname
    }
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/funnel-event', blob)) return;
    }
  } catch {}
  fetch('/api/funnel-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'omit'
  }).catch(() => {});
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
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
  document.execCommand('copy');
  textarea.remove();
}

document.querySelectorAll('[data-status-event]').forEach((link) => {
  link.addEventListener('click', () => {
    trackStatusFunnelEvent(link.dataset.statusEvent, {
      target: link.getAttribute('href') || null,
      button: link.textContent.trim().slice(0, 60),
      state: link.dataset.statusState || null
    });
  });
});

$('status-copy-founder-recommended-first-reply')?.addEventListener('click', async () => {
  const block = $('status-founder-recommended-first-reply');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied no-secret recommended first reply.';
    trackStatusFunnelEvent('outreach_snippet_copied', {
      target: 'status-revenue-action',
      button: 'Copy recommended first reply',
      state: 'status-founder-recommended-first-reply',
      snippet: 'status-founder-recommended-first-reply',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the reply manually.';
  }
});

$('status-copy-founder-pro-reply')?.addEventListener('click', async () => {
  const block = $('status-founder-pro-reply');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied no-secret Pro reply.';
    trackStatusFunnelEvent('outreach_snippet_copied', {
      target: 'status-revenue-action',
      button: 'Copy Pro reply',
      state: 'status-founder-pro-reply',
      snippet: 'status-founder-pro-reply',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the reply manually.';
  }
});

$('status-copy-first-request-setup')?.addEventListener('click', async () => {
  const block = $('status-first-request-setup-bundle');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied setup bundle.';
    trackStatusFunnelEvent('status_first_request_setup_copied', {
      target: 'status-revenue-action',
      button: 'Copy setup bundle',
      state: 'status-revenue-setup',
      snippet: 'status-revenue-setup-bundle',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the setup bundle manually.';
  }
});

$('status-copy-one-subscription-review-packet')?.addEventListener('click', async () => {
  const block = $('status-one-subscription-review-packet');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied no-secret one-subscription review packet.';
    trackStatusFunnelEvent('managed_access_review_packet_copied', {
      target: 'status-revenue-action',
      button: 'Copy review packet',
      state: 'status-one-subscription-review',
      snippet: 'status-one-subscription-review-packet',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the review packet manually.';
  }
});

$('status-copy-activation-approval-packet')?.addEventListener('click', async () => {
  const block = $('status-activation-approval-packet');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied no-secret signup-to-key approval packet.';
    trackStatusFunnelEvent('status_activation_approval_packet_copied', {
      target: 'status-revenue-action',
      button: 'Copy approval packet',
      state: 'status-activation-approval',
      snippet: 'status-activation-approval-packet',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the approval packet manually.';
  }
});

$('status-copy-activation-worksheet-refresh')?.addEventListener('click', async () => {
  const block = $('status-activation-worksheet-refresh');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied activation worksheet refresh command.';
    trackStatusFunnelEvent('status_activation_approval_packet_copied', {
      target: 'status-revenue-action',
      button: 'Copy worksheet refresh',
      state: 'status-activation-worksheet-refresh',
      snippet: 'status-activation-worksheet-refresh',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the worksheet refresh command manually.';
  }
});

$('status-copy-activation-review-record')?.addEventListener('click', async () => {
  const block = $('status-activation-review-record');
  const status = $('status-founder-pro-status');
  try {
    await writeClipboardText(block?.textContent.trim() || '');
    if (status) status.textContent = 'Copied activation review recording command.';
    trackStatusFunnelEvent('status_activation_approval_packet_copied', {
      target: 'status-revenue-action',
      button: 'Copy review record',
      state: 'status-activation-review-record',
      snippet: 'status-activation-review-record',
    });
  } catch (_error) {
    if (status) status.textContent = 'Copy failed. Select the review recording command manually.';
  }
});
const originKind = (url = '') => {
  if (url && typeof url === 'object') return url.originKind || originKind(url.url || url.label || url.id || '');
  const name = host(url).toLowerCase();
  if (name.endsWith('.ts.net')) return 'tailnet';
  if (name.includes('run.app')) return 'cloud fallback';
  if (name.includes('sagerouter.dev')) return 'public edge';
  return 'custom';
};
const upstreamId = (row = {}) => row.id || row.url || '';
const upstreamLabel = (row = {}, fallback = 'unknown') => row.label || (row.url ? host(row.url) : '') || row.id || fallback;
const relTime = (epochSeconds) => {
  const epoch = Number(epochSeconds);
  if (!Number.isFinite(epoch) || epoch <= 0) return 'not checked yet';
  const seconds = Math.max(0, Math.round((Date.now() - epoch * 1000) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

function badge(label, state = '') {
  return `<span class="badge ${esc(state)}">${esc(label)}</span>`;
}

function renderUpstreams(health = {}) {
  const selected = health.selectedUpstreamId || health.selected || '';
  const rows = health.upstreams || [];
  if (!rows.length) {
    $('upstreams').innerHTML = '<p class="muted">No upstreams reported by the edge.</p>';
    return null;
  }
  const selectedRow = rows.find(row => upstreamId(row) === selected) || null;
  $('upstreams').innerHTML = rows.map((row) => {
    const isSelected = upstreamId(row) === selected;
    const state = row.healthy ? 'good' : 'bad';
    const label = row.healthy ? 'healthy' : 'down';
    const error = row.last_error ? `<div class="meta">${esc(row.last_error)}</div>` : '';
    return `<article class="upstream ${isSelected ? 'selected' : ''}">
      <div class="row"><div class="host">${esc(upstreamLabel(row))}</div>${badge(isSelected ? 'selected' : label, isSelected ? 'good' : state)}</div>
      <div class="meta">${esc(fmtLatency(row.latency_ms))} latency · checked ${esc(relTime(row.last_checked))}</div>
      ${error}
    </article>`;
  }).join('');
  return selectedRow;
}

function renderPlans(pricing = {}) {
  const plans = pricing.plans || {};
  const billing = pricing.billing || {};
  const stripe = billing.stripe || {};
  const checkoutReady = stripe.checkoutReady === true;
  const checkoutPlans = new Set(Array.isArray(stripe.configuredPlans) ? stripe.configuredPlans : []);
  const preferred = ['free', 'lite', 'pro', 'max', 'metered'].filter(name => plans[name]);
  const names = preferred.length ? preferred : Object.keys(plans);
  if (!names.length) {
    $('plans').innerHTML = '<p class="muted">Plan catalog is unavailable.</p>';
    return;
  }
  $('plans').innerHTML = names.map((name) => {
    const plan = plans[name] || {};
    const limits = plan.limits || {};
    const limitText = [
      limits.monthlyRequests === 0 ? 'local/free only' : (limits.monthlyRequests ? `${fmtNumber(limits.monthlyRequests)} requests/month` : ''),
      limits.rateLimitPerMinute ? `${fmtNumber(limits.rateLimitPerMinute)} rpm` : '',
    ].filter(Boolean).join(' · ');
    const selfServe = plan.apiAccess && checkoutReady && checkoutPlans.has(name);
    const state = plan.apiAccess ? (selfServe ? 'good' : 'warn') : '';
    const access = plan.apiAccess ? (selfServe ? 'self-serve' : 'manual review') : 'no API';
    return `<article class="planCard">
      <div class="row"><div class="host">${esc(plan.name || name)}</div>${badge(access, state)}</div>
      <div class="meta">${esc(plan.price || '')}${limitText ? ` · ${esc(limitText)}` : ''}</div>
    </article>`;
  }).join('');
}

function renderReliabilityEvidence(health = {}) {
  const upstreams = health.upstreams || [];
  const healthy = upstreams.filter(row => row.healthy);
  const failover = health.failover || {};
  const tailnetCount = healthy.filter(row => originKind(row) === 'tailnet').length;
  const cloudCount = healthy.filter(row => originKind(row) === 'cloud fallback').length;
  const selectedId = health.selectedUpstreamId || health.selected || '';
  const selected = upstreams.find(row => upstreamId(row) === selectedId) || {};
  const selectedKind = originKind(selected);
  const multiOrigin = tailnetCount > 0 && cloudCount > 0;
  const multiHost = healthy.length >= 2;
  const status = multiOrigin && multiHost ? 'resilient' : (multiHost ? 'partial' : 'limited');
  const reportedHealthyCount = Number.isFinite(Number(failover.healthyUpstreamCount)) ? Number(failover.healthyUpstreamCount) : healthy.length;
  const retryHeader = failover.retryHeader || 'X-Sage-Router-Retry-Count';
  const retryStatuses = fmtRetryStatuses(failover.retryStatuses);
  const retryEnabled = failover.retryEnabled === true;
  const failoverMode = failover.mode || 'lowest-latency healthy';
  const cards = [
    {
      title: 'Healthy backends',
      value: `${reportedHealthyCount}/${upstreams.length}`,
      badge: multiHost ? 'failover ready' : 'limited',
      state: multiHost ? 'good' : 'warn',
      meta: 'The public edge selects the lowest-latency healthy backend before proxying model traffic.',
    },
    {
      title: 'Origin mix',
      value: `${tailnetCount} Tailnet · ${cloudCount} cloud`,
      badge: multiOrigin ? 'hybrid' : 'single class',
      state: multiOrigin ? 'good' : 'warn',
      meta: 'Tailnet installs provide private capacity; the Cloud Run origin remains available as hosted fallback.',
    },
    {
      title: 'Current route',
      value: upstreamLabel(selected, selectedId || '--'),
      badge: selectedKind,
      state: selected.healthy ? 'good' : 'warn',
      meta: `${fmtLatency(selected.latency_ms)} selected latency; checked ${relTime(selected.last_checked)}.`,
    },
    {
      title: 'Retry failover',
      value: failoverMode,
      badge: retryEnabled ? 'retry enabled' : 'retry unknown',
      state: retryEnabled ? 'good' : 'warn',
      meta: retryEnabled
        ? `Retries ${retryStatuses} responses on the next healthy upstream; successful retries include ${retryHeader}.`
        : `Retry metadata is not published by this edge yet; expected header is ${retryHeader}.`,
    },
  ];
  $('reliability-evidence').innerHTML = cards.map(row => `<article class="upstream">
    <div class="row"><div class="host">${esc(row.title)}: ${esc(row.value)}</div>${badge(row.badge, row.state)}</div>
    <div class="meta">${esc(row.meta)}</div>
  </article>`).join('');
  const retrySummary = retryEnabled ? ` Retry failover is enabled for ${retryStatuses} responses.` : '';
  set('reliability-summary', `${status === 'resilient' ? 'Hybrid failover is active' : 'Failover is limited'}: ${reportedHealthyCount}/${upstreams.length} healthy backends, ${tailnetCount} Tailnet origin${tailnetCount === 1 ? '' : 's'}, and ${cloudCount} cloud fallback origin${cloudCount === 1 ? '' : 's'}.${retrySummary}`);
}

function renderControls(health = {}) {
  const upstreams = health.upstreams || [];
  const healthyFromRows = upstreams.filter(row => row.healthy).length;
  const failover = health.failover || {};
  const healthyCount = Number.isFinite(Number(failover.healthyUpstreamCount)) ? Number(failover.healthyUpstreamCount) : healthyFromRows;
  const retryHeader = failover.retryHeader || 'X-Sage-Router-Retry-Count';
  const retryStatuses = fmtRetryStatuses(failover.retryStatuses);
  const retryEnabled = failover.retryEnabled === true;
  const failoverMode = failover.mode || (healthyCount >= 2 ? 'multi-upstream' : (healthyCount === 1 ? 'single upstream' : 'no healthy upstreams'));
  const controlPlane = health.controlPlane || {};
  const enforcement = health.enforcement || {};
  const authMode = health.authMode || 'unknown';
  const cacheSeconds = Number(enforcement.apiKeyAuthCacheSeconds);
  const immediateRevocation = Number.isFinite(cacheSeconds) && cacheSeconds === 0;
  const rateLimitWindow = Number(enforcement.rateLimitWindowSeconds);
  const authAttemptLimit = Number(enforcement.authAttemptRateLimit);
  const rows = [
    {
      title: 'Failover policy',
      value: failoverMode,
      badge: retryEnabled ? 'retry enabled' : (healthyCount >= 2 ? 'active' : 'limited'),
      state: retryEnabled && healthyCount >= 2 ? 'good' : 'warn',
      meta: `${healthyCount}/${upstreams.length} healthy backends; requests use the lowest-latency healthy route and retry ${retryStatuses} responses with ${retryHeader}.`,
    },
    {
      title: 'Control plane',
      value: controlPlane.healthy ? 'healthy' : 'unavailable',
      badge: fmtLatency(controlPlane.latency_ms),
      state: controlPlane.healthy ? 'good' : 'bad',
      meta: `${upstreamLabel(controlPlane)} · checked ${relTime(controlPlane.last_checked)}`,
    },
    {
      title: 'Customer auth',
      value: authMode,
      badge: enforcement.apiKeyPrefix || 'API keys',
      state: authMode === 'supabase' ? 'good' : 'warn',
      meta: 'Generated customer keys are validated before model traffic is proxied.',
    },
    {
      title: 'Rate limits',
      value: fmtBool(enforcement.rateLimitEnabled),
      badge: Number.isFinite(rateLimitWindow) ? `${rateLimitWindow}s window` : 'window unknown',
      state: enforcement.rateLimitEnabled ? 'good' : 'warn',
      meta: 'Public generated-key traffic is throttled at the edge.',
    },
    {
      title: 'Auth-attempt throttle',
      value: fmtBool(enforcement.authAttemptRateLimitEnabled),
      badge: Number.isFinite(authAttemptLimit) ? `${fmtNumber(authAttemptLimit)}/window` : 'limit unknown',
      state: enforcement.authAttemptRateLimitEnabled ? 'good' : 'warn',
      meta: 'Invalid generated-key attempts are throttled before they can create unbounded auth lookups.',
    },
    {
      title: 'Durable quotas',
      value: fmtBool(enforcement.quotaEnabled),
      badge: enforcement.quotaEnabled ? 'Supabase counted' : 'not enforced',
      state: enforcement.quotaEnabled ? 'good' : 'warn',
      meta: 'Monthly usage is counted outside the edge process for subscription enforcement.',
    },
    {
      title: 'Key revocation',
      value: immediateRevocation ? 'immediate' : `${Number.isFinite(cacheSeconds) ? cacheSeconds : '?'}s cache`,
      badge: immediateRevocation ? 'zero cache' : 'cached',
      state: immediateRevocation ? 'good' : 'warn',
      meta: 'Revoked generated keys are rechecked before the next model request.',
    },
  ];

  $('controls').innerHTML = rows.map(row => `<article class="upstream">
    <div class="row"><div class="host">${esc(row.title)}: ${esc(row.value)}</div>${badge(row.badge, row.state)}</div>
    <div class="meta">${esc(row.meta)}</div>
  </article>`).join('');
  set('resilience-summary', `${healthyCount}/${upstreams.length} upstreams are healthy; control plane ${controlPlane.healthy ? 'healthy' : 'not healthy'}; auth mode ${authMode}; retry failover ${retryEnabled ? 'enabled' : 'not reported'}.`);
}

function renderLaunchReadiness(pricing = {}, health = {}) {
  const billing = pricing.billing || {};
  const stripe = billing.stripe || {};
  const activation = pricing.activationEmailReadiness || {};
  const managed = pricing.publicLaunch?.managedProviderAccess || {};
  const managedSetup = managed.readinessSetup || {};
  const managedActions = Array.isArray(managed.nextActions) ? managed.nextActions : [];
  const topManagedAction = managedActions[0] || {};
  const managedOnboarding = Array.isArray(managed.onboardingSequence) ? managed.onboardingSequence : [];
  const topManagedOnboarding = managedOnboarding.find(step => step && step.status !== 'complete') || managedOnboarding[0] || {};
  const configuredPlans = Array.isArray(stripe.configuredPlans) ? stripe.configuredPlans : [];
  const missingManagedControls = Array.isArray(managed.missingControls) ? managed.missingControls : [];
  const requiredActivationEnv = Array.isArray(activation.requiredEnv) ? activation.requiredEnv : [];
  const clientGuidance = 'OpenAI/Python SDK clients should use a normal SDK User-Agent; bare Python urllib can be challenged by Cloudflare Browser Integrity Check until the host-scoped BIC skip is applied.';
  const rows = [
    {
      title: 'Self-serve checkout',
      value: stripe.checkoutReady ? 'ready' : 'not ready',
      badge: configuredPlans.length ? configuredPlans.join('/') : 'no plans',
      state: stripe.checkoutReady ? 'good' : 'warn',
      meta: stripe.checkoutReady
        ? `Stripe checkout and billing portal are configured for ${configuredPlans.join(', ')}.`
        : 'Stripe checkout or billing portal metadata is incomplete.',
    },
    {
      title: 'Activation sender',
      value: activation.configured ? 'configured' : 'copy fallback',
      badge: activation.provider || 'resend',
      state: activation.configured ? 'good' : 'warn',
      meta: activation.configured
        ? `Operator email follow-ups can be dry-run before sending batches of up to ${fmtNumber(activation.maxBatch || 0)}.`
        : `Real activation email sending is not configured; missing ${requiredActivationEnv.join(', ') || 'sender configuration'}, so operators use the copy/mailto packet.`,
    },
    {
      title: 'Managed access',
      value: managed.enabled ? 'private beta ready' : 'disabled',
      badge: managed.status || 'pending controls',
      state: managed.enabled ? 'good' : 'warn',
      meta: managed.enabled
        ? 'Managed provider access readiness is satisfied for private beta; keep provider authorization evidence current.'
        : `One-subscription managed provider access remains disabled; next action: ${topManagedAction.title || missingManagedControls[0] || 'review provider readiness controls'}. Setup guard: ${managedSetup.setupScript || 'scripts/configure_managed_provider_resale_readiness.sh'}.`,
    },
    {
      title: 'API client compatibility',
      value: health.authMode === 'supabase' ? 'auth gate live' : 'check auth',
      badge: 'BIC-aware',
      state: health.authMode === 'supabase' ? 'good' : 'warn',
      meta: clientGuidance,
    },
  ];

  $('launch-readiness').innerHTML = rows.map(row => `<article class="upstream">
    <div class="row"><div class="host">${esc(row.title)}: ${esc(row.value)}</div>${badge(row.badge, row.state)}</div>
    <div class="meta">${esc(row.meta)}</div>
  </article>`).join('');
  const blockers = rows.filter(row => row.state !== 'good').map(row => row.title.toLowerCase());
  set(
    'launch-readiness-summary',
    blockers.length
      ? `Launch posture has ${blockers.length} visible follow-up${blockers.length === 1 ? '' : 's'}: ${blockers.join(', ')}.`
      : 'Checkout, activation sending, managed-access guard, and API-client posture are ready.'
  );
}

function renderOperatorLaunchActions(pricing = {}, health = {}) {
  const activation = pricing.activationEmailReadiness || {};
  const managed = pricing.publicLaunch?.managedProviderAccess || {};
  const managedSetup = managed.readinessSetup || {};
  const managedActions = Array.isArray(managed.nextActions) ? managed.nextActions : [];
  const topManagedAction = managedActions[0] || {};
  const billing = pricing.billing || {};
  const stripe = billing.stripe || {};
  const openaiBase = pricing.openaiBaseUrl || `${sageRouterUrl}/v1`;
  const activationCheck = activation.setupCheckCommand || `${activation.setupScript || 'scripts/configure_activation_email_sender.sh'} --check`;
  const activationDeliveryMode = activation.deliveryMode || (activation.provider === 'supabase-recovery'
    ? 'supabase_recovery_link'
    : (activation.configured ? 'branded_resend_email' : 'copy_mailto_operator_packet'));
  const activationDeliveryLabel = activationDeliveryMode === 'supabase_recovery_link'
    ? 'Supabase recovery links ready'
    : (activationDeliveryMode === 'branded_resend_email'
      ? 'Branded Resend sender ready'
      : 'Copy/mailto fallback active');
  const activationDeliveryMeta = activationDeliveryMode === 'supabase_recovery_link'
    ? `Dry-run ${fmtNumber(activation.maxBatch || 0)} queued signup-to-key follow-ups before triggering Supabase recovery links; configure Resend separately for branded generated-key copy.`
    : (activation.configured
      ? `Dry-run ${fmtNumber(activation.maxBatch || 0)} queued signup-to-key follow-ups before sending from the configured branded sender.`
      : `Missing ${(activation.requiredEnv || []).join(', ') || 'sender inputs'}; public readiness stays failed until this check passes.`);
  const managedDryRun = managedSetup.dryRunCommand || 'scripts/configure_managed_provider_resale_readiness.sh --check';
  const managedTermsApproval = managedSetup.termsApprovalCommand || 'scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet';
  const managedAuthorizationPacket = managedSetup.authorizationPacketCommand || 'scripts/configure_managed_provider_resale_readiness.sh --authorization-packet';
  const managedAuthorizationLedgerTemplate = managedSetup.authorizationLedgerTemplateCommand || 'scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template';
  const managedProviderOutreach = managedSetup.providerOutreachCommand || 'scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet';
  const managedOneSubscriptionPricing = managedSetup.oneSubscriptionPricingCommand || 'scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet';
  const managedUnitEconomics = managedSetup.unitEconomicsCommand || "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics";
  const activationApprovalPacket = 'scripts/summarize_sagerouter_launch_funnel.sh --days 30 --approval-packet --verify-recovery --verify-auth-repair';
  const founderSalesFallback = [
    'Founder sales fallback',
    'Use when activation sends are approval-gated or managed provider resale is waiting on terms, authorization evidence, a private cost model, or abuse-control review.',
    `Kit: ${FOUNDER_SALES_KIT_URL}`,
    'Primary motion: sell Pro activation and Max implementation review from warm routing, reliability, gateway migration, calculator, and model-catalog conversations.',
    'No-secret boundary: do not paste emails, customer IDs, prompts, OAuth tokens, generated API keys, provider credentials, raw provider responses, private funnel rows, or private provider-cost values.',
  ].join('\n');
  const cloudflareBicCheck = [
    'Sage Router Cloudflare BIC reliability packet',
    'Boundary: no token values, customer data, provider credentials, API keys, prompts, OAuth tokens, or raw provider responses.',
    'Docs: docs/cloudflare-api-bic-skip.md',
    'Required token permissions for zone sagerouter.dev: Zone:Zone:Read; Zone Rulesets:Read; Zone Rulesets:Edit.',
    'Manual UI fallback: Cloudflare Dashboard > sagerouter.dev > Rules > Configuration Rules > Create rule.',
    'Rule name/ref: sage-router-api-disable-bic.',
    'Expression: http.host eq "api.sagerouter.dev".',
    'Action: set configuration setting Browser Integrity Check to Off.',
    'Scope warning: do not disable Browser Integrity Check for sagerouter.dev, app.sagerouter.dev, www.sagerouter.dev, or the whole zone.',
    '',
    'scripts/configure_cloudflare_api_bic_skip.sh --operator-packet',
    'scripts/configure_cloudflare_api_bic_skip.sh --audit-local-tokens',
    'scripts/configure_cloudflare_api_bic_skip.sh --check',
    'scripts/configure_cloudflare_api_bic_skip.sh',
  ].join('\n');
  const managedStagePublicControls = managedSetup.stagePublicControlsCommand || 'scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls';
  const managedSetupCommand = managedSetup.setupCommand || [
    "SAGEROUTER_PROVIDER_RESALE_TERMS_URL='https://sagerouter.dev/provider-resale-terms' \\",
    "SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL='https://sagerouter.dev/margin-policy' \\",
    "SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS='ollama,openai,anthropic' \\",
    "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' \\",
    "scripts/configure_managed_provider_resale_readiness.sh",
  ].join('\n');
  const setupBundle = [
    'export OPENAI_BASE_URL=https://api.sagerouter.dev/v1',
    'export OPENAI_API_KEY=sk_sage_your_key_here',
    'curl "$OPENAI_BASE_URL/models" -H "Authorization: Bearer $OPENAI_API_KEY"',
  ].join('\n');
  const actions = [
    {
      id: 'activation-email-preflight',
      title: 'Activation email sender',
      value: activationDeliveryLabel,
      badge: activation.configured ? 'ready' : 'blocking launch readiness',
      state: activation.configured ? 'good' : 'warn',
      meta: activationDeliveryMeta,
      command: activationCheck,
      copyEvent: 'status_activation_email_preflight_copied',
    },
    {
      id: 'activation-approval-packet',
      title: 'Signup-to-key approval packet',
      value: activation.configured ? 'Sender configured; approval still required' : 'Copy fallback active',
      badge: 'no-secret review',
      state: 'warn',
      meta: 'Prints the current no-key signup queue, dry-run coverage, next segment, and explicit-confirmation send command without sending email or exposing emails, keys, prompts, or provider credentials.',
      command: activationApprovalPacket,
      copyEvent: 'status_activation_approval_packet_copied',
    },
    {
      id: 'founder-sales-fallback',
      title: 'Founder-sales fallback',
      value: 'Pro and Max direct outreach',
      badge: 'no-secret revenue motion',
      state: 'warn',
      meta: 'Use when activation sends still need explicit approval or one-subscription managed access is waiting on provider terms, authorization evidence, private cost, or abuse-control review.',
      command: founderSalesFallback,
      copyEvent: 'outreach_snippet_copied',
    },
    {
      id: 'managed-resale-dry-run',
      title: 'One-subscription managed access',
      value: managed.enabled ? 'Private beta ready' : (topManagedAction.title || 'Keep disabled; stage provider terms first'),
      badge: managed.enabled ? 'ready' : 'guarded',
      state: managed.enabled ? 'good' : 'warn',
      meta: managed.enabled
        ? 'Provider resale guardrails report readiness satisfied; keep authorization evidence current.'
        : `${topManagedAction.action || 'Run the dry-run before staging provider terms, allowlist, private cost model, and margin controls.'} Onboarding step: ${topManagedOnboarding.title || 'collect provider authorization evidence'}. OpenRouter remains BYOK-only unless separate authorization is added.`,
      command: managed.enabled ? (managedSetup.enableCommandTemplate || managedDryRun) : managedDryRun,
      copyEvent: 'status_managed_resale_dry_run_copied',
    },
    {
      id: 'managed-terms-approval',
      title: 'Provider terms approval',
      value: managed.providerTermsAcknowledged ? 'Terms acknowledged' : 'Approval packet required',
      badge: managed.providerTermsAcknowledged ? 'acknowledged' : 'no-secret review',
      state: managed.providerTermsAcknowledged ? 'good' : 'warn',
      meta: 'Review provider terms, authorization-evidence presence, resale-eligible families, and BYOK-only exclusions before setting terms acknowledgment.',
      command: managedTermsApproval,
      copyEvent: 'status_managed_terms_approval_copied',
    },
    {
      id: 'managed-authorization-packet',
      title: 'Provider authorization evidence',
      value: managed.providerAuthorizationEvidenceConfigured ? 'Evidence reference configured' : 'Evidence packet required',
      badge: managed.providerAuthorizationEvidenceConfigured ? 'reference present' : 'no-secret review',
      state: managed.providerAuthorizationEvidenceConfigured ? 'good' : 'warn',
      meta: 'Prints the provider-family authorization checklist and private evidence-reference format without printing provider contracts, account IDs, credentials, costs, prompts, or raw responses.',
      command: managedAuthorizationPacket,
      copyEvent: 'status_managed_authorization_packet_copied',
    },
    {
      id: 'managed-authorization-ledger-template',
      title: 'Provider authorization ledger template',
      value: managed.providerAuthorizationEvidenceConfigured ? 'Evidence reference configured' : 'Ledger template required',
      badge: 'private review template',
      state: managed.providerAuthorizationEvidenceConfigured ? 'good' : 'warn',
      meta: 'Prints the private-review authorization ledger template without provider credentials, contract text, account IDs, actual costs, prompts, or raw responses.',
      command: managedAuthorizationLedgerTemplate,
      copyEvent: 'status_managed_authorization_ledger_template_copied',
    },
    {
      id: 'managed-provider-outreach',
      title: 'Provider authorization outreach',
      value: managed.providerAuthorizationEvidenceConfigured ? 'Evidence captured' : 'Request provider approval',
      badge: 'no-secret outreach',
      state: managed.providerAuthorizationEvidenceConfigured ? 'good' : 'warn',
      meta: 'Prints the provider-facing request packet for Ollama, OpenAI, and Anthropic managed-access authorization without provider credentials, contracts, account IDs, costs, prompts, or raw responses.',
      command: managedProviderOutreach,
      copyEvent: 'status_managed_provider_outreach_copied',
    },
    {
      id: 'managed-one-subscription-pricing',
      title: 'One-subscription pricing packet',
      value: managed.unitEconomics?.satisfied ? 'Thresholds pass' : 'Review public thresholds',
      badge: 'public thresholds only',
      state: managed.unitEconomics?.satisfied ? 'good' : 'warn',
      meta: 'Prints live public plan revenue, max-safe provider-cost thresholds, the binding plan, and packaging decisions without private provider costs, required private prices, credentials, prompts, or customer data.',
      command: managedOneSubscriptionPricing,
      copyEvent: 'status_managed_one_subscription_pricing_copied',
    },
    {
      id: 'managed-unit-economics',
      title: 'Provider cost preflight',
      value: managed.unitEconomics?.satisfied ? 'Plan margins pass' : 'Review private cost candidate',
      badge: managed.unitEconomics?.costModelConfigured ? 'cost model present' : 'secret-safe dry-run',
      state: managed.unitEconomics?.satisfied ? 'good' : 'warn',
      meta: 'Run before writing the private provider-cost model; output shows only candidate presence, public plan revenue, max-safe thresholds, and pass/fail status.',
      command: managedUnitEconomics,
      copyEvent: 'status_managed_unit_economics_copied',
    },
    {
      id: 'managed-resale-stage',
      title: 'Provider public-control staging',
      value: 'Ollama/OpenAI/Anthropic only',
      badge: 'no secret cost model',
      state: 'warn',
      meta: 'Stages public terms, margin-policy, resale-eligible allowlist, minimum margin, and disabled public-enable controls without writing the private provider-cost model or authorization reference.',
      command: managedStagePublicControls,
      copyEvent: 'status_managed_resale_stage_copied',
    },
    {
      id: 'managed-private-cost-stage',
      title: 'Private cost-model staging',
      value: 'Requires reviewed private cost',
      badge: 'Secret Manager',
      state: 'warn',
      meta: 'Use only after the unit-economics preflight passes with the reviewed private provider-cost candidate. Keep public managed resale disabled until final approval.',
      command: managedSetupCommand,
      copyEvent: 'status_managed_private_cost_stage_copied',
    },
    {
      id: 'first-request-proof',
      title: '$10k MRR activation proof',
      value: stripe.checkoutReady ? 'Checkout ready; prove first request' : 'Checkout setup incomplete',
      badge: stripe.checkoutReady ? 'customer setup' : 'billing follow-up',
      state: stripe.checkoutReady ? 'good' : 'warn',
      meta: `Customers should create an sk_sage key, verify /models, then send the first request against ${openaiBase}.`,
      command: setupBundle,
      copyEvent: 'status_first_request_setup_copied',
    },
    {
      id: 'cloudflare-bic-check',
      title: 'Raw API-client BIC check',
      value: health.authMode === 'supabase' ? 'SDK auth gate live' : 'Verify edge auth',
      badge: 'Cloudflare check',
      state: health.authMode === 'supabase' ? 'good' : 'warn',
      meta: 'SDK-style clients reach the auth gate; raw Python urllib may still need the host-scoped Browser Integrity Check skip rule. Audit local token candidates first; the audit prints status only, never token values.',
      command: cloudflareBicCheck,
      copyEvent: 'status_cloudflare_bic_check_copied',
    },
  ];

  $('operator-launch-actions').innerHTML = actions.map((row) => `<article class="launchAction">
    <div class="row"><div class="host">${esc(row.title)}: ${esc(row.value)}</div>${badge(row.badge, row.state)}</div>
    <div class="meta">${esc(row.meta)}</div>
    <pre class="commandText">${esc(row.command)}</pre>
    <div class="actions"><button type="button" class="btn secondary" data-copy-command="${esc(row.id)}">Copy action</button></div>
  </article>`).join('');
  actions.forEach((row) => {
    const button = document.querySelector(`[data-copy-command="${row.id}"]`);
    button?.addEventListener('click', async () => {
      try {
        await writeClipboardText(row.command);
        button.textContent = 'Copied';
        trackStatusFunnelEvent(row.copyEvent, {
          target: 'operator-launch-actions',
          button: row.title,
          state: row.id,
          snippet: row.id,
        });
      } catch (_error) {
        button.textContent = 'Copy failed';
      }
    });
  });
  const blockers = actions.filter(row => row.state !== 'good').map(row => row.title.toLowerCase());
  set(
    'operator-launch-summary',
    blockers.length
      ? `Next launch actions: ${blockers.join(', ')}. Commands are placeholders or dry-runs only and contain no secrets.`
      : 'Checkout, activation sending, managed-access gate, first-request setup, and API-client checks are ready.'
  );
}

async function fetchJson(path) {
  const res = await fetch(`${sageRouterUrl}${path}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function refreshStatus() {
  set('headline', 'Checking edge...');
  set('summary', 'Loading public health and launch metadata from api.sagerouter.dev.');
  set('updated', '');
  try {
    const [health, pricing] = await Promise.all([
      fetchJson('/edge/health'),
      fetchJson('/pricing').catch(() => ({})),
    ]);
    if (pricing.apiBaseUrl) sageRouterUrl = pricing.apiBaseUrl;
    const selectedRow = renderUpstreams(health);
    renderPlans(pricing);
    renderReliabilityEvidence(health);
    renderControls(health);
    renderLaunchReadiness(pricing, health);
    renderOperatorLaunchActions(pricing, health);
    const healthyCount = (health.upstreams || []).filter(row => row.healthy).length;
    const totalCount = (health.upstreams || []).length;
    const ok = health.status === 'ok' && healthyCount > 0;
    const selectedLabel = upstreamLabel(selectedRow || {}, health.selectedUpstreamId || health.selected || '--');
    set('headline', ok ? 'Operational' : 'Degraded');
    set('summary', `${healthyCount}/${totalCount} upstreams healthy. Public API traffic is routed through ${selectedLabel}.`);
    set('kpi-status', ok ? 'OK' : 'Check');
    set('kpi-auth', health.authMode || '--');
    set('kpi-selected', selectedLabel);
    set('kpi-latency', fmtLatency(selectedRow?.latency_ms));
    const openaiBase = pricing.openaiBaseUrl || `${sageRouterUrl}/v1`;
    $('endpoint').innerHTML = `OpenAI-compatible clients should use <code>${esc(openaiBase)}</code>.`;
    set('updated', `Last refreshed ${new Date().toLocaleString()}.`);
  } catch (error) {
    set('headline', 'Status unavailable');
    set('summary', error.message || 'Could not reach the public edge health endpoint.');
    set('kpi-status', 'Error');
    set('kpi-auth', '--');
    set('kpi-selected', '--');
    set('kpi-latency', '--');
    $('upstreams').innerHTML = '<p class="muted">Could not load upstream health.</p>';
    $('plans').innerHTML = '<p class="muted">Could not load hosted plan metadata.</p>';
    $('reliability-evidence').innerHTML = '<p class="muted">Could not load failover evidence.</p>';
    set('reliability-summary', 'Public failover evidence is unavailable.');
    $('controls').innerHTML = '<p class="muted">Could not load edge enforcement controls.</p>';
    set('resilience-summary', 'Edge enforcement metadata is unavailable.');
    $('launch-readiness').innerHTML = '<p class="muted">Could not load launch readiness metadata.</p>';
    set('launch-readiness-summary', 'Checkout, activation, and managed-access readiness are unavailable.');
    $('operator-launch-actions').innerHTML = '<p class="muted">Could not load operator launch actions.</p>';
    set('operator-launch-summary', 'No-secret activation and managed-access action packet is unavailable.');
  }
}

$('refresh')?.addEventListener('click', refreshStatus);
refreshStatus();
