# Sage Router SaaS launch plan: $10k MRR

This plan turns the current hosted Sage Router surface into a measurable SaaS
launch target while preserving the product boundary: sell routing, account
management, reliability, quotas, analytics, and support. Do not claim model
resale, pooled provider accounts, or unauthorized provider access.

## Revenue target

Target: `$10,000 MRR` from hosted Sage Router subscriptions.

Current public plan ladder:

| Plan | Price | Included requests | Rate limit | Best fit |
| --- | ---: | ---: | ---: | --- |
| Lite | $6/month | 10,000/month | 60/minute | Individual agent experiments |
| Pro | $30/month | 50,000/month | 180/minute | Daily agent development |
| Max | $72/month | 200,000/month | 600/minute | Automation, teams, and high-volume agents |

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

## Conversion funnel

| Stage | Target metric | Product surface |
| --- | ---: | --- |
| Visitor to waitlist/signup | 5% | `sagerouter.dev`, `/pricing`, `/compare/openrouter` |
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
and abuse controls are in place.

The public `/pricing` metadata must keep `publicLaunch.managedProviderAccess`
disabled by default. Turning on bundled/managed model access requires explicit
provider resale terms, a published margin policy, durable quota and rate-limit
enforcement, and managed-access acceptable-use terms before it can be marketed
as a launchable offer.

The public prerequisite pages at `/provider-resale-terms` and `/margin-policy`
document the required legal and unit-economics boundaries for a future private
beta. They do not activate managed resale by themselves; the runtime must still
keep `publicLaunch.managedProviderAccess.enabled` false unless the provider
authorization, billing, quota, and abuse-control checks are explicitly enabled.

Pricing and comparison pages can still measure demand for the future
one-subscription path by sending prospects to
`/managed-access`. That private-beta intake stores contact and allowlisted
qualification buckets only; it is not a checkout entitlement, provider resale
claim, or runtime feature flag.

## Near-term launch checklist

- Keep anonymous `/v1/*` blocked and generated `sk_sage_*` keys enforced.
- Keep `/pricing`, `/quickstart`, `/docs/codex`, `/status`, `/support`, `/account.html`, `/login.html`,
  `/api/waitlist`, `/models`, `/managed-access`, `/compare/openrouter`, `/model-routing-calculator`, `/terms`,
  `/privacy`, `/security`, `/acceptable-use`, `/provider-resale-terms`, and
  `/margin-policy` in the readiness gate.
- Keep the public pricing, calculator, legal, provider-resale, and margin-policy
  pages in sitemap and LLM discovery.
- Keep public model discovery at `/models` and `/model-catalog`, while live
  `/v1/models` stays authenticated with generated `sk_sage_*` keys.
- Keep `/quickstart` as the first hosted API request path with
  `OPENAI_BASE_URL=https://api.sagerouter.dev/v1`, `sage-router/frontier`,
  curl, JavaScript, Python, Codex, and 401/402/429/503 troubleshooting.
- Keep `/docs/codex` as the dedicated Codex CLI path with hosted, local port
  `8790`, and Tailnet examples using `wire_api = "responses"` and
  `sage-router/frontier`.
- Keep `/support` as the safe escalation path for account, billing, Stripe
  portal, manual/crypto settlement, quota, generated-key, reliability, 503,
  security, abuse, and private deployment issues. Public support channels must
  warn customers not to send prompts, workflow text, provider credentials,
  OAuth tokens, generated API keys, private keys, cookies, raw provider
  responses, or customer data.
- Use the calculator as the lightweight qualification path before signup:
  prospects estimate savings, review points, and fallback gaps, then create a
  hosted API key or request implementation support. The calculator should
  recommend Lite, Pro, or Max from the workflow profile and send the prospect
  into preselected checkout with `/account.html?plan=...`.
- Capture pre-signup CTA intent from the calculator and pricing pages through
  the privacy-safe `/api/funnel-event` path. Store only event, plan, sanitized
  source/target URL, and small allowlisted metadata buckets; do not store
  prompts, workflow text, emails, API keys, or provider credentials.
- Keep hosted positioning limited to routing/control-plane infrastructure until
  provider terms, billing, margin, and abuse controls support any managed
  provider resale offer.
- Keep Stripe subscription webhooks price-ID aware: plan changes from the
  Stripe portal should update Sage Router quotas and routing state from the
  subscription item price before trusting webhook metadata or prior customer
  state.
- Keep Stripe webhook customer binding fail-closed: signed webhook metadata
  must agree with any existing `stripe_customer_id` binding before changing
  quota, plan, or routing state.
- Capture managed-access beta demand through the waitlist `interest` metadata
  path from `/managed-access` and watch `managedAccessBetaInterest` plus
  `managedAccessShareOfWaitlist` in `/analytics/funnel` instead of advertising
  bundled model access as live.
- Keep the managed provider access readiness guard active: default disabled,
  with `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=1` allowed only when provider
  resale terms and margin-policy URLs are configured and the legal/abuse-control
  boundary is published.
- Enable GitHub OAuth in Supabase after the GitHub App manifest approval code is
  available; the bootstrap must verify both Supabase management config and the
  browser-visible `/auth/v1/settings` provider state before treating this as
  complete.
- Track the funnel from waitlist to signup, generated key, first routed request,
  paid conversion, and retained paid account through the operator-only
  `/analytics/funnel` endpoint.
- Include anonymous `marketingIntentEvents` in `/analytics/funnel` so the
  operator can see whether pricing/calculator demand exists before signup.
- Keep `app.sagerouter.dev/account.html` aligned with the same activation
  funnel: signed-in account, paid routing, generated key, public-edge
  `/v1/models` verification, and server-recorded first routed usage.
- Keep `/analytics/funnel` tied to the `$10k MRR` operating plan by reporting
  estimated current MRR, target attainment, and per-plan gaps against the
  recommended 100 Lite / 200 Pro / 50 Max launch mix.
- Keep `/analytics/funnel` target-aware: it should compare current activation
  rates with the launch assumptions and return privacy-safe bottlenecks for the
  next stage to improve.
- Use `https://app.sagerouter.dev/launch-funnel.html` as the private operator
  view for the same data. The page is not a customer dashboard; it requires the
  private admin/analytics token and keeps optional browser persistence scoped to
  the current tab.
