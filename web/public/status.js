let sageRouterUrl = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';

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
const originKind = (url = '') => {
  const name = host(url).toLowerCase();
  if (name.endsWith('.ts.net')) return 'tailnet';
  if (name.includes('run.app')) return 'cloud fallback';
  if (name.includes('sagerouter.dev')) return 'public edge';
  return 'custom';
};
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
  const selected = health.selected || '';
  const rows = health.upstreams || [];
  if (!rows.length) {
    $('upstreams').innerHTML = '<p class="muted">No upstreams reported by the edge.</p>';
    return null;
  }
  const selectedRow = rows.find(row => row.url === selected) || null;
  $('upstreams').innerHTML = rows.map((row) => {
    const isSelected = row.url === selected;
    const state = row.healthy ? 'good' : 'bad';
    const label = row.healthy ? 'healthy' : 'down';
    const error = row.last_error ? `<div class="meta">${esc(row.last_error)}</div>` : '';
    return `<article class="upstream ${isSelected ? 'selected' : ''}">
      <div class="row"><div class="host">${esc(host(row.url))}</div>${badge(isSelected ? 'selected' : label, isSelected ? 'good' : state)}</div>
      <div class="meta">${esc(fmtLatency(row.latency_ms))} latency · checked ${esc(relTime(row.last_checked))}</div>
      ${error}
    </article>`;
  }).join('');
  return selectedRow;
}

function renderPlans(pricing = {}) {
  const plans = pricing.plans || {};
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
    const state = plan.apiAccess ? (plan.stripeConfigured ? 'good' : 'warn') : '';
    const access = plan.apiAccess ? (plan.stripeConfigured ? 'self-serve' : 'manual') : 'no API';
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
  const tailnetCount = healthy.filter(row => originKind(row.url) === 'tailnet').length;
  const cloudCount = healthy.filter(row => originKind(row.url) === 'cloud fallback').length;
  const selected = upstreams.find(row => row.url === health.selected) || {};
  const selectedKind = originKind(selected.url || health.selected || '');
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
      value: host(selected.url || health.selected || '--'),
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
      meta: `${host(controlPlane.url || 'unknown')} · checked ${relTime(controlPlane.last_checked)}`,
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
    const healthyCount = (health.upstreams || []).filter(row => row.healthy).length;
    const totalCount = (health.upstreams || []).length;
    const ok = health.status === 'ok' && healthyCount > 0;
    set('headline', ok ? 'Operational' : 'Degraded');
    set('summary', `${healthyCount}/${totalCount} upstreams healthy. Public API traffic is routed through ${host(health.selected)}.`);
    set('kpi-status', ok ? 'OK' : 'Check');
    set('kpi-auth', health.authMode || '--');
    set('kpi-selected', host(health.selected || '--'));
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
  }
}

$('refresh')?.addEventListener('click', refreshStatus);
refreshStatus();
