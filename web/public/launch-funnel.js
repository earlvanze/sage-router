const API_BASE = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
const MARKETING_BASE = window.SAGE_ROUTER_MARKETING_URL || 'https://sagerouter.dev';
const APP_BASE = window.SAGE_ROUTER_APP_URL || window.location.origin;
const SESSION_TOKEN_KEY = 'sage_router_operator_launch_funnel_token';

const $ = (id) => document.getElementById(id);

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function integer(value) {
  return Math.round(asNumber(value)).toLocaleString();
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function percent(value) {
  if (value === null || value === undefined || value === '') return '--';
  return `${(asNumber(value) * 100).toFixed(1)}%`;
}

function host(url) {
  try {
    return new URL(url).host;
  } catch (_error) {
    return url || 'unknown';
  }
}

function fmtLatency(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : '--';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setStatus(message, tone = '') {
  const status = $('status');
  status.className = `status ${tone}`.trim();
  status.textContent = message;
}

function setCustomerStatus(message, tone = '') {
  const status = $('customer-status-message');
  if (!status) return;
  status.className = `status ${tone}`.trim();
  status.textContent = message;
}

function operatorToken() {
  return $('operator-token').value.trim();
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

function rememberTokenIfRequested(token) {
  if ($('remember-token').checked) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

function loadRememberedToken() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
  if (token) {
    $('operator-token').value = token;
    $('remember-token').checked = true;
  }
}

function privacyLabel(privacy = {}) {
  const clean = privacy.containsEmails === false && privacy.containsApiKeys === false;
  return clean ? 'No emails or keys' : 'Review payload';
}

function customerPrivacyLabel(privacy = {}) {
  const clean = privacy.containsRawApiKeys === false &&
    privacy.containsApiKeyHashes === false &&
    privacy.containsProviderCredentials === false &&
    privacy.containsPrompts === false &&
    privacy.operatorOnly === true;
  return clean ? 'No raw keys/hashes' : 'Review payload';
}

function formatDate(epoch) {
  const value = asNumber(epoch);
  return value > 0 ? new Date(value * 1000).toLocaleString() : '--';
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (['active', 'trialing', 'manual', 'paid'].includes(normalized)) return 'good';
  if (['suspended', 'canceled', 'blocked'].includes(normalized)) return 'bad';
  return 'warn';
}

function customerLabel(summary = {}) {
  const customer = summary.customer || {};
  return customer.email || customer.user_id || customer.id || 'unknown customer';
}

function usageLabel(summary = {}) {
  const activation = summary.activation || {};
  const usage = summary.usage || {};
  if (usage.unlimited) return `${integer(usage.requests)} requests`;
  return `${integer(usage.requests)} / ${integer(activation.quota ?? usage.quota)} requests`;
}

function customerActionLabel(action) {
  const labels = {
    choose_plan: 'choose plan',
    create_key: 'create key',
    send_first_request: 'send first request',
    watch_quota: 'watch quota',
    upgrade_before_quota: 'upgrade before quota',
    monitor_usage: 'monitor usage',
  };
  return labels[action] || String(action || '').replace(/_/g, ' ');
}

function campaignSlug(value) {
  return String(value || 'acquisition')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'acquisition';
}

function campaignTemplateForAction(kind, bucket) {
  const normalizedKind = String(kind || '').trim();
  const normalizedBucket = String(bucket || '').trim().toLowerCase();
  const templates = {
    sourceSurface: {
      pricing: ['/pricing', 'operator', 'launch_funnel', 'pricing_checkout_proof'],
      'model-routing-calculator': ['/model-routing-calculator', 'operator', 'launch_funnel', 'calculator_qualification'],
      'model-catalog': ['/models', 'operator', 'launch_funnel', 'model_catalog_demand'],
      quickstart: ['/quickstart', 'operator', 'launch_funnel', 'first_request_activation'],
      'compare-openrouter': ['/compare/openrouter', 'openrouter', 'founder', 'launch_openrouter_migration'],
      'managed-access': ['/managed-access', 'operator', 'launch_funnel', 'managed_access_beta'],
      'launch-plan': ['/launch-plan', 'operator', 'launch_funnel', 'founder_sales'],
      landing: ['/', 'operator', 'launch_funnel', 'homepage_activation'],
      account: ['/account.html', 'operator', 'launch_funnel', 'account_activation'],
      login: ['/login.html', 'operator', 'launch_funnel', 'signup_onboarding'],
      billing: ['/billing.html', 'operator', 'launch_funnel', 'billing_recovery'],
    },
    attributionChannel: {
      openrouter: ['/compare/openrouter', 'openrouter', 'founder', 'launch_openrouter_migration'],
      github: ['/quickstart', 'github', 'readme', 'launch_builder_quickstart'],
      google: ['/quickstart', 'google', 'search', 'launch_search_router'],
      discord: ['/support', 'discord', 'community', 'launch_founder_activation'],
      reddit: ['/compare/openrouter', 'reddit', 'community', 'launch_comparison_threads'],
      newsletter: ['/pricing', 'newsletter', 'email', 'launch_subscription_offer'],
      docs: ['/quickstart', 'docs', 'docs', 'launch_docs_conversion'],
      direct: ['/', 'direct', 'direct', 'launch_homepage_activation'],
      sagerouter: ['/pricing', 'sagerouter', 'internal', 'launch_internal_conversion'],
    },
  };
  const selected = templates[normalizedKind]?.[normalizedBucket];
  if (selected) {
    const [path, source, medium, campaign] = selected;
    return { path, source, medium, campaign };
  }
  return {
    path: '/quickstart',
    source: normalizedBucket || 'operator',
    medium: normalizedKind === 'sourceSurface' ? 'launch_funnel' : 'referral',
    campaign: `launch_${campaignSlug(normalizedBucket || normalizedKind)}`,
  };
}

function launchActionUrl(row = {}) {
  const template = campaignTemplateForAction(row.kind, row.bucket);
  const url = new URL(template.path, MARKETING_BASE);
  url.searchParams.set('utm_source', template.source);
  url.searchParams.set('utm_medium', template.medium);
  url.searchParams.set('utm_campaign', template.campaign);
  return url.toString();
}

function renderCampaignActions(row = {}) {
  const url = launchActionUrl(row);
  return `<div class="campaignActions">
    <a class="pill good" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Campaign link</a>
    <button class="btn secondary small" type="button" data-copy-campaign="${esc(url)}">Copy link</button>
  </div>`;
}

function firstAction(rows = []) {
  return Array.isArray(rows) && rows.length ? rows[0] : {};
}

function actionLine(row = {}) {
  const label = row.label || row.metric || row.surface || row.plan || row.bucket || 'launch action';
  const action = row.action || 'Review this launch motion.';
  return `${label}: ${action}`;
}

function buildLaunchBrief(data = {}) {
  const stages = data.stages || {};
  const rates = data.rates || {};
  const mrr = data.mrr || {};
  const marketingIntent = data.marketingIntent || {};
  const checkoutFriction = marketingIntent.checkoutFriction || {};
  const modelCatalogDemand = marketingIntent.modelCatalogDemand || {};
  const authState = marketingIntent.authProviderState || {};
  const managedAccessDemand = data.managedAccessDemand || {};
  const acquisitionActions = data.acquisitionActions || marketingIntent.acquisitionActions || [];
  const revenueActions = Array.isArray(mrr.planRevenueActions) ? mrr.planRevenueActions : [];
  const bottleneck = firstAction(data.bottlenecks);
  const conversionAction = firstAction(data.conversionActions);
  const topAcquisition = acquisitionActions.slice(0, 3);
  const topRevenue = revenueActions.slice(0, 3);
  const generatedAt = data.generatedAt ? new Date(data.generatedAt * 1000).toLocaleString() : 'unknown';
  const lines = [
    'Sage Router operator launch brief',
    `Generated: ${generatedAt}`,
    'Boundary: No secrets or customer data; excludes emails, prompts, OAuth tokens, generated API keys, provider credentials, raw campaign URLs, and raw responses.',
    '',
    '$10k MRR snapshot',
    `- Estimated MRR: ${money(mrr.estimatedCurrentMrrUsd)} / ${money(mrr.targetMrrUsd)} (${percent(mrr.targetAttainment)} attainment)`,
    `- MRR gap: ${money(Math.max(0, asNumber(mrr.targetMrrUsd) - asNumber(mrr.estimatedCurrentMrrUsd)))}`,
    `- Paid customers: ${integer(stages.paidCustomers)}; paid conversions: ${integer(stages.paidConversions)}; retained paid with usage: ${integer(stages.retainedPaidCustomers ?? stages.retainedPaidWithUsage)}`,
    '',
    'Activation snapshot',
    `- Signups: ${integer(stages.signups)}; generated-key accounts: ${integer(stages.customersWithGeneratedApiKeys ?? stages.generatedApiKeys)}; first routed request: ${integer(stages.customersWithFirstRoutedRequest ?? stages.firstRoutedRequest)}`,
    `- Generated-key to first request: ${percent(rates.generatedKeyToFirstRequest)}; setup-copy to first request: ${percent(rates.setupCopyToFirstRequest)}`,
    `- Checkout unavailable: ${integer(checkoutFriction.unavailableEvents)} / ${integer(checkoutFriction.totalCheckoutIntent)} intent events (${percent(checkoutFriction.unavailableRate)})`,
    '',
    'Next conversion move',
    `- Bottleneck: ${actionLine(bottleneck)}`,
    `- Owner/surface: ${conversionAction.owner || 'Operator'} / ${conversionAction.surface || 'launch funnel'}`,
    `- Success metric: ${conversionAction.successMetric || 'Improve the next funnel stage.'}`,
    '',
    'Revenue motions',
    ...(topRevenue.length ? topRevenue.map(row => `- ${row.plan || row.label || 'plan'}: ${integer(row.customerGap)} customers remaining, ${money(row.remainingMrrToTargetUsd)} gap. ${row.action || 'Review plan conversion.'}`) : ['- No remaining revenue actions returned for the launch mix.']),
    '',
    'Acquisition motions',
    ...(topAcquisition.length ? topAcquisition.map(row => `- ${attributionLabel(row.bucket || row.kind || 'source')}: ${integer(row.clicks)} clicks, ${customerActionLabel(row.priority || 'review')}. ${row.action || 'Review this channel.'} Link: ${launchActionUrl(row)}`) : ['- No ranked acquisition actions returned for this window.']),
    '',
    'Model catalog demand',
    `- Model-family buckets: ${sortedEntries(modelCatalogDemand.modelFamily).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    `- Search buckets: ${sortedEntries(modelCatalogDemand.queryBucket).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    '',
    'Managed-access demand',
    `- Beta interest: ${integer(stages.managedAccessBetaInterest)}; waitlist share: ${percent(rates.managedAccessShareOfWaitlist)}`,
    `- Target-provider buckets: ${sortedEntries(managedAccessDemand.targetProviderFamily).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    `- Commercial buckets: ${sortedEntries(managedAccessDemand.commercialPreference).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    '',
    'OAuth onboarding state',
    `- GitHub enabled checks: ${integer(authState.githubEnabled)}; GitHub disabled checks: ${integer(authState.githubDisabled)}; email remains the baseline signup path until GitHub is enabled.`,
  ];
  return `${lines.join('\n')}\n`;
}

function renderLaunchBrief(data = {}) {
  const brief = buildLaunchBrief(data);
  setText('launch-brief', brief);
  setText('launch-brief-status', 'No-secret launch brief generated from aggregate funnel data.');
}

async function copyLaunchBrief() {
  const brief = $('launch-brief')?.textContent || '';
  const status = $('launch-brief-status');
  if (!brief || brief.includes('Load the funnel')) {
    if (status) status.textContent = 'Load the funnel before copying the launch brief.';
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(brief);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = brief;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    if (status) {
      status.className = 'status good';
      status.textContent = 'Copied no-secret launch brief.';
    }
  } catch (error) {
    if (status) {
      status.className = 'status bad';
      status.textContent = `Launch brief copy failed: ${error.message}`;
    }
  }
}

async function copyCampaignUrl(button) {
  const url = button.getAttribute('data-copy-campaign') || '';
  if (!url) return;
  const original = button.textContent;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    button.textContent = 'Copied';
    setStatus(`Copied campaign link: ${url}`, 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Campaign link copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

function reviewTone(severity) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'bad') return 'bad';
  if (normalized === 'warn') return 'warn';
  if (normalized === 'good') return 'good';
  return '';
}

function renderReviewFlags(review = {}, limit = 3) {
  const flags = Array.isArray(review.flags) ? review.flags : [];
  if (!flags.length) return '<span class="pill good">No review flags</span>';
  const visible = flags.slice(0, limit);
  const extra = flags.length - visible.length;
  const pills = visible.map(flag => `<span class="pill ${reviewTone(flag.severity)}">${esc(flag.label || flag.code || 'review')}</span>`);
  if (extra > 0) pills.push(`<span class="pill">+${integer(extra)}</span>`);
  return pills.join(' ');
}

function renderPlanMix(byPlan = {}) {
  const names = Object.keys(byPlan);
  if (!names.length) {
    $('plan-mix').innerHTML = '<div class="empty">No plan mix data returned.</div>';
    return;
  }
  const rows = names.sort().map((name) => {
    const plan = byPlan[name] || {};
    return `<tr>
      <td><span class="pill">${esc(name)}</span></td>
      <td>${integer(plan.paidCustomers ?? plan.currentCustomers)}</td>
      <td>${integer(plan.targetCustomers)}</td>
      <td>${integer(plan.remainingToTarget ?? plan.customerGap)}</td>
      <td>${money(plan.estimatedMrrUsd ?? plan.estimatedCurrentMrrUsd)}</td>
      <td>${money((plan.monthlyPriceUsd || 0) * (plan.targetCustomers || 0))}</td>
    </tr>`;
  }).join('');
  $('plan-mix').innerHTML = `<table>
    <thead><tr><th>Plan</th><th>Current</th><th>Target</th><th>Gap</th><th>Current MRR</th><th>Target MRR</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderRevenueActions(actions = []) {
  if (!actions.length) {
    $('revenue-actions').innerHTML = '<div class="empty">No remaining revenue actions against the launch mix.</div>';
    return;
  }
  $('revenue-actions').innerHTML = `<table>
    <thead><tr><th>Priority</th><th>Customer gap</th><th>MRR gap</th><th>Action</th></tr></thead>
    <tbody>${actions.map(row => `<tr>
      <td><span class="pill">${esc(row.plan || row.label || 'plan')}</span></td>
      <td>${integer(row.customerGap)} at ${money(row.monthlyPriceUsd)}/mo</td>
      <td>${money(row.remainingMrrToTargetUsd)}</td>
      <td>${esc(row.action || '')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderAcquisitionActions(actions = []) {
  if (!actions.length) {
    $('acquisition-actions').innerHTML = '<div class="empty">No source or channel acquisition actions returned for this window.</div>';
    return;
  }
  $('acquisition-actions').innerHTML = `<table>
    <thead><tr><th>Signal</th><th>Clicks</th><th>Priority</th><th>Action</th></tr></thead>
    <tbody>${actions.map(row => `<tr>
      <td><span class="pill">${esc(attributionLabel(row.bucket || row.kind || 'source'))}</span></td>
      <td>${integer(row.clicks)}</td>
      <td>${esc(customerActionLabel(row.priority || 'review'))}</td>
      <td>${esc(row.action || '')}${renderCampaignActions(row)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function gapLabel(row = {}) {
  if (row.metric === 'mrrTargetAttainment') return money(row.gap);
  return percent(row.gap);
}

function renderBottlenecks(rows = []) {
  if (!rows.length) {
    $('bottlenecks').innerHTML = '<div class="empty">All tracked launch targets are on track for this window.</div>';
    return;
  }
  $('bottlenecks').innerHTML = `<table>
    <thead><tr><th>Stage</th><th>Current</th><th>Target</th><th>Gap</th><th>Next action</th></tr></thead>
    <tbody>${rows.map(row => `<tr>
      <td><span class="pill">${esc(row.label || row.metric)}</span></td>
      <td>${percent(row.actualRate)}</td>
      <td>${row.targetRate == null ? '--' : percent(row.targetRate)}</td>
      <td>${gapLabel(row)}</td>
      <td>${esc(row.action || '')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function conversionActionUrl(row = {}) {
  const path = String(row.ctaPath || '/launch-plan');
  const base = path.endsWith('.html') || path.startsWith('/analytics') ? APP_BASE : MARKETING_BASE;
  return new URL(path, base).toString();
}

function conversionActionValue(row = {}) {
  if (row.metric === 'mrrTargetAttainment') return money(row.gap);
  return gapLabel(row);
}

function renderConversionActions(actions = []) {
  if (!actions.length) {
    $('conversion-actions').innerHTML = '<div class="empty">No conversion actions returned for this window.</div>';
    return;
  }
  $('conversion-actions').innerHTML = `<table>
    <thead><tr><th>Priority</th><th>Owner</th><th>Surface</th><th>Gap</th><th>Action</th><th>Success</th></tr></thead>
    <tbody>${actions.map(row => {
      const url = conversionActionUrl(row);
      return `<tr>
        <td><span class="pill ${row.priority === 'fix_now' ? 'warn' : ''}">${esc(customerActionLabel(row.priority || 'review'))}</span></td>
        <td>${esc(row.owner || 'Operator')}</td>
        <td><a class="pill" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(row.surface || row.label || 'surface')}</a></td>
        <td>${conversionActionValue(row)}</td>
        <td>${esc(row.action || '')}</td>
        <td>${esc(row.successMetric || '')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function eventLabel(name) {
  return String(name || 'unknown')
    .replace(/^openrouter_compare_/, 'openrouter ')
    .replace(/_/g, ' ');
}

function demandLabel(name) {
  return String(name || 'unknown').replace(/-/g, ' ');
}

function attributionLabel(name) {
  return String(name || 'unknown')
    .replace(/^compare-/, 'compare ')
    .replace(/-/g, ' ');
}

function sortedEntries(counts = {}) {
  return Object.entries(counts || {})
    .filter(([, count]) => asNumber(count) > 0)
    .sort((a, b) => asNumber(b[1]) - asNumber(a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function renderDemandTable(title, rows, emptyText) {
  if (!rows.length) {
    return `<div><h3>${esc(title)}</h3><div class="empty">${esc(emptyText)}</div></div>`;
  }
  return `<div>
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr><th>Bucket</th><th>Leads</th></tr></thead>
      <tbody>${rows.map(([name, count]) => `<tr><td><span class="pill">${esc(demandLabel(name))}</span></td><td>${integer(count)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderManagedAccessDemand(demand = {}) {
  const targetProviderRows = sortedEntries(demand.targetProviderFamily);
  const commercialRows = sortedEntries(demand.commercialPreference);
  const supportRows = sortedEntries(demand.supportNeed);
  const launchWindowRows = sortedEntries(demand.targetLaunchWindow);
  const intentRows = sortedEntries(demand.intent);
  if (!targetProviderRows.length && !commercialRows.length && !supportRows.length && !launchWindowRows.length && !intentRows.length) {
    $('managed-access-demand-breakdown').innerHTML = '<div class="empty">No managed-access qualification buckets returned for this window.</div>';
    return;
  }
  $('managed-access-demand-breakdown').innerHTML = `<div class="grid2">${
    renderDemandTable('Target provider family', targetProviderRows, 'No target provider demand returned.')
  }${
    renderDemandTable('Commercial preference', commercialRows, 'No commercial preference demand returned.')
  }${
    renderDemandTable('Support need', supportRows, 'No support need demand returned.')
  }${
    renderDemandTable('Target launch window', launchWindowRows, 'No target launch window demand returned.')
  }${
    renderDemandTable('Inbound intent', intentRows, 'No inbound intent demand returned.')
  }</div>`;
}

function renderMarketingIntent(marketingIntent = {}) {
  const eventRows = sortedEntries(marketingIntent.events);
  const planRows = sortedEntries(marketingIntent.plans);
  const surfaceRows = sortedEntries(marketingIntent.sourceSurfaces);
  const channelRows = sortedEntries(marketingIntent.attributionChannels);
  const modelCatalogDemand = marketingIntent.modelCatalogDemand || {};
  const modelFamilyRows = sortedEntries(modelCatalogDemand.modelFamily);
  const modelQueryRows = sortedEntries(modelCatalogDemand.queryBucket);
  const setupRows = sortedEntries(marketingIntent.setupSnippetCopiesBySnippet);
  const setupCopyCount = asNumber(marketingIntent.setupSnippetCopies);
  const setupBlock = setupCopyCount || setupRows.length ? `<div>
    <h3>Setup copies</h3>
    <table>
      <thead><tr><th>Snippet</th><th>Copies</th></tr></thead>
      <tbody><tr><td><span class="pill">Total setup copies</span></td><td>${integer(setupCopyCount)}</td></tr>${
        setupRows.map(([name, count]) => `<tr><td><span class="pill">${esc(demandLabel(name))}</span></td><td>${integer(count)}</td></tr>`).join('')
      }</tbody>
    </table>
  </div>` : '';
  const checkoutFriction = marketingIntent.checkoutFriction || {};
  const hasCheckoutFriction = asNumber(checkoutFriction.totalCheckoutIntent) > 0 || asNumber(checkoutFriction.unavailableEvents) > 0;
  const checkoutRows = hasCheckoutFriction ? [
    ['Total checkout intent', checkoutFriction.totalCheckoutIntent],
    ['Checkout unavailable', checkoutFriction.unavailableEvents],
    ['Unavailable rate', percent(checkoutFriction.unavailableRate)],
  ] : [];
  const unavailableRows = sortedEntries(checkoutFriction.unavailableByEvent);
  const checkoutBlock = checkoutRows.length || unavailableRows.length ? `<div>
    <h3>Checkout readiness</h3>
    <table>
      <thead><tr><th>Signal</th><th>Value</th></tr></thead>
      <tbody>${checkoutRows.map(([name, value]) => `<tr><td><span class="pill">${esc(name)}</span></td><td>${typeof value === 'string' ? esc(value) : integer(value)}</td></tr>`).join('')}${
        unavailableRows.map(([name, count]) => `<tr><td><span class="pill warn">${esc(eventLabel(name))}</span></td><td>${integer(count)}</td></tr>`).join('')
      }</tbody>
    </table>
  </div>` : '';
  if (!eventRows.length && !planRows.length && !surfaceRows.length && !channelRows.length && !modelFamilyRows.length && !modelQueryRows.length && !setupBlock && !checkoutBlock) {
    $('marketing-intent-breakdown').innerHTML = '<div class="empty">No anonymous marketing CTA intent events in this window.</div>';
    return;
  }
  const renderTable = (title, rows, labeler = attributionLabel) => rows.length ? `<div>
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr><th>Bucket</th><th>Clicks</th></tr></thead>
      <tbody>${rows.map(([name, count]) => `<tr><td><span class="pill">${esc(labeler(name))}</span></td><td>${integer(count)}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : '<div class="empty">No event breakdown returned.</div>';
  $('marketing-intent-breakdown').innerHTML = `<div class="grid2">${
    renderTable('Events', eventRows, eventLabel)
  }${
    renderTable('Plans', planRows)
  }${
    renderTable('Source surfaces', surfaceRows)
  }${
    renderTable('Attribution channels', channelRows)
  }${
    renderDemandTable('Model catalog families', modelFamilyRows, 'No model catalog family demand returned.')
  }${
    renderDemandTable('Catalog search buckets', modelQueryRows, 'No model catalog search demand returned.')
  }${setupBlock}${checkoutBlock}</div>`;
}

function renderAuthProviderState(authState = {}) {
  const total = asNumber(authState.total);
  if (!total) {
    $('auth-provider-state').innerHTML = '<div class="empty">No browser-visible auth provider state checks in this window.</div>';
    return;
  }
  const enabledRows = sortedEntries(authState.enabledProviders);
  const disabledRows = sortedEntries(authState.disabledProviders);
  const statusRows = [
    ['Loaded settings', authState.loaded],
    ['Unavailable settings', authState.unavailable],
    ['Unknown state', authState.unknown],
    ['GitHub enabled', authState.githubEnabled],
    ['GitHub disabled', authState.githubDisabled],
  ].filter(([, count]) => asNumber(count) > 0);
  const renderRows = (title, rows, label = (value) => value) => `<div>
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr><th>Bucket</th><th>Checks</th></tr></thead>
      <tbody>${rows.map(([name, count]) => `<tr><td><span class="pill">${esc(label(name))}</span></td><td>${integer(count)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
  $('auth-provider-state').innerHTML = `<div class="grid2">${
    renderRows('Status', statusRows)
  }${
    renderRows('Enabled providers', enabledRows, attributionLabel)
  }${
    renderRows('Disabled providers', disabledRows, attributionLabel)
  }</div>`;
}

function readinessPill(label, good) {
  return `<span class="pill ${good ? 'good' : 'warn'}">${esc(label)}</span>`;
}

function renderOperationalReadiness(health = {}, pricing = {}) {
  const upstreams = Array.isArray(health.upstreams) ? health.upstreams : [];
  const healthyRows = upstreams.filter(row => row.healthy);
  const failover = health.failover || {};
  const healthyCount = Number.isFinite(Number(failover.healthyUpstreamCount))
    ? Number(failover.healthyUpstreamCount)
    : healthyRows.length;
  const selected = upstreams.find(row => row.url === health.selected) || {};
  const enforcement = health.enforcement || {};
  const stripe = pricing.billing?.stripe || {};
  const managed = pricing.publicLaunch?.managedProviderAccess || {};
  const missingControls = Array.isArray(managed.missingControls) ? managed.missingControls : [];
  const checkoutPlans = Array.isArray(stripe.configuredPlans) ? stripe.configuredPlans : [];
  const retryEnabled = failover.retryEnabled === true;
  const quotaReady = enforcement.quotaEnabled === true && enforcement.authAttemptRateLimitEnabled === true;
  const checkoutReady = stripe.checkoutReady === true && stripe.billingPortalReady === true;
  const managedSafelyGated = managed.enabled === false && managed.readinessSatisfied !== true;
  const rows = [
    {
      title: 'Public edge',
      status: health.status === 'ok' && healthyCount > 0 ? `${healthyCount}/${upstreams.length} healthy` : 'degraded',
      ok: health.status === 'ok' && healthyCount > 0,
      detail: `${host(health.selected || selected.url || '--')} selected at ${fmtLatency(selected.latency_ms)}; retry failover ${retryEnabled ? 'enabled' : 'not reported'}.`,
    },
    {
      title: 'Customer enforcement',
      status: health.authMode === 'supabase' && quotaReady ? 'API-key gated' : 'review',
      ok: health.authMode === 'supabase' && quotaReady,
      detail: `Auth mode ${health.authMode || 'unknown'}; quotas ${enforcement.quotaEnabled ? 'enabled' : 'disabled'}; invalid key throttle ${enforcement.authAttemptRateLimitEnabled ? 'enabled' : 'disabled'}.`,
    },
    {
      title: 'Checkout',
      status: checkoutReady ? 'self-serve ready' : 'manual fallback',
      ok: checkoutReady,
      detail: checkoutReady
        ? `Stripe checkout and portal are ready for ${checkoutPlans.join(', ') || 'configured plans'}.`
        : 'Use manual settlement or billing support until Stripe checkout and portal metadata are ready.',
    },
    {
      title: 'Managed provider access',
      status: managed.enabled ? 'enabled' : 'gated',
      ok: managedSafelyGated,
      detail: managedSafelyGated
        ? `Public resale remains disabled; missing controls: ${missingControls.slice(0, 4).join(', ') || 'not reported'}.`
        : 'Review provider terms, margin, quota, and abuse controls before marketing bundled provider access.',
    },
  ];
  $('operational-readiness').innerHTML = rows.map(row => `<article>
    <div class="metric"><span>${esc(row.title)}</span><strong>${readinessPill(row.status, row.ok)}</strong></div>
    <p class="muted">${esc(row.detail)}</p>
  </article>`).join('');
}

async function fetchOperationalReadiness() {
  const target = $('operational-readiness');
  if (!target) return;
  target.innerHTML = '<div class="empty">Loading live operational readiness...</div>';
  try {
    const [healthResponse, pricingResponse] = await Promise.all([
      fetch(`${API_BASE}/edge/health`, { cache: 'no-store' }),
      fetch(`${API_BASE}/pricing`, { cache: 'no-store' }),
    ]);
    const health = await healthResponse.json().catch(() => ({}));
    const pricing = await pricingResponse.json().catch(() => ({}));
    if (!healthResponse.ok) throw new Error(health.error || `edge health HTTP ${healthResponse.status}`);
    if (!pricingResponse.ok) throw new Error(pricing.error || `pricing HTTP ${pricingResponse.status}`);
    renderOperationalReadiness(health, pricing);
  } catch (error) {
    target.innerHTML = `<div class="empty">Operational readiness unavailable: ${esc(error.message)}</div>`;
  }
}

function renderFunnel(data) {
  const stages = data.stages || {};
  const rates = data.rates || {};
  const mrr = data.mrr || {};
  const waitlistInterest = data.waitlistInterest || {};
  const marketingIntent = data.marketingIntent || {};
  const managedAccessDemand = data.managedAccessDemand || {};
  const privacy = data.privacy || {};

  setText('kpi-marketing-intent', integer(stages.marketingIntentEvents ?? marketingIntent.total));
  setText('kpi-waitlist', integer(stages.waitlistLeads));
  setText('kpi-managed-access', integer(stages.managedAccessBetaInterest ?? waitlistInterest.managedAccess));
  setText('kpi-signups', integer(stages.signups));
  setText('kpi-mrr', money(mrr.estimatedCurrentMrrUsd));

  setText('metric-generated-keys', integer(stages.customersWithGeneratedApiKeys ?? stages.generatedApiKeys));
  setText('metric-setup-copies', integer(stages.setupSnippetCopies ?? marketingIntent.setupSnippetCopies));
  setText('metric-first-request', integer(stages.customersWithFirstRoutedRequest ?? stages.firstRoutedRequest));
  setText('metric-paid-conversions', integer(stages.paidConversions));
  setText('metric-paid-customers', integer(stages.paidCustomers));
  setText('metric-retained-paid', integer(stages.retainedPaidCustomers ?? stages.retainedPaidWithUsage));
  setText('metric-key-to-first', percent(rates.generatedKeyToFirstRequest));
  setText('metric-copy-to-first', percent(rates.setupCopyToFirstRequest));
  setText('metric-marketing-intent', integer(stages.marketingIntentEvents ?? marketingIntent.total));
  setText('metric-target-mrr', money(mrr.targetMrrUsd));
  setText('metric-attainment', percent(mrr.targetAttainment));
  setText('metric-mrr-gap', money(Math.max(0, asNumber(mrr.targetMrrUsd) - asNumber(mrr.estimatedCurrentMrrUsd))));
  setText('metric-managed-share', percent(rates.managedAccessShareOfWaitlist));
  setText('metric-privacy', privacyLabel(privacy));
  setText('metric-generated-at', data.generatedAt ? new Date(data.generatedAt * 1000).toLocaleString() : '--');

  const privacyEl = $('metric-privacy');
  privacyEl.className = privacy.containsEmails === false && privacy.containsApiKeys === false ? 'pill good' : 'pill bad';

  renderBottlenecks(data.bottlenecks || []);
  renderConversionActions(data.conversionActions || []);
  renderMarketingIntent(marketingIntent);
  renderAuthProviderState(marketingIntent.authProviderState || {});
  renderAcquisitionActions(data.acquisitionActions || marketingIntent.acquisitionActions || []);
  renderManagedAccessDemand(managedAccessDemand);
  renderPlanMix(mrr.byPlan || {});
  renderRevenueActions(mrr.planRevenueActions || []);
  renderLaunchBrief(data);
  $('dashboard').classList.remove('hidden');
  fetchOperationalReadiness();
}

function renderApiKeys(keys = []) {
  if (!keys.length) return '<div class="empty">No generated API keys on this account.</div>';
  return `<div class="tableWrap"><table>
    <thead><tr><th>Name</th><th>Prefix</th><th>Status</th><th>Routing</th><th>Created</th><th>Last used</th></tr></thead>
    <tbody>${keys.map(key => `<tr>
      <td>${esc(key.name || 'Default')}</td>
      <td><span class="pill">${esc(key.prefix || '--')}</span></td>
      <td><span class="pill ${statusTone(key.status)}">${esc(key.status || 'active')}</span></td>
      <td>${key.routing_enabled ? '<span class="good">enabled</span>' : '<span class="warn">blocked</span>'}</td>
      <td>${formatDate(key.created_at_epoch)}</td>
      <td>${formatDate(key.last_used_at_epoch)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function auditActionLabel(action) {
  const labels = {
    'customer.suspend': 'Suspended',
    'customer.unsuspend': 'Unsuspended',
  };
  return labels[action] || action || 'Operator action';
}

function renderAuditEvents(events = []) {
  if (!events.length) return '<div class="empty">No operator audit events recorded for this customer.</div>';
  return `<div class="tableWrap"><table>
    <thead><tr><th>Time</th><th>Action</th><th>Reason</th><th>Status change</th><th>Keys revoked</th></tr></thead>
    <tbody>${events.map(event => `<tr>
      <td>${formatDate(event.created_at_epoch)}</td>
      <td>${esc(auditActionLabel(event.action))}</td>
      <td><span class="pill">${esc(event.reason_code || 'operator_review')}</span></td>
      <td>${esc(event.status_before || '--')} -> ${esc(event.status_after || '--')}</td>
      <td>${integer(event.revoked_api_keys_count)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderCustomerDetail(summary = {}) {
  const customer = summary.customer || {};
  const activation = summary.activation || {};
  const usage = summary.usage || {};
  const status = customer.status || activation.status || 'inactive';
  const isSuspended = status === 'suspended';
  $('customer-detail').classList.remove('hidden');
  $('customer-detail').innerHTML = `
    <h3>${esc(customerLabel(summary))}</h3>
    <div class="grid2">
      <div class="metricList">
        <div class="metric"><span>Customer ID</span><strong>${esc(customer.id || '--')}</strong></div>
        <div class="metric"><span>Plan</span><strong>${esc(customer.plan || activation.plan || 'free')}</strong></div>
        <div class="metric"><span>Status</span><strong><span class="pill ${statusTone(status)}">${esc(status)}</span></strong></div>
        <div class="metric"><span>Next action</span><strong>${esc(customerActionLabel(activation.nextAction))}</strong></div>
      </div>
      <div class="metricList">
        <div class="metric"><span>Review</span><strong>${renderReviewFlags(summary.review || {}, 5)}</strong></div>
        <div class="metric"><span>Usage</span><strong>${esc(usageLabel(summary))}</strong></div>
        <div class="metric"><span>Active keys</span><strong>${integer(activation.activeKeyCount)}</strong></div>
        <div class="metric"><span>Routing</span><strong>${activation.routingEnabled ? '<span class="good">enabled</span>' : '<span class="warn">blocked</span>'}</strong></div>
        <div class="metric"><span>Updated</span><strong>${formatDate(customer.updated_at_epoch)}</strong></div>
      </div>
    </div>
    <div class="actions" style="margin:14px 0">
      <button class="btn danger" type="button" data-customer-action="suspend" data-customer-id="${esc(customer.id || '')}" ${isSuspended ? 'disabled' : ''}>Suspend</button>
      <button class="btn secondary" type="button" data-customer-action="unsuspend" data-customer-id="${esc(customer.id || '')}" ${isSuspended ? '' : 'disabled'}>Unsuspend inactive</button>
      <button class="btn secondary" type="button" data-customer-action="unsuspend-active" data-customer-id="${esc(customer.id || '')}" ${isSuspended ? '' : 'disabled'}>Unsuspend active</button>
    </div>
    <h4>Operator audit</h4>
    ${renderAuditEvents(summary.auditEvents || [])}
    <h4>Generated API keys</h4>
    ${renderApiKeys(summary.api_keys || [])}`;
}

function renderCustomers(data = {}) {
  const customers = data.customers || [];
  const privacy = data.privacy || {};
  const omitsApiKeyHashes = privacy.containsApiKeyHashes === false;
  const omitsRawApiKeys = privacy.containsRawApiKeys === false;
  const privacyTone = omitsApiKeyHashes && omitsRawApiKeys ? 'good' : 'bad';
  if (!customers.length) {
    $('customers').innerHTML = `<div class="empty">No matching customers. <span class="pill ${privacyTone}">${esc(customerPrivacyLabel(privacy))}</span></div>`;
    return;
  }
  $('customers').innerHTML = `<div class="tableWrap"><table>
    <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Review</th><th>Usage</th><th>Keys</th><th>Next action</th><th>Updated</th><th></th></tr></thead>
    <tbody>${customers.map(summary => {
      const customer = summary.customer || {};
      const activation = summary.activation || {};
      const status = customer.status || activation.status || 'inactive';
      return `<tr>
        <td>${esc(customerLabel(summary))}<br><span class="muted">${esc(customer.id || '')}</span></td>
        <td>${esc(customer.plan || activation.plan || 'free')}</td>
        <td><span class="pill ${statusTone(status)}">${esc(status)}</span></td>
        <td>${renderReviewFlags(summary.review || {})}</td>
        <td>${esc(usageLabel(summary))}</td>
        <td>${integer(activation.activeKeyCount)} active / ${integer(activation.keyCount)} total</td>
        <td>${esc(customerActionLabel(activation.nextAction))}</td>
        <td>${formatDate(customer.updated_at_epoch)}</td>
        <td><button class="btn secondary" type="button" data-customer-action="detail" data-customer-id="${esc(customer.id || '')}">Review</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <p><span class="pill ${privacyTone}">${esc(customerPrivacyLabel(privacy))}</span></p>`;
}

async function fetchFunnel(event) {
  event?.preventDefault();
  const token = operatorToken();
  const days = $('days').value || '30';
  if (!token) {
    setStatus('Operator token is required.', 'bad');
    return;
  }

  rememberTokenIfRequested(token);
  $('refresh').disabled = true;
  setStatus('Loading launch funnel...');

  try {
    const response = await fetch(`${API_BASE}/analytics/funnel?days=${encodeURIComponent(days)}`, {
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderFunnel(data);
    setStatus(`Loaded ${days}-day launch funnel from ${API_BASE}.`, 'good');
  } catch (error) {
    setStatus(`Funnel load failed: ${error.message}`, 'bad');
  } finally {
    $('refresh').disabled = false;
  }
}

async function fetchCustomers(event) {
  event?.preventDefault();
  const token = operatorToken();
  if (!token) {
    setCustomerStatus('Operator token is required.', 'bad');
    return;
  }
  rememberTokenIfRequested(token);
  $('load-customers').disabled = true;
  setCustomerStatus('Loading customer review...');
  const params = new URLSearchParams();
  const query = $('customer-query').value.trim();
  const status = $('customer-status').value.trim();
  const limit = $('customer-limit').value || '25';
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  params.set('limit', limit);
  try {
    const response = await fetch(`${API_BASE}/admin/customers?${params.toString()}`, {
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderCustomers(data);
    setCustomerStatus(`Loaded ${integer(data.count)} matching customer records.`, 'good');
  } catch (error) {
    setCustomerStatus(`Customer review failed: ${error.message}`, 'bad');
  } finally {
    $('load-customers').disabled = false;
  }
}

async function fetchCustomerDetail(customerId) {
  const token = operatorToken();
  if (!token || !customerId) {
    setCustomerStatus('Operator token and customer ID are required.', 'bad');
    return;
  }
  setCustomerStatus('Loading customer detail...');
  try {
    const response = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}`, {
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderCustomerDetail(data);
    setCustomerStatus('Loaded bounded customer detail.', 'good');
  } catch (error) {
    setCustomerStatus(`Customer detail failed: ${error.message}`, 'bad');
  }
}

async function postCustomerAction(customerId, action) {
  const token = operatorToken();
  if (!token || !customerId) {
    setCustomerStatus('Operator token and customer ID are required.', 'bad');
    return;
  }
  const endpointAction = action === 'unsuspend-active' ? 'unsuspend' : action;
  const body = {
    reasonCode: 'operator_review',
    ...(action === 'unsuspend-active' ? { status: 'active' } : {}),
  };
  if (action === 'suspend' && !confirm('Suspend this customer and revoke active generated API keys?')) {
    return;
  }
  setCustomerStatus(`${customerActionLabel(action)} in progress...`);
  try {
    const response = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}/${endpointAction}`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const revokedApiKeysRemainRevoked = data.revokedApiKeysRemainRevoked === true;
    const suffix = revokedApiKeysRemainRevoked ? ' Revoked API keys remain revoked.' : '';
    await fetchCustomerDetail(customerId);
    await fetchCustomers();
    setCustomerStatus(`${customerActionLabel(action)} complete.${suffix}`, 'good');
  } catch (error) {
    setCustomerStatus(`${customerActionLabel(action)} failed: ${error.message}`, 'bad');
  }
}

function clearToken() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  $('operator-token').value = '';
  $('remember-token').checked = false;
  setStatus('Operator token cleared for this tab.');
  setCustomerStatus('Operator token cleared for this tab.');
}

function clearCustomerSearch() {
  $('customer-query').value = '';
  $('customer-status').value = '';
  $('customer-limit').value = '25';
  $('customers').innerHTML = '';
  $('customer-detail').classList.add('hidden');
  setCustomerStatus('Customer search cleared.');
}

function handleCustomerClick(event) {
  const button = event.target.closest('[data-customer-action]');
  if (!button) return;
  const customerId = button.getAttribute('data-customer-id');
  const action = button.getAttribute('data-customer-action');
  if (action === 'detail') {
    fetchCustomerDetail(customerId);
    return;
  }
  postCustomerAction(customerId, action);
}

function handleCampaignCopyClick(event) {
  const button = event.target.closest('[data-copy-campaign]');
  if (!button) return;
  copyCampaignUrl(button);
}

document.addEventListener('DOMContentLoaded', () => {
  loadRememberedToken();
  $('controls').addEventListener('submit', fetchFunnel);
  $('clear-token').addEventListener('click', clearToken);
  $('customer-controls').addEventListener('submit', fetchCustomers);
  $('clear-customer-search').addEventListener('click', clearCustomerSearch);
  $('customers').addEventListener('click', handleCustomerClick);
  $('customer-detail').addEventListener('click', handleCustomerClick);
  $('acquisition-actions').addEventListener('click', handleCampaignCopyClick);
  $('copy-launch-brief').addEventListener('click', copyLaunchBrief);
  if ($('operator-token').value) {
    fetchFunnel();
  }
});
