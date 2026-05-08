# Sage Router Frontend MVP

Static React/Vite landing page for sagerouter.ai. It lives in web/ so the Python router service and OpenClaw skill packaging stay untouched.

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

This MVP is a static site. Deploy web/dist/ to any static host, for example Cloudflare Pages, Netlify, Vercel static output, S3/CloudFront, or a plain nginx/Caddy site.

Suggested Cloudflare Pages settings:

- Root directory: web
- Build command: npm run build
- Build output directory: dist

The waitlist form is intentionally static and currently prevents default submit. Wire it to the chosen waitlist provider before launch.



## Hot-swappable copy

The page now includes the product line: “Your agents’ engine is now hot-swappable.” It frames Sage Router as a model layer that lets agents swap/fail over between authorized providers and local/cloud models without rewiring the harness.

## SEO / GEO / LLM discovery

The MVP treats discoverability as first-class. Current static assets include:

- Canonical placeholder: https://sagerouter.ai/
- OpenGraph and Twitter metadata.
- Keyword coverage for AI model router, LLM router, provider routing, model selection automation, AI agent model routing, OpenAI-compatible router, Anthropic-compatible router, Ollama routing, BYOK AI gateway, local-first AI router, and OpenRouter alternative.
- Structured page sections for automation, BYOK routing, OpenRouter comparison, and Ollama/Ollama Cloud roadmap language.
- FAQ content intended for snippets and LLM ingestion.
- JSON-LD SoftwareApplication and FAQPage schema in index.html.
- Machine-readable files served from the static root:
  - /llms.txt
  - /llms-full.txt
  - /robots.txt
  - /sitemap.xml

Next recommended additions after MVP:

- Dedicated `/compare/openrouter` page if the site moves beyond one static page.
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

This scope does not change implementation choices for the frontend MVP. It remains a static Vite/React site with no backend, no account system, and no live payments.

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

## Google Indexing API / boring SEO submission

The web package includes a pinned `google-indexing-script` integration for submitting SageRouter.dev to the Google Indexing API after free tools, BYOK/BYOS pages, and dumb SEO posts are published.

Important constraints:

- Google says the Indexing API is officially intended for pages with `JobPosting` or `BroadcastEvent` structured data. Treat this as discovery assistance, not a ranking guarantee.
- The domain must be verified in Google Search Console.
- `public/sitemap.xml` should be accurate and submitted in Search Console.
- Keep service-account JSON out of git.

Submit to Google Indexing API:

```bash
cd web
GIS_SERVICE_ACCOUNT_PATH=/path/to/service_account.json npm run seo:index
# or use ~/.gis/service_account.json as the default path
npm run seo:index
```

This supports the $10k MRR loop for SageRouter: free model-routing tools + dumb blogs + indexed utility pages + BYOK/BYOS Lite and routing-audit CTAs.

Current credential default:

- If `GIS_SERVICE_ACCOUNT_PATH` is not set, the script first tries the Google Drive service account configured in `~/.config/rclone/rclone.conf`, then falls back to `~/.gis/service_account.json`.
- The service account email must be added as an owner/user for `sagerouter.dev` in Google Search Console before live submission works.
