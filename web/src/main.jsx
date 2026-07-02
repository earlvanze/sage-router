import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const steps = [
  {
    number: '01',
    title: 'Point tools at one endpoint',
    body: 'Use OpenAI-compatible, Anthropic-compatible, and local endpoints from the same router running on your machine or server.',
  },
  {
    number: '02',
    title: 'Connect your authorized providers',
    body: 'Bring your own API keys, subscriptions, local models, and team-approved access. Credentials stay under your custody by default.',
  },
  {
    number: '03',
    title: 'Route, fallback, and observe',
    body: 'Route by task, provider health, latency, capability, and policy. Fall back automatically and inspect what happened afterward.',
  },
];

const routePaths = [
  {
    label: 'Cursor',
    title: 'Cursor AI router',
    href: '/cursor-ai-model-router',
    body: 'Route Cursor custom OpenAI or Anthropic-compatible traffic through one hosted edge with fallback and multimodal safeguards.',
    button: 'Cursor route path',
    state: 'route-path-cursor',
  },
  {
    label: 'Coding agents',
    title: 'Codex, Aider, Continue, OpenHands',
    href: '/coding-agent-model-router',
    body: 'Use one profile for coding agents that need tool-safe model routing, 429 failover, and local/cloud provider choice.',
    button: 'Coding agent route path',
    state: 'route-path-coding-agent',
  },
  {
    label: 'Codex CLI',
    title: 'Responses API coding route',
    href: '/codex-cli-router',
    body: 'Point Codex at one hosted, local, or Tailnet Sage Router profile with Responses API wiring and provider failover.',
    button: 'Codex CLI route path',
    state: 'route-path-codex-cli',
  },
  {
    label: 'Aider',
    title: 'Local-first coding edits',
    href: '/aider-ai-model-router',
    body: 'Point Aider at one OpenAI-compatible Sage Router endpoint with local Ollama fallback, key failover, and route telemetry.',
    button: 'Aider route path',
    state: 'route-path-aider',
  },
  {
    label: 'Continue',
    title: 'OpenAI-compatible IDE assistant',
    href: '/continue-ai-model-router',
    body: 'Configure Continue once against Sage Router for local, Tailnet, or hosted routing with health-aware failover.',
    button: 'Continue route path',
    state: 'route-path-continue',
  },
  {
    label: 'OpenHands',
    title: 'Resilient agent sessions',
    href: '/openhands-ai-model-router',
    body: 'Route OpenHands actions through one endpoint with local/cloud policy, provider health, and automatic failover.',
    button: 'OpenHands route path',
    state: 'route-path-openhands',
  },
  {
    label: 'OpenClaw',
    title: 'Serious agent workflows',
    href: '/openclaw-ai-model-router',
    body: 'Run OpenClaw behind one local, Tailnet, or hosted Sage Router endpoint with Codex OAuth passthrough and failover.',
    button: 'OpenClaw route path',
    state: 'route-path-openclaw',
  },
  {
    label: 'Claude Code',
    title: 'Anthropic-compatible coding route',
    href: '/claude-code-router',
    body: 'Route Claude Code through one Sage Router policy layer with authorized Anthropic or Dario paths, local fallback, and 429 failover.',
    button: 'Claude Code route path',
    state: 'route-path-claude-code',
  },
  {
    label: 'Ollama',
    title: 'Local Ollama + Ollama Cloud',
    href: '/ollama-ai-model-router',
    body: 'Keep local models first, add Ollama Cloud when authorized, and fail over to other providers when local capacity runs out.',
    button: 'Ollama route path',
    state: 'route-path-ollama',
  },
  {
    label: 'OpenAI API',
    title: 'OpenAI-compatible endpoint',
    href: '/openai-api-router',
    body: 'Point OpenAI SDKs and compatible clients at Sage Router for key load balancing, fallback, and route telemetry.',
    button: 'OpenAI API route path',
    state: 'route-path-openai',
  },
  {
    label: 'Azure OpenAI',
    title: 'Enterprise OpenAI-compatible routes',
    href: '/azure-openai-router',
    body: 'Route Azure OpenAI deployments through one policy layer with AZURE_OPENAI_ENDPOINT custody, BYOK keys, and 429 failover.',
    button: 'Azure OpenAI route path',
    state: 'route-path-azure',
  },
  {
    label: 'Anthropic',
    title: 'Claude-style /v1/messages',
    href: '/anthropic-api-router',
    body: 'Route Claude Code and Anthropic-compatible clients while keeping access BYOK and subscription-authorized.',
    button: 'Anthropic route path',
    state: 'route-path-anthropic',
  },
  {
    label: 'AWS Bedrock',
    title: 'Enterprise AWS model routes',
    href: '/aws-bedrock-router',
    body: 'Route customer-authorized Bedrock models through one policy layer with AWS account custody, 429 failover, and multimodal safeguards.',
    button: 'AWS Bedrock route path',
    state: 'route-path-bedrock',
  },
  {
    label: 'GitHub Copilot',
    title: 'Subscription-authorized coding routes',
    href: '/github-copilot-router',
    body: 'Keep Copilot-compatible endpoints in the coding-agent matrix with token custody, model discovery, and 429 failover.',
    button: 'GitHub Copilot route path',
    state: 'route-path-copilot',
  },
  {
    label: 'Gemini',
    title: 'Google AI + Vertex AI',
    href: '/gemini-api-router',
    body: 'Keep Gemini and Vertex routes in the agent matrix with tool-call normalization, multimodal routing, and 429 failover.',
    button: 'Gemini route path',
    state: 'route-path-gemini',
  },
  {
    label: 'xAI Grok',
    title: 'Frontier API-key route',
    href: '/xai-grok-router',
    body: 'Route Grok through the same OpenAI-compatible policy layer with XAI_API_KEY custody, model discovery, and 429 failover.',
    button: 'xAI Grok route path',
    state: 'route-path-grok',
  },
  {
    label: 'Mistral AI',
    title: 'Codestral and Mistral routes',
    href: '/mistral-ai-router',
    body: 'Route Mistral and Codestral through one policy layer with MISTRAL_API_KEY custody, code-profile fallback, and 429 failover.',
    button: 'Mistral AI route path',
    state: 'route-path-mistral',
  },
  {
    label: 'Groq',
    title: 'Low-latency Llama routes',
    href: '/groq-ai-router',
    body: 'Route Groq-hosted Llama and Mixtral through one policy layer with GROQ_API_KEY custody, latency-aware fallback, and 429 failover.',
    button: 'Groq route path',
    state: 'route-path-groq',
  },
  {
    label: 'NVIDIA NIM',
    title: 'GPU-backed hosted inference',
    href: '/nvidia-nim-router',
    body: 'Route NVIDIA NIM and NVIDIA Cloud endpoints through one policy layer with BYOK custody, load balancing, and 429 failover.',
    button: 'NVIDIA NIM route path',
    state: 'route-path-nvidia',
  },
  {
    label: 'Self-hosted',
    title: 'Local and Tailnet deployment',
    href: '/self-hosted-ai-model-router',
    body: 'Run the router on your machine, Umbrel, or Tailnet host while preserving local credential custody and dashboard control.',
    button: 'Self-hosted route path',
    state: 'route-path-self-hosted',
  },
];

const ACCOUNT_PAGE_URL = 'https://app.sagerouter.dev/account.html?plan=pro&start=create_key&utm_source=landing&utm_medium=activation&utm_campaign=sage-router-launch';
const ACCOUNT_PAGE_HREF = ACCOUNT_PAGE_URL;
const LANDING_SETUP_ACCOUNT_URL = `${ACCOUNT_PAGE_URL}&setup=landing-full-setup-bundle&source_surface=landing`;
const HERO_SETUP_ACCOUNT_URL = `${ACCOUNT_PAGE_URL}&setup=landing-hero-setup-bundle&source_surface=landing`;
const STICKY_SETUP_ACCOUNT_URL = `${ACCOUNT_PAGE_URL}&setup=landing-sticky-setup-bundle&source_surface=landing`;
const LANDING_KEY_RECOVERY_URL = '/setup-key-recovery?utm_source=landing&utm_medium=recovery&utm_campaign=signup_to_key_recovery&source_surface=landing';
const MANAGED_ONE_SUBSCRIPTION_URL = '/managed-access?intent=one-subscription&utm_source=landing&utm_medium=managed_access&utm_campaign=sage-router-launch&utm_content=one-subscription-review#managed-access-quick-form';
const MANAGED_MAX_IMPLEMENTATION_URL = '/managed-access?intent=max-implementation&utm_source=landing&utm_medium=managed_access&utm_campaign=sage-router-launch&utm_content=max-implementation-review#managed-access-quick-form';
const MANAGED_ACCESS_REVIEW_EMAIL = 'support@sagerouter.dev';
const ACTIVATION_NUDGE_STORAGE_KEY = 'sage_router_activation_nudge_dismissed_until';
const SUPABASE_URL = 'https://awtangrlqqsdpksarhwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dGFuZ3JscXFzZHBrc2FyaHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTYzNzEsImV4cCI6MjA4ODU5MjM3MX0.U7TmEJMgYMH0rR8tTWFQ2tzReO5syRwnI3Ytg-BbDaw';

function referrerHost() {
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    return referrer && referrer.host !== window.location.host ? referrer.host : null;
  } catch {
    return null;
  }
}

function trackLandingFunnelEvent(event, data = {}) {
  const params = new URLSearchParams(window.location.search);
  const payload = JSON.stringify({
    event,
    plan: data.plan || null,
    sourcePage: window.location.href,
    target: data.target || null,
    metadata: {
      source: 'landing',
      button: data.button || null,
      state: data.state || null,
      utmSource: params.get('utm_source') || params.get('utmSource') || null,
      utmMedium: params.get('utm_medium') || params.get('utmMedium') || null,
      utmCampaign: params.get('utm_campaign') || params.get('utmCampaign') || null,
      referrerHost: referrerHost(),
      landingPath: window.location.pathname,
      snippet: data.snippet || null,
      intent: data.intent || null,
      commercialPreference: data.commercialPreference || null,
      supportNeed: data.supportNeed || null,
    },
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
    credentials: 'omit',
  }).catch(() => {});
}

function trackManagedAccessReviewClick({ target, button, state, intent, commercialPreference, supportNeed }) {
  const eventData = { target, button, state, intent, commercialPreference, supportNeed };
  trackLandingFunnelEvent('landing_managed_access_clicked', eventData);
  trackLandingFunnelEvent('managed_access_interest_clicked', eventData);
}

function landingSetupBundleText() {
  return `# Sage Router hosted edge setup
# 1) Create a hosted key:
# ${LANDING_SETUP_ACCOUNT_URL}

export OPENAI_BASE_URL=https://api.sagerouter.dev/v1
export OPENAI_API_KEY=sk_sage_your_key_here
export SAGE_ROUTER_MODEL=sage-router/frontier

# 2) Verify your key can see routed models
curl "$OPENAI_BASE_URL/models" \\
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 3) Send the first routed request
curl "$OPENAI_BASE_URL/chat/completions" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "'$SAGE_ROUTER_MODEL'",
    "messages": [{"role": "user", "content": "Route this well"}]
  }'

# Codex profile:
# [model_providers.sage-router-hosted]
# name = "Sage Router Hosted"
# base_url = "https://api.sagerouter.dev/v1"
# env_key = "OPENAI_API_KEY"
# wire_api = "responses"
#
# [profiles.sage-router-frontier]
# model_provider = "sage-router-hosted"
# model = "sage-router/frontier"
#
# Full quickstart:
# https://sagerouter.dev/quickstart
#
# Local-first option:
# python3 router.py --port 8790
# export OPENAI_BASE_URL=http://localhost:8790/v1`;
}

function landingOneSubscriptionReviewText() {
  return [
    'Sage Router one-subscription review from homepage',
    '',
    'Request: review Sage Router as one subscription for hosted routing, quotas, failover, local-first controls, and Max implementation support.',
    'Intent: one-subscription',
    'Provider access posture: needs-managed-access',
    'Target provider family: mixed-frontier',
    'Commercial preference: one-subscription',
    'Support need: managed-provider-review',
    'Target launch window: exploring',
    '',
    `Review URL: https://sagerouter.dev${MANAGED_ONE_SUBSCRIPTION_URL}`,
    `Immediate BYOK fallback: ${ACCOUNT_PAGE_URL.replace('plan=pro', 'plan=max')}&utm_content=landing-one-subscription-review-packet`,
    '',
    'Boundary: managed provider access is disabled until provider authorization, provider terms acknowledgment, an authorized provider allowlist, a private cost model, positive unit economics, quotas, audit events, abuse controls, and acceptable-use controls pass.',
    'OpenRouter and other OpenAI-compatible endpoints remain customer-authorized BYOK routes unless separate managed-access authorization is added later.',
    '',
    'Do not paste prompts, provider credentials, OAuth tokens, generated API keys, private keys, cookies, raw provider responses, actual provider costs, customer IDs, or customer data.',
  ].join('\n');
}

function landingManagedAccessContactRequestText(email = '') {
  const cleanEmail = String(email || '').trim();
  return [
    'Sage Router homepage managed-access contact request',
    '',
    `Work email: ${cleanEmail || '[add work email]'}`,
    'Intent: one-subscription',
    'Provider access posture: needs-managed-access',
    'Target provider family: mixed-frontier',
    'Commercial preference: one-subscription',
    'Support need: managed-provider-review',
    'Target launch window: this-month',
    '',
    'Request: private-beta review for one Sage Router subscription with hosted routing, quotas, fallback reliability, local-first controls, and Max/BYOK fallback while managed provider access remains gated.',
    `Review URL: https://sagerouter.dev${MANAGED_ONE_SUBSCRIPTION_URL}`,
    '',
    'Boundary: this is a review request, not an enabled managed-provider resale entitlement. Managed access still requires provider authorization, terms acknowledgment, allowed provider families, private cost review, positive unit economics, durable quotas, operator audit events, and acceptable-use controls.',
    '',
    'Do not include prompts, workflow text, provider credentials, OAuth tokens, generated API keys, private keys, cookies, raw provider responses, actual provider costs, customer IDs, or customer data.',
  ].join('\n');
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

function LandingSetupCopy() {
  const [status, setStatus] = useState('');

  return (
    <div className="landingSetupCopy">
      <button type="button" onClick={async () => {
        try {
          await writeClipboardText(landingSetupBundleText());
          trackLandingFunnelEvent('quickstart_snippet_copied', {
            button: 'Copy hosted setup bundle',
            state: 'homepage-terminal',
            snippet: 'landing-full-setup-bundle',
          });
          setStatus('Copied hosted setup bundle.');
        } catch {
          setStatus('Copy failed. Open the quickstart for manual setup.');
        }
      }}>
        Copy hosted setup bundle
      </button>
      <a href="/quickstart" onClick={() => trackLandingFunnelEvent('landing_quickstart_clicked', {
        target: '/quickstart',
        button: 'Open full quickstart',
        state: 'homepage-terminal',
      })}>
        Open full quickstart →
      </a>
      <span role="status" aria-live="polite">{status}</span>
    </div>
  );
}

function HeroSetupCopy() {
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    trackLandingFunnelEvent('landing_post_copy_prompt_shown', {
      plan: 'pro',
      target: ACCOUNT_PAGE_HREF,
      state: 'post-copy',
      snippet: 'landing-hero-setup-bundle',
    });
  }, [copied]);

  return (
    <div className="heroSetupCopyWrap">
      <div className="heroSetupCopy">
        <button type="button" className="button setupBundleButton" onClick={async () => {
          try {
            await writeClipboardText(landingSetupBundleText());
            trackLandingFunnelEvent('quickstart_snippet_copied', {
              button: 'Copy 60-second setup bundle',
              state: 'hero-primary-setup',
              snippet: 'landing-hero-setup-bundle',
            });
            setStatus('Copied. Next: create your sk_sage API key so the commands can run.');
            setCopied(true);
          } catch {
            setStatus('Copy failed. Open the quickstart for manual setup.');
            setCopied(false);
          }
        }}>
          {copied ? 'Setup copied ✓' : 'Copy 60-second setup bundle'}
        </button>
        <a className="button postCopyAccountButton" href={copied ? HERO_SETUP_ACCOUNT_URL : ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_setup_next_clicked', {
          plan: 'pro',
          target: copied ? HERO_SETUP_ACCOUNT_URL : ACCOUNT_PAGE_HREF,
          button: copied ? 'Create API key next after copy' : 'Create API key next',
          state: copied ? 'post-copy' : 'pre-copy',
          snippet: 'landing-hero-setup-bundle',
        })}>
          Create API key next
        </a>
        <span role="status" aria-live="polite">{status}</span>
      </div>
      {copied && (
        <div className="heroPostCopyPrompt" role="status" aria-live="polite">
          <strong>Setup copied. Create your key now.</strong>
          <span>The bundle is already pointed at <code>https://api.sagerouter.dev/v1</code>; it only needs your generated <code>sk_sage_*</code> key.</span>
          <a href={HERO_SETUP_ACCOUNT_URL} onClick={() => trackLandingFunnelEvent('landing_setup_next_clicked', {
            plan: 'pro',
            target: HERO_SETUP_ACCOUNT_URL,
            button: 'Post-copy create API key panel',
            state: 'post-copy-panel',
            snippet: 'landing-hero-setup-bundle',
          })}>
            Generate the API key →
          </a>
        </div>
      )}
    </div>
  );
}

function StickyActivationBar() {
  const [setupStatus, setSetupStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const copyStickySetup = async () => {
    if (copied) {
      trackLandingFunnelEvent('landing_setup_next_clicked', {
        plan: 'pro',
        target: STICKY_SETUP_ACCOUNT_URL,
        button: 'Sticky create API key after copy',
        state: 'sticky-post-copy',
        snippet: 'landing-sticky-setup-bundle',
      });
      window.location.href = STICKY_SETUP_ACCOUNT_URL;
      return;
    }
    try {
      await writeClipboardText(landingSetupBundleText());
      trackLandingFunnelEvent('quickstart_snippet_copied', {
        button: 'Sticky copy 60-second setup',
        state: 'sticky-activation',
        snippet: 'landing-sticky-setup-bundle',
      });
      setCopied(true);
      setSetupStatus('Setup copied. Create API key next.');
    } catch {
      trackLandingFunnelEvent('landing_quickstart_clicked', {
        target: '/quickstart',
        button: 'Sticky copy fallback quickstart',
        state: 'sticky-copy-failed',
      });
      setSetupStatus('Copy failed. Opening quickstart...');
      window.setTimeout(() => {
        window.location.href = '/quickstart';
      }, 900);
    }
  };

  return (
    <aside className="stickyActivationBar" aria-label="Hosted API activation">
      <div>
        <strong>Hosted API is live.</strong>
        <span>{setupStatus || 'Copy the setup bundle first, then create an API key; no provider key or credit card required yet.'}</span>
      </div>
      <button className="button primary stickySetupButton" type="button" onClick={copyStickySetup}>
        {copied ? 'Create API key next' : 'Copy 60-second setup first'}
      </button>
      <a className="button secondary" href={ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_account_clicked', {
        plan: 'pro',
        target: ACCOUNT_PAGE_HREF,
        button: 'Sticky create API key',
        state: 'sticky-activation',
      })}>
        Create API key
      </a>
      <a className="button secondary stickyRecoveryButton" href={LANDING_KEY_RECOVERY_URL} onClick={() => trackLandingFunnelEvent('landing_key_recovery_clicked', {
        plan: 'pro',
        target: LANDING_KEY_RECOVERY_URL,
        button: 'Sticky finish setup key',
        state: 'sticky-recovery',
      })}>
        Finish setup key
      </a>
      <a className="button secondary stickyManagedButton" href={MANAGED_ONE_SUBSCRIPTION_URL} onClick={() => trackManagedAccessReviewClick({
        target: MANAGED_ONE_SUBSCRIPTION_URL,
        button: 'Sticky one-subscription review',
        state: 'sticky-managed-access',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      })}>
        One-subscription beta
      </a>
    </aside>
  );
}

function LandingKeyRecovery() {
  return (
    <div className="landingKeyRecovery" aria-label="Returning user key recovery">
      <span>Already signed up but no <code>sk_sage</code> key yet?</span>
      <a href={LANDING_KEY_RECOVERY_URL} onClick={() => trackLandingFunnelEvent('landing_key_recovery_clicked', {
        plan: 'pro',
        target: LANDING_KEY_RECOVERY_URL,
        button: 'Landing finish setup key',
        state: 'landing-returning-user',
      })}>
        Finish setup key
      </a>
    </div>
  );
}

function ManagedAccessReviewPrompt() {
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const widgetRef = useRef(null);
  const widgetIdRef = useRef(null);
  const presentationTrackedRef = useRef(false);
  const focusTrackedRef = useRef(false);
  const startedTrackedRef = useRef(false);
  const [turnstile, setTurnstile] = useState({ required: false, siteKey: '', token: '' });

  useEffect(() => {
    if (presentationTrackedRef.current) return;
    presentationTrackedRef.current = true;
    const telemetry = {
      plan: 'max',
      target: '#homepage-managed-access-review-form',
      button: 'Homepage one-subscription email',
      state: 'hero-managed-access-quick-form-presented',
      intent: 'one-subscription',
      commercialPreference: 'one-subscription',
      supportNeed: 'managed-provider-review',
    };
    trackLandingFunnelEvent('managed_access_contact_capture_landed', telemetry);
    trackLandingFunnelEvent('managed_access_quick_form_presented', telemetry);
    trackLandingFunnelEvent('managed_access_contact_handoff_prompted', {
      ...telemetry,
      target: '#homepage-managed-access-contact-fallback',
      button: 'Homepage managed-access contact fallback',
      state: 'hero-managed-access-contact-handoff',
      snippet: 'landing-homepage-managed-access-contact-handoff',
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/waitlist')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.turnstileRequired && data?.turnstileSiteKey) {
          setTurnstile({ required: true, siteKey: data.turnstileSiteKey, token: '' });
        } else if (!cancelled && data?.turnstileRequired) {
          setStatus('Verification is temporarily unavailable. Use the managed-access page or copy the review packet.');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!turnstile.required || !turnstile.siteKey || !widgetRef.current || widgetIdRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !api || !widgetRef.current || widgetIdRef.current) return;
        widgetIdRef.current = api.render(widgetRef.current, {
          sitekey: turnstile.siteKey,
          callback: (token) => setTurnstile((current) => ({ ...current, token })),
          'expired-callback': () => setTurnstile((current) => ({ ...current, token: '' })),
          'error-callback': () => {
            setTurnstile((current) => ({ ...current, token: '' }));
            setStatus('Verification failed. Use the managed-access page or copy the review packet.');
          },
        });
      })
      .catch(() => setStatus('Verification could not load. Use the managed-access page or copy the review packet.'));
    return () => {
      cancelled = true;
    };
  }, [turnstile.required, turnstile.siteKey]);

  const resetTurnstile = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstile((current) => ({ ...current, token: '' }));
  };

  const copyReviewPacket = async () => {
    try {
      await writeClipboardText(landingOneSubscriptionReviewText());
      trackLandingFunnelEvent('managed_access_review_packet_copied', {
        plan: 'max',
        target: MANAGED_ONE_SUBSCRIPTION_URL,
        button: 'Hero copy one-subscription review packet',
        state: 'hero-managed-access-copy',
        snippet: 'landing-one-subscription-review-packet',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setStatus('Copied no-secret one-subscription review packet.');
    } catch {
      setStatus('Copy failed. Open managed-access review instead.');
    }
  };

  const copyContactRequest = async () => {
    try {
      await writeClipboardText(landingManagedAccessContactRequestText(email));
      trackLandingFunnelEvent('managed_access_contact_packet_copied', {
        plan: 'max',
        target: '#homepage-managed-access-review-form',
        button: 'Homepage copy contact request',
        state: 'hero-managed-access-contact-copy',
        snippet: 'landing-homepage-managed-access-contact-request',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setStatus('Copied no-secret contact request. Add work email before sending.');
    } catch {
      setStatus('Copy failed. Open the managed-access page or email support without secrets.');
    }
  };

  const openContactDraft = () => {
    const subject = 'Sage Router one-subscription review request';
    const body = landingManagedAccessContactRequestText(email);
    const draftUrl = `mailto:${MANAGED_ACCESS_REVIEW_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    trackLandingFunnelEvent('managed_access_contact_draft_opened', {
      plan: 'max',
      target: `mailto:${MANAGED_ACCESS_REVIEW_EMAIL}`,
      button: 'Homepage open contact email draft',
      state: 'hero-managed-access-contact-draft',
      snippet: 'landing-homepage-managed-access-contact-draft',
      intent: 'one-subscription',
      commercialPreference: 'one-subscription',
      supportNeed: 'managed-provider-review',
    });
    setStatus('Opening no-secret email draft. Add work email before sending.');
    window.location.href = draftUrl;
  };

  const submitManagedAccessReview = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      trackLandingFunnelEvent('managed_access_quick_request_validation_failed', {
        plan: 'max',
        target: '#homepage-managed-access-review-form',
        button: 'Homepage one-subscription email',
        state: 'hero-managed-access-email-missing',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setStatus('Enter a work email for the private-beta review request.');
      return;
    }
    if (turnstile.required && !turnstile.token) {
      trackLandingFunnelEvent('managed_access_quick_request_validation_failed', {
        plan: 'max',
        target: '#homepage-managed-access-review-form',
        button: 'Homepage one-subscription email',
        state: 'hero-managed-access-turnstile-missing',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setStatus('Complete verification first. This stores only contact plus qualification buckets.');
      return;
    }
    setSubmitting(true);
    setStatus('Requesting one-subscription review...');
    trackLandingFunnelEvent('managed_access_quick_request_submitted', {
      plan: 'max',
      target: '#homepage-managed-access-review-form',
      button: 'Homepage one-subscription email',
      state: 'hero-managed-access-quick-form',
      intent: 'one-subscription',
      commercialPreference: 'one-subscription',
      supportNeed: 'managed-provider-review',
    });
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          email: trimmedEmail,
          interest: 'managed-access',
          intent: 'one-subscription',
          deployment: 'hybrid',
          monthlyVolume: '200k-1m',
          providerAccess: 'needs-managed-access',
          targetProviderFamily: 'mixed-frontier',
          commercialPreference: 'one-subscription',
          supportNeed: 'managed-provider-review',
          targetLaunchWindow: 'this-month',
          sourcePage: `${window.location.origin}${window.location.pathname}`,
          turnstileToken: turnstile.token,
        }),
      });
      if (!response.ok) throw new Error('managed_access_review_failed');
      trackLandingFunnelEvent('managed_access_quick_request_received', {
        plan: 'max',
        target: '#homepage-managed-access-review-form',
        button: 'Homepage one-subscription email',
        state: 'hero-managed-access-quick-form',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setEmail('');
      resetTurnstile();
      setStatus('Review request received. Use Max with BYOK while one-subscription access stays gated.');
    } catch {
      resetTurnstile();
      trackLandingFunnelEvent('managed_access_quick_request_failed', {
        plan: 'max',
        target: '#homepage-managed-access-review-form',
        button: 'Homepage one-subscription email',
        state: 'hero-managed-access-quick-form',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      });
      setStatus('Could not submit here. Open managed-access review or copy the packet; do not send secrets.');
    } finally {
      setSubmitting(false);
    }
  };

  const focusManagedAccessReview = () => {
    if (focusTrackedRef.current) return;
    focusTrackedRef.current = true;
    trackLandingFunnelEvent('managed_access_quick_form_focused', {
      plan: 'max',
      target: '#homepage-managed-access-review-form',
      button: 'Homepage one-subscription email',
      state: 'hero-managed-access-quick-form',
      intent: 'one-subscription',
      commercialPreference: 'one-subscription',
      supportNeed: 'managed-provider-review',
    });
  };

  const updateManagedAccessEmail = (event) => {
    const nextEmail = event.target.value;
    setEmail(nextEmail);
    if (startedTrackedRef.current || !nextEmail.trim()) return;
    startedTrackedRef.current = true;
    trackLandingFunnelEvent('managed_access_quick_form_started', {
      plan: 'max',
      target: '#homepage-managed-access-review-form',
      button: 'Homepage one-subscription email',
      state: 'hero-managed-access-quick-form',
      intent: 'one-subscription',
      commercialPreference: 'one-subscription',
      supportNeed: 'managed-provider-review',
    });
  };

  return (
    <div className="managedAccessPrompt" aria-label="One-subscription private beta review">
      <div>
        <strong>Need one subscription instead of BYOK?</strong>
        <span>Request private-beta review. Hosted managed provider access still waits for provider authorization, terms, cost controls, and margin checks.</span>
      </div>
      <form id="homepage-managed-access-review-form" className="managedAccessInlineForm" onSubmit={submitManagedAccessReview}>
        <input
          type="email"
          value={email}
          onChange={updateManagedAccessEmail}
          onFocus={focusManagedAccessReview}
          placeholder="work email"
          aria-label="Work email for one-subscription review"
        />
        <button type="submit" disabled={submitting}>{submitting ? 'Requesting...' : 'Request review'}</button>
        {turnstile.required && <div className="turnstileSlot managedAccessTurnstile" ref={widgetRef} />}
      </form>
      <div id="homepage-managed-access-contact-fallback" className="managedAccessFallbackActions" aria-label="Homepage managed-access contact fallback">
        <button type="button" onClick={copyContactRequest}>Copy contact request</button>
        <button type="button" onClick={openContactDraft}>Open email draft</button>
        <a href={`mailto:${MANAGED_ACCESS_REVIEW_EMAIL}?subject=${encodeURIComponent('Sage Router one-subscription review request')}`} onClick={() => trackLandingFunnelEvent('managed_access_contact_draft_opened', {
          plan: 'max',
          target: `mailto:${MANAGED_ACCESS_REVIEW_EMAIL}`,
          button: 'Homepage direct managed-access email',
          state: 'hero-managed-access-direct-email',
          snippet: 'landing-homepage-managed-access-direct-email',
          intent: 'one-subscription',
          commercialPreference: 'one-subscription',
          supportNeed: 'managed-provider-review',
        })}>Email support</a>
      </div>
      <a href={MANAGED_ONE_SUBSCRIPTION_URL} onClick={() => trackManagedAccessReviewClick({
        target: MANAGED_ONE_SUBSCRIPTION_URL,
        button: 'Hero one-subscription review',
        state: 'hero-managed-access',
        intent: 'one-subscription',
        commercialPreference: 'one-subscription',
        supportNeed: 'managed-provider-review',
      })}>
        Request one-subscription review
      </a>
      <a href={MANAGED_MAX_IMPLEMENTATION_URL} onClick={() => trackManagedAccessReviewClick({
        target: MANAGED_MAX_IMPLEMENTATION_URL,
        button: 'Hero Max implementation review',
        state: 'hero-managed-access',
        intent: 'max-implementation',
        commercialPreference: 'private-contract',
        supportNeed: 'implementation-support',
      })}>
        Max implementation review
      </a>
      <button type="button" onClick={copyReviewPacket}>
        Copy review packet
      </button>
      <span className="managedAccessCopyStatus" role="status" aria-live="polite">{status}</span>
    </div>
  );
}

function ActivationNudge() {
  const [visible, setVisible] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);
  const [setupStatus, setSetupStatus] = useState('');
  const shownRef = useRef(false);

  useEffect(() => {
    const dismissedUntil = Number(window.localStorage?.getItem(ACTIVATION_NUDGE_STORAGE_KEY) || 0);
    if (dismissedUntil && dismissedUntil > Date.now()) return undefined;

    const show = (state) => {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
      trackLandingFunnelEvent('landing_activation_nudge_shown', {
        plan: 'pro',
        target: ACCOUNT_PAGE_HREF,
        button: 'Activation nudge',
        state,
      });
    };

    const onScroll = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (window.scrollY / scrollable > 0.38) show('scroll-depth');
    };

    const timer = window.setTimeout(() => show('time-on-page'), 12000);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage?.setItem(ACTIVATION_NUDGE_STORAGE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {}
    trackLandingFunnelEvent('landing_activation_nudge_dismissed', {
      plan: 'pro',
      target: ACCOUNT_PAGE_HREF,
      button: 'Activation nudge dismiss',
      state: 'dismissed',
    });
    setVisible(false);
  };

  const startGithub = async () => {
    setOauthSubmitting(true);
    trackLandingFunnelEvent('landing_activation_nudge_clicked', {
      plan: 'pro',
      target: ACCOUNT_PAGE_HREF,
      button: 'Activation nudge GitHub',
      state: 'github',
    });
    trackLandingFunnelEvent('landing_oauth_clicked', {
      plan: 'pro',
      target: ACCOUNT_PAGE_HREF,
      button: 'Activation nudge GitHub',
      state: 'github',
    });
    try {
      const api = await loadSupabaseScript();
      const client = api.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: ACCOUNT_PAGE_HREF },
      });
      if (error) throw error;
    } catch {
      trackLandingFunnelEvent('landing_oauth_failed', {
        plan: 'pro',
        target: ACCOUNT_PAGE_HREF,
        button: 'Activation nudge GitHub',
        state: 'github',
      });
      window.location.href = ACCOUNT_PAGE_HREF;
    } finally {
      setOauthSubmitting(false);
    }
  };

  const copyNudgeSetup = async () => {
    try {
      await writeClipboardText(landingSetupBundleText());
      trackLandingFunnelEvent('quickstart_snippet_copied', {
        button: 'Activation nudge copy setup first',
        state: 'activation-nudge',
        snippet: 'landing-nudge-setup-bundle',
      });
      trackLandingFunnelEvent('landing_post_copy_prompt_shown', {
        plan: 'pro',
        target: LANDING_SETUP_ACCOUNT_URL,
        button: 'Activation nudge copy setup first',
        state: 'activation-nudge-post-copy',
        snippet: 'landing-nudge-setup-bundle',
      });
      setSetupCopied(true);
      setSetupStatus('Setup copied. Create the API key next.');
    } catch {
      trackLandingFunnelEvent('landing_quickstart_clicked', {
        target: '/quickstart',
        button: 'Activation nudge copy fallback quickstart',
        state: 'activation-nudge-copy-failed',
      });
      setSetupCopied(false);
      setSetupStatus('Copy failed. Open the quickstart for manual setup.');
    }
  };

  if (!visible) return null;

  return (
    <aside className="activationNudge" aria-label="Create a Sage Router API key">
      <button type="button" className="activationNudgeClose" onClick={dismiss} aria-label="Dismiss activation prompt">×</button>
      <div>
        <strong>Ready to try the live edge?</strong>
        <span>{setupStatus || 'Copy setup first, then generate a Pro key; checkout only unlocks routing after the key exists.'}</span>
      </div>
      <button type="button" className="button secondary" onClick={copyNudgeSetup}>
        {setupCopied ? 'Setup copied' : 'Copy setup first'}
      </button>
      <button type="button" className="button primary" onClick={startGithub} disabled={oauthSubmitting}>
        {oauthSubmitting ? 'Opening GitHub...' : 'Continue with GitHub'}
      </button>
      <a className="button secondary" href={setupCopied ? LANDING_SETUP_ACCOUNT_URL : ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_activation_nudge_clicked', {
        plan: 'pro',
        target: setupCopied ? LANDING_SETUP_ACCOUNT_URL : ACCOUNT_PAGE_HREF,
        button: setupCopied ? 'Activation nudge create key after setup copy' : 'Activation nudge create key',
        state: setupCopied ? 'activation-nudge-post-copy' : 'account',
        snippet: setupCopied ? 'landing-nudge-setup-bundle' : null,
      })}>
        {setupCopied ? 'Create API key next' : 'Create API key'}
      </a>
    </aside>
  );
}

const loadTurnstileScript = () => new Promise((resolve, reject) => {
  if (window.turnstile) {
    resolve(window.turnstile);
    return;
  }
  const existing = document.querySelector('script[data-turnstile]');
  if (existing) {
    existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.turnstile = 'true';
  script.addEventListener('load', () => resolve(window.turnstile), { once: true });
  script.addEventListener('error', reject, { once: true });
  document.head.appendChild(script);
});

const loadSupabaseScript = () => new Promise((resolve, reject) => {
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

function LandingEmailStart() {
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  const startGithub = async () => {
    setOauthSubmitting(true);
    setStatus('Opening GitHub sign-in for Pro.');
    trackLandingFunnelEvent('landing_oauth_clicked', {
      plan: 'pro',
      target: ACCOUNT_PAGE_URL,
      button: 'Continue with GitHub for Pro',
      state: 'github',
    });
    try {
      const api = await loadSupabaseScript();
      const client = api.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: ACCOUNT_PAGE_URL },
      });
      if (error) throw error;
    } catch (error) {
      trackLandingFunnelEvent('landing_oauth_failed', {
        plan: 'pro',
        target: ACCOUNT_PAGE_URL,
        button: 'Continue with GitHub for Pro',
        state: 'github',
      });
      setStatus('GitHub sign-in failed here. Opening the account flow...');
      window.setTimeout(() => {
        window.location.href = ACCOUNT_PAGE_URL;
      }, 900);
    } finally {
      setOauthSubmitting(false);
    }
  };

  return (
    <form id="hero-email-form" className="heroEmailStart" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = String(new FormData(form).get('email') || '').trim();
      if (!email) {
        setStatus('Enter an email first.');
        return;
      }
      setSubmitting(true);
      setStatus('Sending secure sign-in link...');
      trackLandingFunnelEvent('landing_magic_link_requested', {
        plan: 'pro',
        target: ACCOUNT_PAGE_URL,
        button: 'Email API key setup link',
        state: 'email-start',
      });
      try {
        const api = await loadSupabaseScript();
        const client = api.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: ACCOUNT_PAGE_URL,
            data: {
              sage_router_onboarding: true,
              signup_source: 'landing',
              selected_plan: 'pro',
              auth_method: 'magic_link',
            },
          },
        });
        if (error) throw error;
        form.reset();
        trackLandingFunnelEvent('landing_magic_link_sent', {
          plan: 'pro',
          target: ACCOUNT_PAGE_URL,
          button: 'Email API key setup link',
          state: 'email-start',
        });
        setStatus('Check your inbox for the API key setup link. It opens Pro activation with generated-key creation queued first.');
      } catch (error) {
        trackLandingFunnelEvent('landing_magic_link_failed', {
          plan: 'pro',
          target: ACCOUNT_PAGE_URL,
          button: 'Email API key setup link',
          state: 'email-start',
        });
        setStatus('Email link failed. Opening the account flow...');
        window.setTimeout(() => {
          window.location.href = ACCOUNT_PAGE_URL;
        }, 900);
      } finally {
        setSubmitting(false);
      }
    }}>
      <label htmlFor="hero-email">Create your sk_sage key first</label>
      <p className="heroEmailStartLead">Open the generated-key account flow now, or send yourself the same Pro activation link. No checkout, provider key, or local install before the key exists.</p>
      <a className="heroKeyDirectButton" href={ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_key_first_direct_clicked', {
        plan: 'pro',
        target: ACCOUNT_PAGE_HREF,
        button: 'Open account key creator',
        state: 'hero-key-first',
      })}>
        Open account key creator
      </a>
      <button className="heroOauthButton" type="button" onClick={startGithub} disabled={oauthSubmitting}>
        {oauthSubmitting ? 'Opening GitHub...' : 'Continue with GitHub for Pro'}
      </button>
      <div>
        <input id="hero-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required />
        <button type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Email API key setup link'}</button>
      </div>
      <p className="heroEmailStartStatus" aria-live="polite">{status || 'No provider key or credit card required until your generated sk_sage key exists.'}</p>
    </form>
  );
}

function WaitlistForm() {
  const widgetRef = useRef(null);
  const widgetIdRef = useRef(null);
  const initialInterest = new URLSearchParams(window.location.search).get('interest') || 'general';
  const interest = /^[a-z0-9-]{1,80}$/i.test(initialInterest) ? initialInterest : 'general';
  const managedAccessInterest = interest === 'managed-access';
  const [status, setStatus] = useState('');
  const [turnstile, setTurnstile] = useState({ required: false, siteKey: '', token: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/waitlist')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.turnstileRequired && data?.turnstileSiteKey) {
          setTurnstile({ required: true, siteKey: data.turnstileSiteKey, token: '' });
        } else if (!cancelled && data?.turnstileRequired) {
          setStatus('Verification is temporarily unavailable.');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!turnstile.required || !turnstile.siteKey || !widgetRef.current || widgetIdRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !api || !widgetRef.current || widgetIdRef.current) return;
        widgetIdRef.current = api.render(widgetRef.current, {
          sitekey: turnstile.siteKey,
          callback: (token) => setTurnstile((current) => ({ ...current, token })),
          'expired-callback': () => setTurnstile((current) => ({ ...current, token: '' })),
          'error-callback': () => {
            setTurnstile((current) => ({ ...current, token: '' }));
            setStatus('Verification failed. Refresh and try again.');
          },
        });
      })
      .catch(() => setStatus('Verification could not load. Try again later.'));
    return () => {
      cancelled = true;
    };
  }, [turnstile.required, turnstile.siteKey]);

  const resetTurnstile = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstile((current) => ({ ...current, token: '' }));
  };

  return (
    <form className="waitlistForm" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      if (turnstile.required && !turnstile.token) {
        setStatus('Complete verification first.');
        return;
      }
      setStatus('Submitting...');
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            interest,
            sourcePage: `${window.location.origin}${window.location.pathname}`,
            turnstileToken: turnstile.token,
          }),
        });
        if (!response.ok) throw new Error('Submit failed');
        form.reset();
        resetTurnstile();
        trackLandingFunnelEvent('landing_waitlist_submitted', {
          target: '#waitlist',
          button: 'Join waitlist',
          state: interest,
        });
        setStatus('You are on the list.');
      } catch (error) {
        resetTurnstile();
        setStatus('Could not submit. Try again or use GitHub for now.');
      }
    }}>
      <input name="website" tabIndex="-1" autoComplete="off" className="honeypot" aria-hidden="true" />
      <input name="interest" type="hidden" value={interest} readOnly />
      {managedAccessInterest && (
        <p className="formNote">Requesting private-beta interest for managed provider access. Public plans still require customer-authorized provider access.</p>
      )}
      <input name="email" type="email" placeholder="you@example.com" required />
      <input name="company" type="text" placeholder="Company or project" />
      <button type="submit">Join waitlist</button>
      {turnstile.required && <div className="turnstileSlot" ref={widgetRef} />}
      <p data-status>{status}</p>
    </form>
  );
}

function App() {
  useEffect(() => {
    trackLandingFunnelEvent('landing_viewed', { state: 'page-view' });
  }, []);

  return (
    <main>
      <StickyActivationBar />
      <ActivationNudge />
      <section className="hero">
        <nav className="nav" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="Sage Router home">
            <span className="brandMark">S</span>
            <span>Sage Router</span>
          </a>
          <div className="navLinks">
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#automation">Automation</a>
            <a href="#analytics">Analytics</a>
            <a href="/compare/model-gateways">Compare</a>
            <a href="/compare/openrouter">OpenRouter</a>
            <a href="/local-first-routing-for-ai-agents">Guide</a>
            <a href="/self-hosted-ai-model-router">Self-hosted</a>
            <a href="/ollama-ai-model-router">Ollama</a>
            <a href="/openai-api-router">OpenAI API</a>
            <a href="/azure-openai-router">Azure OpenAI</a>
            <a href="/anthropic-api-router">Anthropic</a>
            <a href="/aws-bedrock-router">AWS Bedrock</a>
            <a href="/github-copilot-router">GitHub Copilot</a>
            <a href="/codex-cli-router">Codex CLI</a>
            <a href="/aider-ai-model-router">Aider</a>
            <a href="/continue-ai-model-router">Continue</a>
            <a href="/openhands-ai-model-router">OpenHands</a>
            <a href="/openclaw-ai-model-router">OpenClaw</a>
            <a href="/claude-code-router">Claude Code</a>
            <a href="/xai-grok-router">xAI Grok</a>
            <a href="/mistral-ai-router">Mistral AI</a>
            <a href="/groq-ai-router">Groq</a>
            <a href="/nvidia-nim-router">NVIDIA NIM</a>
            <a href="/coding-agent-model-router">Coding Agents</a>
            <a href="/cursor-ai-model-router">Cursor</a>
            <a href="/integrations">Integrations</a>
            <a href="/quickstart">Quickstart</a>
            <a href="/models">Models</a>
            <a href="/model-routing-calculator">Calculator</a>
            <a href="/launch-plan">Launch Plan</a>
            <a href="/managed-access">Managed Access</a>
            <a href="/billing">Billing</a>
            <a href="/pricing">Pricing</a>
            <a href="/security">Security</a>
            <a href="/status">Status</a>
            <a href="/analytics.html">Dashboard</a>
            <a href="/login.html">Login</a>
            <a href="#docs">Guides</a>
            <a href="#waitlist">Updates</a>
            <a href="https://github.com/earlvanze/sage-router">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid" id="top">
          <div className="heroCopy">
            <p className="eyebrow">Hosted API live • open-source • local-first</p>
            <h1>Smarter model routing for serious AI agents.</h1>
            <p className="subhero">
              Copy the 60-second setup bundle, create a hosted Sage Router API key, then point tools at <code>https://api.sagerouter.dev/v1</code>
              and route OpenClaw, Hermes, Pi agents, Codex, Claude Code, Cursor, Aider, Continue,
              OpenHands, and OpenAI-compatible clients across authorized providers and local/cloud models.
            </p>
            <HeroSetupCopy />
            <LandingEmailStart />
            <LandingKeyRecovery />
            <ManagedAccessReviewPrompt />
            <div className="heroActions heroPrimaryActions">
              <a className="button primary" href={ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_account_clicked', {
                plan: 'pro',
                target: ACCOUNT_PAGE_HREF,
                button: 'Start API key activation',
                state: 'hero-primary',
              })}>
                Start API key activation
              </a>
              <a className="button secondary" href="/pricing" onClick={() => trackLandingFunnelEvent('landing_pricing_clicked', {
                target: '/pricing',
                button: 'Compare hosted plans',
                state: 'hero-primary',
              })}>
                Compare hosted plans
              </a>
              <a className="button secondary" href="/quickstart" onClick={() => trackLandingFunnelEvent('landing_quickstart_clicked', {
                target: '/quickstart',
                button: 'Read quickstart',
                state: 'hero-primary',
              })}>
                Read quickstart
              </a>
              <a className="button secondary" href="/compare/model-gateways" onClick={() => trackLandingFunnelEvent('landing_gateway_compare_clicked', {
                target: '/compare/model-gateways',
                button: 'Compare gateways',
                state: 'hero-primary',
              })}>
                Compare gateways
              </a>
            </div>
            <div className="heroExploreLinks" aria-label="Secondary Sage Router paths">
              <span>Explore:</span>
              <a href="/billing" onClick={() => trackLandingFunnelEvent('landing_billing_clicked', {
                target: '/billing',
                button: 'Billing help',
                state: 'hero-secondary',
              })}>Billing help</a>
              <a href="/integrations" onClick={() => trackLandingFunnelEvent('landing_integrations_clicked', {
                target: '/integrations',
                button: 'Browse integrations',
                state: 'hero-secondary',
              })}>Browse integrations</a>
              <a href="/status" onClick={() => trackLandingFunnelEvent('landing_status_clicked', {
                target: '/status',
                button: 'View public status',
                state: 'hero-secondary',
              })}>View public status</a>
              <a href="/compare/openrouter" onClick={() => trackLandingFunnelEvent('landing_gateway_compare_clicked', {
                target: '/compare/openrouter',
                button: 'Compare OpenRouter',
                state: 'hero-secondary-openrouter',
              })}>Compare OpenRouter</a>
              <a href="/local-first-routing-for-ai-agents" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/local-first-routing-for-ai-agents',
                button: 'Read local-first guide',
                state: 'hero-secondary',
              })}>Read local-first guide</a>
              <a href="/self-hosted-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/self-hosted-ai-model-router',
                button: 'Self-hosted router',
                state: 'hero-secondary-self-hosted',
              })}>Self-hosted router</a>
              <a href="/ollama-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/ollama-ai-model-router',
                button: 'Ollama router',
                state: 'hero-secondary-ollama-router',
              })}>Ollama router</a>
              <a href="/openai-api-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/openai-api-router',
                button: 'OpenAI API router',
                state: 'hero-secondary-openai-router',
              })}>OpenAI API router</a>
              <a href="/azure-openai-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/azure-openai-router',
                button: 'Azure OpenAI router',
                state: 'hero-secondary-azure-router',
              })}>Azure OpenAI router</a>
              <a href="/anthropic-api-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/anthropic-api-router',
                button: 'Anthropic API router',
                state: 'hero-secondary-anthropic-router',
              })}>Anthropic API router</a>
              <a href="/aws-bedrock-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/aws-bedrock-router',
                button: 'AWS Bedrock router',
                state: 'hero-secondary-bedrock-router',
              })}>AWS Bedrock router</a>
              <a href="/github-copilot-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/github-copilot-router',
                button: 'GitHub Copilot router',
                state: 'hero-secondary-copilot-router',
              })}>GitHub Copilot router</a>
              <a href="/codex-cli-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/codex-cli-router',
                button: 'Codex CLI router',
                state: 'hero-secondary-codex-cli-router',
              })}>Codex CLI router</a>
              <a href="/aider-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/aider-ai-model-router',
                button: 'Aider router',
                state: 'hero-secondary-aider-router',
              })}>Aider router</a>
              <a href="/continue-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/continue-ai-model-router',
                button: 'Continue router',
                state: 'hero-secondary-continue-router',
              })}>Continue router</a>
              <a href="/openhands-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/openhands-ai-model-router',
                button: 'OpenHands router',
                state: 'hero-secondary-openhands-router',
              })}>OpenHands router</a>
              <a href="/openclaw-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/openclaw-ai-model-router',
                button: 'OpenClaw router',
                state: 'hero-secondary-openclaw-router',
              })}>OpenClaw router</a>
              <a href="/claude-code-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/claude-code-router',
                button: 'Claude Code router',
                state: 'hero-secondary-claude-code-router',
              })}>Claude Code router</a>
              <a href="/xai-grok-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/xai-grok-router',
                button: 'xAI Grok router',
                state: 'hero-secondary-grok-router',
              })}>xAI Grok router</a>
              <a href="/mistral-ai-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/mistral-ai-router',
                button: 'Mistral AI router',
                state: 'hero-secondary-mistral-router',
              })}>Mistral AI router</a>
              <a href="/groq-ai-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/groq-ai-router',
                button: 'Groq router',
                state: 'hero-secondary-groq-router',
              })}>Groq router</a>
              <a href="/nvidia-nim-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/nvidia-nim-router',
                button: 'NVIDIA NIM router',
                state: 'hero-secondary-nvidia-router',
              })}>NVIDIA NIM router</a>
              <a href="/coding-agent-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/coding-agent-model-router',
                button: 'Coding agent router',
                state: 'hero-secondary-coding-agent-router',
              })}>Coding agent router</a>
              <a href="/cursor-ai-model-router" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/cursor-ai-model-router',
                button: 'Cursor router',
                state: 'hero-secondary-cursor-router',
              })}>Cursor router</a>
              <a href="/reddit-ai-gateway-evaluation" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/reddit-ai-gateway-evaluation',
                button: 'Reddit evaluation kit',
                state: 'hero-secondary-reddit-evaluation',
              })}>Reddit evaluation kit</a>
              <a href="/reliability-proof" onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
                target: '/reliability-proof',
                button: 'Reliability proof kit',
                state: 'hero-secondary-reliability-proof',
              })}>Reliability proof</a>
              <a href="/models" onClick={() => trackLandingFunnelEvent('landing_models_clicked', {
                target: '/models',
                button: 'Browse models',
                state: 'hero-secondary',
              })}>Browse models</a>
              <a href="/model-routing-calculator" onClick={() => trackLandingFunnelEvent('landing_calculator_clicked', {
                target: '/model-routing-calculator',
                button: 'Estimate routing savings',
                state: 'hero-secondary',
              })}>Estimate routing savings</a>
              <a href={MANAGED_ONE_SUBSCRIPTION_URL} onClick={() => trackManagedAccessReviewClick({
                target: MANAGED_ONE_SUBSCRIPTION_URL,
                button: 'Explore one-subscription review',
                state: 'hero-secondary-one-subscription',
                intent: 'one-subscription',
                commercialPreference: 'one-subscription',
                supportNeed: 'managed-provider-review',
              })}>One-subscription review</a>
              <a href={MANAGED_MAX_IMPLEMENTATION_URL} onClick={() => trackManagedAccessReviewClick({
                target: MANAGED_MAX_IMPLEMENTATION_URL,
                button: 'Explore Max implementation review',
                state: 'hero-secondary-max-implementation',
                intent: 'max-implementation',
                commercialPreference: 'private-contract',
                supportNeed: 'implementation-support',
              })}>Max implementation review</a>
              <a href="/security" onClick={() => trackLandingFunnelEvent('landing_security_clicked', {
                target: '/security',
                button: 'Review security',
                state: 'hero-secondary',
              })}>Review security</a>
              <a href="/analytics.html" onClick={() => trackLandingFunnelEvent('landing_analytics_clicked', {
                target: '/analytics.html',
                button: 'View analytics dashboard',
                state: 'hero-secondary',
              })}>View analytics dashboard</a>
              <a href="/login.html" onClick={() => trackLandingFunnelEvent('landing_login_clicked', {
                target: '/login.html',
                button: 'Sign in',
                state: 'hero-secondary',
              })}>Sign in</a>
              <a href="https://github.com/earlvanze/sage-router" onClick={() => trackLandingFunnelEvent('landing_github_clicked', {
                target: 'https://github.com/earlvanze/sage-router',
                button: 'Run locally',
                state: 'hero-secondary',
              })}>Run locally</a>
            </div>
            <p className="complianceNote">
              Hosted plans include account-managed keys, quotas, analytics, and reliability routing.
              Bring your own authorized provider access; Sage Router does not resell models, pool
              accounts, or bypass provider terms.
            </p>
            <div className="activationStrip" aria-label="Hosted activation path">
              <div>
                <strong>1. Pick Pro</strong>
                <span>Plan intent is preserved through sign-in.</span>
              </div>
              <div>
                <strong>2. Create <code>sk_sage_*</code></strong>
                <span>Generate a key in the browser account flow.</span>
              </div>
              <div>
                <strong>3. Verify the edge</strong>
                <span>Test <code>/v1/models</code> and send a first request.</span>
              </div>
              <a className="activationCta" href={ACCOUNT_PAGE_HREF} onClick={() => trackLandingFunnelEvent('landing_account_clicked', {
                plan: 'pro',
                target: ACCOUNT_PAGE_HREF,
                button: 'Start API key activation',
                state: 'activation-strip',
              })}>
                Start API key activation →
              </a>
            </div>
          </div>

          <div className="terminalCard" aria-label="Sage Router quick start terminal example">
            <div className="terminalTop">
              <span></span><span></span><span></span>
            </div>
            <pre>{`# run the local router
python3 router.py --port 8790

# connect an OpenAI-compatible tool
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router

# Sage Router selects a route
route: codex-task → local/qwen-coder
fallback: openai/gpt-4.1 → anthropic/sonnet`}</pre>
            <LandingSetupCopy />
          </div>
        </div>
      </section>

      <section className="section hotSwap" aria-label="Hot-swappable AI engine layer">
        <div>
          <p className="eyebrow">Hot-swappable model layer</p>
          <h2>Your agents’ engine is now hot-swappable.</h2>
        </div>
        <p>
          Swap models without rewiring your agents. Sage Router lets agent harnesses route and fail
          over between authorized providers, subscriptions, local models, and cloud engines, improving
          speed, reliability, and task fit when a model is slow, down, or wrong for the job.
        </p>
      </section>

      <section className="section routePaths" aria-label="Choose a Sage Router path">
        <div className="sectionHeader">
          <p className="eyebrow">Choose your route path</p>
          <h2>Start from the tool or provider you already use.</h2>
          <p>
            Pick the path closest to your current workflow, copy the setup bundle, then use the same
            hosted API key and dashboard policy controls as you expand across providers and models.
          </p>
        </div>
        <div className="routePathGrid">
          {routePaths.map((route) => (
            <a className="routePathCard" key={route.href} href={route.href} onClick={() => trackLandingFunnelEvent('landing_article_clicked', {
              target: route.href,
              button: route.button,
              state: route.state,
            })}>
              <span>{route.label}</span>
              <h3>{route.title}</h3>
              <p>{route.body}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="section intro">
        <div>
          <p className="eyebrow">Why it exists</p>
          <h2>Built when basic routing stopped being enough.</h2>
        </div>
        <p>
          OpenClaw’s built-in model routing was not smart enough for serious agent workflows, so we
          built a better layer: routing across your own providers, subscriptions, API keys, and local
          models with fewer brittle tool-by-tool configs.
        </p>
      </section>

      <section className="section cards" aria-label="Core product promises">
        <article>
          <h3>Route across what you already have</h3>
          <p>
            Use OpenAI, Anthropic, Gemini, Grok, NVIDIA NIM / NVIDIA Cloud, GitHub Copilot-compatible endpoints, Ollama, and
            other local or authorized providers behind one policy-aware gateway.
          </p>
        </article>
        <article id="security">
          <h3>Keys stay local by default</h3>
          <p>
            The default architecture keeps provider credentials on your machine or server. Routing
            policy and fallback behavior stay inspectable instead of disappearing inside a black-box proxy.
          </p>
        </article>
        <article>
          <h3>Agent-grade fallback</h3>
          <p>
            Route for coding, reasoning, chat, refactors, documentation, health, latency, and model
            capability, then fall back when providers fail or rate limit.
          </p>
        </article>
      </section>

      <section className="section how" id="how">
        <div className="sectionHeader">
          <p className="eyebrow">How it works</p>
          <h2>One endpoint. Your policies. Better routes.</h2>
        </div>
        <div className="steps">
          {steps.map((step) => (
            <article className="step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>


      <section className="section analytics" id="analytics">
        <div className="sectionHeader">
          <p className="eyebrow">Paid performance intelligence</p>
          <h2>Free routing. Paid analytics that prove the best route.</h2>
          <p>
            When teams bring their own subscriptions, they are not paying Sage for model access. They are paying
            for live provider intelligence: latency trends, error rates, fallback frequency, best-model recommendations,
            and alerts when a provider degrades.
          </p>
          <p><a className="inlineLink" href="/analytics.html">Open the private analytics dashboard →</a></p>
          <p><a className="inlineLink" href="/compare/model-gateways">Read the model gateway comparison →</a></p>
          <p><a className="inlineLink" href="/compare/openrouter">Compare Sage Router vs OpenRouter →</a></p>
          <p><a className="inlineLink" href="/local-first-routing-for-ai-agents">Read the local-first routing guide →</a></p>
          <p><a className="inlineLink" href="/self-hosted-ai-model-router">See the self-hosted router path →</a></p>
          <p><a className="inlineLink" href="/ollama-ai-model-router">Route local Ollama and Ollama Cloud →</a></p>
          <p><a className="inlineLink" href="/openai-api-router">Route OpenAI-compatible API traffic →</a></p>
          <p><a className="inlineLink" href="/anthropic-api-router">Route Claude-style Anthropic traffic →</a></p>
          <p><a className="inlineLink" href="/coding-agent-model-router">Route Codex, Cursor, Aider, Continue, and OpenHands →</a></p>
          <p><a className="inlineLink" href="/cursor-ai-model-router">Route Cursor through Sage Router →</a></p>
          <p><a className="inlineLink" href="/model-routing-calculator">Estimate routing savings for one workflow →</a></p>
          <p><a className="inlineLink" href="/managed-access?intent=one-subscription#managed-access-quick-form">Request one-subscription review →</a></p>
          <p><a className="inlineLink" href="/pricing">See hosted routing pricing and plan limits →</a></p>
        </div>
        <div className="cards">
          <article>
            <h3>Model rankings over time</h3>
            <p>See which model is fastest and most reliable by task type, provider, route mode, and time window.</p>
          </article>
          <article>
            <h3>Degradation detection</h3>
            <p>Spot rate limits, timeouts, empty outputs, and provider slowdowns before they break agent workflows.</p>
          </article>
          <article>
            <h3>Routing recommendations</h3>
            <p>Turn telemetry into policy suggestions: default models, fallback order, budget caps, and providers to cancel.</p>
          </article>
        </div>
      </section>

      <section className="section integrations" id="docs">
        <div className="sectionHeader">
          <p className="eyebrow">Integrations</p>
          <h2>Connect the tools your agents already use.</h2>
          <p>
            One clean guide grid for agent harnesses, local runtimes, cloud APIs, SDK-compatible clients,
            and harness fallback routes.
          </p>
        </div>
        <div className="docsGrid">
          {[
            ['Codex', 'Codex CLI via the OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/codex.md'],
            ['Claude Code', 'Anthropic Messages routing with fallback behind one endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/claude-code.md'],
            ['OpenClaw', 'Route OpenClaw agents across local, cloud, and authorized providers.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openclaw.md'],
            ['Hermes', 'Operator-agent routing for status, review, and escalation workflows.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/hermes.md'],
            ['Pi agents', 'Route Pi agents through one OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/pi.md'],
            ['Cursor', 'Use OpenAI-compatible or Anthropic-compatible routing from Cursor.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/cursor.md'],
            ['Ollama / Cloud', 'Local Ollama plus :cloud model routing through the local runtime.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/ollama.md'],
            ['NVIDIA NIM', 'NVIDIA-backed inference as a BYOK provider route.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/nvidia-nim.md'],
            ['Aider', 'Aider via the OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/aider.md'],
            ['Continue', 'Continue configured against the Sage Router endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/continue.md'],
            ['OpenHands', 'OpenHands through one policy-routed OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openhands.md'],
            ['OpenAI clients', 'Drop-in base URL for SDKs and similar tools.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openai-compatible.md'],
            ['Anthropic clients', 'Claude-style /v1/messages routing with local policy and fallback.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/anthropic-compatible.md'],
            ['Harness fallback', 'Policy-based failover for agent harnesses across your authorized providers.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/harness-fallback.md'],
          ].map(([title, body, href]) => (
            <a className="guideCard" key={title} href={href} aria-label={body}>
              <strong>{title}</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="section searchIntents" id="automation">
        <div className="sectionHeader">
          <p className="eyebrow">Model selection automation</p>
          <h2>How to automate AI model selection.</h2>
          <p>
            Put Sage Router between your agents and model providers. Your tools send requests to one
            local endpoint, while routing policy selects the right model by task type, required
            capability, provider health, latency, fallback order, and local-vs-cloud preference.
          </p>
        </div>
        <div className="intentGrid">
          <article>
            <h3>Route requests across providers</h3>
            <p>
              Configure authorized access for OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama,
              local models, and other BYOK providers, then expose a stable router endpoint to agents
              and developer tools.
            </p>
          </article>
          <article>
            <h3>Local-first BYOK model routing for AI agents</h3>
            <p>
              Keep provider credentials on your machine or server by default. Sage Router gives teams
              routing policy, health checks, and fallback behavior without default custody of customer
              provider keys.
            </p>
          </article>
          <article>
            <h3>Policy-based routing for teams using their own providers</h3>
            <p>
              Sage Router is routing infrastructure for teams that already have authorized provider
              accounts, subscriptions, API keys, local models, or approved proxy endpoints and want
              smarter selection and fallback.
            </p>
          </article>
          <article>
            <h3>Local + Ollama Cloud hybrid routing</h3>
            <p>
              The router supports local Ollama and Ollama Cloud today through your local Ollama
              runtime. Sage Router discovers available cloud models, can auto-pull matching
              <code>:cloud</code> models, and routes between them and other cloud APIs with
              health-aware fallback.
            </p>
          </article>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="sectionHeader">
          <p className="eyebrow">FAQ</p>
          <h2>Answers for AI model routing.</h2>
        </div>
        <div className="faqList">
          <details open>
            <summary>What is an AI model router?</summary>
            <p>An AI model router is middleware that receives LLM requests and selects which model or provider should handle them based on policy, task type, availability, latency, cost, context size, capability, or fallback rules.</p>
          </details>
          <details>
            <summary>How do I automate model/provider selection for AI agents?</summary>
            <p>Run Sage Router locally, configure your authorized providers and local models, then point OpenAI-compatible or Anthropic-compatible tools at the Sage Router endpoint. The router performs model selection and fallback without every tool needing its own routing logic.</p>
          </details>
          <details>
            <summary>Does Sage Router work with OpenAI-compatible and Anthropic clients?</summary>
            <p>Yes. The repo documents OpenAI-compatible chat completions and Anthropic-compatible messages endpoints, plus Google/Gemini-style endpoints for supported tools.</p>
          </details>
          <details>
            <summary>Can Sage Router route between Ollama, Ollama Cloud, and cloud APIs?</summary>
            <p>Sage Router supports local Ollama and Ollama Cloud today through Ollama running locally. It discovers available <code>:cloud</code> models, can auto-pull discovered cloud models, and routes between local Ollama, Ollama Cloud, NVIDIA NIM, and other cloud APIs according to policy and health.</p>
          </details>
          <details>
            <summary>Where do provider API keys live?</summary>
            <p>By default, provider credentials live locally on the customer machine or server. Sage Router is designed so routing and fallback do not require default custody of customer provider keys.</p>
          </details>
        </div>
      </section>

      <section className="section presets" id="presets">
        <div className="sectionHeader">
          <p className="eyebrow">Provider profiles</p>
          <h2>Routing presets for agent jobs.</h2>
          <p>
            Provider profiles turn routing expertise into reusable defaults: best model for coding,
            best model for fast chat, best local fallback, and hybrid local/cloud routes.
          </p>
        </div>
        <div className="presetGrid">
          <article><h3>Best model for coding</h3><p>Route coding, refactor, and debugging tasks to coding-strong models with sensible fallbacks.</p></article>
          <article><h3>Best model for fast chat</h3><p>Prefer low-latency models for lightweight agent chatter, planning, and status checks.</p></article>
          <article><h3>Best local fallback</h3><p>Keep agents moving with local models when cloud providers are down, slow, or rate limited.</p></article>
          <article><h3>Hybrid local/cloud routes</h3><p>Blend local Ollama routes, Ollama Cloud models exposed through your local Ollama runtime, cloud APIs, and NVIDIA NIM endpoints behind one endpoint.</p></article>
        </div>
      </section>


      <section className="section waitlistSection" id="waitlist">
        <div className="sectionHeader">
          <p className="eyebrow">Updates</p>
          <h2>Get launch and integration updates.</h2>
          <p>Hosted signup is live. Use this list for release notes, integration updates, private deployment help, and one-subscription managed-provider beta interest.</p>
        </div>
        <WaitlistForm />
      </section>

      <footer>
        <span>© Sage Router</span>
        <a href="https://github.com/earlvanze/sage-router">GitHub</a>
        <a href="/login.html">Login</a>
        <a href="/pricing">Pricing</a>
        <a href="/compare/model-gateways">Compare gateways</a>
        <a href="/compare/openrouter">OpenRouter</a>
        <a href="/local-first-routing-for-ai-agents">Local-first Guide</a>
        <a href="/self-hosted-ai-model-router">Self-hosted</a>
        <a href="/ollama-ai-model-router">Ollama</a>
        <a href="/openai-api-router">OpenAI API</a>
        <a href="/azure-openai-router">Azure OpenAI</a>
        <a href="/anthropic-api-router">Anthropic</a>
        <a href="/aws-bedrock-router">AWS Bedrock</a>
        <a href="/github-copilot-router">GitHub Copilot</a>
        <a href="/codex-cli-router">Codex CLI</a>
        <a href="/aider-ai-model-router">Aider</a>
        <a href="/continue-ai-model-router">Continue</a>
        <a href="/openhands-ai-model-router">OpenHands</a>
        <a href="/openclaw-ai-model-router">OpenClaw</a>
        <a href="/claude-code-router">Claude Code</a>
        <a href="/xai-grok-router">xAI Grok</a>
        <a href="/mistral-ai-router">Mistral AI</a>
        <a href="/groq-ai-router">Groq</a>
        <a href="/nvidia-nim-router">NVIDIA NIM</a>
        <a href="/coding-agent-model-router">Coding Agents</a>
        <a href="/cursor-ai-model-router">Cursor</a>
        <a href="/model-routing-calculator">Calculator</a>
        <a href="/launch-plan">Launch Plan</a>
        <a href="/managed-access">Managed Access</a>
        <a href="/security">Security</a>
        <a href="/status">Status</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/acceptable-use">Acceptable Use</a>
        <a href="https://github.com/earlvanze/sage-router#readme">Docs</a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
