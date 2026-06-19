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

Suggested Cloudflare Pages settings:

- Root directory: web
- Build command: npm run build
- Build output directory: dist

The waitlist form posts to `/api/waitlist`, a Cloudflare Pages Function that inserts into Supabase table `sage_router_waitlist` and falls back to `funnel_leads` for older AOps schemas. `GET /api/waitlist` is a non-mutating health check used by `scripts/check_sagerouter_launch_readiness.sh`.



## Hot-swappable copy

The page now includes the product line: “Your agents’ engine is now hot-swappable.” It frames Sage Router as a model layer that lets agents swap/fail over between authorized providers and local/cloud models without rewiring the harness.

## SEO / GEO / LLM discovery

The MVP treats discoverability as first-class. Current static assets include:

- Canonical placeholder: https://sagerouter.ai/
- OpenGraph and Twitter metadata.
- Keyword coverage for AI model router, LLM router, provider routing, model selection automation, AI agent model routing, OpenAI-compatible router, Anthropic-compatible router, Ollama routing, BYOK AI gateway, local-first AI router, and OpenRouter alternative.
- Structured page sections for automation, BYOK routing, OpenRouter comparison, and Ollama/Ollama Cloud roadmap language.
- Dedicated hosted pricing page at `/pricing.html` with plan limits, compliance-safe positioning, and $10k MRR launch math.
- FAQ content intended for snippets and LLM ingestion.
- JSON-LD SoftwareApplication and FAQPage schema in index.html.
- Machine-readable files served from the static root:
  - /llms.txt
  - /llms-full.txt
  - /robots.txt
  - /sitemap.xml

Next recommended additions after MVP:

- Dedicated `/compare/openrouter` page for OpenRouter-alternative acquisition traffic.
- Keep `/pricing.html` aligned with `/pricing` API metadata and the account checkout plans.
- Dedicated docs pages for OpenAI-compatible, Anthropic-compatible, Ollama, Gemini, Cursor, Aider, Continue, Codex CLI, Claude Code, and OpenHands setup.
- Expand JSON-LD once final production docs URLs, logo/social image, and hosted beta URLs are stable.
- Real case-study/benchmark pages targeting `automate model selection`, `agent model router`, and `BYOK LLM gateway` searches.

## Business model positioning

The MVP page now encodes the intended business model:

- Free local router, works without an account.
- Paid Sage Cloud / hosted control plane for team config sync, provider health monitoring, hosted dashboards, uptime checks, routing policy sync, and optional reliability.
- Optional managed cloud fallback/failover, framed as BYOK/BYOS reliability infrastructure, not model resale.
- Enterprise deployment/support: private deployments, compliance/security review, custom routing strategies, audit logs, usage visibility, team API keys, and private deployments.
- Developer-first docs as acquisition, with prominent tutorial CTAs for Codex, Claude Code, OpenClaw, Ollama/Ollama Cloud, and OpenAI-compatible endpoint use.
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
