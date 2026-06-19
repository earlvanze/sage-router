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
  }
}

$('refresh')?.addEventListener('click', refreshStatus);
refreshStatus();
