# Sage Router Frontend MVP

Static React/Vite landing page for sagerouter.dev. It lives in web/ so the Python router service and OpenClaw skill packaging stay untouched.

## Preview

    cd web
    npm install
    npm run dev

Open the local Vite URL, usually http://localhost:5173.

## Production build

    cd web
    npm install
    npm run build

The static site is emitted to web/dist/.

## Local production preview

    cd web
    npm run preview

## Deploy notes

This site is deployed with Cloudflare Pages so static assets and Pages Functions ship together. `web/dist/` contains the static build; `web/functions/` contains production functions such as the waitlist endpoint.
The repo deploy helper compiles `web/functions` into the deploy artifact before
calling `wrangler pages deploy`, which keeps `/api/waitlist` routed to the
function in direct Wrangler uploads.

Suggested Cloudflare Pages settings:

- Root directory: web
- Build command: npm run build
- Build output directory: dist

The waitlist form posts to `/api/waitlist`, a Cloudflare Pages Function that inserts into Supabase table `sage_router_waitlist` and falls back to `funnel_leads` for older AOps schemas. `GET /api/waitlist` is a non-mutating health check used by `scripts/check_sagerouter_launch_readiness.sh`. The managed-access intake posts `interest=managed-access` plus allowlisted qualification buckets for private-beta demand measurement while public managed provider access stays disabled, including target provider family and commercial preference buckets for Ollama, OpenAI, Anthropic, and BYOK-compatible demand, plus support need, target launch window, and coarse inbound intent from known CTA URLs for Max implementation follow-up. It also sends anonymous page-view, form-start, submit, and received events to `/api/funnel-event` with only those qualification buckets, so operators can see one-subscription and implementation demand before full contact submission without sending email or company fields through the marketing-event path. Browser-originating waitlist writes must come from Sage Router-owned production hosts, local development hosts, Cloudflare Pages preview hosts ending in `.sage-router-web.pages.dev`, or exact origins listed in `SAGEROUTER_WAITLIST_ALLOWED_ORIGINS`; the endpoint rejects third-party origins before using the Supabase service-role insert. Set both `SAGEROUTER_TURNSTILE_SECRET_KEY` and `SAGEROUTER_TURNSTILE_SITE_KEY` in Cloudflare Pages to require Cloudflare Turnstile on waitlist submissions; the health check fails if the secret is enabled without a public site key.

The homepage, calculator, pricing, launch plan, quickstart, and OpenRouter
comparison pages send anonymous pre-signup page-view, CTA, and quickstart
snippet-copy intent to `/api/funnel-event`, backed by Supabase table
`sage_router_funnel_events`.
`GET /api/funnel-event` is a non-mutating health check. The function only
accepts allowlisted event names, plans, sanitized URLs, and metadata buckets so
the operator launch funnel can count demand without storing prompts, workflow
text, emails, API keys, or provider credentials. Browser-originating writes must
come from Sage Router-owned production hosts, local development hosts,
Cloudflare Pages preview hosts ending in `.sage-router-web.pages.dev`, or exact
origins listed in `SAGEROUTER_FUNNEL_ALLOWED_ORIGINS`; the endpoint rejects
third-party origins before using the Supabase service-role insert.

The account and standalone login pages use the same endpoint for activation and
checkout intent: signup/login attempt, OAuth click, wallet connect attempt,
browser-visible auth-provider state check, selected plan, API-key creation,
public-edge key verification, first browser test request success, Stripe
checkout click/return, Stripe portal click/return, and crypto/manual payment
intent click. Keep the payload limited to event name, plan, sanitized
source/target URL, and allowlisted metadata; Supabase Auth,
generated-key records, billing webhooks, route usage, and Supabase customer
records remain authoritative for activation and paid conversion. Login-page
events must not include typed emails, passwords, wallet addresses, OAuth codes,
OAuth secrets, or access tokens.
The dedicated `/billing` recovery page also sends account, pricing, support,
troubleshooting, quickstart, and status CTA events through this endpoint so the
operator funnel can distinguish payment recovery friction from normal
pre-signup checkout interest without collecting secrets or support text.



## Hosted onboarding CTA

The primary homepage CTA is `Create hosted API key`, which links to
`/account.html?plan=pro`. The hero keeps pricing, quickstart, public status,
OpenRouter comparison, model catalog, calculator, security, analytics, login,
managed-access private beta review, support, and local GitHub install paths
visible so a prospect can move from discovery to generated `sk_sage_*` key setup
without joining a waitlist first. The waitlist remains secondary for release
notes, integration updates, private deployment help, and future managed-provider
beta interest.
The same hero CTAs and successful waitlist submissions emit privacy-safe homepage funnel events with the `landing` source surface, so the private launch funnel can measure visitor-to-signup movement without storing form emails, company names, prompts, API keys, provider credentials, or raw query strings.

## Hot-swappable copy

The page now includes the product line: “Your agents’ engine is now hot-swappable.” It frames Sage Router as a model layer that lets agents swap/fail over between authorized providers and local/cloud models without rewiring the harness.

## SEO / GEO / LLM discovery

The MVP treats discoverability as first-class. Current static assets include:

- Canonical placeholder: https://sagerouter.ai/
- OpenGraph and Twitter metadata.
- Keyword coverage for AI model router, LLM router, provider routing, model selection automation, AI agent model routing, OpenAI-compatible router, Anthropic-compatible router, Ollama routing, BYOK AI gateway, local-first AI router, and OpenRouter alternative.
- Structured page sections for automation, BYOK routing, OpenRouter comparison, and Ollama/Ollama Cloud roadmap language.
- Dedicated hosted pricing page at `/pricing` with plan limits, compliance-safe positioning, and $10k MRR launch math.
- Dedicated billing help page at `/billing` with Stripe checkout, Stripe billing portal, manual/crypto settlement, activation states, generated key behavior, payment recovery, and no-secret support boundaries.
- Dedicated managed-access private beta and Max implementation intake at `/managed-access` with no-secret qualification buckets for one-subscription demand capture, target provider family, commercial preference, support need, target launch window, and coarse inbound CTA intent. The page points to the public pricing readiness checkpoint and keeps activation conditioned on provider authorization, terms acknowledgment, an authorized provider allowlist, configured provider cost model, and plan-margin checks.
- Dedicated API quickstart page at `/quickstart` with hosted `sk_sage_*` key setup, `OPENAI_BASE_URL=https://api.sagerouter.dev/v1`, `sage-router/frontier`, curl, JavaScript, Python, Codex, and error troubleshooting.
- Dedicated API troubleshooting page at `/api-troubleshooting` with no-secret guidance for hosted 401/402/429/503 responses, safe curl probes, `WWW-Authenticate`, `Retry-After`, `X-RateLimit-*`, `X-Quota-*`, and account/pricing/status onboarding links.
- Dedicated hosted API reference page at `/docs/api-reference` with OpenAI-compatible endpoint docs for `GET /v1/models`, `POST /v1/chat/completions`, `POST /v1/responses`, public `/model-catalog`, generated keys, quotas, rate limits, and failover signals.
- Dedicated OpenRouter migration guide at `/docs/openrouter-migration` mapping `https://openrouter.ai/api/v1` to `https://api.sagerouter.dev/v1`, generated `sk_sage_*` keys, `sage-router/frontier`, model catalog discovery, and provider terms boundaries.
- Dedicated Codex setup page at `/docs/codex` with hosted `https://api.sagerouter.dev/v1/`, local `http://127.0.0.1:8790/v1/`, Tailnet `http://<tailnet-host>:8790/v1/`, `wire_api = "responses"`, and `sage-router/frontier` profiles.
- Dedicated agent-native routing page at `/agent-native` with `sage-router/frontier`, Responses API and Codex compatibility, health-aware fallback, BYOK custody, local/Tailnet/hosted deployment choices, and the public `/features/agent-native` metadata endpoint.
- Dedicated integrations index at `/integrations` with hosted `https://api.sagerouter.dev/v1`, local `http://127.0.0.1:8790/v1`, Tailnet `http://<tailnet-host>:8790/v1`, `sage-router/frontier`, OpenAI-compatible clients, Codex, Cursor, Aider, Continue, Claude Code, OpenHands, Anthropic-compatible clients, Ollama, Ollama Cloud, NVIDIA NIM, OpenClaw, Hermes, and Pi agents.
- No-login model routing calculator at `/model-routing-calculator` for acquisition and workflow qualification; it recommends Lite/Pro/Max, reads public `/pricing` billing readiness metadata for current limits and checkout availability, sends configured tiers into preselected checkout on `/account.html?plan=...`, and emits `calculator_checkout_unavailable` when the account/manual billing path is safer than a failing checkout handoff.
- FAQ content intended for snippets and LLM ingestion.
- JSON-LD SoftwareApplication and FAQPage schema in index.html.
- Machine-readable files served from the static root:
  - /llms.txt
  - /llms-full.txt
  - /robots.txt
  - /sitemap.xml

Next recommended additions after MVP:

- Dedicated `/compare/openrouter` page for OpenRouter-alternative acquisition traffic.
- Keep `/docs/openrouter-migration` aligned with the OpenRouter comparison page, hosted quickstart, API reference, sitemap, LLM discovery, and readiness checks.
- Keep the hosted pricing page aligned with `/pricing` API metadata and the account checkout plans.
- Keep `/billing` aligned with Stripe checkout, Stripe billing portal, manual/crypto settlement, generated-key activation behavior, sitemap, LLM discovery, and readiness checks.
- Keep `/managed-access` aligned with provider-resale terms, margin policy, waitlist metadata, sitemap, LLM discovery, and readiness checks.
- Keep `/quickstart` aligned with the hosted account page and public edge error guidance.
- Keep `/api-troubleshooting` aligned with public edge 401/402/429/503 payloads, rate-limit headers, quota headers, sitemap, LLM discovery, and readiness checks.
- Keep `/docs/api-reference` aligned with the hosted OpenAI-compatible API surface, quota/rate-limit headers, authenticated model API boundary, sitemap, LLM discovery, and readiness checks.
- Keep `/agent-native` aligned with `/features/agent-native`, Codex setup, public model profiles, sitemap, LLM discovery, and readiness checks.
- Keep `/integrations` aligned with the public quickstart, Codex setup, integration docs, local port `8790`, Tailnet routing, sitemap, LLM discovery, and readiness checks.
- Keep the model routing calculator in navigation, sitemap, LLM discovery, and readiness checks.
- Keep the public `/security` trust page in navigation, sitemap, LLM discovery, and readiness checks whenever hosted edge authentication copy changes.
- Keep the public `/support` page in navigation, sitemap, LLM discovery, and readiness checks whenever hosted account, billing, quota, reliability, or security escalation copy changes.
- Dedicated docs pages for OpenAI-compatible, Anthropic-compatible, Ollama, Gemini, Cursor, Aider, Continue, Claude Code, and OpenHands setup.
- Expand JSON-LD once final production docs URLs, logo/social image, and hosted beta URLs are stable.
- Real case-study/benchmark pages targeting `automate model selection`, `agent model router`, and `BYOK LLM gateway` searches.

## Business model positioning

The MVP page now encodes the intended business model:

- Free local router, works without an account.
- Paid Sage Cloud / hosted control plane for team config sync, provider health monitoring, hosted dashboards, uptime checks, routing policy sync, and optional reliability.
- Optional managed cloud fallback/failover, framed as BYOK/BYOS reliability infrastructure, not model resale.
- Enterprise deployment/support: private deployments, compliance/security review, custom routing strategies, audit logs, usage visibility, team API keys, and private deployments.
- Developer-first docs as acquisition, with prominent tutorial CTAs for the public Codex setup page, Claude Code, OpenClaw, Ollama/Ollama Cloud, and OpenAI-compatible endpoint use.
- Provider profiles/routing presets for coding, fast chat, local fallback, and hybrid local/cloud routes.
- Crypto-native billing remains planned, with Algorand-native billing and BTC bridge support.

This scope keeps the frontend lightweight: Vite/React static assets, Cloudflare Pages Functions for narrow hosted flows, Supabase Auth for account/session state, and the Sage Router API edge for billing, API keys, usage, and model traffic.

## Crypto billing direction

The landing page now includes only a lightweight payment direction section. Payment rails are not wired in this pass.

Planned direction:

- Crypto-native billing for hosted beta.
- Algorand-native billing, with BTC bridge support.
- Use AOps.studio infrastructure where appropriate.
- Borrow EARLCoin wallet/payment UX patterns where useful.
- Avoid Stripe-first assumptions until payment scope is explicitly chosen.

Reuse opportunities found:

- /home/umbrel/.openclaw/workspace/.vite-build/earlcoin_frontend appears to include WalletConnect/Web3Modal-style wallet flow code in built assets.
- /home/umbrel/.openclaw/workspace/earlcoin_frontend_build.zip contains a built EARLCoin frontend bundle, useful as a visual/flow reference but not source-level reusable as-is.
- No live payment wiring was added, to avoid accidental external money movement or premature custody/payment commitments.

## Compliance and security copy guardrails

- Customers bring their own authorized provider access.
- Do not claim Sage Router resells model access, pools accounts, bypasses ToS, or grants unauthorized provider access.
- Default key custody is local. Hosted Sage infrastructure should be described as control plane/docs/health/optional reliability infrastructure unless an explicit encrypted hosted proxy mode is implemented.
