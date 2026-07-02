# Sage Router SaaS launch plan: $10k MRR

This plan turns the current hosted Sage Router surface into a measurable SaaS
launch target while preserving the product boundary: sell routing, account
management, reliability, quotas, analytics, and support. Do not claim model
resale, pooled provider accounts, or unauthorized provider access.

## Revenue target

Target: `$10,000 MRR` from hosted Sage Router subscriptions.

Current verified snapshot from the hosted launch funnel:

- Estimated MRR: `$60 / $10,000` target (`0.6%`).
- Paid customers: `2`.
- Generated-key customers: `1`.
- First routed request customers: `1`.
- Setup snippet copies: `2`.
- Founder-sales outreach copies: `0`.
- Managed-access packet copies: `0`.

Near-term revenue priority: convert active generated-key and first-request
users into Pro buyers with the frontier profile, analytics, and live failover
proof before claiming bundled managed-provider access. One-subscription demand
should route to managed-access review until provider authorization, terms,
private cost model, and positive unit economics are approved.

Current public plan ladder:

| Plan | Price | Included requests | Rate limit | Best fit |
| --- | ---: | ---: | ---: | --- |
| Lite | $6/month | 10,000/month | 60/minute | Individual agent experiments |
| Pro | $30/month | 50,000/month | 180/minute | Daily agent development, frontier routing, and Fusion synthesis |
| Max | $72/month | 200,000/month | 600/minute | Automation, teams, high-volume agents, and priority Fusion budget |

Straight-line paths:

| Mix | Monthly revenue |
| --- | ---: |
| 334 Pro customers | $10,020 |
| 139 Max customers | $10,008 |
| 100 Lite + 200 Pro + 50 Max | $10,200 |
| 50 Lite + 150 Pro + 75 Max | $10,200 |

Recommended launch target: the mixed path. It proves low-friction signup, a
serious Pro workflow, and a high-volume Max segment without depending on a
single buyer type.

Current gap to the mixed path:

- Lite pilot: `100` Lite customers, `$600` remaining MRR.
- Pro conversion: `198` Pro customers, `$5,940` remaining MRR.
- Max review: `50` Max customers, `$3,600` remaining MRR.

## Conversion funnel

| Stage | Target metric | Product surface |
| --- | ---: | --- |
| Visitor to waitlist/signup | 5% | `sagerouter.dev`, `/pricing`, `/compare/model-gateways` |
| Signup to generated key | 60% | `app.sagerouter.dev/account.html` |
| Generated key to first routed request | 50% | `/quickstart` OpenAI-compatible setup |
| Trial/free to paid | 15% | Stripe checkout and plan gating |
| Paid logo retention | 85% monthly | usage quotas, status, analytics, fallback value |

At those assumptions, 10,000 qualified visitors can produce roughly 500
signups, 300 API-key creators, 150 first routed users, and 22 to 25 paid users.
The first paid cohort is not enough for $10k MRR, so launch must combine
inbound SEO, direct agent-community outreach, and founder-led conversion for
Max accounts.

## Packaging

Sell one simple Sage Router subscription for:

- hosted account, API-key, and quota management;
- public edge routing at `https://api.sagerouter.dev/v1`;
- route health, fallback policy, and analytics;
- Tailnet/private router resilience;
- support and private deployment guidance.

Provider access remains customer-authorized by default. Managed provider
resale should only be introduced after explicit provider terms, billing, margin,
positive unit economics, metering, and abuse controls are in place.

The public `/pricing` metadata must keep `publicLaunch.managedProviderAccess`
disabled by default. Turning on bundled/managed model access requires explicit
provider resale terms, an explicit operator acknowledgment of those terms, an
authorized provider-family allowlist, a published margin policy, a minimum
gross-margin threshold, a configured provider cost model with a positive value
(`SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS`), durable quota and
rate-limit enforcement, generated-key revocation, operator abuse review, and
managed-access acceptable-use terms before it can be marketed as a launchable
offer. OpenRouter remains a supported BYOK-compatible provider and model
discovery source, but it does not count as a managed subscription resale family
unless separate provider authorization is added later.
`providerFamilyReadiness` and `oneSubscriptionReadiness` make that boundary
machine-readable: Ollama, OpenAI, and Anthropic can become managed-access
families only after authorization and cost controls, while OpenRouter remains
discoverable and routable through customer-authorized BYOK configuration.

The public prerequisite pages at `/provider-resale-terms` and `/margin-policy`
document the required legal and unit-economics boundaries for a future private
beta. They do not activate managed resale by themselves; the runtime must still
keep `publicLaunch.managedProviderAccess.enabled` false unless the provider
authorization, provider-family allowlist, terms acknowledgment, billing,
margin, quota, metering, and abuse-control checks are explicitly enabled. A
pricing page alone is not enough; the runtime readiness guard must prove
positive unit economics by comparing public plan price/quotas against the
configured provider cost model before bundled access can be treated as
launchable. Public metadata can show each plan's public revenue and derived
maximum safe provider cost per 1,000 requests for the margin threshold, but it
must not expose the configured provider cost.
Likewise, `SAGEROUTER_MANAGED_PROVIDER_RESALE_REQUESTED=1` is only an operator
review marker until the full prerequisite set is present; the runtime must
publish `requested: true`, `readinessSatisfied: false`, `enabled: false`, and
`missingControls` for incomplete configurations instead of advertising bundled
provider access. `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=1` remains the
explicit final enable request and still fails closed unless every readiness
control passes.

Run `scripts/configure_managed_provider_resale_readiness.sh --authorization-packet`
before acknowledging provider terms. The packet is safe to copy into operator
review because it prints only the provider-family checklist and private
evidence-reference format. It must not include provider contracts, account IDs,
credentials, actual provider costs, prompts, OAuth tokens, generated API keys,
or raw responses. The only value that belongs in runtime config is a private
reference string in `SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF`, after the
underlying Ollama/OpenAI/Anthropic authorization artifact has been reviewed out
of band. OpenRouter remains BYOK-only unless a separate authorization review
explicitly promotes it into the managed resale allowlist.

The homepage, sticky activation bar, pricing page, and comparison pages can
still measure demand for the future one-subscription path and Max
implementation support by sending prospects to `/managed-access`. Homepage
CTAs emit `landing_managed_access_clicked` and `managed_access_interest_clicked`
with allowlisted intent/commercial-preference/support-need metadata before the
handoff. The homepage one-field review form also emits
`managed_access_contact_capture_landed`, `managed_access_quick_form_presented`,
guarded `managed_access_quick_form_focused`, guarded
`managed_access_quick_form_started`, and `managed_access_quick_request_*`
events without logging email values, so the operator can distinguish homepage
presentation, focus, start, submit, and received stages. It also exposes
homepage `Copy contact request` and `Open email draft` fallbacks measured as
`managed_access_contact_packet_copied` and `managed_access_contact_draft_opened`
with `landing-homepage-managed-access-contact-*` snippets, so a blocked browser
form can still become a no-secret contact handoff. That private-beta intake stores contact and allowlisted
qualification buckets only, including target provider family and commercial
preference demand for Ollama, OpenAI, Anthropic, and BYOK-compatible routes,
plus support need and target launch window, and coarse inbound intent from
known CTA URLs for founder-sales follow-up. It also offers a
copyable no-secret one-subscription review packet, local email-draft share
path measured by `managed_access_review_packet_copied`, and a Max/BYOK setup
bundle measured by `quickstart_snippet_copied` with
`managed-access-max-byok-setup`, so internal buyer sharing and immediate
key-first Max fallback can become demand telemetry without contact submission;
it is not a checkout entitlement, provider resale claim, or runtime feature
flag.

## Near-term launch checklist

- Keep anonymous `/v1/*` blocked and generated `sk_sage_*` keys enforced.
- Keep `/pricing`, `/launch-plan`, `/community-launch-kit`, `/billing`, `/quickstart`, `/api-troubleshooting`, `/docs/api-reference`, `/docs/gateway-migration`, `/docs/codex`, `/agent-native`, `/integrations`, `/status`, `/support`, `/account.html`, `/login.html`,
  `/api/waitlist`, `/models`, `/managed-access`, `/compare/model-gateways`, `/compare/openrouter`, `/reddit-ai-gateway-evaluation`, `/reliability-proof`, `/model-routing-calculator`, `/terms`,
  `/privacy`, `/security`, `/acceptable-use`, `/provider-resale-terms`, and
  `/margin-policy` in the readiness gate.
- Keep the public pricing, launch-plan, agent-native routing, calculator, model-gateway/OpenRouter comparison, legal, provider-resale,
  and margin-policy pages in sitemap and LLM discovery. Pricing must preserve
  checkout intent while showing that buyers create the generated `sk_sage_*`
  setup artifact before checkout unlocks hosted routing.
- Keep public model discovery at `/models` and `/model-catalog`, while live
  `/v1/models` stays authenticated with generated `sk_sage_*` keys.
- Keep `/quickstart` as the first hosted API request path with
  `OPENAI_BASE_URL=https://api.sagerouter.dev/v1`, `sage-router/frontier`,
  curl, JavaScript, Python, Codex, and 401/402/429/503 troubleshooting.
- Keep `/api-troubleshooting` as the no-secret customer diagnostic path for
  hosted 401/402/429/503 responses, generated key prefix checks,
  `WWW-Authenticate`, `Retry-After`, rate-limit headers, quota headers,
  account/pricing/status onboarding links, placeholder 401 `setupSnippet`, safe
  support context, measured `api_troubleshooting_setup_copied` 401 setup-copy
  telemetry, and one-subscription managed-access beta review demand when
  BYOK/provider access is the blocker.
- Keep `/setup-key-recovery` as the public no-key signup recovery destination
  for API 401 `keyRecoveryUrl` handoffs, public marketing/docs/status/support
  recovery CTAs, and operator signup-to-key follow-up drafts, with the direct
  API-auth recovery handoff auto-opening account setup when `utm_source=api-auth`
  plus `signup_to_key_recovery` are present, the same-email setup-link form
  retained, a first-screen signed-in fast path for recovery visitors who can
  already open account setup, app login retained as fallback, direct GitHub
  same-OAuth account return, generated-key-before-checkout setup, and
  placeholder setup-copy telemetry. Operator packets should use it as the
  primary CTA while retaining app-hosted same-email/password and GitHub/OAuth
  fallbacks. It may route
  one-subscription interest to managed-access beta review, but public managed
  provider access stays disabled until provider terms, authorization evidence,
  allowlist, cost model, and
  margin controls pass.
- Keep `bash scripts/diagnose_setup_key_recovery_dropoff.sh` available as the
  no-secret operator diagnostic for signup-to-generated-key stalls. It should
  classify the aggregate dropoff as no recovery traffic, recovery view to
  account handoff, account handoff to key creation, key-create attempt to
  success, or working recovery path before any real activation send is approved.
  Operators can add `--verify-handoff` to run the live no-persistence handoff
  smoke and distinguish a broken public handoff from verified handoff code that
  is simply waiting for fresh real recovery traffic.
- Keep `/login.html?start=create_key` as the hosted same-email bridge for
  returning no-key signups: the recovery panel must include an inline
  same-email setup-link form, copy-first setup, same-GitHub recovery, a
  first-panel `Open API key setup now` handoff, a static fully attributed
  `Create API key next` handoff with `setup=login-key-recovery` plus
  `source_surface=recovery`, and `login_key_recovery_magic_link_*` telemetry so
  recovery views can move into generated-key setup without waiting for operator
  outreach or JS-only link rewriting. Recovery landings should focus same-email
  recovery first; account-setup auto-handoff is a one-second idle fallback that
  cancels as soon as the user types or clicks a recovery action, so it does not
  suppress `login_key_recovery_magic_link_requested/sent`.
- Keep `/docs/api-reference` as the hosted OpenAI-compatible API reference for
  `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/responses`, public
  `/model-catalog`, generated `sk_sage_*` keys, quota headers, rate-limit
  headers, failover signals, and the authenticated model API boundary.
- Keep Google Gemini and Vertex AI viable as agentic fallback routes by
  translating OpenAI-compatible function tools into Gemini function
  declarations, preserving tool results in the conversation, and returning
  structured OpenAI-compatible `tool_calls` instead of visible tool-call text.
- Keep `/docs/gateway-migration` as the model gateway customer migration path
  with `OPENAI_BASE_URL=https://gateway.example/api/v1` to
  `OPENAI_BASE_URL=https://api.sagerouter.dev/v1`, generated `sk_sage_*` keys,
  `sage-router/frontier`, premium `sage-router/fusion`, model catalog
  discovery, and the provider terms boundary.
- Keep `/reddit-ai-gateway-evaluation` as the Reddit/community acquisition path
  for local-first custody, OpenRouter BYOK boundary, 429 failover, multimodal
  routing, hosted generated-key activation, and copyable evaluation/setup proof.
- Keep `/reliability-proof` as the skeptical-buyer proof path for Reddit,
  self-hosted, and founder-sales follow-up, with copyable 429 failover,
  credential load-balancing, multimodal routing, and no-secret Reddit reply
  snippets plus measured `utm_source=reliability-proof` links.
- Keep `/gemini-api-router` as the Gemini/Google acquisition path for Google
  AI, Vertex AI, Gemini CLI, function-tool routing, 429 failover, multimodal
  routing, hosted generated-key activation, and provider-authorization
  boundaries.
- Keep `/github-copilot-router` as the GitHub Copilot acquisition path for
  Copilot-compatible coding-agent routing, customer-owned
  `GITHUB_COPILOT_TOKEN` custody, OpenAI-compatible setup, model discovery,
  credential load balancing, 429 failover, multimodal safeguards, and
  provider-authorization boundaries.
- Keep `/codex-cli-router` as the Codex CLI acquisition path for Responses API
  routing, hosted generated `sk_sage_*` keys, local port `8790`, Tailnet
  routing, `sage-router/frontier` profiles, 429 failover, multimodal routing,
  BYOK custody, and the Codex OAuth boundary.
- Keep `/aider-ai-model-router` as the Aider acquisition path for
  OpenAI-compatible coding-agent routing, hosted generated `sk_sage_*` keys,
  `aider --model openai/auto`, local port `8790`, local Ollama fallback,
  Tailnet routing, credential load balancing, 429 failover, multimodal routing,
  and provider-authorization boundaries.
- Keep `/continue-ai-model-router` as the Continue acquisition path for
  OpenAI-compatible coding-agent routing, hosted generated `sk_sage_*` keys,
  `model=auto`, local port `8790`, local Ollama fallback, Tailnet routing,
  credential load balancing, 429 failover, multimodal routing, and
  provider-authorization boundaries.
- Keep `/openhands-ai-model-router` as the OpenHands acquisition path for
  OpenAI-compatible agent routing, hosted generated `sk_sage_*` keys,
  `model = "auto"`, local port `8790`, local Ollama fallback, Tailnet routing,
  credential load balancing, 429 failover, multimodal routing, and
  provider-authorization boundaries.
- Keep `/openclaw-ai-model-router` as the OpenClaw acquisition path for
  OpenAI-compatible and Anthropic-compatible agent routing, Sage Router skill
  setup, local port `8790`, Tailnet routing, Codex OAuth passthrough,
  credential load balancing, 429 failover, multimodal routing, and
  provider-authorization boundaries.
- Keep `/claude-code-router` as the Claude Code acquisition path for
  Anthropic-compatible coding-agent routing, customer-owned authorized
  Anthropic or Dario subscription paths, hosted `sk_sage_*` account control,
  local/Tailnet fallback, credential load balancing, 429 failover, multimodal
  routing, and provider-authorization boundaries.
- Keep `/xai-grok-router` as the xAI Grok acquisition path for API-key
  authorized Grok routing, customer-owned `XAI_API_KEY` custody,
  OpenAI-compatible setup, `/v1/models` discovery, credential load balancing,
  429 failover, multimodal safeguards, xAI SSO proxy boundaries, and
  provider-authorization boundaries.
- Keep `/mistral-ai-router` as the Mistral AI acquisition path for API-key
  authorized Mistral and Codestral routing, customer-owned `MISTRAL_API_KEY`
  custody, OpenAI-compatible setup, code-profile routing, credential load
  balancing, 429 failover, multimodal safeguards, and provider-authorization
  boundaries.
- Keep `/groq-ai-router` as the Groq AI acquisition path for API-key
  authorized low-latency Llama and Mixtral routing, customer-owned
  `GROQ_API_KEY` custody, OpenAI-compatible setup, latency-aware routing,
  credential load balancing, 429 failover, multimodal safeguards, and
  provider-authorization boundaries.
- Keep `/azure-openai-router` as the Azure OpenAI acquisition path for
  customer-owned `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` custody,
  Azure deployment routing, OpenAI-compatible setup, credential load balancing,
  429 failover, multimodal safeguards, and provider-authorization boundaries.
- Keep `/aws-bedrock-router` as the Amazon Bedrock acquisition path for
  customer-owned AWS account/IAM custody, `AWS_PROFILE`, `AWS_REGION`, Bedrock
  model routing for authorized foundation models, OpenAI-compatible setup,
  credential load balancing, 429 failover, multimodal safeguards, and
  provider-authorization boundaries.
- Keep `/nvidia-nim-router` as the NVIDIA NIM acquisition path for NVIDIA
  Cloud, GPU-backed hosted inference, customer-owned `NVIDIA_API_KEY` custody,
  OpenAI-compatible setup, credential load balancing, 429 failover, multimodal
  routing, and provider-authorization boundaries.
- Keep `/community-launch-kit` as the owner-approved community posting kit for
  Hacker News and adjacent launch channels, with measured UTM links, no-secret
  posting rules, local-first/BYOK positioning, copyable Show HN, Indie
  Hackers, Dev.to, X, and LinkedIn text, and privacy-safe snippet-copy
  telemetry.
- Keep `/founder-sales-kit` as the founder-led direct outreach kit for Pro
  activation, Max implementation review, one-subscription managed-access
  review, gateway migration replies, OpenRouter migration replies, and
  calculator follow-up, with measured `utm_source=founder-sales` links,
  `outreach_snippet_copied` telemetry, and no-secret outreach boundaries. The
  private launch-funnel dashboard should also promote a first-screen
  founder-sales fallback banner when activation or managed-resale work is gated
  and founder-sales copies are still zero, render a copyable recommended first
  reply, keep the recommended first reply visible, plus one copyable next outreach snippet from the current aggregate MRR
  gap, and the status page should expose a founder-sales fallback packet;
  those actions emit `outreach_snippet_copied` when copied. Aggregate those copy actions into
  `marketingIntent.founderSalesOutreachCopies` and
  `marketingIntent.founderSalesOutreachCopiesBySnippet` so founder-led
  outreach is visible without exposing conversation text, customer data, or
  prospect identities.
- Keep `/managed-access` as the one-subscription qualification path with
  copyable no-secret review packets, a provider authorization request packet,
  Max/BYOK fallback setup, deep-link intent handoff packets, and live readiness
  guardrails. The provider packet must not enable resale, acknowledge terms,
  expose provider costs, print authorization references, or claim OpenRouter is
  part of the managed subscription offer.
- Keep `/docs/codex` as the dedicated Codex CLI path with hosted, local port
  `8790`, and Tailnet examples using `wire_api = "responses"` and
  `sage-router/frontier`.
- Keep `/integrations` as the public setup index for OpenAI-compatible clients,
  Codex, Cursor, Aider, Continue, Claude Code, OpenHands,
  Anthropic-compatible clients, Ollama, Ollama Cloud, NVIDIA NIM, OpenClaw,
  Hermes, Pi agents, local port `8790`, Tailnet routes, and the no-secret
  support boundary.
- Keep `/support` as the safe escalation path for account, billing, Stripe
  portal, manual/crypto settlement, quota, generated-key, reliability, 503,
  security, abuse, and private deployment issues. Public support channels must
  warn customers not to send prompts, workflow text, provider credentials,
  OAuth tokens, generated API keys, private keys, cookies, raw provider
  responses, or customer data. The signed-in account page should generate a
  copyable no-secret support context packet from only account plan, routing,
  quota, activation, endpoint, and support-path state.
- Keep `/billing` as the hosted billing recovery path for Stripe checkout,
  Stripe billing portal, manual/crypto settlement, activation states,
  generated `sk_sage_*` key behavior before and after payment, payment
  recovery, bounded customer-visible manual payment status, and safe no-secret
  support context. The signed-in account page should recover the customer's
  latest pending or settled manual payment intent after reload without requiring
  the user to retain the intent id, and the status response must remain
  customer-scoped and free of customer notes or operator-only billing context.
- Keep account activation key-first: signed-in users with no active generated
  key should auto-create the first `sk_sage_*` setup key once per session, even
  before email verification. Saved `start=checkout` should preserve checkout
  intent and proceed toward checkout only after the setup artifact exists, so
  signup-to-generated-key conversion is not blocked by an extra button click.
  The signed-in no-key panel should also expose a copyable placeholder setup
  bundle so returning users can prepare their agent config before pressing the
  create-key button; the copy event must stay privacy-safe and store only the
  snippet ID.
- Use the calculator as the lightweight qualification path before signup:
  prospects estimate savings, review points, and fallback gaps, then create a
  hosted API key or request implementation support. The calculator should
  recommend Lite, Pro, or Max from the workflow profile and send the prospect
  into generated-key-first account setup with
  `/account.html?plan=...&start=create_key`; record
  `calculator_key_activation_clicked` so calculator interest can be measured
  before checkout.
- Capture pre-signup page-view and CTA intent from the homepage, calculator,
  pricing, launch plan, quickstart, plus model gateway comparison/migration pages
  through the privacy-safe `/api/funnel-event` path. Store only event, plan,
  sanitized source/target URL, and small allowlisted metadata buckets; do not
  store prompts, workflow text, emails, API keys, or provider credentials. For
  quickstart snippet-copy events, store only the snippet ID, not the snippet
  body or generated keys. Keep the browser-origin guard
  enabled so writes are accepted only from Sage Router production hosts, Pages
  previews, local development, or exact origins configured with
  `SAGEROUTER_FUNNEL_ALLOWED_ORIGINS`; the service-role-backed Supabase insert
  path must not be reusable as a third-party analytics sink.
- Convert long-form article traffic into activation intent with the shared
  `article-activation-dock.js` inline offer plus bottom dock on pages that
  already emit `content_article_viewed`. The CTAs must keep the next actions
  concrete: email an API key setup link, request Max implementation review, copy
  the hosted quickstart, compare OpenRouter/gateway positioning, open Codex
  setup, or estimate plan fit. Its events must use the same
  privacy-safe funnel path and store only page path, normalized title, button,
  target, source surface, UTM buckets, and referrer host; raw email addresses
  stay inside Supabase Auth and are not written to funnel events.
- Capture model catalog page-view, filter, CTA, per-family setup-copy, setup-key
  handoff, and bucketed search intent from `/models` through the same path.
  Store only model-family and search-bucket
  intent such as `openai-codex`, `ollama`, `byok-compatible`, or `other`; do
  not store raw model search text or live `/v1/models` output.
- Preserve coarse launch-channel attribution on those CTA events by storing
  only source surface, UTM source/medium/campaign tokens, referrer host, and
  landing path, then report aggregated channel attribution in the private
  operator funnel. Do not return raw query strings, raw campaign URLs, emails,
  prompts, API keys, provider credentials, or customer data.
- Capture signed-in activation, checkout, and billing intent from the account
  and standalone login pages through the same privacy-safe path, including
  signup/login attempts, OAuth clicks, browser-visible auth-provider state
  checks, email verification resend recovery, wallet connect attempts, plan selection, API-key creation, public-edge key verification,
  setup snippet-copy intent, first browser test request success, Stripe checkout clicks and returns,
  Stripe portal clicks and returns, and crypto/manual payment intent clicks.
  Treat Stripe webhooks, Supabase Auth, customer state, generated-key records,
  and server-recorded route usage as the source of truth; use browser funnel
  events only to diagnose onboarding drop-off without storing emails, passwords,
  wallet addresses, generated keys, prompts, provider credentials, OAuth tokens,
  OAuth secrets, completion text, copied snippet bodies, or API keys. Account
  setup snippet-copy events may store only the snippet ID.
- Keep the verified-email gate recoverable from the signed-in account page:
  generated API keys may be created before verification so setup can be copied
  once, but those keys remain blocked from routing until the customer reaches an
  active paid, trial, or manual plan. When Stripe checkout or manual payment is
  blocked by unverified email, show the current verification state and resend
  the Supabase verification email using only the authenticated account email
  returned by the server. Funnel events may record resend click/sent counts,
  but must not store email addresses or typed email input.
- Track setup-copy to first-request activation in `/analytics/funnel` from
  privacy-safe snippet IDs, generated-key records, and server-recorded route
  usage so copied Codex/OpenAI snippets become an operator-owned activation
  target instead of an unmeasured onboarding hint.
- Capture public billing recovery CTA intent from `/billing` through the same
  privacy-safe path, including account, pricing, support, troubleshooting,
  quickstart, and status clicks. Use those aggregates to diagnose payment
  recovery and activation friction without storing prompts, emails, API keys,
  provider credentials, raw invoices, or support message bodies.
- Surface checkout-readiness friction in the private operator launch funnel by
  comparing aggregate checkout intent against `account_checkout_unavailable`
  counts, plus checkout failure, billing-portal failure, and manual-settlement
  failure counts. Treat nonzero
  billing friction events as a monetization bottleneck to fix before scaling
  paid acquisition.
- Keep hosted positioning limited to routing/control-plane infrastructure until
  provider terms, billing, margin, and abuse controls support any managed
  provider resale offer.
- Keep Stripe subscription webhooks price-ID aware: plan changes from the
  Stripe portal should update Sage Router quotas and routing state from the
  subscription item price before trusting webhook metadata or prior customer
  state.
- Keep Stripe checkout activation payment-status aware: signed
  `checkout.session.completed` events should grant generated-key routing only
  when the Checkout Session reports `payment_status=paid` or
  `payment_status=no_payment_required`; unpaid or missing payment status events
  are recorded for idempotency but are not paid-conversion entitlement.
- Keep Stripe payment recovery automatic: signed `invoice.payment_succeeded`
  and `invoice.paid` events, plus delayed
  `checkout.session.async_payment_succeeded` events, should restore active
  generated-key routing after resolving the existing Stripe customer binding
  and deriving the plan from invoice line price IDs or checkout metadata.
- Keep Stripe webhook customer binding fail-closed: signed webhook metadata
  must agree with any existing `stripe_customer_id` binding before changing
  quota, plan, or routing state.
- Keep operator suspension fail-closed: `POST /admin/customers/{customer_id}/suspend`
  must require the private operator token, revoke active generated keys, block
  generated-key routing immediately, record a secret-free operator audit event,
  and remain sticky across later Stripe subscription or payment-recovery webhooks.
- Keep operator customer review bounded and privacy-safe:
  `GET /admin/customers` and `GET /admin/customers/{customer_id}` must require
  the private operator token and return only customer, usage, activation,
  server-derived review flags, secret-free operator audit events, and public
  API-key metadata, without raw generated keys, key hashes, provider
  credentials, prompts, or raw provider responses. Review flags may identify
  bounded operational states such as suspended, routing blocked, no active key,
  no first request, quota pressure, and paid-but-idle accounts.
- Keep the hosted operator customer review on
  `https://app.sagerouter.dev/launch-funnel.html` and route `/admin/customers`
  through the public edge control-plane path, not the latency-selected model
  backend.
- Keep operator review release fail-closed: `POST /admin/customers/{customer_id}/unsuspend`
  must require the private operator token, default the customer to `inactive`,
  only restore active routing when an operator explicitly requests an active
  status, record a secret-free operator audit event, and never un-revoke
  previously revoked generated API keys.
- Keep manual/crypto payment recovery bounded: `POST
  /admin/payment-intents/{intent_id}/approve` must require the private operator
  token, approve only pending manual crypto intents, activate the selected
  Lite/Pro/Max plan, reject replay/stale approvals without duplicate audit
  events, record a secret-free operator audit event, and preserve sticky
  suspension so settled payment cannot restore an account under abuse,
  chargeback, provider-risk, or security review. Customer-facing manual intent
  create/status responses must use the bounded public intent shape and avoid
  echoing arbitrary customer notes or support text.
- Capture managed-access beta and Max implementation demand through the
  homepage/sticky review CTAs, the homepage one-field one-subscription review
  form, the waitlist `interest` metadata path from `/managed-access`, and the
  one-field pricing-page review request, then watch
  `managedAccessBetaInterest` plus `managedAccessShareOfWaitlist` in
  `/analytics/funnel`; the page also emits anonymous managed-access page-view,
  form-start, submit, and received events with only allowlisted qualification
  buckets, while homepage CTAs emit `managed_access_interest_clicked`, the
  homepage inline form emits `managed_access_quick_request_*`, and
  pricing emits `managed_access_quick_request_*` events for buyer-intent
  traffic. The `/managed-access` page also provides a first-screen
  contact-decision panel that focuses the work-email field or reuses the
  no-secret contact-request/email-draft fallbacks, a copyable no-secret
  one-subscription review packet and email-draft share path with
  `managed_access_review_packet_copied`, an intent handoff packet for
  `?intent=one-subscription` visitors, plus a Max/BYOK setup bundle measured as
  `quickstart_snippet_copied` with `managed-access-max-byok-setup`, so
  one-subscription, implementation, and immediate key-first Max fallback demand
  are visible before full contact submission. The launch funnel also rolls
  managed-access review and provider-authorization packet copies into
  `marketingIntent.managedAccessPacketCopies` and
  `marketingIntent.managedAccessPacketCopiesBySnippet`, so authorization
  outreach progress stays visible separately from anonymous demand clicks. Use
  `managedAccessDemand.targetProviderFamily`,
  `managedAccessDemand.commercialPreference`, `managedAccessDemand.supportNeed`,
  `managedAccessDemand.targetLaunchWindow`, and `managedAccessDemand.intent` to
  rank private-beta provider resale and implementation conversations instead of
  advertising bundled model access as live.
- Feed high-intent article traffic into the same one-subscription demand path:
  the shared article activation dock adds inline and sticky managed-access
  review CTAs with `inline-one-subscription-review` and
  `sticky-one-subscription-review` funnel states, using
  `content_article_managed_access_clicked` plus allowlisted qualification
  buckets. `/analytics/funnel` aggregates those anonymous clicks into
  `anonymousManagedAccessDemand` and the combined `managedAccessDemand` view
  without collecting prompts, provider credentials, OAuth tokens, generated
  keys, or customer data. The same inline article offer can now submit a
  one-field one-subscription review request to `/api/waitlist`, turning article
  demand into `managedAccessBetaInterest` while preserving the provider resale
  gate until authorization, terms, cost, and margin controls pass. The article
  form records `managed_access_contact_capture_landed`,
  `managed_access_quick_form_presented`, `managed_access_quick_form_focused`,
  and `managed_access_quick_form_started` before submission, so article traffic
  can be measured through the same contact-capture drop-off funnel as pricing
  and managed-access traffic without logging email values in marketing events.
  `/analytics/funnel` and the CLI summarizer expose that as
  `managedAccessDropoff` with aggregate presentation/handoff-prompt/focus/start/submit/received
  counts, rates, status, and next action for operator follow-up. The private
  launch funnel promotes the same gap into a first-screen managed-access
  contact-capture handoff, so an operator can copy the no-secret review packet
  or open the `/managed-access` fast-form CTA before enabling resale. If the
  status is `presented_not_engaged`, the managed-access page should keep the
  first-screen `Start 30-second review` control, contact-decision panel, and
  idle contact handoff live so a buyer can focus the work-email field, copy the
  no-secret contact request, or open the email draft without enabling provider
  resale. The idle handoff records `managed_access_contact_handoff_prompted`
  with `managed-access-default-idle-handoff`; analytics surfaces that as
  `contactHandoffPrompts`, a pre-contact prompt signal rather than a captured
  lead, before any email is collected.
  Operator contact-capture URLs also show a route nudge and re-run the
  work-email focus path on hash changes and browser page restore, so routed
  buyers keep landing on `#managed-access-quick-form` instead of only adding a
  presentation event.
- Keep `/api/waitlist` guarded before Supabase inserts: browser-originating
  writes must come from Sage Router production hosts, Pages previews, local
  development, or exact origins configured with
  `SAGEROUTER_WAITLIST_ALLOWED_ORIGINS`; mutating requests must carry an
  explicit trusted `Origin`, while `Referer` is only sanitized attribution
  metadata and is not accepted as an origin fallback. Turnstile remains the
  optional bot challenge layer on top of that origin guard.
- Keep pre-auth generated-key attempts throttled at the public edge before
  Supabase lookup: `SAGE_ROUTER_EDGE_AUTH_ATTEMPT_RATE_LIMIT` should remain
  enabled, higher than the highest legitimate per-plan RPM, and visible in
  `/edge/health` so random invalid `sk_sage_*` traffic cannot create unbounded
  service-role reads.
- Keep hosted browser CORS explicit at the public edge: `SAGE_ROUTER_CORS_ORIGIN`
  should list the app and marketing origins rather than `*`, and `/edge/health`
  must report `corsWildcardAllowed=false` before Cloudflare or launch readiness
  treats an origin as public-SaaS safe.
- Capture one-subscription and Max implementation demand with allowlisted
  target provider family, commercial preference, support need, target launch
  window, and inbound intent buckets, so provider resale and implementation
  conversations can be ranked by real Ollama, OpenAI, Anthropic, and
  BYOK-compatible buyer interest.
- Keep the managed provider access readiness guard active: default disabled,
  with `SAGEROUTER_MANAGED_PROVIDER_RESALE_REQUESTED=1` allowed for public
  "under review" metadata and `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=1`
  allowed only when provider resale terms and margin-policy URLs are configured,
  `SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED=1` is set,
  `SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS` names the authorized provider
  families, `SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS` is set to
  a positive value, every fixed API plan clears the minimum gross-margin
  threshold of at least 30%, public metadata includes derived maximum safe provider cost thresholds, durable operator audit events are installed, and the
  legal/metering/abuse-control boundary is published.
  Stage those values with
  `scripts/configure_managed_provider_resale_readiness.sh`; the script stores
  the reviewed provider-cost model in Secret Manager, updates the Cloud Run
  readiness env, and keeps public managed resale disabled unless
  `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=1` is explicitly set.
  Run `scripts/configure_managed_provider_resale_readiness.sh --check` before
  applying; the helper must reject BYOK-only families such as OpenRouter from
  the managed resale allowlist and reject minimum gross-margin thresholds below
  the launch floor.
  `/pricing` and the operator launch funnel expose the no-secret
  `readinessSetup` packet so the dry run and enable template are visible
  without printing provider credentials or actual provider costs.
  Keep durable operator audit events enabled before any managed-access private
  beta customer can receive bundled provider access.
- Keep email/password and magic-link auth as the baseline launch path, then
  enable GitHub OAuth in Supabase after the GitHub App manifest approval code is
  available. Use `bash scripts/check_github_supabase_auth_status.sh` for a
  non-mutating status probe; the bootstrap must verify both Supabase management
  config and the browser-visible `/auth/v1/settings` provider state before
  treating GitHub OAuth as complete. When GitHub is still disabled, the status
  helper prints the hosted fallback owner handoff and local credential-save path
  so the manifest secret is not lost during Supabase setup. Hosted auth panels
  should tell users GitHub sign-in is pending owner setup instead of presenting
  it as a broken login path.
- Keep signup attribution bounded. Email signup and magic-link requests can
  attach Supabase user metadata for selected hosted plan, signup surface, auth
  method, UTM source/medium/campaign, referrer host, and landing path. OAuth
  redirects can persist the same context in browser storage. Do not attach
  prompts, workflow text, provider credentials, OAuth tokens, generated API
  keys, private keys, raw URLs, cookies, raw provider responses, or customer
  data.
- Keep hosted account abuse controls on by default: with Supabase Auth enabled,
  generated API keys can be created before verification for setup-copy
  activation, but they cannot route while the customer remains inactive/free.
  Stripe checkout and manual crypto payment intent creation require verified
  email unless a trusted private deployment explicitly sets
  `SAGE_ROUTER_REQUIRE_VERIFIED_EMAIL=0`.
- Keep customer emergency revocation available: a signed-in customer can revoke
  their own generated API keys even before email verification is complete, while
  the revoke endpoint still scopes the key lookup to that customer's id so one
  account cannot revoke another customer's key.
- Record customer-initiated revocation as bounded security telemetry:
  successful revokes should create an `api_key.revoke` audit event and
  anonymous account-funnel revoke events without raw generated keys, key hashes,
  prompts, provider credentials, or raw error payloads.
- Track the funnel from waitlist to signup, generated key, first routed request,
  paid conversion, and retained paid account through the operator-only
  `/analytics/funnel` endpoint.
- Include anonymous `marketingIntentEvents` plus event/plan breakdowns in
  `/analytics/funnel` and the private launch-funnel dashboard so the operator
  can see whether pricing, calculator, model catalog, and model gateway comparison
  demand exists before signup.
- Count article-dock setup-copy actions as setup-copy activation with
  `content_article_snippet_copied` using `article-hero-setup-bundle`,
  `article-inline-setup-bundle`, and `article-sticky-setup-bundle`, so
  long-form article readers can become measurable setup-intent users without
  first navigating to `/quickstart`.
- Route long-form article API-key CTAs through generated-key creation first and
  record `content_article_key_activation_clicked`; after a copy, the shared
  dock switches to a setup-attributed `Create API key next` handoff so article
  checkout interest stays separate from setup-key activation.
- Filter obvious crawler, obsolete-browser, headless, and same-minute page-sweep
  traffic from `/analytics/funnel` marketing totals while preserving raw funnel
  event storage. Report `filteredSyntheticEvents` so traffic-quality changes are
  visible before making acquisition or conversion decisions.
- Include model catalog family and search-bucket demand in the same private
  funnel so model interest can drive catalog copy, route-profile proof, and
  hosted key activation without storing raw search text.
- Include source-surface and attribution-channel breakdowns in the same
  operator funnel so GitHub, Google, model gateways, Discord, Reddit, newsletter,
  direct, and internal Sage Router traffic can be ranked against the `$10k MRR`
  launch mix without exposing identities.
- Include browser-visible auth-provider state in the operator funnel so GitHub
  OAuth setup friction is visible as counts while email signup remains the
  baseline path, without storing OAuth codes, tokens, secrets, or identities.
- Return ranked acquisition actions from those source/channel buckets so the
  operator can decide whether the next push should be Gateway migration
  content, GitHub/docs conversion, community outreach, pricing-page tuning, or
  calculator follow-up without reading raw campaign URLs or identities.
- Render deterministic campaign links for those ranked acquisition actions in
  the private operator dashboard, using only coarse action buckets to generate
  public UTM URLs instead of storing or replaying raw visitor URLs, and make
  those links copyable for founder-sales outreach.
- Render founder-sales outreach copy counts and snippet buckets beside setup
  copy activation in the private operator dashboard and CLI launch snapshot, so
  direct Lite/Pro/Max and one-subscription outreach volume can be compared with
  generated-key and first-request activation.
- Render a copyable no-secret launch brief in the private operator dashboard
  from the same aggregate funnel snapshot, so founder-sales and support
  follow-up can use the current MRR, activation, checkout friction, conversion,
  acquisition, managed-access, and OAuth onboarding state without copying
  emails, prompts, OAuth tokens, generated API keys, provider credentials, raw
  campaign URLs, or raw responses.
- Render a dedicated managed-access readiness panel in the private operator
  dashboard with a copyable no-secret approval packet, terms packet command,
  resale dry-run, unit-economics preflight, a no-secret public-control staging
  command, a separate private cost-model staging command, one-subscription
  ready/blocked families, BYOK-only boundary, prerequisite URLs, and public plan
  threshold rows. The panel must omit provider credentials, authorization
  reference values, actual provider costs, prompts, raw provider responses,
  generated API keys, and customer data.
- Count account-page setup snippets even when clipboard permission is denied:
  the fallback manual selection path emits the same aggregate
  `account_snippet_copied` event with `state=selected`, setup snippet ID, and no
  snippet body, so `setupCopyToFirstRequest` does not go dark in locked-down
  browsers.
- Keep the signed-out account activation nudge executable: it should expose a
  measured placeholder setup-copy action before GitHub or email setup, using the
  existing `account_snippet_copied` event and `preauth-setup-before-signup`
  snippet ID without copying a real API key.
- Keep the homepage activation nudge executable as setup-first: it should expose
  `Copy setup first`, record `quickstart_snippet_copied` with
  `landing-nudge-setup-bundle`, and change the account handoff to
  `Create API key next` after copy so the live nudge can move setup-copy
  activation before signup.
- Include `activationFollowUps` in `/analytics/funnel` as a privacy-safe
  aggregate for no-key signups, including count, suggested plan, generated-key
  recovery CTA with `start=create_key&auth=github`, and no-secret operator
  action, without returning emails, customer IDs, generated keys, provider
  credentials, or raw support content.
- Include `operatorExecutionPacket` in `/analytics/funnel` as an aggregate,
  no-secret execution contract for dashboards, agents, and runbooks. It should
  contain signup-to-key recovery URLs, segment counts, draft subject/body,
  telemetry event names, and privacy flags without returning emails, customer
  IDs, generated keys, prompts, OAuth tokens, provider credentials, or raw
  support content.
- In the private operator dashboard, render the next send segment and a
  copyable activation send command only as an explicit-approval handoff. The
  copied command must still require the private operator token and
  `SEND_ACTIVATION_FOLLOWUPS` confirmation token plus a fresh
  `approvalPacketIssuedAt` from the current approval packet, and copying it
  records only aggregate `operator_execution_packet_copied` telemetry.
- Also render a no-secret activation approval packet before the send command so
  the operator can review sendable segments, review-only auth-repair segments,
  dry-run coverage, the server-derived decision checklist, and the success
  metric without exposing customer identifiers or secrets.
- Include an aggregate `operatorExecutionPacket.authRepair` handoff for
  review-only `missing_auth_user` segments. It should expose only counts,
  segment names, hydrate candidate counts for auth signups without customer
  rows, account-link review counts for existing customers whose auth binding is
  stale, `/admin/customers/hydrate-auth-users` only when hydration can create
  rows, a dry-run `/admin/customers/repair-auth-links` command for exact
  confirmed same-email account-link repair, expected aggregate result fields, a
  bounded safe customer review command, no-op fallback guidance, and privacy
  flags; applying account-link repair must require `REPAIR_AUTH_LINKS`, and
  after any hydration or account-link repair the operator must refresh the
  funnel and re-run dry-run coverage before approving new real sends.
- Keep the operator-only launch funnel no-key queue executable: it should read
  bounded `/admin/customers` rows, render generated-key-first mailto/link
  actions, and provide per-customer plus batch snippet copy for outreach without
  raw generated keys, key hashes, prompts, provider credentials, or raw provider
  responses.
- Allow the queue to become real outreach when configured: private
  `POST /admin/customers/send-activation-followups` may send the same
  generated-key-first recovery drafts through the configured Resend sender,
  must support dry runs, and must fail closed with required env names when no
  activation email provider is configured. The setup script should preflight
  Resend API access plus sender-domain verified/sending state before binding
  Cloud Run secrets, and runtime sends should use provider idempotency keys so
  retries do not duplicate the same generated-key recovery draft.
- Track operator follow-up work separately from queued follow-ups:
  per-customer and batch copy actions emit privacy-safe
  `operator_no_key_followup_*` events, and `/analytics/funnel` exposes
  `activationFollowUps.operatorFollowUpCopies` plus kind breakdowns so the
  operator can tell whether the queue was actually worked.
- Include `nextBestAction` in `/analytics/funnel` as the single privacy-safe
  operator move for the current bottleneck. When no-key signups exist and
  generated-key conversion is still zero, this should point at the
  operator no-key queue until `operatorFollowUpCopies` is nonzero, then at the
  generated-key-first recovery CTA instead of only reporting the broad `$10k
  MRR` gap.
- Keep `app.sagerouter.dev/account.html` aligned with the same activation
  funnel: signed-in account, generated key, paid routing checkout,
  public-edge `/v1/models` verification, and server-recorded first routed
  usage. Once the key exists but routing is still locked, the post-key panel
  should make checkout the next visible action before first-request testing.
- Keep `/analytics/funnel` tied to the `$10k MRR` operating plan by reporting
  estimated current MRR, target attainment, and per-plan gaps against the
  recommended 100 Lite / 200 Pro / 50 Max launch mix.
- Include prioritized plan revenue actions in `/analytics/funnel`, sorted by
  remaining MRR gap, so the operator can choose between Lite checkout
  conversion, Pro activation upgrades, and founder-led Max sales without
  exposing customer identities.
- Render the same ranked acquisition actions in the private launch-funnel
  dashboard alongside marketing attribution, so source/channel demand turns
  into a concrete acquisition motion instead of another passive count table.
- Keep `/analytics/funnel` target-aware: it should compare current activation
  rates with the launch assumptions and return privacy-safe bottlenecks for the
  next stage to improve.
- Return and render conversion actions from those target-aware bottlenecks so
  the private operator dashboard shows owner, surface, action, and success
  metric for the next signup, activation, checkout, retention, or MRR fix.
- Use `https://app.sagerouter.dev/launch-funnel.html` as the private operator
  view for the same data. The page is not a customer dashboard; it requires the
  private admin/analytics token and keeps optional browser persistence scoped to
  the current tab.
