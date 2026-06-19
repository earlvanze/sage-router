const API_BASE = window.SAGE_ROUTER_API_URL || 'https://api.sagerouter.dev';
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

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setStatus(message, tone = '') {
  const status = $('status');
  status.className = `status ${tone}`.trim();
  status.textContent = message;
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

function renderPlanMix(byPlan = {}) {
  const names = Object.keys(byPlan);
  if (!names.length) {
    $('plan-mix').innerHTML = '<div class="empty">No plan mix data returned.</div>';
    return;
  }
  const rows = names.sort().map((name) => {
    const plan = byPlan[name] || {};
    return `<tr>
      <td><span class="pill">${name}</span></td>
      <td>${integer(plan.currentCustomers)}</td>
      <td>${integer(plan.targetCustomers)}</td>
      <td>${integer(plan.customerGap)}</td>
      <td>${money(plan.estimatedCurrentMrrUsd)}</td>
      <td>${money(plan.targetMrrUsd)}</td>
    </tr>`;
  }).join('');
  $('plan-mix').innerHTML = `<table>
    <thead><tr><th>Plan</th><th>Current</th><th>Target</th><th>Gap</th><th>Current MRR</th><th>Target MRR</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderFunnel(data) {
  const stages = data.stages || {};
  const rates = data.rates || {};
  const mrr = data.mrr || {};
  const waitlistInterest = data.waitlistInterest || {};
  const privacy = data.privacy || {};

  setText('kpi-waitlist', integer(stages.waitlistLeads));
  setText('kpi-managed-access', integer(stages.managedAccessBetaInterest ?? waitlistInterest.managedAccess));
  setText('kpi-signups', integer(stages.signups));
  setText('kpi-mrr', money(mrr.estimatedCurrentMrrUsd));

  setText('metric-generated-keys', integer(stages.generatedApiKeys));
  setText('metric-first-request', integer(stages.firstRoutedRequest));
  setText('metric-paid-conversions', integer(stages.paidConversions));
  setText('metric-paid-customers', integer(stages.paidCustomers));
  setText('metric-retained-paid', integer(stages.retainedPaidWithUsage));
  setText('metric-key-to-first', percent(rates.generatedKeyToFirstRequest));
  setText('metric-target-mrr', money(mrr.targetMrrUsd));
  setText('metric-attainment', percent(mrr.targetAttainment));
  setText('metric-mrr-gap', money(mrr.remainingToTargetUsd));
  setText('metric-managed-share', percent(rates.managedAccessShareOfWaitlist));
  setText('metric-privacy', privacyLabel(privacy));
  setText('metric-generated-at', data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '--');

  const privacyEl = $('metric-privacy');
  privacyEl.className = privacy.containsEmails === false && privacy.containsApiKeys === false ? 'pill good' : 'pill bad';

  renderPlanMix(mrr.byPlan || {});
  $('dashboard').classList.remove('hidden');
}

async function fetchFunnel(event) {
  event?.preventDefault();
  const token = $('operator-token').value.trim();
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
      headers: { Authorization: `Bearer ${token}` },
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

function clearToken() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  $('operator-token').value = '';
  $('remember-token').checked = false;
  setStatus('Operator token cleared for this tab.');
}

document.addEventListener('DOMContentLoaded', () => {
  loadRememberedToken();
  $('controls').addEventListener('submit', fetchFunnel);
  $('clear-token').addEventListener('click', clearToken);
  if ($('operator-token').value) {
    fetchFunnel();
  }
});
