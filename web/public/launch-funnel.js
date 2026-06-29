const API_BASE = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
const MARKETING_BASE = window.SAGE_ROUTER_MARKETING_URL || 'https://sagerouter.dev';
const APP_BASE = window.SAGE_ROUTER_APP_URL || window.location.origin;
const SESSION_TOKEN_KEY = 'sage_router_operator_launch_funnel_token';
const FOLLOWUP_DRAFT_ACTION_PREFIX = 'sage_router_operator_no_key_followup_draft';
const ACTIVATION_FOLLOWUP_SEND_CONFIRMATION = 'SEND_ACTIVATION_FOLLOWUPS';
const AUTH_LINK_REPAIR_CONFIRMATION = 'REPAIR_AUTH_LINKS';
const ACTIVATION_FOLLOWUP_TYPED_APPROVAL_PROMPT = `Type ${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION} to send real activation follow-up emails.`;
const OPERATOR_TOKEN_COMMAND = [
  "python3 - <<'PY'",
  "import os, subprocess",
  "from pathlib import Path",
  "env_paths = (Path('/home/digit/.openclaw/.env'), Path('.env'), Path('deploy/tailnet-edge/.env'))",
  "values = {}",
  "for path in env_paths:",
  "    if not path.exists():",
  "        continue",
  "    for raw in path.read_text(errors='ignore').splitlines():",
  "        line = raw.strip()",
  "        if not line or line.startswith('#') or '=' not in line:",
  "            continue",
  "        if line.startswith('export '):",
  "            line = line[7:].strip()",
  "        name, value = line.split('=', 1)",
  "        values.setdefault(name.strip(), value.strip().strip('\"').strip(\"'\"))",
  "for name in ('SAGE_ROUTER_API_KEY', 'SAGE_ROUTER_EDGE_TOKEN', 'SAGE_ROUTER_OPERATOR_TOKEN'):",
  "    token = (os.environ.get(name) or values.get(name) or '').split(',')[0].strip()",
  "    if token:",
  "        print(token)",
  "        raise SystemExit(0)",
  "project = os.environ.get('SAGE_ROUTER_GCP_PROJECT_ID') or os.environ.get('GOOGLE_CLOUD_PROJECT') or 'sacred-result-442018-v2'",
  "for secret in ('SAGE_ROUTER_API_KEY', 'SAGE_ROUTER_EDGE_TOKEN', 'SAGE_ROUTER_CLIENT_API_KEYS'):",
  "    try:",
  "        raw = subprocess.check_output(['gcloud', 'secrets', 'versions', 'access', 'latest', '--secret', secret, '--project', project], stderr=subprocess.DEVNULL, text=True, timeout=20)",
  "    except Exception:",
  "        continue",
  "    token = raw.strip().split(',')[0].strip()",
  "    if token:",
  "        print(token)",
  "        raise SystemExit(0)",
  "raise SystemExit('No admin token found. Set SAGE_ROUTER_API_KEY or SAGE_ROUTER_EDGE_TOKEN, then retry.')",
  "PY",
].join('\n');
let lastFunnelData = null;
let lastCustomerData = null;

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

function upstreamId(row = {}) {
  return row.id || row.url || '';
}

function upstreamLabel(row = {}, fallback = 'unknown') {
  return row.label || (row.url ? host(row.url) : '') || row.id || fallback;
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

function followUpSegmentActionKey(plan = 'pro', segment = 'all') {
  return `${FOLLOWUP_DRAFT_ACTION_PREFIX}:${String(plan || 'pro').toLowerCase()}:${String(segment || 'all').toLowerCase()}`;
}

function followUpSegmentDraftReady(plan = 'pro', segment = 'all') {
  try {
    return window.sessionStorage.getItem(followUpSegmentActionKey(plan, segment)) === '1';
  } catch (_error) {
    return false;
  }
}

function updateFollowUpWorkedButtons(plan = 'pro', segment = 'all') {
  const ready = followUpSegmentDraftReady(plan, segment);
  document.querySelectorAll('[data-mark-followup-worked]').forEach(button => {
    if ((button.getAttribute('data-mark-followup-worked') || 'all') !== segment) return;
    if ((button.getAttribute('data-followup-plan') || 'pro') !== plan) return;
    button.disabled = !ready;
    button.setAttribute('data-followup-draft-ready', ready ? '1' : '0');
    button.title = ready ? 'Mark worked only after real outreach was sent.' : `Copy or open the ${segment} draft first.`;
  });
}

function markFollowUpSegmentDraftAction(button, action = 'draft_opened') {
  const segment = button.getAttribute('data-followup-segment') || button.getAttribute('data-email-followup-batch') || button.getAttribute('data-email-followup-single') || 'all';
  const plan = button.getAttribute('data-followup-plan') || 'pro';
  try {
    window.sessionStorage.setItem(followUpSegmentActionKey(plan, segment), '1');
  } catch (_error) {}
  button.setAttribute('data-followup-draft-ready', '1');
  button.setAttribute('data-followup-draft-action', action);
  updateFollowUpWorkedButtons(plan, segment);
}

function trackOperatorFunnelEvent(event, metadata = {}) {
  const payload = {
    event,
    plan: metadata.plan || 'pro',
    sourcePage: window.location.href,
    target: metadata.target || `${APP_BASE.replace(/\/$/, '')}/account.html`,
    metadata: {
      sourceSurface: 'launch-plan',
      source: 'operator-launch-funnel',
      snippet: metadata.snippet || 'no-key-followup',
      state: metadata.state || 'copied',
      resultCount: metadata.resultCount || 1,
      utmSource: 'operator',
      utmMedium: 'launch_funnel',
      utmCampaign: 'signup_to_key_recovery',
    },
  };
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/funnel-event', blob)) return;
    }
  } catch (_error) {
    // Fall through to fetch.
  }
  fetch('/api/funnel-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
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

function retryNoKeyFollowUpsAfterTokenPaste() {
  const token = operatorToken();
  if (!token || !lastFunnelData) return;
  rememberTokenIfRequested(token);
  setStatus('Operator token updated; retrying no-key follow-ups...');
  fetchNoKeyFollowUps(token);
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

function contactExportPrivacyLabel(privacy = {}) {
  const bounded = privacy.operatorOnly === true &&
    privacy.explicitContactExport === true &&
    privacy.containsEmails === true &&
    privacy.containsCustomerIds === false &&
    privacy.containsRawApiKeys === false &&
    privacy.containsApiKeyHashes === false &&
    privacy.containsProviderCredentials === false &&
    privacy.containsPrompts === false;
  return bounded ? 'Explicit email export' : 'Review contact payload';
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

function bucketCountsLabel(counts = {}) {
  const entries = Object.entries(counts || {})
    .filter(([, count]) => Number(count || 0) > 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (!entries.length) return 'none';
  return entries.map(([key, count]) => `${String(key).replace(/_/g, ' ')} ${integer(count)}`).join(' · ');
}

function selectedActivationPlan(summary = {}) {
  const customer = summary.customer || {};
  const activation = summary.activation || {};
  const followUp = summary.followUp || activation.followUp || {};
  const plan = String(customer.plan || activation.plan || '').toLowerCase();
  const suggestedPlan = String(followUp.suggestedPlan || '').toLowerCase();
  if (['lite', 'pro', 'max'].includes(plan)) return plan;
  return ['lite', 'pro', 'max'].includes(suggestedPlan) ? suggestedPlan : 'pro';
}

function activationFollowUpUrl(summary = {}, options = {}) {
  const activation = summary.activation || {};
  const followUp = summary.followUp || activation.followUp || {};
  if (options.recovery === true && (followUp.setupKeyRecovery || followUp.primaryCtaUrl)) {
    return followUp.setupKeyRecovery || followUp.primaryCtaUrl;
  }
  if (options.auth === false && (followUp.passwordFallback || followUp.primaryCtaUrl)) {
    return followUp.passwordFallback || followUp.primaryCtaUrl;
  }
  if (options.auth !== false && (followUp.githubOAuth || followUp.oauth || followUp.primaryCtaUrl)) {
    return followUp.githubOAuth || followUp.oauth || followUp.primaryCtaUrl;
  }
  if (options.recovery === true) {
    const recoveryUrl = new URL('/setup-key-recovery', MARKETING_BASE);
    recoveryUrl.searchParams.set('plan', selectedActivationPlan(summary));
    recoveryUrl.searchParams.set('utm_source', 'operator');
    recoveryUrl.searchParams.set('utm_medium', 'launch_funnel');
    recoveryUrl.searchParams.set('utm_campaign', 'signup_to_key_recovery');
    recoveryUrl.searchParams.set('source_surface', 'operator_activation');
    return recoveryUrl.toString();
  }
  const url = new URL(options.auth === false ? '/login.html' : '/account.html', APP_BASE);
  url.searchParams.set('start', 'create_key');
  url.searchParams.set('plan', selectedActivationPlan(summary));
  url.searchParams.set('auth', options.auth === false ? 'email' : (options.auth || 'github'));
  url.searchParams.set('utm_source', 'operator');
  url.searchParams.set('utm_medium', 'launch_funnel');
  url.searchParams.set('utm_campaign', 'signup_to_key_recovery');
  return url.toString();
}

function primaryFollowUpLinkSet(plan = 'pro', urls = {}) {
  const summary = { activation: { plan } };
  const setupUrl = urls.setupKeyRecovery || urls.primaryCtaUrl || activationFollowUpUrl(summary, { recovery: true });
  const githubUrl = urls.githubOAuth || urls.github || activationFollowUpUrl(summary);
  const passwordUrl = urls.passwordFallback || urls.emailPassword || activationFollowUpUrl(summary, { auth: false });
  return [
    'Sage Router setup-key recovery links',
    '',
    `Start here: ${setupUrl}`,
    `Same-email magic link/password fallback: ${passwordUrl}`,
    `GitHub/OAuth, only if it is the same account: ${githubUrl}`,
    '',
    'Start with setup-key recovery to avoid creating a second no-key account.',
  ].join('\n');
}

function aggregateFollowUpSubject(segment = 'all') {
  return segment === 'unverified'
    ? 'Verify email, then finish your Sage Router setup key'
    : 'Finish your Sage Router setup key';
}

function aggregateFollowUpDraft(plan = 'pro', urls = {}, options = {}) {
  const segment = String(options.segment || 'all').toLowerCase();
  const linkSet = primaryFollowUpLinkSet(plan, urls);
  return [
    `Subject: ${aggregateFollowUpSubject(segment)}`,
    '',
    segment === 'unverified'
      ? 'You already started Sage Router setup, but email verification and the hosted API key step are not complete yet.'
      : 'You already started Sage Router setup, but the hosted API key step is not complete yet.',
    '',
    segment === 'unverified'
      ? 'Next step: use the same email you signed up with, verify it if prompted, then create the generated sk_sage setup key before checkout or routing setup:'
      : 'Next step: use the same email you signed up with, then create the generated sk_sage setup key before checkout or routing setup:',
    '',
    linkSet,
    '',
    `Suggested path: ${String(plan || 'pro').toUpperCase()} activation -> generated key -> /v1/models verification -> first Responses API request.`,
    '',
    'Boundary: do not send prompts, provider credentials, OAuth tokens, generated API keys, private keys, cookies, or raw provider responses.',
  ].join('\n');
}

function aggregateFollowUpMailtoUrl(plan = 'pro', urls = {}, options = {}) {
  const segment = String(options.segment || 'all').toLowerCase();
  const body = aggregateFollowUpDraft(plan, urls, { segment }).replace(/^Subject:.*\n\n/, '');
  const params = new URLSearchParams({
    subject: aggregateFollowUpSubject(segment),
    body,
  });
  return `mailto:?${params.toString()}`;
}

function aggregateNoKeySegments(counts = {}, total = 0) {
  const verified = Number(counts.verified || 0);
  const unverified = Number(counts.unverified || 0);
  const segments = [];
  if (verified > 0) segments.push(['verified', 'verified aggregate draft', verified]);
  if (unverified > 0) segments.push(['unverified', 'unverified aggregate draft', unverified]);
  if (!segments.length && Number(total || 0) > 0) segments.push(['all', 'all aggregate drafts', Number(total || 0)]);
  return segments;
}

function renderAggregateNoKeySegmentControls({ counts = {}, total = 0, plan = 'pro', urls = {} } = {}) {
  return aggregateNoKeySegments(counts, total).map(([segment, label, count], idx) => {
    const draft = aggregateFollowUpDraft(plan, urls, { segment });
    const linkSet = primaryFollowUpLinkSet(plan, urls);
    const mailto = aggregateFollowUpMailtoUrl(plan, urls, { segment });
    const draftReady = followUpSegmentDraftReady(plan, segment);
    const draftFirst = draftReady ? '' : ' disabled';
    const step = idx + 1;
    return `<a class="btn small" href="${esc(mailto)}" data-email-followup-batch="${esc(segment)}" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Open ${step}. ${esc(label)} (${integer(count)})</a><button class="btn secondary small" type="button" data-copy-primary-followup-url="${esc(urls.setupKeyRecovery || urls.primaryCtaUrl || urls.passwordFallback || '')}" data-copy-primary-followup-text="${esc(draft)}" data-followup-copy-kind="${esc(segment)}_aggregate_draft_copied" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Copy ${esc(label)}</button><button class="btn secondary small" type="button" data-copy-primary-followup-url="${esc(urls.setupKeyRecovery || urls.primaryCtaUrl || urls.githubOAuth || '')}" data-copy-primary-followup-text="${esc(linkSet)}" data-followup-copy-kind="${esc(segment)}_aggregate_links_copied" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Copy ${esc(segment)} links</button><button class="btn small" type="button" data-mark-followup-worked="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}" data-followup-draft-ready="${draftReady ? '1' : '0'}" title="${draftReady ? 'Mark worked only after real outreach was sent.' : `Copy or open the ${esc(segment)} aggregate draft first.`}"${draftFirst}>Mark ${esc(segment)} worked</button>`;
  }).join('');
}

function activationFollowUpText(summary = {}) {
  const plan = selectedActivationPlan(summary);
  const emailState = summary.emailVerification || {};
  const emailUnverified = emailState.required !== false && emailState.verified === false;
  const subject = emailUnverified
    ? 'Subject: Verify email, then finish your Sage Router setup key'
    : 'Subject: Finish your Sage Router setup key';
  const firstStep = emailUnverified
    ? 'Next step: open this same-email recovery link, finish email verification if prompted, then create the generated sk_sage key before checkout or routing setup:'
    : 'Next step: open this same-email recovery link. It is set to create the generated sk_sage key first; checkout can happen after the setup key exists:';
  return [
    subject,
    '',
    'You are signed in, but the hosted API key step is not complete yet.',
    '',
    firstStep,
    activationFollowUpUrl(summary, { recovery: true }),
    '',
    'If that recovery page does not open the existing account, use the same-email login fallback:',
    activationFollowUpUrl(summary, { auth: false }),
    '',
    'Use GitHub/OAuth only if it is the same account you used before:',
    activationFollowUpUrl(summary),
    '',
    `Suggested path: ${plan.toUpperCase()} activation -> generated key -> /v1/models verification -> first Responses API request.`,
    '',
    'Do not send prompts, provider credentials, OAuth tokens, generated API keys, private keys, cookies, or raw provider responses in support replies.',
  ].join('\n');
}

function activationFollowUpUrlList(customers = [], segment = 'all') {
  const followUps = noKeyFollowUpCandidates(customers).filter(summary => {
    if (!segment || segment === 'all') return true;
    return emailVerificationSegment(summary) === segment;
  });
  if (!followUps.length) return '';
  return followUps.map((summary, idx) => {
    const customer = summary.customer || {};
    const recipient = String(customer.email || '').trim() || customerLabel(summary);
    return [
      `${idx + 1}. ${recipient}`,
      `Setup-key recovery: ${activationFollowUpUrl(summary, { recovery: true })}`,
      `Same-email magic link/password fallback: ${activationFollowUpUrl(summary, { auth: false })}`,
      `GitHub/OAuth, only if same account: ${activationFollowUpUrl(summary)}`,
    ].join('\n');
  }).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}

function activationFollowUpCsv(customers = [], segment = 'all') {
  const followUps = noKeyFollowUpCandidates(customers).filter(summary => {
    if (!segment || segment === 'all') return true;
    return emailVerificationSegment(summary) === segment;
  });
  const rows = [[
    'email',
    'segment',
    'plan',
    'next_action',
    'same_email_recovery_url',
    'github_oauth_url',
    'subject',
  ]];
  followUps.forEach(summary => {
    const customer = summary.customer || {};
    const activation = summary.activation || {};
    rows.push([
      customer.email || '',
      emailVerificationSegment(summary),
      selectedActivationPlan(summary),
      activation.nextAction || 'create_key',
      activationFollowUpUrl(summary, { auth: false }),
      activationFollowUpUrl(summary),
      (summary.emailVerification || {}).verified === false
        ? 'Verify email, then finish your Sage Router setup key'
        : 'Finish your Sage Router setup key',
    ]);
  });
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

function emailVerificationLabel(summary = {}) {
  const state = summary.emailVerification || {};
  if (state.required === false) return 'email verification not required';
  if (state.source === 'unavailable') return 'email verification unavailable';
  if (state.source === 'missing_user_id') return 'missing auth user link';
  if (state.source === 'missing_auth_user') return 'auth user missing';
  return state.verified ? 'email verified' : 'email unverified';
}

function emailVerificationSegment(summary = {}) {
  const state = summary.emailVerification || {};
  if (state.required === false) return 'not-required';
  if (state.verified === true) return 'verified';
  if (state.source === 'unavailable') return 'verification-unavailable';
  return 'unverified';
}

function noKeyFollowUpMode() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  if (!hash.startsWith('no-key-followups')) return '';
  const [, mode] = hash.split(':', 2);
  return mode || 'all';
}

function activationFollowUpBatchText(customers = [], segment = 'all') {
  const followUps = noKeyFollowUpCandidates(customers).filter(summary => {
    if (!segment || segment === 'all') return true;
    return emailVerificationSegment(summary) === segment;
  });
  if (!followUps.length) return '';
  const segmentLabel = segment && segment !== 'all' ? ` (${segment})` : '';
  return [
    `Sage Router no-key signup follow-up batch${segmentLabel}`,
    'Boundary: Operator-only. Do not paste prompts, provider credentials, OAuth tokens, generated API keys, private keys, cookies, or raw provider responses.',
    '',
    ...followUps.flatMap((summary, idx) => {
      const customer = summary.customer || {};
      const recipient = String(customer.email || '').trim() || customerLabel(summary);
      return [
        `--- Follow-up ${idx + 1}: ${recipient} ---`,
        activationFollowUpText(summary),
        '',
      ];
    }),
  ].join('\n');
}

function mailtoFollowUpUrl(summary = {}) {
  const customer = summary.customer || {};
  const email = String(customer.email || '').trim();
  const subject = 'Finish your Sage Router setup key';
  const body = activationFollowUpText(summary).replace(/^Subject:.*\n\n/, '');
  const url = new URL(`mailto:${email}`);
  url.searchParams.set('subject', subject);
  url.searchParams.set('body', body);
  return url.toString();
}

function mailtoBatchFollowUpUrl(customers = [], segment = 'all') {
  const followUps = noKeyFollowUpCandidates(customers).filter(summary => {
    if (!segment || segment === 'all') return true;
    return emailVerificationSegment(summary) === segment;
  });
  const emails = followUps
    .map(summary => String((summary.customer || {}).email || '').trim())
    .filter(Boolean);
  if (!emails.length) return '';
  const sample = followUps[0] || {};
  const unverified = segment === 'unverified';
  const subject = unverified
    ? 'Verify email, then finish your Sage Router setup key'
    : 'Finish your Sage Router setup key';
  const body = [
    unverified
      ? 'You are signed in, but email verification and hosted API key creation are not complete yet.'
      : 'You are signed in, but the hosted API key step is not complete yet.',
    '',
    unverified
      ? 'Next step: open this same-email recovery link, finish email verification if prompted, then create the generated sk_sage key before checkout or routing setup:'
      : 'Next step: open this same-email recovery link. It is set to create the generated sk_sage key first; checkout can happen after the setup key exists:',
    activationFollowUpUrl(sample, { auth: false }),
    'Use GitHub/OAuth only if it is the same account you used before:',
    activationFollowUpUrl(sample),
    '',
    `Suggested path: ${selectedActivationPlan(sample).toUpperCase()} activation -> generated key -> /v1/models verification -> first Responses API request.`,
    '',
    'Do not send prompts, provider credentials, OAuth tokens, generated API keys, private keys, cookies, or raw provider responses in support replies.',
  ].join('\n');
  const params = new URLSearchParams({
    bcc: emails.join(','),
    subject,
    body,
  });
  return `mailto:?${params.toString()}`;
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
      'compare-gateways': ['/compare/model-gateways', 'model-gateway', 'founder', 'launch_gateway_migration'],
      'managed-access': ['/managed-access', 'operator', 'launch_funnel', 'managed_access_beta'],
      'launch-plan': ['/launch-plan', 'operator', 'launch_funnel', 'founder_sales'],
      landing: ['/', 'operator', 'launch_funnel', 'homepage_activation'],
      account: ['/account.html', 'operator', 'launch_funnel', 'account_activation'],
      login: ['/login.html', 'operator', 'launch_funnel', 'signup_onboarding'],
      billing: ['/billing.html', 'operator', 'launch_funnel', 'billing_recovery'],
    },
    attributionChannel: {
      'model-gateway': ['/compare/model-gateways', 'model-gateway', 'founder', 'launch_gateway_migration'],
      github: ['/quickstart', 'github', 'readme', 'launch_builder_quickstart'],
      google: ['/quickstart', 'google', 'search', 'launch_search_router'],
      discord: ['/support', 'discord', 'community', 'launch_founder_activation'],
      reddit: ['/compare/model-gateways', 'reddit', 'community', 'launch_comparison_threads'],
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

function activationDeliveryCounts(data = {}) {
  const followUps = data.activationFollowUps || {};
  const packet = data.operatorExecutionPacket || {};
  const evidence = data.nextBestAction?.evidence || {};
  const sendableQueued = Number(
    packet.sendableQueued ??
    followUps.sendableQueued ??
    evidence.sendableQueued ??
    0
  );
  const reviewOnlyQueued = Number(
    packet.reviewOnlyQueued ??
    followUps.reviewOnlyQueued ??
    evidence.reviewOnlyQueued ??
    0
  );
  const totalQueued = Number(
    packet.totalQueued ??
    evidence.noKeyFollowUpsQueued ??
    followUps.total ??
    0
  );
  return {
    totalQueued,
    sendableQueued,
    reviewOnlyQueued,
    unknownQueued: Math.max(0, totalQueued - sendableQueued - reviewOnlyQueued),
  };
}

function activationSendTelemetry(data = {}) {
  const followUps = data.activationFollowUps || {};
  const packet = data.operatorExecutionPacket || {};
  const packetTelemetry = packet.sendTelemetry || {};
  const evidence = data.nextBestAction?.evidence || {};
  const sendableQueued = Number(packet.sendableQueued ?? followUps.sendableQueued ?? evidence.sendableQueued ?? 0);
  const dryRunActions = Number(packetTelemetry.dryRunActions ?? evidence.operatorFollowUpSendDryRuns ?? followUps.operatorFollowUpSendDryRuns ?? 0);
  const dryRunRecordedRecipients = Number(packetTelemetry.dryRunRecordedRecipients ?? evidence.operatorFollowUpSendDryRunRecipients ?? followUps.operatorFollowUpSendDryRunRecipients ?? 0);
  const dryRunRecipients = Number(packetTelemetry.dryRunRecipients ?? Math.min(dryRunRecordedRecipients, sendableQueued || dryRunRecordedRecipients));
  const dryRunDuplicateRecipients = Number(packetTelemetry.dryRunDuplicateRecipients ?? Math.max(0, dryRunRecordedRecipients - dryRunRecipients));
  const sendActions = Number(packetTelemetry.sendActions ?? evidence.operatorFollowUpSends ?? followUps.operatorFollowUpSends ?? 0);
  const sentRecipients = Number(packetTelemetry.sentRecipients ?? evidence.operatorFollowUpSentRecipients ?? followUps.operatorFollowUpSentRecipients ?? 0);
  const failedActions = Number(packetTelemetry.failedActions ?? evidence.operatorFollowUpSendFailures ?? followUps.operatorFollowUpSendFailures ?? 0);
  const failedRecipients = Number(packetTelemetry.failedRecipients ?? evidence.operatorFollowUpSendFailureRecipients ?? followUps.operatorFollowUpSendFailureRecipients ?? 0);
  const dryRunCoveredSegments = Array.isArray(packetTelemetry.dryRunCoveredSegments) ? packetTelemetry.dryRunCoveredSegments : [];
  const dryRunPendingSegments = Array.isArray(packetTelemetry.dryRunPendingSegments) ? packetTelemetry.dryRunPendingSegments : [];
  return {
    dryRunActions,
    dryRunRecipients,
    dryRunRecordedRecipients,
    dryRunDuplicateRecipients,
    dryRunCoveredSegments,
    dryRunPendingSegments,
    sendActions,
    sentRecipients,
    failedActions,
    failedRecipients,
    sendableQueued,
    dryRunVerified: packetTelemetry.dryRunVerified === true || (sendableQueued > 0 && dryRunRecipients >= sendableQueued && dryRunPendingSegments.length === 0),
    sendApprovalRequired: packetTelemetry.sendApprovalRequired === true || (sendableQueued > 0 && sentRecipients < sendableQueued),
    nextSendSegment: packetTelemetry.nextSendSegment || 'all',
  };
}

function activationSendCommand(emailReadiness = {}, activationSend = {}) {
  const template = String(emailReadiness.sendCommandTemplate || '').trim();
  if (!template) return '';
  const segment = String(activationSend.nextSendSegment || 'all').trim() || 'all';
  return template.replace(/"segment"\s*:\s*"[^"]*"/, `"segment":"${segment}"`);
}

function activationDeliveryMode(emailReadiness = {}) {
  if (emailReadiness.deliveryMode) return emailReadiness.deliveryMode;
  if (emailReadiness.provider === 'supabase-recovery' && emailReadiness.configured) return 'supabase_recovery_link';
  if (emailReadiness.provider === 'resend' && emailReadiness.configured) return 'branded_resend_email';
  return 'copy_mailto_operator_packet';
}

function activationDeliveryLabel(emailReadiness = {}) {
  const mode = activationDeliveryMode(emailReadiness);
  if (mode === 'supabase_recovery_link') return 'Supabase recovery links ready';
  if (mode === 'branded_resend_email') return 'Branded Resend sender ready';
  return 'Copy/mailto fallback active';
}

function activationDeliveryMeta(emailReadiness = {}) {
  const mode = activationDeliveryMode(emailReadiness);
  if (mode === 'supabase_recovery_link') {
    return 'Supabase recovery links are automated; configure Resend separately for branded generated-key copy.';
  }
  if (mode === 'branded_resend_email') {
    return 'Branded generated-key recovery drafts can be sent after dry-run verification and explicit approval.';
  }
  return 'Use copy/mailto fallback until sender config is ready.';
}

function activationApprovalReadiness(data = {}) {
  const readiness = data.activationApprovalReadiness || {};
  if (readiness && readiness.status) return readiness;
  const delivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const sendableQueued = Number(delivery.sendableQueued || activationSend.sendableQueued || 0);
  let status = 'no_sendable_activation_followups';
  let blockedReason = 'no_sendable_segments';
  if (sendableQueued > 0 && !activationSend.dryRunVerified) {
    status = 'dry_run_required';
    blockedReason = 'dry_run_not_verified';
  } else if (sendableQueued > 0 && activationSend.sendApprovalRequired) {
    status = 'approval_required';
    blockedReason = 'explicit_operator_approval_required';
  } else if (Number(activationSend.failedRecipients || 0) > 0) {
    status = 'send_failures_need_review';
    blockedReason = 'activation_send_failures';
  } else if (sendableQueued > 0) {
    status = 'no_pending_send';
    blockedReason = '';
  }
  const nextActions = [];
  if (sendableQueued > 0 && !activationSend.dryRunVerified) {
    nextActions.push({ id: 'dry_run_activation_followups', priority: 'fix_now' });
  }
  if (sendableQueued > 0 && activationSend.dryRunVerified && activationSend.sendApprovalRequired) {
    nextActions.push({ id: 'approve_activation_followups', priority: 'fix_now' });
  }
  if (delivery.reviewOnlyQueued > 0) {
    nextActions.push({ id: 'review_auth_repair_segments', priority: nextActions.length ? 'next' : 'fix_now' });
  }
  return {
    status,
    blockedReason,
    approvalRequired: activationSend.sendApprovalRequired,
    dryRunVerified: activationSend.dryRunVerified,
    nextSendSegment: activationSend.nextSendSegment,
    totalQueued: delivery.totalQueued,
    sendableQueued,
    reviewOnlyQueued: delivery.reviewOnlyQueued,
    unknownQueued: delivery.unknownQueued,
    dryRunRecipients: activationSend.dryRunRecipients,
    dryRunCoveredSegments: activationSend.dryRunCoveredSegments,
    dryRunPendingSegments: activationSend.dryRunPendingSegments,
    sentRecipients: activationSend.sentRecipients,
    failedRecipients: activationSend.failedRecipients,
    nextActions,
    privacy: {
      containsEmails: false,
      containsCustomerIds: false,
      containsApiKeys: false,
      containsProviderCredentials: false,
      aggregateOnly: true,
    },
  };
}

function activationApprovalChecklist(data = {}) {
  const delivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const approvalReadiness = activationApprovalReadiness(data);
  if (Array.isArray(approvalReadiness.decisionChecklist) && approvalReadiness.decisionChecklist.length) {
    return approvalReadiness.decisionChecklist.map(row => ({
      id: row.id || 'approval_gate',
      label: row.label || row.id || 'Approval gate',
      status: row.status || 'review',
      detail: row.detail || '',
    }));
  }
  const hasSendable = asNumber(delivery.sendableQueued || activationSend.sendableQueued) > 0;
  const hasReviewOnly = asNumber(delivery.reviewOnlyQueued) > 0;
  return [
    {
      id: 'no_secret_boundary',
      label: 'No-secret packet',
      status: 'ready',
      detail: 'Approval packet omits emails, customer IDs, API keys, prompts, OAuth tokens, provider credentials, and raw responses.',
    },
    {
      id: 'dry_run_coverage',
      label: 'Dry-run coverage',
      status: hasSendable ? (activationSend.dryRunVerified ? 'ready' : 'blocked') : 'skipped',
      detail: hasSendable
        ? `${integer(activationSend.dryRunRecipients)} unique sendable recipient(s); covered ${activationSend.dryRunCoveredSegments.join(', ') || 'none'}; pending ${activationSend.dryRunPendingSegments.join(', ') || 'none'}.`
        : 'No sendable activation follow-up segment is queued.',
    },
    {
      id: 'operator_approval',
      label: 'Operator approval',
      status: approvalReadiness.status === 'approval_required' ? 'needs_approval' : (approvalReadiness.approvalRequired ? 'blocked' : 'ready'),
      detail: approvalReadiness.approvalRequired
        ? `Approve or hold the next real send for segment "${approvalReadiness.nextSendSegment || activationSend.nextSendSegment || 'all'}".`
        : 'No pending real activation send needs approval.',
    },
    {
      id: 'confirmation_token',
      label: 'Confirmation token',
      status: approvalReadiness.approvalRequired ? 'protected' : 'ready',
      detail: approvalReadiness.approvalRequired
        ? `Real sends still require ${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION} in the browser prompt and request body.`
        : 'Real-send confirmation protection is configured.',
    },
    {
      id: 'review_only_segments',
      label: 'Review-only segments',
      status: hasReviewOnly ? 'review' : 'ready',
      detail: hasReviewOnly
        ? `${integer(delivery.reviewOnlyQueued)} queued signup(s) need auth-repair review before outreach.`
        : 'No review-only auth-repair segment is queued.',
    },
  ];
}

function renderActivationApprovalChecklist(data = {}) {
  const rows = activationApprovalChecklist(data);
  return `<div class="approvalChecklist">
    <h3>Activation approval checklist</h3>
    <table>
      <thead><tr><th>Gate</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${rows.map(row => `<tr><td><span class="pill">${esc(row.label)}</span></td><td><span class="pill ${row.status === 'ready' || row.status === 'protected' ? 'good' : row.status === 'skipped' ? '' : 'warn'}">${esc(row.status)}</span></td><td>${esc(row.detail)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderActivationNextSendStep(data = {}, { compact = false } = {}) {
  const packet = data.operatorExecutionPacket || {};
  const emailReadiness = packet.emailReadiness || data.activationFollowUps?.emailReadiness || {};
  const delivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const approvalReadiness = activationApprovalReadiness(data);
  const sendCommand = activationSendCommand(emailReadiness, activationSend);
  const nextSegment = activationSend.nextSendSegment || approvalReadiness.nextSendSegment || 'all';
  const dryRunReady = activationSend.dryRunVerified === true;
  const approvalNeeded = activationSend.sendApprovalRequired === true;
  const canCopySend = Boolean(sendCommand && dryRunReady && approvalNeeded);
  const pendingSegments = activationSend.dryRunPendingSegments.join(', ') || 'none';
  const coveredSegments = activationSend.dryRunCoveredSegments.join(', ') || 'none';
  const nextAction = !delivery.sendableQueued
    ? 'No sendable activation segment is queued; review auth-repair segments first.'
    : !dryRunReady
    ? `Dry-run pending for ${pendingSegments}; run a dry-run before requesting approval.`
    : approvalNeeded
    ? `Ready for operator approval: type ${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION} only when sending ${nextSegment}.`
    : 'No pending real send remains; monitor generated-key creation and first routed request.';
  const detail = `Sendable ${integer(delivery.sendableQueued)} · review-only ${integer(delivery.reviewOnlyQueued)} · dry-run ${dryRunReady ? 'verified' : 'pending'} for ${integer(activationSend.dryRunRecipients)} unique recipient(s) · covered ${coveredSegments}.`;
  return `<div class="empty ${approvalNeeded ? 'warn' : 'good'}">
    <strong>${compact ? 'Activation next step' : 'Activation next send step'}:</strong> ${esc(nextAction)}
    <p class="muted">${esc(detail)} Real sends remain protected by private operator token, browser confirmation, and typed approval phrase <code>${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION}</code>. Do not mark worked until the outreach is actually sent or copied into the outbound channel.</p>
    ${sendCommand ? `<div class="actions"><button class="btn secondary small" type="button" data-copy-activation-send-command="${esc(sendCommand)}" data-followup-segment="${esc(nextSegment)}" data-followup-count="${integer(activationSend.sendableQueued)}" ${canCopySend ? '' : 'disabled'}>Copy next approved send command</button><span class="status">${canCopySend ? 'Dry-run verified; approval still required before real send.' : 'Complete dry-run verification and approval before copying the real-send command.'}</span></div>` : ''}
  </div>`;
}

function segmentActionGroups(packet = {}) {
  const segmentActions = Array.isArray(packet.segmentActions) ? packet.segmentActions : [];
  return {
    sendable: segmentActions.filter(row => row.sendable !== false),
    reviewOnly: segmentActions.filter(row => row.sendable === false),
  };
}

function activationAuthRepair(data = {}) {
  const packetRepair = data.operatorExecutionPacket?.authRepair || {};
  const readinessRepair = data.activationApprovalReadiness?.authRepair || {};
  const repair = packetRepair.status ? packetRepair : readinessRepair;
  if (repair && repair.status) return repair;
  const delivery = activationDeliveryCounts(data);
  return {
    status: delivery.reviewOnlyQueued > 0 ? 'review_required' : 'not_required',
    required: delivery.reviewOnlyQueued > 0,
    endpoint: '/admin/customers/hydrate-auth-users',
    command: '',
    reviewOnlyQueued: delivery.reviewOnlyQueued,
    reviewOnlySegments: delivery.reviewOnlySegments,
    repairsMissingAuthUsers: false,
    hydrateCandidateCount: 0,
    accountLinkRepairRequired: delivery.reviewOnlySegments.includes('missing_auth_user'),
    accountLinkReviewQueued: delivery.reviewOnlySegments.includes('missing_auth_user') ? Number((data.activationFollowUps?.countsByEmailVerification || {}).missing_auth_user || 0) : 0,
    operatorAction: delivery.reviewOnlyQueued > 0
      ? 'Review account-link repair or exclusion for auth-repair segments before sending recovery emails.'
      : 'No missing-auth-user repair handoff is queued.',
    noopFallbackAction: delivery.reviewOnlyQueued > 0
      ? 'Hydration has no missing customer rows to create; keep review-only rows excluded and inspect the bounded customer review.'
      : 'No review-only auth repair is queued.',
    privacy: {
      containsEmails: false,
      containsUserIds: false,
      containsCustomerIds: false,
      containsApiKeys: false,
      aggregateOnly: true,
    },
  };
}

function renderActivationAuthRepair(data = {}) {
  const repair = activationAuthRepair(data);
  if (!repair.required) return '';
  const segments = safeList(repair.reviewOnlySegments).join(', ') || 'review-only';
  const command = repair.command || '';
  const accountLinkCommand = repair.accountLinkRepairCommand || '';
  const hydrateCount = Number(repair.hydrateCandidateCount || 0);
  const accountLinkCount = Number(repair.accountLinkReviewQueued || 0);
  const mode = command
    ? `Hydration candidates ${integer(hydrateCount)}; refresh the funnel after hydration and re-run dry-run coverage before any new real send.`
    : `Account-link review queued ${integer(accountLinkCount)}; hydration has no missing customer rows to create.`;
  return `<div class="empty warn">
    <strong>Review-only auth repair:</strong> ${esc(repair.operatorAction || 'Repair or exclude review-only activation segments before email outreach.')}
    <p class="muted">Queued ${integer(repair.reviewOnlyQueued)} across ${esc(segments)}. ${esc(mode)} ${esc(repair.noopFallbackAction || '')}</p>
    ${command ? `<div class="actions"><button class="btn secondary small" type="button" data-copy-auth-repair-command="${esc(command)}" data-followup-count="${integer(repair.reviewOnlyQueued)}">Copy auth repair command</button><span class="status">Command requires the private operator token and does not include emails, user IDs, customer IDs, or API keys.</span></div>` : ''}
    ${accountLinkCommand ? `<div class="actions"><button class="btn secondary small" type="button" data-copy-auth-repair-command="${esc(accountLinkCommand)}" data-followup-count="${integer(repair.accountLinkReviewQueued || repair.reviewOnlyQueued)}">Copy account-link dry-run</button><span class="status">Dry-run only; apply requires ${AUTH_LINK_REPAIR_CONFIRMATION || 'REPAIR_AUTH_LINKS'} and still returns aggregate counts.</span></div>` : ''}
    ${repair.reviewCommand ? `<div class="actions"><button class="btn secondary small" type="button" data-copy-auth-repair-command="${esc(repair.reviewCommand)}" data-followup-count="${integer(repair.reviewOnlyQueued)}">Copy bounded review command</button><span class="status">${command ? 'Use this if hydration reports created=0 and the review-only segment remains.' : 'Use this to inspect account-link repair or exclusion without exposing raw keys or prompts.'}</span></div>` : ''}
  </div>`;
}

function activationApprovalPacketText(data = {}) {
  const packet = data.operatorExecutionPacket || {};
  const followUps = data.activationFollowUps || {};
  const delivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const approvalReadiness = activationApprovalReadiness(data);
  const authRepair = activationAuthRepair(data);
  const { sendable, reviewOnly } = segmentActionGroups(packet);
  const sendableLines = sendable.length
    ? sendable.map(row => `- ${row.segment || 'all'}: ${integer(row.count)} queued; order=${integer(row.sendOrder)}; dryRun=${activationSend.dryRunVerified ? 'verified' : 'pending'}; worked=${row.workedKind || ''}`)
    : ['- none'];
  const reviewLines = reviewOnly.length
    ? reviewOnly.map(row => `- ${row.segment || 'review'}: ${integer(row.count)} queued; reason=${row.reviewReason || 'Review before sending.'}`)
    : ['- none'];
  const checklistLines = activationApprovalChecklist(data).map(row => `- ${row.id || 'approval_gate'}=${row.status || 'review'}: ${row.detail || ''}`);
  return [
    'Sage Router activation approval packet',
    'Boundary: no emails, customer IDs, API keys, prompts, OAuth tokens, provider credentials, or raw provider responses.',
    '',
    `Approval readiness: ${approvalReadiness.status || 'unknown'}; blocker=${approvalReadiness.blockedReason || 'none'}.`,
    `Decision needed: approve or hold the next real activation send for segment "${approvalReadiness.nextSendSegment || activationSend.nextSendSegment || 'all'}".`,
    `Queued: ${integer(delivery.totalQueued || followUps.total)} total; ${integer(delivery.sendableQueued)} sendable; ${integer(delivery.reviewOnlyQueued)} review-only; ${integer(delivery.unknownQueued)} unknown.`,
    `Dry-run: ${activationSend.dryRunVerified ? 'verified' : 'not complete'} for ${integer(activationSend.dryRunRecipients)} unique sendable recipient(s). Sent: ${integer(activationSend.sentRecipients)}; failed: ${integer(activationSend.failedRecipients)}.`,
    `Dry-run segments: covered=${activationSend.dryRunCoveredSegments.join(', ') || 'none'}; pending=${activationSend.dryRunPendingSegments.join(', ') || 'none'}; duplicate raw recipient records=${integer(activationSend.dryRunDuplicateRecipients)}.`,
    `Approval required: ${approvalReadiness.approvalRequired ? 'yes, do not send until explicit operator approval' : 'no pending send'}.`,
    `Next actions: ${(approvalReadiness.nextActions || []).map(row => `${row.priority || 'next'}:${row.id || 'review'}`).join(', ') || 'monitor_activation_queue'}.`,
    `Auth repair: ${authRepair.status || 'unknown'}; queued=${integer(authRepair.reviewOnlyQueued)}; segments=${safeList(authRepair.reviewOnlySegments).join(', ') || 'none'}; hydrateCandidates=${integer(authRepair.hydrateCandidateCount)}; accountLinkReview=${integer(authRepair.accountLinkReviewQueued)}; endpoint=${authRepair.endpoint || '/admin/customers/hydrate-auth-users'}.`,
    `Auth repair fallback: ${authRepair.noopFallbackAction || 'none'}`,
    ...(authRepair.command ? ['', 'Auth repair command:', authRepair.command] : []),
    ...(authRepair.accountLinkRepairCommand ? ['', 'Account-link repair dry-run command:', authRepair.accountLinkRepairCommand] : []),
    ...(authRepair.reviewCommand ? ['', 'Bounded auth review command:', authRepair.reviewCommand] : []),
    '',
    'Approval checklist:',
    ...checklistLines,
    '',
    'Sendable segments:',
    ...sendableLines,
    '',
    'Review-only segments:',
    ...reviewLines,
    '',
    `Primary recovery CTA: ${followUps.primaryCtaUrl || packet.recoveryUrls?.setupKeyRecovery || packet.recoveryUrls?.passwordFallback || activationFollowUpUrl({}, { recovery: true })}`,
    `Success metric: ${followUps.successMetric || packet.telemetry?.successMetric || 'Move no-key signups into generated-key accounts, then first routed request.'}`,
  ].join('\n') + '\n';
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
  const managedAccessEvents = marketingIntent.events || {};
  const activationFollowUps = data.activationFollowUps || {};
  const activationEmailReadiness = activationFollowUps.emailReadiness || {};
  const activationDelivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const authRepair = activationAuthRepair(data);
  const managedReadiness = managedProviderReadiness(data);
  const managedSetup = managedReadiness.readinessSetup || {};
  const managedActions = Array.isArray(managedReadiness.nextActions) ? managedReadiness.nextActions : [];
  const topManagedAction = managedActions[0] || {};
  const noKeyVerification = activationFollowUps.countsByEmailVerification || {};
  const acquisitionActions = data.acquisitionActions || marketingIntent.acquisitionActions || [];
  const revenueActions = Array.isArray(mrr.planRevenueActions) ? mrr.planRevenueActions : [];
  const bottleneck = firstAction(data.bottlenecks);
  const conversionAction = firstAction(data.conversionActions);
  const nextBestAction = data.nextBestAction || conversionAction || bottleneck || {};
  const topAcquisition = acquisitionActions.slice(0, 3);
  const topRevenue = revenueActions.slice(0, 3);
  const generatedAt = data.generatedAt ? new Date(data.generatedAt * 1000).toLocaleString() : 'unknown';
  const githubOauthPosture = asNumber(authState.githubEnabled) > 0
    ? 'GitHub OAuth is visible in browser settings; keep email as the fallback signup path.'
    : 'GitHub OAuth has not appeared in browser settings yet; email remains the baseline signup path.';
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
    `- No-key follow-ups queued: ${integer(activationDelivery.totalQueued || activationFollowUps.total)} total, ${integer(activationDelivery.sendableQueued)} sendable, ${integer(activationDelivery.reviewOnlyQueued)} review-only, ${integer(activationFollowUps.windowedNewSignups)} new in-window; worked: ${integer(activationFollowUps.operatorFollowUpWorked)}; copied/opened: ${integer(activationFollowUps.operatorFollowUpCopies)}; dry-run verified: ${activationSend.dryRunVerified ? 'yes' : 'no'} (${integer(activationSend.dryRunRecipients)} unique sendable recipients; covered ${activationSend.dryRunCoveredSegments.join(', ') || 'none'}); sent: ${integer(activationSend.sentRecipients)} recipients; key-first redirects: ${integer(activationFollowUps.keyFirstRedirects)}. Action: ${activationFollowUps.recommendedOperatorAction || 'Send the generated-key-first follow-up.'}`,
    `- Send approval handoff: next segment=${activationSend.nextSendSegment || 'all'}; approval required=${activationSend.sendApprovalRequired ? 'yes' : 'no'}; command copy remains operator-token gated and confirmation-token protected.`,
    `- Auth repair handoff: status=${authRepair.status || 'unknown'}; review-only=${integer(authRepair.reviewOnlyQueued)}; segments=${safeList(authRepair.reviewOnlySegments).join(', ') || 'none'}; hydrateCandidates=${integer(authRepair.hydrateCandidateCount)}; accountLinkReview=${integer(authRepair.accountLinkReviewQueued)}; endpoint=${authRepair.endpoint || '/admin/customers/hydrate-auth-users'}`,
    `- Auth repair fallback: ${authRepair.noopFallbackAction || 'none'}`,
    `- Approval checklist: ${(activationApprovalChecklist(data)).map(row => `${row.id}=${row.status}`).join('; ')}`,
    `- Recovery auth starts: magic=${integer(asNumber(managedAccessEvents.login_key_recovery_magic_link_requested) + asNumber(managedAccessEvents.setup_key_recovery_magic_link_requested))}; password=${integer(managedAccessEvents.login_key_recovery_password_submitted)}; oauth=${integer(managedAccessEvents.login_key_recovery_oauth_clicked)}; account setup clicks=${integer(managedAccessEvents.login_key_recovery_account_setup_clicked)}`,
    `- Activation email sender: ${activationDeliveryLabel(activationEmailReadiness)} via ${activationEmailReadiness.provider || 'resend'}; mode=${activationDeliveryMode(activationEmailReadiness)}; dry run ${activationEmailReadiness.dryRunSupported ? 'supported' : 'not reported'}; action: ${activationEmailReadiness.operatorAction || activationDeliveryMeta(activationEmailReadiness)}`,
    `- No-key email verification: verified ${integer(noKeyVerification.verified)}, unverified ${integer(noKeyVerification.unverified)}, missing ${integer(noKeyVerification.missing_auth_user || noKeyVerification.missing_user_id)}, unavailable ${integer(noKeyVerification.unavailable)}`,
    `- Follow-up CTA: ${activationFollowUps.primaryCtaUrl || activationFollowUpUrl({}, { auth: false })}`,
    `- Checkout unavailable: ${integer(checkoutFriction.unavailableEvents)} / ${integer(checkoutFriction.totalCheckoutIntent)} intent events (${percent(checkoutFriction.unavailableRate)})`,
    `- Managed access readiness: ${managedReadiness.enabled ? 'enabled' : 'disabled'} (${managedReadiness.status || 'unknown'}); setup=${managedSetup.setupScript || 'scripts/configure_managed_provider_resale_readiness.sh'}; next=${topManagedAction.title || 'Review managed-access controls'}; action: ${topManagedAction.action || managedSetup.operatorAction || 'Keep managed resale disabled until provider authorization, allowlist, and unit economics pass.'}`,
    '',
    'Next conversion move',
    `- Bottleneck: ${actionLine(bottleneck)}`,
    `- Do now: ${nextBestAction.action || conversionAction.action || 'Review the current launch funnel bottleneck.'}`,
    ...(Array.isArray(nextBestAction.executionChecklist) && nextBestAction.executionChecklist.length
      ? nextBestAction.executionChecklist.slice(0, 5).map(item => `  ${integer(item.step)}. ${item.action || ''} (${item.successMetric || 'watch the next stage'})`)
      : []),
    `- Link: ${nextBestAction.ctaPath || conversionAction.ctaPath || '/launch-funnel.html'}`,
    `- Owner/surface: ${nextBestAction.owner || conversionAction.owner || 'Operator'} / ${nextBestAction.surface || conversionAction.surface || 'launch funnel'}`,
    `- Success metric: ${nextBestAction.successMetric || conversionAction.successMetric || 'Improve the next funnel stage.'}`,
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
    `- Anonymous interest clicks: ${integer(managedAccessEvents.managed_access_interest_clicked)}; quick requests submitted: ${integer(managedAccessEvents.managed_access_quick_request_submitted)}; quick requests received: ${integer(managedAccessEvents.managed_access_quick_request_received)}`,
    `- Target-provider buckets: ${sortedEntries(managedAccessDemand.targetProviderFamily).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    `- Commercial buckets: ${sortedEntries(managedAccessDemand.commercialPreference).slice(0, 4).map(([name, count]) => `${demandLabel(name)} ${integer(count)}`).join(', ') || 'none'}`,
    '',
    'OAuth onboarding state',
    `- GitHub enabled checks: ${integer(authState.githubEnabled)}; GitHub disabled checks: ${integer(authState.githubDisabled)}; ${githubOauthPosture}`,
  ];
  return `${lines.join('\n')}\n`;
}

function renderLaunchBrief(data = {}) {
  const brief = buildLaunchBrief(data);
  setText('launch-brief', brief);
  setText('launch-brief-status', 'No-secret launch brief generated from aggregate funnel data.');
}

function operatorAuthPosture(data = {}) {
  const marketingIntent = data.marketingIntent || {};
  const authState = data.authProviderState || marketingIntent.authProviderState || {};
  const githubEnabled = asNumber(authState.githubEnabled);
  const githubDisabled = asNumber(authState.githubDisabled);
  if (githubEnabled > 0) {
    return {
      label: 'GitHub visible',
      tone: 'good',
      action: 'Use email/password recovery first; GitHub/OAuth is available only when it is the same signup account.',
    };
  }
  if (githubDisabled > 0) {
    return {
      label: 'GitHub disabled observed',
      tone: 'warn',
      action: 'Use email/password recovery first and avoid GitHub-only follow-up.',
    };
  }
  return {
    label: 'Auth provider state unknown',
    tone: 'warn',
    action: 'Use email/password recovery first; offer GitHub/OAuth only if the user confirms it is the same account.',
  };
}

function operatorExecutionPacketText(packet = {}, data = {}) {
  const telemetry = packet.telemetry || {};
  const privacy = packet.privacy || {};
  const urls = packet.recoveryUrls || {};
  const draft = packet.draft || {};
  const segmentActions = Array.isArray(packet.segmentActions) ? packet.segmentActions : [];
  const instructions = Array.isArray(packet.instructions) ? packet.instructions : [];
  const emailReadiness = packet.emailReadiness || data.activationFollowUps?.emailReadiness || {};
  const managedReadiness = managedProviderReadiness(data);
  const managedSetup = managedReadiness.readinessSetup || {};
  const managedActions = Array.isArray(managedReadiness.nextActions) ? managedReadiness.nextActions : [];
  const topManagedAction = managedActions[0] || {};
  const authPosture = operatorAuthPosture(data);
  const activationDelivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const approvalReadiness = activationApprovalReadiness(data);
  const authRepair = activationAuthRepair(data);
  const sendCommand = activationSendCommand(emailReadiness, activationSend);
  return [
    `${packet.title || 'Operator execution packet'} (${packet.kind || 'none'})`,
    `Priority: ${packet.priority || 'monitor'} | Owner: ${packet.owner || 'Operator'} | Metric: ${packet.metric || 'launch'}`,
    `Queued: ${integer(activationDelivery.totalQueued || packet.totalQueued)} total, ${integer(activationDelivery.sendableQueued)} sendable, ${integer(activationDelivery.reviewOnlyQueued)} review-only, ${integer(packet.windowedNewSignups)} new in-window`,
    `Send telemetry: dry-run actions=${integer(activationSend.dryRunActions)} uniqueRecipients=${integer(activationSend.dryRunRecipients)} rawRecordedRecipients=${integer(activationSend.dryRunRecordedRecipients)} duplicateRecords=${integer(activationSend.dryRunDuplicateRecipients)}; sent actions=${integer(activationSend.sendActions)} recipients=${integer(activationSend.sentRecipients)}; failures=${integer(activationSend.failedActions)} recipients=${integer(activationSend.failedRecipients)}; approvalRequired=${activationSend.sendApprovalRequired === true}`,
    `Next send segment: ${activationSend.nextSendSegment || 'all'}; dryRunVerified=${activationSend.dryRunVerified === true}; approvalRequired=${activationSend.sendApprovalRequired === true}`,
    `Approval readiness: ${approvalReadiness.status || 'unknown'}; blockedReason=${approvalReadiness.blockedReason || 'none'}; nextActions=${(approvalReadiness.nextActions || []).map(row => `${row.priority || 'next'}:${row.id || 'review'}`).join(', ') || 'monitor_activation_queue'}`,
    `Auth repair: status=${authRepair.status || 'unknown'}; queued=${integer(authRepair.reviewOnlyQueued)}; segments=${safeList(authRepair.reviewOnlySegments).join(', ') || 'none'}; endpoint=${authRepair.endpoint || '/admin/customers/hydrate-auth-users'}; aggregateOnly=${authRepair.privacy?.aggregateOnly === true}`,
    `Auth repair fallback: ${authRepair.noopFallbackAction || 'none'}`,
    ...(authRepair.command ? ['', 'Auth repair command:', authRepair.command] : []),
    ...(authRepair.reviewCommand ? ['', 'Bounded auth review command:', authRepair.reviewCommand] : []),
    `Auth posture: ${authPosture.label}. ${authPosture.action}`,
    `Activation email sender: ${activationDeliveryLabel(emailReadiness)} via ${emailReadiness.provider || 'resend'}; mode=${activationDeliveryMode(emailReadiness)}; endpoint=${emailReadiness.sendEndpoint || '/admin/customers/send-activation-followups'}; requiredEnv=${(emailReadiness.requiredEnv || []).join(', ') || 'none'}; brandedSender=${emailReadiness.brandedSenderConfigured === true}; recoverySender=${emailReadiness.recoverySenderConfigured === true}`,
    `Activation sender setup: ${emailReadiness.setupScript || 'scripts/configure_activation_email_sender.sh'}`,
    ...(emailReadiness.setupCommand ? ['', 'Setup command template:', emailReadiness.setupCommand] : []),
    ...(emailReadiness.dryRunCommand ? ['', 'Dry-run send command:', emailReadiness.dryRunCommand] : []),
    ...(emailReadiness.sendCommandTemplate ? ['', 'Real send command template:', emailReadiness.sendCommandTemplate] : []),
    ...(sendCommand ? ['', 'Approval send command for next segment:', sendCommand] : []),
    '',
    `Managed provider access: ${managedReadiness.enabled ? 'enabled' : 'disabled'}; requested=${managedReadiness.requested === true}; status=${managedReadiness.status || 'unknown'}; missingControls=${(managedReadiness.missingControls || []).join(', ') || 'none'}`,
    `Managed access next action: ${topManagedAction.title || 'Review managed-access controls'}; priority=${topManagedAction.priority || 'next'}; success=${topManagedAction.successMetric || 'Remove the top managed-access blocker.'}`,
    `Managed access setup: ${managedSetup.setupScript || 'scripts/configure_managed_provider_resale_readiness.sh'}; requiredEnv=${(managedSetup.requiredEnv || []).join(', ') || 'none'}; explicitPublicEnable=${managedSetup.requiresExplicitPublicEnableEnv || 'SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC'}`,
    ...(managedSetup.setupCommand ? ['', 'Managed access setup command:', managedSetup.setupCommand] : []),
    ...(managedSetup.dryRunCommand ? ['', 'Managed access dry-run command:', managedSetup.dryRunCommand] : []),
    ...(managedSetup.enableCommandTemplate ? ['', 'Managed access enable command template:', managedSetup.enableCommandTemplate] : []),
    `Privacy: aggregateOnly=${privacy.aggregateOnly === true}; emails=${privacy.containsEmails === true}; customerIds=${privacy.containsCustomerIds === true}; apiKeys=${privacy.containsApiKeys === true}; prompts=${privacy.containsPrompts === true}; oauthTokens=${privacy.containsOAuthTokens === true}`,
    '',
    'Segments:',
    ...(segmentActions.length
      ? segmentActions.map(row => `- ${row.sendOrder || ''}. ${row.label || row.segment}: ${integer(row.count)} queued; mode=${row.deliveryMode || (row.sendable === false ? 'review' : 'send')}; copy=${row.copyKind || ''}; worked=${row.workedKind || ''}; sendCommand=${row.sendCommand ? 'segment-specific' : 'none'}${row.reviewReason ? `; review=${row.reviewReason}` : ''}`)
      : ['- none']),
    '',
    'Recovery URLs:',
    `- Setup-key recovery: ${urls.setupKeyRecovery || ''}`,
    `- Email/password: ${urls.passwordFallback || ''}`,
    `- GitHub/OAuth: ${urls.githubOAuth || ''}`,
    '',
    'Draft:',
    `Subject: ${draft.subject || ''}`,
    draft.body || '',
    '',
    'Telemetry:',
    `- Copy events: ${(telemetry.copyEvents || []).join(', ')}`,
    `- Recovery views: ${(telemetry.recoveryViewEvents || []).join(', ')}`,
    `- Key attempts: ${(telemetry.keyCreateAttemptEvents || []).join(', ')}`,
    `- Key successes: ${(telemetry.keyCreateSuccessEvents || []).join(', ')}`,
    `- Key failures: ${(telemetry.keyCreateFailureEvents || []).join(', ')}`,
    `- Success: ${telemetry.successMetric || ''}`,
    '',
    'Instructions:',
    ...(instructions.length ? instructions.map((item, idx) => `${idx + 1}. ${item}`) : ['1. Monitor launch funnel.']),
  ].join('\n').trim() + '\n';
}

function safeList(value) {
  return Array.isArray(value) ? value.filter(item => item !== null && item !== undefined && String(item).trim() !== '') : [];
}

function listLine(label, value) {
  const values = safeList(value);
  return `- ${label}: ${values.length ? values.join(', ') : 'none'}`;
}

function managedProviderReadiness(data = {}) {
  const topLevel = data.managedProviderReadiness || {};
  if (topLevel && (topLevel.status || Array.isArray(topLevel.missingControls) || topLevel.readinessSetup)) {
    return topLevel;
  }
  return data.pricing?.publicLaunch?.managedProviderAccess || {};
}

function managedAccessApprovalPacketText(data = {}) {
  const managed = managedProviderReadiness(data);
  const setup = managed.readinessSetup || {};
  const oneSubscription = managed.oneSubscriptionReadiness || {};
  const unitEconomics = managed.unitEconomics || {};
  const actions = Array.isArray(managed.nextActions) ? managed.nextActions : [];
  const plans = Array.isArray(unitEconomics.evaluatedPlans) ? unitEconomics.evaluatedPlans : [];
  const termsCommand = setup.termsApprovalCommand || 'scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet';
  const authorizationPacketCommand = setup.authorizationPacketCommand || 'scripts/configure_managed_provider_resale_readiness.sh --authorization-packet';
  const dryRunCommand = setup.dryRunCommand || 'scripts/configure_managed_provider_resale_readiness.sh --check';
  const unitEconomicsCommand = setup.unitEconomicsCommand || "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics";
  const stagePublicControlsCommand = setup.stagePublicControlsCommand || 'scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls';
  const setupCommand = setup.setupCommand || stagePublicControlsCommand;
  const enableCommand = setup.enableCommandTemplate || "SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='1' scripts/configure_managed_provider_resale_readiness.sh";
  const planLines = plans.length
    ? plans.map(plan => `- ${plan.plan || 'plan'}: revenue=${asNumber(plan.revenueCentsPerThousandRequests).toFixed(4)} cents/1k; maxSafeProviderCost=${asNumber(plan.maximumProviderCostCentsPerThousandRequests).toFixed(4)} cents/1k; minimumGrossMargin=${integer(plan.minimumGrossMarginPercent)}%; pass=${plan.meetsMinimumGrossMargin === true}`)
    : ['- none returned'];
  const actionLines = actions.length
    ? actions.map(action => `- ${action.priority || 'next'}:${action.id || 'managed_access'} - ${action.title || 'Review managed-access controls'}; action=${action.action || 'Review the next missing control.'}; success=${action.successMetric || 'Remove one managed-access blocker.'}; requiredEnv=${safeList(action.requiredEnv).join(', ') || 'none'}`)
    : ['- Review managed provider resale controls before enabling public one-subscription access.'];
  return [
    'Sage Router managed-access approval packet',
    'Boundary: no provider credentials, no authorization-reference values, no actual provider costs, no prompts, no raw provider responses, no generated API keys, and no customer data.',
    '',
    `Status: enabled=${managed.enabled === true}; requested=${managed.requested === true}; readinessSatisfied=${managed.readinessSatisfied === true}; status=${managed.status || 'unknown'}.`,
    `Terms acknowledged=${managed.providerTermsAcknowledged === true}; authorizationEvidenceConfigured=${managed.providerAuthorizationEvidenceConfigured === true}; costModelConfigured=${unitEconomics.costModelConfigured === true}; unitEconomicsSatisfied=${unitEconomics.satisfied === true}.`,
    listLine('Missing controls', managed.missingControls),
    `Provider terms URL: ${managed.providerTermsUrl || 'not configured'}`,
    `Margin policy URL: ${managed.marginPolicyUrl || 'not configured'}`,
    `Acceptable-use URL: ${managed.acceptableUseUrl || 'not configured'}`,
    '',
    'Provider-family boundary',
    listLine('Allowed managed resale families', managed.allowedProviderFamilies),
    listLine('Resale-eligible families', managed.resaleEligibleProviderFamilies),
    listLine('BYOK-only families', managed.byokOnlyProviderFamilies),
    listLine('One-subscription ready families', oneSubscription.readyProviderFamilies),
    listLine('One-subscription blocked families', oneSubscription.blockedProviderFamilies),
    `Boundary note: ${managed.providerBoundary || 'OpenRouter remains supported as BYOK routing unless separately authorized for managed resale.'}`,
    '',
    'Next actions',
    ...actionLines,
    '',
    'Unit-economics public thresholds',
    ...planLines,
    '',
    'Secret-safe commands',
    `- Terms approval packet: ${termsCommand}`,
    `- Authorization evidence packet: ${authorizationPacketCommand}`,
    `- Resale dry-run: ${dryRunCommand}`,
    `- Unit-economics preflight: ${unitEconomicsCommand}`,
    `- Stage public controls without private cost: ${stagePublicControlsCommand}`,
    `- Stage private cost model after preflight: ${setupCommand}`,
    `- Enable template: ${enableCommand}`,
    '',
    'Enable template is not approval. Keep public managed resale disabled until terms, authorization evidence, allowlist, private cost model, and unit economics all pass with explicit operator approval.',
  ].join('\n') + '\n';
}

function managedAccessCommand(button, data = {}) {
  const managed = managedProviderReadiness(data);
  const setup = managed.readinessSetup || {};
  const kind = button.getAttribute('data-copy-managed-command') || '';
  if (kind === 'terms-approval') return setup.termsApprovalCommand || 'scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet';
  if (kind === 'authorization-packet') return setup.authorizationPacketCommand || 'scripts/configure_managed_provider_resale_readiness.sh --authorization-packet';
  if (kind === 'unit-economics') return setup.unitEconomicsCommand || "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics";
  if (kind === 'stage-public-controls') return setup.stagePublicControlsCommand || 'scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls';
  if (kind === 'stage') return setup.setupCommand || setup.stagePublicControlsCommand || 'scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls';
  if (kind === 'enable-template') return setup.enableCommandTemplate || "SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='1' scripts/configure_managed_provider_resale_readiness.sh";
  return setup.dryRunCommand || 'scripts/configure_managed_provider_resale_readiness.sh --check';
}

function renderManagedAccessReadiness(data = {}) {
  const target = $('managed-access-readiness');
  if (!target) return;
  const managed = managedProviderReadiness(data);
  const setup = managed.readinessSetup || {};
  const oneSubscription = managed.oneSubscriptionReadiness || {};
  const unitEconomics = managed.unitEconomics || {};
  const actions = Array.isArray(managed.nextActions) ? managed.nextActions : [];
  const missingControls = safeList(managed.missingControls);
  const plans = Array.isArray(unitEconomics.evaluatedPlans) ? unitEconomics.evaluatedPlans : [];
  const approvalPacket = managedAccessApprovalPacketText(data);
  const statusTone = managed.enabled ? 'good' : (missingControls.length ? 'warn' : 'good');
  const renderList = (items, empty = 'none') => safeList(items).map(item => `<span class="pill">${esc(item)}</span>`).join(' ') || `<span class="muted">${esc(empty)}</span>`;
  const planRows = plans.length
    ? plans.map(plan => `<tr>
      <td><span class="pill">${esc(plan.plan || 'plan')}</span></td>
      <td>${asNumber(plan.revenueCentsPerThousandRequests).toFixed(4)}</td>
      <td>${asNumber(plan.maximumProviderCostCentsPerThousandRequests).toFixed(4)}</td>
      <td>${integer(plan.minimumGrossMarginPercent)}%</td>
      <td><span class="pill ${plan.meetsMinimumGrossMargin ? 'good' : 'warn'}">${plan.meetsMinimumGrossMargin ? 'pass' : 'pending private cost'}</span></td>
    </tr>`).join('')
    : '<tr><td colspan="5">No fixed-plan unit-economics rows returned.</td></tr>';
  const actionRows = actions.length
    ? actions.map(action => `<tr>
      <td><span class="pill ${action.priority === 'fix_now' ? 'bad' : 'warn'}">${esc(action.priority || 'next')}</span></td>
      <td>${esc(action.title || action.id || 'Review managed-access controls')}</td>
      <td>${esc(action.action || '')}</td>
      <td>${esc(action.successMetric || '')}</td>
    </tr>`).join('')
    : '<tr><td colspan="4">No managed-access next actions returned.</td></tr>';
  target.innerHTML = `<div class="metricList">
    <div class="metric"><span>Status</span><strong><span class="pill ${statusTone}">${esc(managed.status || (managed.enabled ? 'enabled' : 'gated'))}</span></strong></div>
    <div class="metric"><span>Public enable</span><strong>${managed.enabled ? 'enabled' : 'disabled'} · requested=${managed.requested === true}</strong></div>
    <div class="metric"><span>Readiness</span><strong>${managed.readinessSatisfied ? 'satisfied' : 'blocked'} · missing ${integer(missingControls.length)}</strong></div>
    <div class="metric"><span>One-subscription ready</span><strong>${renderList(oneSubscription.readyProviderFamilies)}</strong></div>
    <div class="metric"><span>One-subscription blocked</span><strong>${renderList(oneSubscription.blockedProviderFamilies)}</strong></div>
    <div class="metric"><span>Managed resale allowlist</span><strong>${renderList(managed.allowedProviderFamilies)}</strong></div>
    <div class="metric"><span>BYOK-only boundary</span><strong>${renderList(managed.byokOnlyProviderFamilies)}</strong></div>
    <div class="metric"><span>Cost model</span><strong><span class="pill ${unitEconomics.costModelConfigured ? 'good' : 'warn'}">${unitEconomics.costModelConfigured ? 'configured privately' : 'missing private cost'}</span></strong></div>
  </div>
  <p class="muted">${esc(managed.providerBoundary || 'OpenRouter remains supported as BYOK routing unless separately authorized for managed resale.')} Actual provider costs and authorization-reference values are intentionally omitted.</p>
  <div class="actions">
    <button class="btn secondary" type="button" data-copy-managed-access-packet="${esc(approvalPacket)}">Copy managed-access packet</button>
    <button class="btn secondary" type="button" data-copy-managed-command="terms-approval">Copy terms packet command</button>
    <button class="btn secondary" type="button" data-copy-managed-command="authorization-packet">Copy authorization packet</button>
    <button class="btn secondary" type="button" data-copy-managed-command="dry-run">Copy resale dry-run</button>
    <button class="btn secondary" type="button" data-copy-managed-command="unit-economics">Copy unit-economics preflight</button>
    <button class="btn secondary" type="button" data-copy-managed-command="stage-public-controls">Copy public-control staging</button>
    <button class="btn secondary" type="button" data-copy-managed-command="stage">Copy private-cost staging</button>
    ${setup.enableCommandTemplate ? '<button class="btn danger" type="button" data-copy-managed-command="enable-template">Copy enable template</button>' : ''}
  </div>
  <div class="grid2" style="margin-top:14px">
    <div>
      <h3>Missing controls</h3>
      <div class="empty">${renderList(missingControls, 'No missing controls reported.')}</div>
    </div>
    <div>
      <h3>Prerequisite links</h3>
      <div class="metricList">
        <div class="metric"><span>Terms</span><strong>${managed.providerTermsUrl ? `<a class="pill" href="${esc(managed.providerTermsUrl)}" target="_blank" rel="noopener noreferrer">Open terms</a>` : '<span class="muted">not configured</span>'}</strong></div>
        <div class="metric"><span>Margin policy</span><strong>${managed.marginPolicyUrl ? `<a class="pill" href="${esc(managed.marginPolicyUrl)}" target="_blank" rel="noopener noreferrer">Open policy</a>` : '<span class="muted">not configured</span>'}</strong></div>
        <div class="metric"><span>Acceptable use</span><strong>${managed.acceptableUseUrl ? `<a class="pill" href="${esc(managed.acceptableUseUrl)}" target="_blank" rel="noopener noreferrer">Open AUP</a>` : '<span class="muted">not configured</span>'}</strong></div>
      </div>
    </div>
  </div>
  <div class="tableWrap" style="margin-top:14px"><table>
    <thead><tr><th>Priority</th><th>Task</th><th>Action</th><th>Success</th></tr></thead>
    <tbody>${actionRows}</tbody>
  </table></div>
  <div class="tableWrap" style="margin-top:14px"><table>
    <thead><tr><th>Plan</th><th>Revenue cents/1k</th><th>Max safe cost cents/1k</th><th>Min margin</th><th>Private cost check</th></tr></thead>
    <tbody>${planRows}</tbody>
  </table></div>`;
}

function renderOperatorExecutionPacket(data = {}) {
  const target = $('operator-execution-packet');
  if (!target) return;
  const packet = data.operatorExecutionPacket || {};
  const followUps = data.activationFollowUps || {};
  const plan = followUps.suggestedPlan || 'pro';
  const privacy = packet.privacy || {};
  const urls = packet.recoveryUrls || {};
  const draft = packet.draft || {};
  const telemetry = packet.telemetry || {};
  const segmentActions = Array.isArray(packet.segmentActions) ? packet.segmentActions : [];
  const emailReadiness = packet.emailReadiness || data.activationFollowUps?.emailReadiness || {};
  const activationDelivery = activationDeliveryCounts(data);
  const activationSend = activationSendTelemetry(data);
  const approvalReadiness = activationApprovalReadiness(data);
  const authRepair = activationAuthRepair(data);
  const sendCommand = activationSendCommand(emailReadiness, activationSend);
  const managedReadiness = managedProviderReadiness(data);
  const managedSetup = managedReadiness.readinessSetup || {};
  const authPosture = operatorAuthPosture(data);
  const clean = privacy.aggregateOnly === true &&
    privacy.containsEmails === false &&
    privacy.containsCustomerIds === false &&
    privacy.containsApiKeys === false &&
    privacy.containsProviderCredentials === false &&
    privacy.containsPrompts === false &&
    privacy.containsOAuthTokens === false;
  if (!packet.kind || packet.kind === 'none') {
    target.innerHTML = `<div class="empty">No operator execution packet is currently queued. <span class="pill ${clean ? 'good' : ''}">${clean ? 'Aggregate only' : 'No active packet'}</span></div>`;
    return;
  }
  const segmentRows = segmentActions.length
    ? segmentActions.map(row => {
        const segment = row.segment || 'all';
        const draftReady = followUpSegmentDraftReady(plan, segment);
        const segmentSendCommand = row.sendCommand || (row.sendable === false ? '' : activationSendCommand(emailReadiness, { ...activationSend, nextSendSegment: segment }));
        const canCopySegmentSend = Boolean(segmentSendCommand && row.sendable !== false && activationSend.dryRunVerified && activationSend.sendApprovalRequired);
        const segmentDraft = [
          `Subject: ${draft.subject || 'Finish your Sage Router setup key'}`,
          '',
          draft.body || '',
          '',
          `Segment: ${row.label || segment} (${integer(row.count)} queued)`,
        ].join('\n');
        return `<tr>
          <td><span class="pill">${esc(segment)}</span></td>
          <td>${integer(row.count)}</td>
          <td>${integer(row.sendOrder)}</td>
          <td><code>${esc(row.copyKind || '')}</code></td>
          <td><code>${esc(row.workedKind || '')}</code></td>
          <td><div class="actions"><button class="btn secondary small" type="button" data-copy-primary-followup-url="${esc(urls.passwordFallback || '')}" data-copy-primary-followup-text="${esc(segmentDraft)}" data-followup-copy-kind="${esc(row.copyKind || `${segment}_aggregate_draft_copied`)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(row.count)}">Copy draft</button>${segmentSendCommand ? `<button class="btn secondary small" type="button" data-copy-activation-send-command="${esc(segmentSendCommand)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(row.count)}" ${canCopySegmentSend ? '' : 'disabled'}>Copy ${esc(segment)} send</button>` : ''}<button class="btn small" type="button" data-mark-followup-worked="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(row.count)}" data-followup-draft-ready="${draftReady ? '1' : '0'}" ${draftReady ? '' : 'disabled'}>Mark worked</button></div></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6">No segment actions returned.</td></tr>';
  const packetText = operatorExecutionPacketText(packet, data);
  const approvalPacketText = activationApprovalPacketText(data);
  const draftText = [`Subject: ${draft.subject || 'Finish your Sage Router setup key'}`, '', draft.body || ''].join('\n');
  const approvalChecklist = renderActivationApprovalChecklist(data);
  target.innerHTML = `<div class="metricList">
    <div class="metric"><span>Kind</span><strong>${esc(packet.kind)}</strong></div>
    <div class="metric"><span>Priority</span><strong><span class="pill ${packet.priority === 'fix_now' ? 'bad' : 'warn'}">${esc(packet.priority || 'monitor')}</span></strong></div>
    <div class="metric"><span>Queued</span><strong>${integer(activationDelivery.totalQueued || packet.totalQueued)} total · ${integer(activationDelivery.sendableQueued)} sendable · ${integer(activationDelivery.reviewOnlyQueued)} review-only</strong></div>
    <div class="metric"><span>Send approval</span><strong><span class="pill ${activationSend.sendApprovalRequired ? 'warn' : 'good'}">${activationSend.sendApprovalRequired ? 'Approval pending' : 'No pending send'}</span></strong></div>
    <div class="metric"><span>Approval readiness</span><strong><span class="pill ${approvalReadiness.status === 'approval_required' ? 'warn' : approvalReadiness.status === 'dry_run_required' ? 'bad' : 'good'}">${esc(approvalReadiness.status || 'unknown')}</span></strong></div>
    <div class="metric"><span>Auth repair</span><strong><span class="pill ${authRepair.required ? 'warn' : 'good'}">${esc(authRepair.status || 'not_required')}</span></strong></div>
    <div class="metric"><span>Dry-run / sent</span><strong>${integer(activationSend.dryRunRecipients)} unique dry-run · ${integer(activationSend.sentRecipients)} sent · ${integer(activationSend.failedRecipients)} failed</strong></div>
    <div class="metric"><span>Next send segment</span><strong>${esc(activationSend.nextSendSegment || 'all')}</strong></div>
    <div class="metric"><span>Primary CTA</span><strong>${esc(packet.primaryCtaKind || 'setup_key_recovery')}</strong></div>
    <div class="metric"><span>Email sender</span><strong><span class="pill ${emailReadiness.configured ? 'good' : 'warn'}">${esc(activationDeliveryLabel(emailReadiness))}</span></strong></div>
    <div class="metric"><span>Managed access</span><strong><span class="pill ${managedReadiness.enabled ? 'good' : 'warn'}">${esc(managedReadiness.status || 'disabled')}</span></strong></div>
    <div class="metric"><span>Auth posture</span><strong><span class="pill ${esc(authPosture.tone)}">${esc(authPosture.label)}</span></strong></div>
    <div class="metric"><span>Privacy</span><strong><span class="pill ${clean ? 'good' : 'bad'}">${clean ? 'Aggregate only' : 'Review payload'}</span></strong></div>
    <div class="metric"><span>Success</span><strong>${esc(telemetry.successMetric || packet.metric || 'activation')}</strong></div>
  </div>
  <p class="muted">${esc(authPosture.action)} Approval readiness is ${esc(approvalReadiness.status || 'unknown')}${approvalReadiness.blockedReason ? ` (${esc(approvalReadiness.blockedReason)})` : ''}. ${esc(activationDeliveryMeta(emailReadiness))} ${activationSend.sendApprovalRequired ? `Dry-run is ${activationSend.dryRunVerified ? 'verified' : 'not complete'} for ${integer(activationSend.dryRunRecipients)} unique sendable recipient(s); covered segments: ${activationSend.dryRunCoveredSegments.join(', ') || 'none'}; wait for explicit operator approval before real send.` : esc(emailReadiness.operatorAction || 'Dry-run activation follow-up sending before real outreach.')} ${esc(managedSetup.operatorAction || 'Keep managed provider access disabled until resale controls pass.')}</p>
  ${approvalChecklist}
  ${renderActivationAuthRepair(data)}
  ${renderActivationNextSendStep(data)}
  <div class="actions">
    <button class="btn secondary" type="button" data-copy-operator-packet="${esc(packetText)}">Copy execution packet</button>
    <button class="btn secondary" type="button" data-copy-activation-approval-packet="${esc(approvalPacketText)}" data-followup-count="${integer(activationDelivery.sendableQueued)}">Copy approval packet</button>
    ${sendCommand ? `<button class="btn secondary" type="button" data-copy-activation-send-command="${esc(sendCommand)}" data-followup-segment="${esc(activationSend.nextSendSegment || 'all')}" data-followup-count="${integer(activationSend.sendableQueued)}" ${activationSend.dryRunVerified && activationSend.sendApprovalRequired ? '' : 'disabled'}>Copy approved send command</button>` : ''}
    <button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(urls.setupKeyRecovery || urls.passwordFallback || '')}" data-copy-primary-followup-text="${esc(draftText)}" data-followup-copy-kind="operator_packet_draft_copied" data-followup-plan="${esc(plan)}" data-followup-count="${integer(packet.totalQueued)}">Copy packet draft</button>
    <button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(urls.setupKeyRecovery || urls.passwordFallback || '')}" data-copy-primary-followup-text="${esc(primaryFollowUpLinkSet(plan, urls))}" data-followup-copy-kind="operator_packet_links_copied" data-followup-plan="${esc(plan)}" data-followup-count="${integer(packet.totalQueued)}">Copy packet links</button>
    ${urls.setupKeyRecovery ? `<a class="btn secondary" href="${esc(urls.setupKeyRecovery)}" target="_blank" rel="noopener noreferrer">Open setup recovery</a>` : ''}
    ${urls.passwordFallback ? `<a class="btn secondary" href="${esc(urls.passwordFallback)}" target="_blank" rel="noopener noreferrer">Open email/password</a>` : ''}
    ${urls.githubOAuth ? `<a class="btn secondary" href="${esc(urls.githubOAuth)}" target="_blank" rel="noopener noreferrer">Open GitHub/OAuth</a>` : ''}
  </div>
  <div class="tableWrap"><table>
    <thead><tr><th>Segment</th><th>Queued</th><th>Order</th><th>Copy state</th><th>Worked state</th><th></th></tr></thead>
    <tbody>${segmentRows}</tbody>
  </table></div>
  <p class="muted">Telemetry: ${esc((telemetry.copyEvents || []).slice(0, 3).join(', ') || 'copy events')} -> ${esc((telemetry.recoveryViewEvents || []).slice(0, 2).join(', ') || 'recovery views')} -> ${esc((telemetry.keyCreateSuccessEvents || []).slice(0, 2).join(', ') || 'key creation')}.</p>`;
}

function renderNextBestActionDock(data = {}) {
  const target = $('next-best-action-dock');
  if (!target) return;
  const action = data.nextBestAction || {};
  const followUps = data.activationFollowUps || {};
  const primaryCtaUrls = followUps.primaryCtaUrls || {};
  const evidence = action.evidence || {};
  const emailVerification = evidence.emailVerification || followUps.countsByEmailVerification || {};
  const primaryCta = primaryCtaUrls.setupKeyRecovery || followUps.primaryCtaUrl || primaryCtaUrls.passwordFallback || activationFollowUpUrl({ activation: { plan: followUps.suggestedPlan || 'pro' } }, { recovery: true });
  const actionHref = action.ctaPath || primaryCta || '/launch-funnel.html';
  const priority = action.priority || 'review';
  const metric = action.metric || 'activation';
  const noKeyCount = Number(evidence.noKeyFollowUpsQueued ?? followUps.total ?? 0);
  const activationDelivery = activationDeliveryCounts(data);
  const keyRecoveryViews = Number(evidence.keyRecoveryViews ?? followUps.keyRecoveryViews ?? 0);
  const keyFirstRedirects = Number(evidence.keyFirstRedirects ?? followUps.keyFirstRedirects ?? 0);
  const copied = Number(evidence.operatorFollowUpCopies ?? followUps.operatorFollowUpCopies ?? 0);
  const worked = Number(evidence.operatorFollowUpWorked ?? followUps.operatorFollowUpWorked ?? 0);
  const activationSend = activationSendTelemetry(data);
  const keyCreateAttempts = Number(evidence.keyCreateAttempts ?? followUps.keyCreateAttempts ?? 0);
  const keyCreateSuccesses = Number(evidence.keyCreateSuccesses ?? followUps.keyCreateSuccesses ?? 0);
  const keyCreateFailures = Number(evidence.keyCreateFailures ?? followUps.keyCreateFailures ?? 0);
  const verified = Number(emailVerification.verified || 0);
  const unverified = Number(emailVerification.unverified || 0);
  const aggregateDraft = aggregateFollowUpDraft(followUps.suggestedPlan || 'pro', primaryCtaUrls);
  const aggregateMailto = aggregateFollowUpMailtoUrl(followUps.suggestedPlan || 'pro', primaryCtaUrls);
  const linkSet = primaryFollowUpLinkSet(followUps.suggestedPlan || 'pro', primaryCtaUrls);
  const copyButton = primaryCta
    ? `<button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(primaryCta)}" data-copy-primary-followup-text="${esc(aggregateDraft)}" data-followup-copy-kind="primary_recovery_draft_copied" data-followup-plan="${esc(followUps.suggestedPlan || 'pro')}" data-followup-count="${esc(noKeyCount)}">Copy no-secret email draft</button><button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(primaryCta)}" data-copy-primary-followup-text="${esc(linkSet)}" data-followup-copy-kind="primary_recovery_url_copied" data-followup-plan="${esc(followUps.suggestedPlan || 'pro')}" data-followup-count="${esc(noKeyCount)}">Copy recovery links only</button>`
    : '';
  const mailtoButton = noKeyCount > 0
    ? `<a class="btn secondary" href="${esc(aggregateMailto)}" data-email-followup-batch="aggregate" data-followup-segment="aggregate" data-followup-plan="${esc(followUps.suggestedPlan || 'pro')}" data-followup-count="${esc(noKeyCount)}">Open no-secret email draft</a>`
    : '';
  const segmentQueue = String(action.ctaPath || '').includes('#no-key-followups:segments') || (verified > 0 && unverified > 0);
  const queueHref = segmentQueue ? '#no-key-followups:segments' : '#no-key-followups';
  const queueButton = noKeyCount > 0
    ? `<a class="btn" href="${queueHref}" data-jump-no-key-followups>${segmentQueue ? 'Open segmented no-key queue' : 'Open no-key queue'}</a>`
    : '';
  const segmentDraftControls = renderNoKeyDockSegmentControls({ plan: followUps.suggestedPlan || 'pro' });
  const aggregateSegmentDraftControls = segmentDraftControls ? '' : renderAggregateNoKeySegmentControls({
    counts: emailVerification,
    total: noKeyCount,
    plan: followUps.suggestedPlan || 'pro',
    urls: primaryCtaUrls,
  });
  const segmentDraftDock = segmentDraftControls
    ? `<div class="actions">${segmentDraftControls}<span class="status">Copy/review drafts first; mark worked only after real outreach.</span></div>`
    : aggregateSegmentDraftControls
    ? `<div class="actions">${aggregateSegmentDraftControls}<span class="status">Aggregate segment controls use counts only; paste admin token for per-recipient drafts.</span></div>`
    : '';
  const approvalPacketText = activationApprovalPacketText(data);
  const approvalButton = noKeyCount > 0
    ? `<button class="btn secondary" type="button" data-copy-activation-approval-packet="${esc(approvalPacketText)}" data-followup-count="${integer(activationDelivery.sendableQueued)}">Copy approval packet</button>`
    : '';
  const checklist = Array.isArray(action.executionChecklist) && action.executionChecklist.length
    ? `<ol class="muted" style="margin:10px 0 0 20px">${action.executionChecklist.slice(0, 5).map(item => `<li><strong>${esc(item.action || '')}</strong><br><span>${esc(item.successMetric || '')}</span></li>`).join('')}</ol>`
    : '';
  target.innerHTML = `<div class="metricList">
    <div class="metric"><span>Priority</span><strong><span class="pill ${priority === 'fix_now' ? 'bad' : 'warn'}">${esc(priority)}</span></strong></div>
    <div class="metric"><span>Metric</span><strong>${esc(metric)}</strong></div>
    <div class="metric"><span>Queued no-key signups</span><strong>${integer(noKeyCount)}</strong></div>
    <div class="metric"><span>Sendable / review-only</span><strong>${integer(activationDelivery.sendableQueued)} send · ${integer(activationDelivery.reviewOnlyQueued)} review</strong></div>
    <div class="metric"><span>Worked / copied</span><strong>${integer(worked)} worked · ${integer(copied)} copied/opened</strong></div>
    <div class="metric"><span>Dry-run / sent</span><strong>${integer(activationSend.dryRunRecipients)} unique dry-run · ${integer(activationSend.sentRecipients)} sent · ${integer(activationSend.failedRecipients)} failed</strong></div>
    <div class="metric"><span>Send approval</span><strong><span class="pill ${activationSend.sendApprovalRequired ? 'warn' : 'good'}">${activationSend.sendApprovalRequired ? 'Approval pending' : 'No pending send'}</span></strong></div>
    <div class="metric"><span>Key-first recovery</span><strong>${integer(keyFirstRedirects)} redirects · ${integer(keyRecoveryViews)} viewed</strong></div>
    <div class="metric"><span>Key creation</span><strong>${integer(keyCreateAttempts)} attempts · ${integer(keyCreateSuccesses)} created · ${integer(keyCreateFailures)} failed</strong></div>
    <div class="metric"><span>Email state</span><strong>${integer(verified)} verified · ${integer(unverified)} unverified</strong></div>
  </div>
  <p><strong>${esc(action.action || followUps.recommendedOperatorAction || 'Review the current launch funnel bottleneck.')}</strong></p>
  <p class="muted">Success metric: ${esc(action.successMetric || followUps.successMetric || 'Improve the next funnel stage.')} ${activationSend.sendApprovalRequired ? `Dry-run verified=${activationSend.dryRunVerified ? 'yes' : 'no'}; real send still needs explicit operator approval.` : ''}</p>${checklist}
  ${renderActivationNextSendStep(data, { compact: true })}
  <div class="actions">${queueButton}<a class="btn secondary" href="${esc(actionHref)}">Open recommended surface</a>${approvalButton}${mailtoButton}${copyButton}<span class="status">Use the queue buttons to record only segment/count telemetry after real outreach.</span></div>${segmentDraftDock}`;
}

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function copyLaunchBrief() {
  const brief = $('launch-brief')?.textContent || '';
  const status = $('launch-brief-status');
  if (!brief || brief.includes('Load the funnel')) {
    if (status) status.textContent = 'Load the funnel before copying the launch brief.';
    return;
  }
  try {
    await writeClipboard(brief);
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
    await writeClipboard(url);
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

async function copyActivationFollowUp(button) {
  const text = button.getAttribute('data-copy-followup') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_no_key_followup_copied', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state: 'single_copied',
      resultCount: 1,
    });
    markFollowUpSegmentDraftAction(button, 'single_copied');
    setStatus('Copied no-key signup follow-up snippet.', 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Follow-up copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyActivationFollowUpBatch(button) {
  const text = button.getAttribute('data-copy-followup-batch') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    const count = Number(button.getAttribute('data-followup-count') || noKeyFollowUpCandidates(lastCustomerData?.customers || []).length);
    const segment = button.getAttribute('data-followup-segment') || 'all';
    const batchState = segment === 'verified'
      ? 'verified_batch_copied'
      : (segment === 'unverified' ? 'unverified_batch_copied' : 'batch_copied');
    trackOperatorFunnelEvent('operator_no_key_followup_batch_copied', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state: batchState,
      resultCount: count,
    });
    markFollowUpSegmentDraftAction(button, batchState);
    setStatus(`Copied ${integer(count)} no-key signup follow-up snippets.`, 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Batch follow-up copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyActivationFollowUpUrls(button) {
  const text = button.getAttribute('data-copy-followup-urls') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    const count = Number(button.getAttribute('data-followup-count') || 0);
    const segment = button.getAttribute('data-followup-segment') || 'all';
    const state = segment === 'verified'
      ? 'verified_url_copied'
      : (segment === 'unverified' ? 'unverified_url_copied' : 'url_copied');
    trackOperatorFunnelEvent('operator_no_key_followup_batch_copied', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state,
      resultCount: count,
    });
    markFollowUpSegmentDraftAction(button, state);
    setStatus(`Copied ${segment} activation URL list for ${integer(count)} signup(s).`, 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Activation URL copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyActivationFollowUpCsv(button) {
  const text = button.getAttribute('data-copy-followup-csv') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    const count = Number(button.getAttribute('data-followup-count') || 0);
    const segment = button.getAttribute('data-followup-segment') || 'all';
    const state = segment === 'verified'
      ? 'verified_csv_copied'
      : (segment === 'unverified' ? 'unverified_csv_copied' : 'csv_copied');
    trackOperatorFunnelEvent('operator_no_key_followup_csv_copied', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state,
      resultCount: count,
    });
    markFollowUpSegmentDraftAction(button, state);
    setStatus(`Copied ${segment} no-key follow-up CSV for ${integer(count)} signup(s).`, 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`CSV copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyPrimaryFollowUpUrl(button) {
  const url = button.getAttribute('data-copy-primary-followup-url') || '';
  const text = button.getAttribute('data-copy-primary-followup-text') || url;
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    const count = Number(button.getAttribute('data-followup-count') || 0);
    const kind = button.getAttribute('data-followup-copy-kind') || 'primary_recovery_url_copied';
    trackOperatorFunnelEvent('operator_no_key_followup_batch_copied', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state: kind,
      resultCount: count,
    });
    markFollowUpSegmentDraftAction(button, kind);
    setStatus(`Copied primary key-recovery ${kind === 'primary_recovery_draft_copied' ? 'draft' : 'link set'} for ${integer(count)} queued signup(s).`, 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Primary recovery link copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyOperatorTokenCommand(button) {
  const original = button.textContent;
  try {
    await writeClipboard(OPERATOR_TOKEN_COMMAND);
    button.textContent = 'Copied';
    setStatus('Copied no-secret command. Run it locally, paste the token into Operator token, then reload no-key follow-ups.', 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Operator token command copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyOperatorExecutionPacket(button) {
  const text = button.getAttribute('data-copy-operator-packet') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_execution_packet_copied', {
      state: 'packet_copied',
      resultCount: lastFunnelData?.operatorExecutionPacket?.totalQueued || 0,
      snippet: 'operator-execution-packet',
    });
    setStatus('Copied no-secret operator execution packet.', 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Execution packet copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyActivationApprovalPacket(button) {
  const text = button.getAttribute('data-copy-activation-approval-packet') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_execution_packet_copied', {
      state: 'activation_approval_packet_copied',
      resultCount: Number(button.getAttribute('data-followup-count') || 0),
      snippet: 'activation-approval-packet',
    });
    setStatus('Copied no-secret activation approval packet. Review it before approving any real send.', 'warn');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Activation approval packet copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyActivationSendCommand(button) {
  const text = button.getAttribute('data-copy-activation-send-command') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_execution_packet_copied', {
      state: 'activation_send_command_copied',
      resultCount: Number(button.getAttribute('data-followup-count') || 0),
      snippet: 'activation-send-command',
      segment: button.getAttribute('data-followup-segment') || 'all',
    });
    setStatus('Copied explicit-approval activation send command. Run it only after operator approval; it still requires the confirmation token.', 'warn');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Activation send command copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyAuthRepairCommand(button) {
  const text = button.getAttribute('data-copy-auth-repair-command') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_execution_packet_copied', {
      state: 'auth_repair_command_copied',
      resultCount: Number(button.getAttribute('data-followup-count') || 0),
      snippet: 'auth-repair-command',
    });
    setStatus('Copied aggregate-only auth repair command. Run it with the private operator token, refresh the funnel, then re-check dry-run coverage before real sends.', 'warn');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Auth repair command copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyManagedAccessApprovalPacket(button) {
  const text = button.getAttribute('data-copy-managed-access-packet') || '';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_managed_access_packet_copied', {
      state: 'managed_access_approval_packet_copied',
      resultCount: safeList(managedProviderReadiness(lastFunnelData || {}).missingControls).length,
      snippet: 'managed-access-approval-packet',
    });
    setStatus('Copied no-secret managed-access approval packet. Keep resale disabled until every control passes.', 'warn');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Managed-access packet copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

async function copyManagedAccessCommand(button) {
  const text = managedAccessCommand(button, lastFunnelData || {});
  const kind = button.getAttribute('data-copy-managed-command') || 'dry-run';
  const original = button.textContent;
  if (!text) return;
  try {
    await writeClipboard(text);
    button.textContent = 'Copied';
    trackOperatorFunnelEvent('operator_managed_access_command_copied', {
      state: `${kind}_copied`,
      resultCount: safeList(managedProviderReadiness(lastFunnelData || {}).missingControls).length,
      snippet: 'managed-access-readiness',
    });
    setStatus(`Copied managed-access ${kind} command. Review it locally before changing production env.`, kind === 'enable-template' ? 'warn' : 'good');
  } catch (error) {
    button.textContent = 'Copy failed';
    setStatus(`Managed-access command copy failed: ${error.message}`, 'bad');
  } finally {
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
}

function markActivationFollowUpSegmentWorked(button) {
  const count = Number(button.getAttribute('data-followup-count') || 0);
  const segment = button.getAttribute('data-followup-segment') || 'all';
  const plan = button.getAttribute('data-followup-plan') || 'pro';
  if (!followUpSegmentDraftReady(plan, segment)) {
    button.disabled = true;
    button.setAttribute('data-followup-draft-ready', '0');
    setStatus(`Copy or open the ${segment} draft first; mark worked only after real outreach.`, 'warn');
    return;
  }
  const state = segment === 'verified'
    ? 'verified_marked_worked'
    : (segment === 'unverified' ? 'unverified_marked_worked' : 'marked_worked');
  trackOperatorFunnelEvent('operator_no_key_followup_batch_copied', {
    plan,
    state,
    resultCount: count,
  });
  setStatus(`Marked ${segment} no-key follow-up segment worked for ${integer(count)} signup(s).`, 'good');
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
    .replace(/^gateway_compare_/, 'gateway ')
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

function managedAccessPulse(marketingIntent = {}) {
  const events = marketingIntent.events || {};
  return [
    ['Anonymous intent clicks', events.managed_access_interest_clicked],
    ['Quick review submitted', events.managed_access_quick_request_submitted],
    ['Quick review received', events.managed_access_quick_request_received],
    ['Full form started', events.managed_access_form_started],
    ['Full form received', events.managed_access_request_received],
  ];
}

function hasManagedAccessPulseSignal(marketingIntent = {}) {
  return managedAccessPulse(marketingIntent).some(([, count]) => asNumber(count) > 0);
}

function renderManagedAccessPulse(marketingIntent = {}) {
  const rows = managedAccessPulse(marketingIntent);
  const hasSignal = hasManagedAccessPulseSignal(marketingIntent);
  return `<div>
    <h3>Anonymous demand pulse</h3>
    <table>
      <thead><tr><th>Signal</th><th>Count</th></tr></thead>
      <tbody>${rows.map(([name, count]) => `<tr><td><span class="pill${hasSignal ? ' good' : ''}">${esc(name)}</span></td><td>${integer(count)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderManagedAccessDemand(demand = {}, marketingIntent = {}) {
  const targetProviderRows = sortedEntries(demand.targetProviderFamily);
  const commercialRows = sortedEntries(demand.commercialPreference);
  const supportRows = sortedEntries(demand.supportNeed);
  const launchWindowRows = sortedEntries(demand.targetLaunchWindow);
  const intentRows = sortedEntries(demand.intent);
  const pulseBlock = renderManagedAccessPulse(marketingIntent);
  if (!targetProviderRows.length && !commercialRows.length && !supportRows.length && !launchWindowRows.length && !intentRows.length && !hasManagedAccessPulseSignal(marketingIntent)) {
    $('managed-access-demand-breakdown').innerHTML = '<div class="empty">No managed-access qualification buckets returned for this window.</div>';
    return;
  }
  $('managed-access-demand-breakdown').innerHTML = `<div class="grid2">${pulseBlock}${
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

function recoveryAuthPulse(marketingIntent = {}) {
  const events = marketingIntent.events || {};
  return [
    ['Magic link requested', asNumber(events.login_key_recovery_magic_link_requested) + asNumber(events.setup_key_recovery_magic_link_requested)],
    ['Password submitted', events.login_key_recovery_password_submitted],
    ['OAuth clicked', events.login_key_recovery_oauth_clicked],
    ['Magic link sent', asNumber(events.login_key_recovery_magic_link_sent) + asNumber(events.setup_key_recovery_magic_link_sent)],
    ['Account setup clicked', events.login_key_recovery_account_setup_clicked],
  ];
}

function hasRecoveryAuthPulseSignal(marketingIntent = {}) {
  return recoveryAuthPulse(marketingIntent).some(([, count]) => asNumber(count) > 0);
}

function renderRecoveryAuthPulse(marketingIntent = {}) {
  const rows = recoveryAuthPulse(marketingIntent);
  const hasSignal = hasRecoveryAuthPulseSignal(marketingIntent);
  return `<div>
    <h3>Recovery auth starts</h3>
    <table>
      <thead><tr><th>Signal</th><th>Count</th></tr></thead>
      <tbody>${rows.map(([name, count]) => `<tr><td><span class="pill${hasSignal ? ' good' : ''}">${esc(name)}</span></td><td>${integer(count)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
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
  const recoveryAuthBlock = renderRecoveryAuthPulse(marketingIntent);
  if (!eventRows.length && !planRows.length && !surfaceRows.length && !channelRows.length && !modelFamilyRows.length && !modelQueryRows.length && !setupBlock && !checkoutBlock && !hasRecoveryAuthPulseSignal(marketingIntent)) {
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
  }${recoveryAuthBlock}${
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
  const selectedId = health.selectedUpstreamId || health.selected || '';
  const selected = upstreams.find(row => upstreamId(row) === selectedId) || {};
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
      detail: `${upstreamLabel(selected, selectedId || '--')} selected at ${fmtLatency(selected.latency_ms)}; retry failover ${retryEnabled ? 'enabled' : 'not reported'}.`,
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
  renderManagedAccessDemand(managedAccessDemand, marketingIntent);
  renderPlanMix(mrr.byPlan || {});
  renderRevenueActions(mrr.planRevenueActions || []);
  renderNextBestActionDock(data);
  renderLaunchBrief(data);
  renderManagedAccessReadiness(data);
  renderOperatorExecutionPacket(data);
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

function noKeyFollowUpCandidates(customers = []) {
  return customers.filter(summary => {
    const activation = summary.activation || {};
    const customer = summary.customer || {};
    const status = String(customer.status || activation.status || '').toLowerCase();
    return Number(activation.activeKeyCount || 0) <= 0 &&
      activation.nextAction === 'create_key' &&
      status !== 'suspended';
  });
}

function contactExportSummaries(exportData = {}) {
  return (exportData.contacts || []).map(contact => ({
    customer: {
      email: contact.email || '',
      status: 'inactive',
      plan: contact.suggestedPlan || 'pro',
    },
    activation: {
      nextAction: contact.nextAction || 'create_key',
      activeKeyCount: 0,
      keyCount: 0,
      plan: contact.suggestedPlan || 'pro',
      status: 'inactive',
    },
    followUp: {
      nextAction: contact.nextAction || 'create_key',
      suggestedPlan: contact.suggestedPlan || 'pro',
      primaryCtaKind: 'setup_key_recovery',
      primaryCtaUrl: contact.setupKeyRecovery || contact.passwordFallback || '',
      setupKeyRecovery: contact.setupKeyRecovery || '',
      passwordFallback: contact.passwordFallback || '',
      githubOAuth: contact.githubOAuth || '',
      recommendedCtaOrder: ['setupKeyRecovery', 'passwordFallback', 'githubOAuth'],
      emailVerificationSegment: contact.emailVerificationSegment || 'unverified',
    },
    emailVerification: {
      required: true,
      verified: contact.emailVerified === true,
      source: 'operator_contact_export',
    },
    review: {
      severity: 'warn',
      flags: [{
        code: 'no_key_contact_export',
        label: 'No setup key',
        detail: 'Explicit operator contact export row.',
      }],
      flagCodes: ['no_key_contact_export'],
    },
  }));
}

function noKeyFollowUpQueueData(data = {}) {
  const customerCandidates = noKeyFollowUpCandidates(data.customers || []);
  const exportCandidates = contactExportSummaries(data.contactExport || {});
  if (exportCandidates.length && !customerCandidates.some(summary => String((summary.customer || {}).email || '').trim())) {
    return exportCandidates;
  }
  return customerCandidates;
}

function renderNoKeySegmentControls({ segment, label, customers, batchText, urlsText, csvText, mailtoUrl, plan }) {
  if (!batchText) return '';
  const count = customers.length;
  const draftReady = followUpSegmentDraftReady(plan, segment);
  const draftFirst = draftReady ? '' : ' disabled';
  return `${mailtoUrl ? `<a class="btn small" href="${esc(mailtoUrl)}" data-email-followup-batch="${esc(segment)}" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Email ${esc(label)}</a>` : ''}<button class="btn secondary small" type="button" data-copy-followup-batch="${esc(batchText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(label)} only</button><button class="btn secondary small" type="button" data-copy-followup-urls="${esc(urlsText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(label)} URLs</button><button class="btn secondary small" type="button" data-copy-followup-csv="${esc(csvText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(label)} CSV</button><button class="btn secondary small" type="button" data-send-followups="${esc(segment)}" data-send-followups-dry-run="true" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Dry-run send ${esc(label)}</button><button class="btn small" type="button" data-send-followups="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Send ${esc(label)} with typed approval</button><button class="btn small" type="button" data-mark-followup-worked="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}" data-followup-draft-ready="${draftReady ? '1' : '0'}" title="${draftReady ? 'Mark worked only after real outreach was sent.' : `Copy or open the ${esc(label)} draft first.`}"${draftFirst}>Mark ${esc(label)} worked</button>`;
}

function renderNoKeyDockSegmentControls({ plan = 'pro' } = {}) {
  const customers = noKeyFollowUpQueueData(lastCustomerData || {});
  if (!customers.length) return '';
  const verified = customers.filter(summary => emailVerificationSegment(summary) === 'verified');
  const unverified = customers.filter(summary => emailVerificationSegment(summary) === 'unverified');
  const segments = verified.length || unverified.length
    ? [
        ['verified', 'verified drafts', verified, '1'],
        ['unverified', 'unverified drafts', unverified, '2'],
      ]
    : [['all', 'all drafts', customers, '1']];
  return segments.map(([segment, label, segmentCustomers, step]) => {
    const batchText = activationFollowUpBatchText(customers, segment);
    const urlsText = activationFollowUpUrlList(customers, segment);
    const csvText = activationFollowUpCsv(customers, segment);
    const mailtoUrl = mailtoBatchFollowUpUrl(customers, segment);
    if (!segmentCustomers.length || !batchText) return '';
    const count = segmentCustomers.length;
    const draftReady = followUpSegmentDraftReady(plan, segment);
    const draftFirst = draftReady ? '' : ' disabled';
    const actionLabel = `${step}. ${label} (${integer(count)})`;
    const mailtoButton = mailtoUrl
      ? `<a class="btn small" href="${esc(mailtoUrl)}" data-email-followup-batch="${esc(segment)}" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Email ${esc(actionLabel)}</a>`
      : '';
    return `${mailtoButton}<button class="btn secondary small" type="button" data-copy-followup-batch="${esc(batchText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(actionLabel)}</button><button class="btn secondary small" type="button" data-copy-followup-urls="${esc(urlsText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(segment)} URLs (${integer(count)})</button><button class="btn secondary small" type="button" data-copy-followup-csv="${esc(csvText)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}">Copy ${esc(segment)} CSV (${integer(count)})</button><button class="btn secondary small" type="button" data-send-followups="${esc(segment)}" data-send-followups-dry-run="true" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Dry-run send ${esc(segment)} (${integer(count)})</button><button class="btn small" type="button" data-send-followups="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-count="${integer(count)}">Send ${esc(segment)} with typed approval (${integer(count)})</button><button class="btn small" type="button" data-mark-followup-worked="${esc(segment)}" data-followup-plan="${esc(plan)}" data-followup-segment="${esc(segment)}" data-followup-count="${integer(count)}" data-followup-draft-ready="${draftReady ? '1' : '0'}" title="${draftReady ? 'Mark worked only after real outreach was sent.' : `Copy or open the ${esc(segment)} draft first.`}"${draftFirst}>3. Mark ${esc(segment)} worked</button>`;
  }).join('');
}

function renderNoKeyFollowUps(data = {}) {
  const target = $('no-key-followups');
  if (!target) return;
  const customers = noKeyFollowUpQueueData(data);
  const privacy = data.privacy || {};
  const contactExport = data.contactExport || {};
  const privacyTone = customerPrivacyLabel(privacy) === 'No raw keys/hashes' ? 'good' : 'bad';
  const exportLabel = contactExport?.privacy ? contactExportPrivacyLabel(contactExport.privacy) : '';
  const exportTone = exportLabel === 'Explicit email export' ? 'warn' : 'bad';
  if (!customers.length) {
    target.innerHTML = `<div class="empty">No no-key signup follow-ups in this result set. <span class="pill ${privacyTone}">${esc(customerPrivacyLabel(privacy))}</span></div>`;
    return;
  }
  const batch = activationFollowUpBatchText(customers);
  const batchPlan = selectedActivationPlan(customers[0] || {});
  const verified = customers.filter(summary => emailVerificationSegment(summary) === 'verified');
  const unverified = customers.filter(summary => emailVerificationSegment(summary) === 'unverified');
  const verifiedBatch = activationFollowUpBatchText(customers, 'verified');
  const unverifiedBatch = activationFollowUpBatchText(customers, 'unverified');
  const verifiedUrls = activationFollowUpUrlList(customers, 'verified');
  const unverifiedUrls = activationFollowUpUrlList(customers, 'unverified');
  const allCsv = activationFollowUpCsv(customers);
  const verifiedCsv = activationFollowUpCsv(customers, 'verified');
  const unverifiedCsv = activationFollowUpCsv(customers, 'unverified');
  const verifiedMailto = mailtoBatchFollowUpUrl(customers, 'verified');
  const unverifiedMailto = mailtoBatchFollowUpUrl(customers, 'unverified');
  const apiEmailVerification = data.emailVerification || {};
  const exportSegmentCounts = contactExport.segments || {};
  const queueSummary = `<div class="metricList">
    <div class="metric"><span>Admin queue returned</span><strong>${integer(data.returned ?? customers.length)} / ${integer(data.count ?? customers.length)}</strong></div>
    <div class="metric"><span>No-key create-key</span><strong>${integer(data.noKeyCreateKey ?? contactExport.count ?? customers.length)}</strong></div>
    <div class="metric"><span>Email verification</span><strong>${integer(apiEmailVerification.verified ?? exportSegmentCounts.verified ?? verified.length)} verified · ${integer(apiEmailVerification.unverified ?? exportSegmentCounts.unverified ?? unverified.length)} unverified</strong></div>
    <div class="metric"><span>Status / action</span><strong>${esc(bucketCountsLabel(data.statusCounts))} · ${esc(bucketCountsLabel(data.nextActions))}</strong></div>
  </div>`;
  const mode = noKeyFollowUpMode();
  const segmentPrompt = mode === 'segments'
    ? '<div class="empty good">Start here: open <strong>Email verified</strong>, review/send that draft, then click <strong>Mark verified worked</strong>. Repeat for unverified. Worked buttons stay disabled until a draft is copied or opened, and record only segment/count telemetry.</div>'
    : '';
  const sendGuard = `<div class="empty warn">Real sends require the private operator token, server-side <code>sendConfirmation: ${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION}</code>, browser confirmation, and typed approval phrase <code>${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION}</code>. Dry runs are safe before approval.</div>`;
  const verifiedControls = renderNoKeySegmentControls({
    segment: 'verified',
    label: 'verified',
    customers: verified,
    batchText: verifiedBatch,
    urlsText: verifiedUrls,
    csvText: verifiedCsv,
    mailtoUrl: verifiedMailto,
    plan: batchPlan,
  });
  const unverifiedControls = renderNoKeySegmentControls({
    segment: 'unverified',
    label: 'unverified',
    customers: unverified,
    batchText: unverifiedBatch,
    urlsText: unverifiedUrls,
    csvText: unverifiedCsv,
    mailtoUrl: unverifiedMailto,
    plan: batchPlan,
  });
  target.innerHTML = `${segmentPrompt}${sendGuard}${queueSummary}<div class="actions"><button class="btn secondary small" type="button" data-copy-followup-batch="${esc(batch)}" data-followup-plan="${esc(batchPlan)}" data-followup-segment="all" data-followup-count="${integer(customers.length)}">Copy all follow-ups</button><button class="btn secondary small" type="button" data-copy-followup-csv="${esc(allCsv)}" data-followup-plan="${esc(batchPlan)}" data-followup-segment="all" data-followup-count="${integer(customers.length)}">Copy all CSV</button>${verifiedControls}${unverifiedControls}<span class="status">Operator-only batch: ${integer(customers.length)} generated-key-first snippet(s); ${integer(verified.length)} verified, ${integer(unverified.length)} unverified.</span></div><div class="tableWrap"><table>
    <thead><tr><th>Customer</th><th>Activation</th><th>Review</th><th>Follow-up</th></tr></thead>
    <tbody>${customers.map(summary => {
      const customer = summary.customer || {};
      const activation = summary.activation || {};
      const text = activationFollowUpText(summary);
      const segment = emailVerificationSegment(summary);
      const mailto = customer.email ? mailtoFollowUpUrl(summary) : '';
      return `<tr>
        <td>${esc(customerLabel(summary))}<br><span class="muted">${esc(customer.id || '')}</span></td>
        <td><span class="pill warn">${esc(customerActionLabel(activation.nextAction))}</span><br><span class="muted">${integer(activation.activeKeyCount)} active keys · ${esc(selectedActivationPlan(summary).toUpperCase())} suggested · ${esc(emailVerificationLabel(summary))}</span></td>
        <td>${renderReviewFlags(summary.review || {})}</td>
        <td><div class="actions"><a class="btn small" href="${esc(activationFollowUpUrl(summary, { recovery: true }))}" target="_blank" rel="noopener noreferrer">Open setup recovery</a><a class="btn secondary small" href="${esc(activationFollowUpUrl(summary, { auth: false }))}" target="_blank" rel="noopener noreferrer">Open email/password</a><a class="btn secondary small" href="${esc(activationFollowUpUrl(summary))}" target="_blank" rel="noopener noreferrer">Open GitHub/OAuth</a>${customer.email ? `<a class="btn secondary small" href="${esc(mailto)}" data-email-followup-single="${esc(segment)}" data-followup-segment="${esc(segment)}" data-followup-plan="${esc(selectedActivationPlan(summary))}">Email</a>` : ''}<button class="btn secondary small" type="button" data-copy-followup="${esc(text)}" data-followup-plan="${esc(selectedActivationPlan(summary))}" data-followup-segment="${esc(segment)}" data-followup-count="1">Copy snippet</button></div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <p><span class="pill ${privacyTone}">${esc(customerPrivacyLabel(privacy))}</span>${exportLabel ? ` <span class="pill ${exportTone}">${esc(exportLabel)}</span>` : ''}</p>`;
  if (mode) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function renderNoKeyFollowUpsAnalyticsFallback(error) {
  const target = $('no-key-followups');
  if (!target) return;
  const followUps = lastFunnelData?.activationFollowUps || {};
  const counts = followUps.countsByEmailVerification || {};
  const total = Number(followUps.total || 0);
  const plan = followUps.suggestedPlan || 'pro';
  const urls = followUps.primaryCtaUrls || {};
  const primaryCta = urls.setupKeyRecovery || followUps.primaryCtaUrl || urls.passwordFallback || activationFollowUpUrl({ activation: { plan } }, { recovery: true });
  const linkSet = primaryFollowUpLinkSet(plan, urls);
  const aggregateDraft = aggregateFollowUpDraft(plan, urls);
  const aggregateMailto = aggregateFollowUpMailtoUrl(plan, urls);
  const aggregateSegmentControls = renderAggregateNoKeySegmentControls({ counts, total, plan, urls });
  if (!total) {
    target.innerHTML = `<div class="empty">No no-key signup follow-ups are currently queued. Admin-token customer review is optional. <span class="pill good">Aggregate only</span></div>`;
    return;
  }
  target.innerHTML = `<div class="empty warn">
    <strong>Aggregate funnel loaded, but email-specific no-key queue needs the private admin token.</strong>
    <p class="muted">The analytics token can read `/analytics/funnel`; paste the private admin token to fetch `/admin/customers` and open per-recipient email drafts. The recovery links below are aggregate and contain no emails, customer IDs, API keys, prompts, or provider credentials.</p>
    <div class="metricList">
      <div class="metric"><span>Queued no-key signups</span><strong>${integer(total)}</strong></div>
      <div class="metric"><span>Email state</span><strong>${integer(counts.verified || 0)} verified · ${integer(counts.unverified || 0)} unverified</strong></div>
      <div class="metric"><span>Worked / copied</span><strong>${integer(followUps.operatorFollowUpWorked || 0)} worked · ${integer(followUps.operatorFollowUpCopies || 0)} copied/opened</strong></div>
      <div class="metric"><span>Key-first recovery</span><strong>${integer(followUps.keyFirstRedirects || 0)} redirects · ${integer(followUps.keyRecoveryViews || 0)} viewed</strong></div>
      <div class="metric"><span>Key creation</span><strong>${integer(followUps.keyCreateAttempts || 0)} attempts · ${integer(followUps.keyCreateSuccesses || 0)} created · ${integer(followUps.keyCreateFailures || 0)} failed</strong></div>
    </div>
    <div class="actions">
      <button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(primaryCta)}" data-copy-primary-followup-text="${esc(aggregateDraft)}" data-followup-copy-kind="primary_recovery_draft_copied" data-followup-plan="${esc(plan)}" data-followup-count="${integer(total)}">Copy aggregate no-secret draft</button>
      <button class="btn secondary" type="button" data-copy-primary-followup-url="${esc(primaryCta)}" data-copy-primary-followup-text="${esc(linkSet)}" data-followup-copy-kind="primary_recovery_url_copied" data-followup-plan="${esc(plan)}" data-followup-count="${integer(total)}">Copy aggregate recovery links</button>
      <a class="btn secondary" href="${esc(aggregateMailto)}" data-email-followup-batch="aggregate" data-followup-segment="aggregate" data-followup-plan="${esc(plan)}" data-followup-count="${integer(total)}">Open aggregate email draft</a>
      <button class="btn secondary" type="button" data-copy-operator-token-command>Copy admin-token command</button>
      <a class="btn secondary" href="${esc(primaryCta)}" target="_blank" rel="noopener noreferrer">Open aggregate recovery link</a>
      <span class="status">Admin queue unavailable with this token: ${esc(error?.message || 'unauthorized')}</span>
    </div>
    ${aggregateSegmentControls ? `<div class="actions">${aggregateSegmentControls}<span class="status">Work verified and unverified aggregate drafts separately; mark worked only after real outreach.</span></div>` : ''}
  </div>`;
}

async function fetchNoKeyFollowUps(token) {
  const target = $('no-key-followups');
  if (!target) return;
  target.innerHTML = '<div class="empty">Loading no-key signup follow-ups...</div>';
  try {
    const params = new URLSearchParams({ status: 'inactive', limit: '50' });
    const response = await fetch(`${API_BASE}/admin/customers?${params.toString()}`, {
      headers: authHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const exportParams = new URLSearchParams({ status: 'inactive', limit: '50', contactExport: 'activation' });
    const exportResponse = await fetch(`${API_BASE}/admin/customers?${exportParams.toString()}`, {
      headers: authHeaders(token),
    });
    if (exportResponse.ok) {
      data.contactExport = await exportResponse.json().catch(() => ({}));
    }
    lastCustomerData = data;
    renderNoKeyFollowUps(data);
    if (lastFunnelData) renderNextBestActionDock(lastFunnelData);
  } catch (error) {
    renderNoKeyFollowUpsAnalyticsFallback(error);
  }
}

async function sendActivationFollowUps(button) {
  const token = operatorToken();
  if (!token) {
    setStatus('Paste the private admin token before sending activation follow-ups.', 'bad');
    return;
  }
  const segment = button.getAttribute('data-send-followups') || 'all';
  const dryRun = button.getAttribute('data-send-followups-dry-run') === 'true';
  const count = Number(button.getAttribute('data-followup-count') || 0);
  if (!dryRun) {
    const typedApproval = window.prompt(ACTIVATION_FOLLOWUP_TYPED_APPROVAL_PROMPT, '');
    if (typedApproval !== ACTIVATION_FOLLOWUP_SEND_CONFIRMATION) {
      setStatus(`Real activation send canceled. Type ${ACTIVATION_FOLLOWUP_SEND_CONFIRMATION} exactly after explicit approval.`, 'warn');
      return;
    }
    if (!window.confirm(`Send generated-key setup follow-ups to ${integer(count)} ${segment} recipient(s)?`)) {
      setStatus('Real activation send canceled before delivery.', 'warn');
      return;
    }
  }
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = dryRun ? 'Dry-running...' : 'Sending...';
  try {
    const response = await fetch(`${API_BASE}/admin/customers/send-activation-followups`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status: 'inactive',
        segment,
        limit: 50,
        dryRun,
        ...(dryRun ? {} : { sendConfirmation: ACTIVATION_FOLLOWUP_SEND_CONFIRMATION }),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    trackOperatorFunnelEvent(dryRun ? 'operator_no_key_followup_send_dry_run' : 'operator_no_key_followup_sent', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state: `${segment}_${dryRun ? 'send_dry_run' : 'sent'}`,
      resultCount: data.sent || data.queued || count || 1,
    });
    markFollowUpSegmentDraftAction(button, dryRun ? `${segment}_send_dry_run` : `${segment}_sent`);
    setStatus(dryRun
      ? `Activation follow-up dry run queued ${integer(data.queued)} ${segment} recipient(s).`
      : `Sent ${integer(data.sent)} activation follow-up email(s); ${integer(data.failed)} failed.`, data.failed ? 'warn' : 'good');
  } catch (error) {
    trackOperatorFunnelEvent('operator_no_key_followup_send_failed', {
      plan: button.getAttribute('data-followup-plan') || 'pro',
      state: `${segment}_send_failed`,
      resultCount: count || 1,
    });
    setStatus(`Activation follow-up send failed: ${error.message}`, 'bad');
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
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
    lastFunnelData = data;
    renderFunnel(data);
    fetchNoKeyFollowUps(token);
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

function handleFollowUpCopyClick(event) {
  const operatorPacketButton = event.target.closest('[data-copy-operator-packet]');
  if (operatorPacketButton) {
    copyOperatorExecutionPacket(operatorPacketButton);
    return;
  }
  const activationSendCommandButton = event.target.closest('[data-copy-activation-send-command]');
  if (activationSendCommandButton) {
    copyActivationSendCommand(activationSendCommandButton);
    return;
  }
  const activationApprovalPacketButton = event.target.closest('[data-copy-activation-approval-packet]');
  if (activationApprovalPacketButton) {
    copyActivationApprovalPacket(activationApprovalPacketButton);
    return;
  }
  const authRepairCommandButton = event.target.closest('[data-copy-auth-repair-command]');
  if (authRepairCommandButton) {
    copyAuthRepairCommand(authRepairCommandButton);
    return;
  }
  const operatorTokenCommandButton = event.target.closest('[data-copy-operator-token-command]');
  if (operatorTokenCommandButton) {
    copyOperatorTokenCommand(operatorTokenCommandButton);
    return;
  }
  const managedAccessPacketButton = event.target.closest('[data-copy-managed-access-packet]');
  if (managedAccessPacketButton) {
    copyManagedAccessApprovalPacket(managedAccessPacketButton);
    return;
  }
  const managedAccessCommandButton = event.target.closest('[data-copy-managed-command]');
  if (managedAccessCommandButton) {
    copyManagedAccessCommand(managedAccessCommandButton);
    return;
  }
  const primaryUrlButton = event.target.closest('[data-copy-primary-followup-url]');
  if (primaryUrlButton) {
    copyPrimaryFollowUpUrl(primaryUrlButton);
    return;
  }
  const jumpButton = event.target.closest('[data-jump-no-key-followups]');
  if (jumpButton) {
    const href = jumpButton.getAttribute('href') || '#no-key-followups';
    if (href.startsWith('#')) {
      window.location.hash = href;
    }
    if (lastCustomerData) {
      renderNoKeyFollowUps(lastCustomerData);
    }
    $('no-key-followups')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setStatus('Opened the no-key signup queue. Send/review the drafts, then mark the worked segment.', 'good');
    return;
  }
  const workedButton = event.target.closest('[data-mark-followup-worked]');
  if (workedButton) {
    markActivationFollowUpSegmentWorked(workedButton);
    return;
  }
  const sendButton = event.target.closest('[data-send-followups]');
  if (sendButton) {
    sendActivationFollowUps(sendButton);
    return;
  }
  const emailLink = event.target.closest('[data-email-followup-batch]');
  if (emailLink) {
    const segment = emailLink.getAttribute('data-email-followup-batch') || 'all';
    const count = Number(emailLink.getAttribute('data-followup-count') || 1);
    markFollowUpSegmentDraftAction(emailLink, `${segment}_mailto_opened`);
    trackOperatorFunnelEvent('operator_no_key_followup_mailto_opened', {
      plan: emailLink.getAttribute('data-followup-plan') || 'pro',
      state: `${segment}_mailto_opened`,
      resultCount: count,
    });
    setStatus(`Opened ${segment} no-key signup email draft for ${integer(count)} recipient(s).`, 'good');
    return;
  }
  const singleEmailLink = event.target.closest('[data-email-followup-single]');
  if (singleEmailLink) {
    const segment = singleEmailLink.getAttribute('data-email-followup-single') || 'single';
    markFollowUpSegmentDraftAction(singleEmailLink, `${segment}_single_mailto_opened`);
    trackOperatorFunnelEvent('operator_no_key_followup_mailto_opened', {
      plan: singleEmailLink.getAttribute('data-followup-plan') || 'pro',
      state: `${segment}_single_mailto_opened`,
      resultCount: 1,
    });
    setStatus(`Opened ${segment} no-key signup email draft for 1 recipient.`, 'good');
    return;
  }
  const batchButton = event.target.closest('[data-copy-followup-batch]');
  if (batchButton) {
    copyActivationFollowUpBatch(batchButton);
    return;
  }
  const urlButton = event.target.closest('[data-copy-followup-urls]');
  if (urlButton) {
    copyActivationFollowUpUrls(urlButton);
    return;
  }
  const csvButton = event.target.closest('[data-copy-followup-csv]');
  if (csvButton) {
    copyActivationFollowUpCsv(csvButton);
    return;
  }
  const button = event.target.closest('[data-copy-followup]');
  if (button) copyActivationFollowUp(button);
}

document.addEventListener('DOMContentLoaded', () => {
  loadRememberedToken();
  $('controls').addEventListener('submit', fetchFunnel);
  $('operator-token').addEventListener('change', retryNoKeyFollowUpsAfterTokenPaste);
  $('operator-token').addEventListener('paste', () => window.setTimeout(retryNoKeyFollowUpsAfterTokenPaste, 0));
  $('clear-token').addEventListener('click', clearToken);
  $('customer-controls').addEventListener('submit', fetchCustomers);
  $('clear-customer-search').addEventListener('click', clearCustomerSearch);
  $('customers').addEventListener('click', handleCustomerClick);
  $('customer-detail').addEventListener('click', handleCustomerClick);
  $('acquisition-actions').addEventListener('click', handleCampaignCopyClick);
  $('no-key-followups').addEventListener('click', handleFollowUpCopyClick);
  $('next-best-action-dock').addEventListener('click', handleFollowUpCopyClick);
  $('operator-execution-packet')?.addEventListener('click', handleFollowUpCopyClick);
  $('managed-access-readiness')?.addEventListener('click', handleFollowUpCopyClick);
  $('copy-launch-brief').addEventListener('click', copyLaunchBrief);
  if ($('operator-token').value) {
    fetchFunnel();
  }
});
