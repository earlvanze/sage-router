# Sage Router

**Local-first AI model routing for serious agents.**

One endpoint. Any provider. The router figures out the rest.

[![Umbrel](https://img.shields.io/badge/Umbrel-1.0.4-purple)](https://github.com/getumbrel/umbrel-apps/pull/5720)
[![ClawHub](https://img.shields.io/badge/ClawHub-v4.157.3-blue)](https://clawhub.ai/earlvanze/sage-router)
[![GitHub](https://img.shields.io/badge/GitHub-earlvanze%2Fsage--router-black)](https://github.com/earlvanze/sage-router)

---

## What This Is

Sage Router is a **local-first, self-hosted AI model gateway** that intelligently routes requests to the best available model based on intent, latency, and capability — not just price.

Sage Router optimizes for **getting the job done**:

- **Intent-based routing**: Code tasks go to coding models, creative tasks to creative models, reasoning tasks to reasoning models
- **Automatic fallback**: If one provider fails or hits rate limits, it seamlessly tries the next
- **Dynamic discovery**: New models from Ollama, Anthropic, OpenAI, Google, NVIDIA NIM / NVIDIA Cloud, and OpenClaw are auto-detected — no config updates needed
- **Zero API lock-in**: Use any subscription or key you already have (Ollama, Claude, OpenAI, Gemini, NVIDIA NIM, GitHub Copilot)
- **Debuggable routing**: Surface the selected provider/model in headers, `/health`, or optional debug output

---

## Quick Start

### Installation (OpenClaw)

```bash
openclaw skill add sage-router --from clawhub
openclaw skill configure sage-router
```

### Manual Installation

```bash
git clone https://github.com/earlvanze/sage-router.git
cd sage-router
pip install -r requirements.txt  # if any
python3 router.py --port 8790
```

### Umbrel (Home Server)

Install from the [Umbrel App Store](https://github.com/getumbrel/umbrel-apps/pull/5720) or add the personal repo:

```yaml
# In umbrel.yaml → appRepositories
- https://github.com/earlvanze/umbrel-personal-apps
```

The Umbrel app pins `ghcr.io/earlvanze/sage-router-public:v3.28.7` and stores its config under the app data directory. The built-in config dashboard is accessible from the Umbrel app tile.

### Tailnet Edge Endpoint

For a CDN-style endpoint across multiple Sage Router installs, deploy the Tailnet edge proxy:

```bash
cd deploy/tailnet-edge
cp .env.example .env
docker compose up -d --build
tailscale serve --bg --https=443 http://127.0.0.1:8790
```

The edge health-checks each configured Tailnet upstream, routes OpenAI-compatible traffic to the lowest-latency healthy Sage Router node, and keeps provider credentials on the private routers. Publish it privately with Tailscale Serve/Funnel, or front a stable cloud VM edge with Cloudflare for a CDN-style public endpoint. See [deploy/tailnet-edge](deploy/tailnet-edge/README.md) for Google Cloud VM bootstrap and public monetization notes.

### sagerouter.dev Deployment Map

The current public deployment is intentionally split:

- `https://sagerouter.dev` and `https://www.sagerouter.dev` are static Cloudflare Pages (`sage-router-web`). They host marketing/docs/account UI only.
- `https://app.sagerouter.dev` is the hosted account/login surface, served by the same Cloudflare Pages project with Supabase Auth redirects pointed at this host.
- `https://app.sagerouter.dev/status` is the public reliability page. It reads `/edge/health` and `/pricing` from the public API edge to show selected upstream, Tailnet/cloud backend health, CDN-style reliability evidence, control-plane health, auth mode, rate-limit/quota enforcement, generated-key revocation posture, customer endpoint, and plan limits without exposing customer data or secrets.
- `https://sagerouter.dev/support` is the public support and billing help page. It routes customers to account setup, Stripe billing portal, manual/crypto settlement, quota/API-key troubleshooting, 503 reliability checks, security reporting, and abuse reporting while explicitly telling users not to send prompts, workflow text, provider credentials, OAuth tokens, API keys, private keys, cookies, raw provider responses, or customer data in public support channels.
- `https://sagerouter.dev/managed-access` is the managed-provider-access private beta intake page. It captures contact plus allowlisted qualification buckets such as deployment preference, expected monthly routed request volume, and provider access posture; it does not collect prompts, workflow text, provider credentials, OAuth tokens, generated API keys, private keys, cookies, raw provider responses, or customer data.
- `https://api.sagerouter.dev` is a Cloudflare-proxied GCP edge VM. The edge health-checks Tailnet Sage Router installs plus the Google-hosted Sage Router API origin, then routes to the lowest-latency healthy backend.
- Tailnet Edge is the reliability layer for routing to healthy Sage Router installs on a Tailnet. In public mode, set `SAGE_ROUTER_EDGE_AUTH_MODE=supabase`: `/pricing`, `/plans`, `/model-catalog`, and `/features/agent-native` are public control-plane metadata; `/pricing` also exposes `publicLaunch.managedProviderAccess`, which must stay disabled until provider resale terms, a margin policy, durable quota/rate-limit enforcement, and managed-access acceptable-use terms are ready. The marketing site publishes `/models`, `/provider-resale-terms`, and `/margin-policy` as reviewable prerequisites, but those pages do not enable managed resale by themselves; `/v1/*` and `/v1beta/*` model APIs accept active generated `sk_sage_*` customer API keys; anonymous model API failures stay fail-closed but include account, pricing, status, OpenAI base URL, and API-key-prefix guidance for setup debugging; account/billing UI requests preserve Supabase user JWTs and should be pinned to a hosted control-plane origin with `SAGE_ROUTER_CONTROL_PLANE_UPSTREAM`; operator analytics such as `/analytics/funnel` requires the private edge admin token, is pinned to the control plane, and can inject `SAGE_ROUTER_CONTROL_PLANE_TOKEN` separately from the Tailnet backend token. Browser login belongs on `app.sagerouter.dev`; `api.sagerouter.dev` should remain API-only. Generated keys and account/billing JWT routes are rate-limited by `SAGE_ROUTER_EDGE_RATE_LIMITS`; generated model API keys can also be counted against durable monthly Supabase quotas with `SAGE_ROUTER_EDGE_QUOTA_ENABLED=1` after applying `supabase/migrations/20260619021500_sage_router_usage_quotas.sql`. Supabase user JWT validation uses `SAGE_ROUTER_EDGE_AUTH_CACHE_SECONDS`, but generated customer API keys default to `SAGE_ROUTER_EDGE_API_KEY_AUTH_CACHE_SECONDS=0` so revocation takes effect on the next request. The private edge admin token is exempt for recovery. Hosted origins should also set `SAGE_ROUTER_CLIENT_AUTH_REQUIRED=1`; direct origin requests to `/v1/models`, setup, admin, discovery, and dashboard config routes must fail closed unless they carry a valid operator token, and generated customer keys are only accepted for model metadata/traffic.
- `https://sagerouter.dev/quickstart` is the hosted API first-request path. It shows `OPENAI_BASE_URL=https://api.sagerouter.dev/v1`, generated `sk_sage_*` key setup, the `sage-router/frontier` profile, curl, JavaScript, Python, and Codex examples, plus 401/402/429/503 troubleshooting.
- `https://sagerouter.dev/docs/codex` is the dedicated Codex CLI setup path. It shows hosted `https://api.sagerouter.dev/v1/`, local `http://127.0.0.1:8790/v1/`, and Tailnet `http://<tailnet-host>:8790/v1/` profiles using `wire_api = "responses"` and `sage-router/frontier`.

### Hosted API Quickstart

The hosted account page at `https://app.sagerouter.dev/account.html` is the customer onboarding surface:

1. Create an account or sign in with email, magic link, or an enabled Supabase OAuth provider.
2. Choose Lite, Pro, or Max. Stripe checkout posts the selected plan to `/billing/stripe/checkout`; after checkout links a Stripe customer, the account page opens `/billing/stripe/portal` for self-service billing, payment-method changes, cancellation, and subscription management. Crypto/manual settlement stays available for accounts that are not ready for Stripe.
3. Generate an `sk_sage_*` API key, copy the raw key while it is shown once, test it against `/v1/models` from the account page, and use the copyable OpenAI SDK, Codex CLI, Anthropic-compatible, or curl quickstart.

Plan-specific pricing links such as `/account.html?plan=pro` preselect that
checkout plan, remember it locally through signup/login, and restore the plan
from Stripe success/cancel return URLs so new customers do not accidentally
land on the default checkout tier.

API keys created before checkout are stored, but the account page marks routing as blocked until the customer is active, trialing, or manually enabled; the edge enforces the same rule before proxying `/v1/*` traffic. Revoked keys and inactive accounts are rechecked against Supabase by default on every generated-key request. Customers are limited to `SAGE_ROUTER_MAX_ACTIVE_API_KEYS_PER_CUSTOMER` active generated keys at a time, default `5`; revoked keys do not count against the cap.

The account page also shows current-period usage from the same Supabase usage counter that the public edge enforces, including requests used, remaining monthly quota, the active request-per-minute limit, and upgrade recommendations when routing is blocked or usage passes 75%/90% of the current plan quota. The public edge publishes only safe enforcement metadata on `/edge/health` so launch readiness can verify Supabase auth, rate limits, durable quotas, and immediate generated-key revocation without exposing secrets. The built-in API key test calls the public edge's `/v1/models` endpoint with the generated key so a new customer can separate key, billing, quota, and backend availability problems before configuring an agent. The same account page can send a first browser-side `sage-router/frontier` chat completion with the session-only generated key, so users can prove paid routing works before copying client configuration. The support page gives those same customers a safe escalation path for account, billing, quota, generated-key, 401/402/429/503, reliability, security, and abuse issues without asking them to paste secrets into public channels. The account launch checklist mirrors the `$10k MRR` activation funnel by marking signed-in account, paid routing, generated key, public-edge verification, and server-recorded first routed usage as separate steps. The hosted analytics dashboard at `https://app.sagerouter.dev/analytics.html` uses the signed-in account session and calls `/account/analytics`, so customers see only their own privacy-safe routing telemetry while `/analytics` and `/analytics/funnel` remain operator/global endpoints; it also reads plan, usage, generated-key, and routing status to show the next conversion action before or after checkout. Operators can view the private global launch funnel at `https://app.sagerouter.dev/launch-funnel.html` by entering the private admin or analytics token; the browser stores that token only in tab-scoped `sessionStorage` when explicitly requested. The launch funnel endpoint reports waitlist, managed-access beta interest, signup, generated-key, first-request, paid-conversion, retained-paid, estimated MRR, target attainment, and per-plan `$10k MRR` gaps without returning email addresses, prompts, message bodies, API keys, provider credentials, OAuth tokens, or raw responses.

Programmatic clients should call the API edge directly:

```bash
export OPENAI_BASE_URL=https://api.sagerouter.dev/v1
export OPENAI_API_KEY=sk_sage_your_key_here

curl "$OPENAI_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sage-router/frontier",
    "messages": [{"role": "user", "content": "Say hello from Sage Router"}]
  }'
```

Keep anonymous `/v1/*` traffic blocked at the edge. New users should reach account, billing, and API key workflows through the hosted control plane, then use generated API keys for model traffic.

Hosted plan limits are exposed from `/pricing` and enforced at the public edge:

| Plan | Price | Included requests | Rate limit |
| --- | --- | ---: | ---: |
| Lite | $6/month | 10,000/month | 60/minute |
| Pro | $30/month | 50,000/month | 180/minute |
| Max | $72/month | 200,000/month | 600/minute |

Customer-facing hosted pricing and plan positioning are published at
`https://sagerouter.dev/pricing`. The launch math and $10k MRR operating
plan live in [docs/saas-launch-10k-mrr.md](docs/saas-launch-10k-mrr.md).
For acquisition and onboarding, `https://sagerouter.dev/quickstart` gives new
customers a first hosted API request path, `https://sagerouter.dev/docs/codex`
gives Codex CLI users hosted, local port 8790, and Tailnet profile examples, while
`https://sagerouter.dev/model-routing-calculator` helps prospects estimate
routing savings, escalation rules, fallback gaps, and review rates for one
workflow before they create a hosted API key. The calculator recommends
Lite/Pro/Max from workflow volume, risk flags, and routing score, then carries
that plan into `/account.html?plan=...` for preselected checkout after account
creation.

The public homepage now treats hosted signup as live: the homepage primary CTA
is `Create hosted API key`, links directly to `/account.html?plan=pro`, and
keeps pricing, quickstart, status, OpenRouter comparison, model catalog,
security, analytics, login, and local GitHub install paths available from the
hero. The waitlist remains an updates/support path, not the primary conversion
path. When a prospect requests the future one-subscription managed access path,
pricing and comparison pages link to `/managed-access`; the private-beta intake
stores contact and allowlisted qualification buckets so beta demand can be
measured without enabling public provider resale.

### Hosted Auth

The hosted web app uses Supabase Auth. Email/password signup and email magic links are the baseline onboarding path; OAuth buttons are additive and appear only when the matching provider is enabled in Supabase. GitHub login requires a GitHub OAuth/GitHub App client, not repository permissions:

- Homepage URL: `https://app.sagerouter.dev`
- Authorization callback URL: `https://awtangrlqqsdpksarhwo.supabase.co/auth/v1/callback`

The account, login, and analytics pages read `https://awtangrlqqsdpksarhwo.supabase.co/auth/v1/settings` with the public anon key and hide disabled OAuth providers. This keeps onboarding usable through email signup while GitHub or other providers are still being configured.

The account page also renders hosted plan selection before sign-in from public
`/pricing` metadata. The selected Lite/Pro/Max plan is persisted in browser
storage, shows quota, rate limit, and estimated cost per 1,000 requests, and is
used after login when the customer continues to Stripe checkout.

The public calculator and pricing pages emit anonymous pre-signup CTA intent to
`/api/funnel-event` so the private launch funnel can count demand before users
create accounts. The event path stores event name, selected plan, sanitized
source/target URL, and small metadata buckets only; it must not store workflow
text, prompt bodies, emails, API keys, or provider credentials.

Bootstrap the GitHub app and wire Supabase without opening the Supabase dashboard:

```bash
set -a; source /home/digit/.openclaw/.env; set +a
bash scripts/bootstrap_github_supabase_auth.sh
```

GitHub requires an owner-approved browser step before it returns app credentials. By default the bootstrap script opens a local browser form, listens on an auto-selected `http://127.0.0.1` port, captures GitHub's one-hour manifest code, exchanges it for the app client id/secret, and patches Supabase Auth in the same run.

On WSL/Windows, the bootstrap copies the generated manifest form into the
Windows temp directory and opens that `file:///` URL first. This avoids browser
handlers that cannot read `\\wsl.localhost` or WSL `/tmp` paths. If the browser
does not appear, open the printed HTML file path manually or use the hosted
callback fallback below.

After patching Supabase, the configurator verifies the management API state
(`site_url`, email auth, GitHub auth, and app/API redirect allow-list entries).
When a public anon/publishable key is available in the environment, it also
checks `/auth/v1/settings` so the browser-visible OAuth buttons match the
management config before the launch readiness script is rerun.
The verification defaults to the Sage Router project ref
`awtangrlqqsdpksarhwo` and the anon key published in the hosted app scripts.
If you override Supabase settings from the environment, prefer
`SAGE_ROUTER_SUPABASE_URL` and `SAGE_ROUTER_SUPABASE_ANON_KEY`; generic
`PUBLIC_*`, `VITE_*`, or `SUPABASE_ANON_KEY` values are accepted only when the
anon-key JWT belongs to the same project ref, which avoids false results on
machines that also work with other Supabase projects.

If local capture is not available, fall back to the hosted callback page. After approving the app, GitHub redirects to `/github-app-manifest.html` with a temporary one-hour `code`; the page is marked `noindex,nofollow`, explains that the browser only holds the short-lived manifest code, and prints the exact local exchange command. Rerun the same script with the full callback URL or the raw code:

```bash
SAGEROUTER_GITHUB_APP_LOCAL_CAPTURE=0 bash scripts/bootstrap_github_supabase_auth.sh
bash scripts/bootstrap_github_supabase_auth.sh 'https://app.sagerouter.dev/github-app-manifest.html?code=...'
# or:
SAGEROUTER_GITHUB_APP_MANIFEST_CODE=... bash scripts/bootstrap_github_supabase_auth.sh
```

If the Supabase Management API token is being refreshed or debugged, preserve
the one-time GitHub client secret before the Supabase patch runs:

```bash
SAGEROUTER_GITHUB_APP_ENV_OUTPUT=/home/digit/.openclaw/sage-router-github-auth.env \
  bash scripts/bootstrap_github_supabase_auth.sh 'https://app.sagerouter.dev/github-app-manifest.html?code=...'
```

The callback page prints the exact command, including env loading and the launch readiness rerun. It also shows the raw temporary code as a fallback if clipboard access is blocked by the browser. If the code expires, rerun `SAGEROUTER_GITHUB_APP_LOCAL_CAPTURE=0 bash scripts/bootstrap_github_supabase_auth.sh` and approve the app again.

If a GitHub OAuth App already exists, pass its credentials directly:

```bash
SUPABASE_ACCESS_TOKEN=... \
SAGEROUTER_GITHUB_CLIENT_ID=... \
SAGEROUTER_GITHUB_CLIENT_SECRET=... \
bash scripts/configure_supabase_github_auth.sh
```

Check the current hosted launch gates with:

```bash
set -a; source /home/digit/.openclaw/.env; set +a
scripts/check_sagerouter_launch_readiness.sh
```

The readiness check verifies the public API edge, Supabase auth mode, rate limits, durable edge quotas, immediate generated-key revocation, anonymous auth gating, the API-only browser/dashboard boundary on `api.sagerouter.dev`, browser CORS preflight for the hosted API-key verification, browser first-routed-request, and operator launch-funnel flows, hosted pricing metadata, the managed provider access guard, direct origin auth gating, Supabase management auth settings, public browser-visible Supabase auth settings, quota schema, hosted login/account/GitHub callback/operator launch funnel pages, hosted security headers, the public security/trust/support and terms/privacy/acceptable-use pages, the provider-resale terms and margin-policy prerequisite pages, the managed-access private beta intake page, the API quickstart, the Codex setup page, the model routing calculator, the operator-only privacy-safe `/analytics/funnel` endpoint including managed-access beta demand fields, the non-mutating waitlist health endpoint on `SAGEROUTER_APP_BASE_URL` (default `https://app.sagerouter.dev`), optional Cloudflare Turnstile waitlist configuration, and the marketing comparison/pricing/model/quickstart/Codex pages on `SAGEROUTER_MARKETING_BASE_URL` (default `https://sagerouter.dev`). By default, `publicLaunch.managedProviderAccess.enabled` must be false. If `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED=1`, readiness requires `SAGEROUTER_PROVIDER_RESALE_TERMS_URL`, `SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL`, durable quota/rate-limit enforcement, and the managed-access acceptable-use boundary before treating bundled provider access as launchable. The direct-origin probe uses `SAGEROUTER_ORIGIN_BASE_URL` when set; otherwise it auto-discovers the Cloud Run URL from `SAGEROUTER_CLOUD_RUN_PROJECT`/`SAGEROUTER_CLOUD_RUN_REGION`/`SAGEROUTER_CLOUD_RUN_SERVICE`, defaulting to the live hosted service.

Use the public deploy helper to avoid branch/digest drift between the static
site and hosted API:

```bash
set -a; source /home/digit/.openclaw/.env; set +a
scripts/deploy_sagerouter_public.sh
```

The helper builds Cloudflare Pages from a clean temporary copy so local
`node_modules` or Dropbox permissions cannot affect the production build, then
deploys project `sage-router-web` to production branch `main` and reruns launch
readiness. To update Cloud Run in the same pass, set an immutable release image
digest:

```bash
GHCR_IMAGE_DIGEST=sha256:... scripts/deploy_sagerouter_public.sh
```

If `SAGEROUTER_DEPLOY_CLOUD_RUN=1` is set without a digest, the helper resolves
the latest successful GitHub Actions `Release image` digest from the run log and
deploys that digest through the Artifact Registry GHCR remote cache.

Monthly API-key quotas require the Supabase usage counter table and RPC. Apply
the idempotent migration through the Supabase Management API before enabling
`SAGE_ROUTER_EDGE_QUOTA_ENABLED=1`:

```bash
set -a; source /home/digit/.openclaw/.env; set +a
scripts/apply_supabase_quota_schema.sh
scripts/check_sagerouter_launch_readiness.sh
```

Stripe checkout reuses an existing `stripe_customer_id` when a customer is already linked, the account page exposes Stripe's customer billing portal after checkout, and Stripe webhook retries are idempotent by `event_id`. Signed subscription lifecycle webhooks update customer routing status: active/trialing subscriptions enable generated-key routing, canceled subscriptions disable routing, and failed or uncollectible invoices mark the customer `past_due`. Apply `supabase/migrations/20260619034200_stripe_webhook_idempotency.sql` anywhere the SaaS tables already exist so duplicate signed webhook deliveries cannot create duplicate payment event rows.

For the existing GCP deployment notes, see [deploy/gcp](deploy/gcp/README.md). For the privacy-preserving relay design where customer credentials stay on the user's machine, see [docs/cloud-tunnel](docs/cloud-tunnel/README.md).

### Configure Your Tools

Point any OpenAI-compatible tool at Sage Router:

```bash
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=irrelevant  # Sage Router uses your configured provider auth
```

Or for Gemini CLI:

```bash
export GOOGLE_GEMINI_BASE_URL=http://localhost:8790
export GEMINI_API_KEY=routed
```

Or for Anthropic tools:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8790
export ANTHROPIC_API_KEY=irrelevant
```

### Codex CLI on port 8790

Codex CLI can use Sage Router through the OpenAI Responses-compatible endpoint. The public setup guide is published at `https://sagerouter.dev/docs/codex`. For local port 8790, add the provider and profile to `~/.codex/config.toml`:

```toml
[model_providers.sage-router]
name = "Sage Router"
base_url = "http://127.0.0.1:8790/v1/"
env_key = "SAGE_ROUTER_API_KEY"
wire_api = "responses"

[profiles.sage-router-frontier]
model_provider = "sage-router"
model = "sage-router/frontier"
```

Run Codex with:

```bash
export SAGE_ROUTER_API_KEY=local-router
codex --profile sage-router-frontier
```

The `sage-router/frontier` model name selects the bundled `frontier` routing profile from `router-profiles.json`.

---

## Integration Guides

- [Codex CLI](docs/integrations/codex.md)
- [Claude Code](docs/integrations/claude-code.md)
- [OpenClaw](docs/integrations/openclaw.md)
- [Hermes](docs/integrations/hermes.md)
- [Pi agents](docs/integrations/pi.md)
- [Cursor](docs/integrations/cursor.md)
- [Aider](docs/integrations/aider.md)
- [Continue](docs/integrations/continue.md)
- [OpenHands](docs/integrations/openhands.md)
- [Ollama and Ollama Cloud](docs/integrations/ollama.md)
- [NVIDIA NIM / NVIDIA Cloud](docs/integrations/nvidia-nim.md)
- [OpenAI-compatible clients](docs/integrations/openai-compatible.md)
- [Anthropic-compatible clients](docs/integrations/anthropic-compatible.md)
- [Harness fallback](docs/integrations/harness-fallback.md)

---


## OpenClaw Codex OAuth

Sage Router connects directly to `chatgpt.com/backend-api/codex` using the same OpenAI OAuth token stored in your OpenClaw `auth-profiles.json`. No API key needed when an auth profile is present — it reads the current ChatGPT session JWT from `~/.openclaw/agents/main/agent/auth-profiles.json` and refreshes it on each request.

Sage Router intentionally does not implement its own `auth.openai.com/codex/device` OAuth route. Use the official Codex/OpenClaw sign-in flow, then import the resulting OpenClaw auth profile or pass an access token through environment.

To use:

```bash
# Force a request through the Codex backend
curl http://localhost:8790/v1/chat/completions \
  -H "Authorization: Bearer local" \
  -d '{"model":"openai-codex/gpt-5.5","messages":[{"role":"user","content":"Hello"}]}'
```

The `openai-codex` provider is enabled by default. Models: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-pro`.

Key env vars:
- `SAGE_ROUTER_OPENAI_CODEX_AUTH_PROFILE_PATH` — path to `auth-profiles.json` (default: `~/.openclaw/agents/main/agent/auth-profiles.json`)
- `SAGE_ROUTER_OPENAI_CODEX_AUTH_PROFILE_PATHS` — comma-separated auth profile paths, useful for container app-data layouts
- `OPENAI_CODEX_API_KEY`, `OPENAI_CODEX_ACCESS_TOKEN`, or `CODEX_ACCESS_TOKEN` — fallback OAuth access token (used if auth-profiles is unavailable)

## Config Dashboard

Sage Router ships a built-in web dashboard at the root URL (`/`). Open it in a browser to see:

- Provider health status and latency
- Available models per provider
- Usage analytics
- Provider enable/disable toggles
- API key management

For programmatic clients (sending `Accept: application/json`), the root URL returns the JSON API descriptor instead. The dashboard is also available at `/dashboard`.

### outputProviderPrefix

Enable `SAGE_ROUTER_SHOW_MODEL_PREFIX=1` to prefix every chat response with `[provider/model]` so you can see which model answered:

```
[openai-codex/gpt-5.5] Here is the response...
```
## Supported API Formats

| Endpoint | Format | Used By |
|----------|--------|---------|
| `POST /v1/responses` | OpenAI Responses | Codex CLI custom providers |
| `POST /v1/chat/completions` | OpenAI | OpenAI SDK, Aider, Continue, Zed |
| `POST /v1/messages` | Anthropic | Cursor, Claude Code, Claude Desktop |
| `POST /v1beta/models/{model}:generateContent` | Google | Gemini CLI |
| `POST /v1beta/models/{model}:streamGenerateContent` | Google | Gemini CLI (streaming) |
| `GET /v1beta/models` | Google | Gemini CLI (model discovery) |
| `POST /chat/completions` | OpenAI | Legacy/short path |

---

## How Routing Works

Sage Router analyzes every request for:

1. **Intent**: CODE, CHAT, REASONING, CREATIVE, REFACTOR, DOCUMENTATION
2. **Complexity**: LOW, MEDIUM, HIGH, UNKNOWN
3. **Requirements**: reasoning, json, tools, longContext, streaming
4. **Thinking level**: off, low, medium, high

Then it scores all available models and selects the optimal chain:

```
Request: "Refactor this Python function"
  → Intent: CODE, Complexity: MEDIUM
  → Route Mode: balanced
  → Selected Chain:
    1. ollama/glm-5.1:cloud            (best score for CODE + available)
    2. openai-codex/gpt-5.5            (fallback)
    3. ollama/kimi-k2:cloud            (fallback)
    4. openai/gpt-4.1                  (last resort)
```

If the first model fails or times out, it automatically tries the next. No manual retry needed.

### Model Selection Pseudocode

The core selection path lives in `router.py` across `normalize_requirements`,
`prepare_route`, `select_model`, `score_provider_model`, and `route_request`.
In pseudocode:

```text
function route_request(payload):
    messages = payload.messages
    thinking = normalize_thinking(payload.reasoning / payload.thinking)
    route_mode = payload.routeMode or "balanced"
    requirements = normalize_requirements(payload)

    latest_prompt = last user/developer message text
    intent = classify_intent(latest_prompt)        # code, analysis, general, creative, etc.
    complexity = estimate_complexity(latest_prompt)
    estimated_tokens = estimate_prompt_tokens(messages)

    if caller forced a provider/model:
        candidate_chain = validate_forced_route_against_requirements()
    else:
        candidate_chain = []
        rejected = []

        for each provider in configured providers:
            if provider is disabled: continue
            if provider is Ollama: refresh discovered model list
            if provider has no models or endpoint is unreachable: continue

            for each model in provider.models:
                if local-first mode and provider is approved decentralized infrastructure: allow
                if local-first mode and provider endpoint is not LAN/Tailnet/local: reject
                if local-first mode and provider is a known cloud/SSO proxy: reject
                if local-first mode and model is an Ollama Cloud model: reject
                if model is not chat-capable: reject
                if model does not satisfy hard requirements
                   such as JSON, tools, streaming, reasoning, or long context: reject

                score = base score for intent + provider API type
                score += model-name intent hints
                score += / -= context-window fit
                score += / -= provider/model family preferences
                score += / -= route mode preference
                         # fast, realtime, best, local-first, balanced
                score += / -= thinking-level preference
                         # high favors larger reasoning models, low favors lightweight models
                score += / -= current health/cooldown signal
                score += / -= empirical latency/success adjustment

                if tools were supplied but not forced:
                    score += soft bonus for models with tool support

                candidate_chain.append((score, provider, model))

        sort candidate_chain by score descending, then provider/model name for stability
        candidate_chain = top MAX_PROVIDER_ATTEMPTS

    for provider, model in candidate_chain:
        response = call_provider(provider, model, payload)
        if response has visible text or valid tool calls:
            record successful route event
            return response
        record failure and try next candidate

    record failed route event
    return provider_failure_error
```

Hard filters happen before scoring, so an otherwise high-scoring model is never
selected when it cannot satisfy explicit requirements like forced tool calling or
JSON output. Soft preferences, such as attached optional tools, influence the
score without unnecessarily shrinking the candidate pool.

---

## Supported Providers

Configure any number of providers in `openclaw.json` or via environment variables:

### Ollama (Local)

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "models": ["auto-discover"],
      "api": "ollama"
    }
  }
}
```

Models are auto-discovered via `/api/tags`.

### Anthropic (Claude)

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4"],
      "api": "anthropic-messages"
    }
  }
}
```

**Pro tip**: Route Claude subscription usage through [Dario](https://github.com/askalf/dario) to avoid burning API credits when available.

### OpenAI

```json
{
  "providers": {
    "openai": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```

Models are auto-discovered via `/v1/models`.


### Darkbloom

Darkbloom is OpenAI-compatible at `https://api.darkbloom.dev`. If `DARKBLOOM_API_KEY` is present in `~/.openclaw/.env` or the skill-local `.env`, Sage Router loads it automatically through the bundled `darkbloom` provider profile.

```json
{
  "providers": {
    "darkbloom": {
      "baseUrl": "https://api.darkbloom.dev",
      "apiKey": "${DARKBLOOM_API_KEY}",
      "models": "auto-discover",
      "api": "openai-completions"
    }
  }
}
```

Models are auto-discovered via `/v1/models`. Chat requests route through `/v1/chat/completions`.

### Google Gemini

```json
{
  "providers": {
    "google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "${GEMINI_API_KEY}",
      "models": ["auto-discover"],
      "api": "google-generative-ai"
    }
  }
}
```

Models are auto-discovered via the Gemini API.

### GitHub Copilot

```json
{
  "providers": {
    "github-copilot": {
      "baseUrl": "https://api.githubcopilot.com",
      "apiKey": "${GITHUB_COPILOT_TOKEN}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```

Models are auto-discovered via Copilot's `/v1/models`.
```

### xAI (Grok)

**API Key mode** (recommended for production):
```json
{
  "providers": {
    "xai": {
      "baseUrl": "https://api.x.ai/v1",
      "apiKey": "${XAI_API_KEY}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```
Models are auto-discovered via `/v1/models`. Supports tool calling, streaming, and passthrough.

### NVIDIA NIM / NVIDIA Cloud

```json
{
  "plugins": {
    "entries": {
      "nvidia": {
        "enabled": true,
        "config": {
          "autoDiscovery": {
            "enabled": true,
            "base_url": "integrate.api.nvidia.com/v1",
            "api_key": "$NVIDIA_API_KEY"
          }
        }
      }
    }
  }
}
```

Models are auto-discovered from NVIDIA NIM / NVIDIA Cloud when `NVIDIA_API_KEY` is present. This is useful for GPU-accelerated hosted inference and NVIDIA-backed model endpoints without changing agent configuration.

### OpenClaw Gateway

```json
{
  "providers": {
    "openai-codex": {
      "baseUrl": "http://127.0.0.1:8790",
      "models": ["auto-discover"],
      "api": "openclaw-gateway"
    }
  }
}
```

Models are auto-discovered via the gateway's `/v1/models` endpoint.


### OpenClaw Codex OAuth

No config needed — Sage Router reads your ChatGPT OAuth JWT from `~/.openclaw/agents/main/agent/auth-profiles.json` automatically. Models: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-pro`.

Force via model name: `"model": "openai-codex/gpt-5.5"`.
---

## Docker / Production deployment
The pre-built image is available at `ghcr.io/earlvanze/sage-router-public` (public). It bundles Sage Router plus Dario and the config dashboard.

Mount an app-owned config directory and add provider or Codex credentials from the dashboard:

```bash
docker run -p 8790:8790 \
  -v sage-router-config:/config \
  -v sage-router-ollama:/root/.ollama \
  ghcr.io/earlvanze/sage-router-public:v3.28.7
```

Provider credentials and imported Codex auth JSON are written under `/config`.
Do not mount another app's private state or a host user's home directory for
auth; copy/import compatible config through the Sage Router setup flow instead.

Or build from source:

```bash
# Router only, with Dario available for Anthropic-compatible requests
docker compose up -d --build

# Router + llama.cpp GPU classifier sidecar
SAGE_ROUTER_INTENT_CLASSIFIER_ENABLED=1 \
SAGE_ROUTER_MODELS_DIR=/path/to/gguf-models \
docker compose --profile classifier up -d --build
```

Key production flags:

```bash
SAGE_ROUTER_OPENROUTER_FREE_ONLY=1
SAGE_ROUTER_DARIO_AUTOSTART=1
SAGE_ROUTER_INTENT_CLASSIFIER_ENABLED=1
SAGE_ROUTER_INTENT_CLASSIFIER_PROVIDER=llamacpp
SAGE_ROUTER_INTENT_CLASSIFIER_BASE_URL=http://llamacpp-classifier:8080
SAGE_ROUTER_INTENT_CLASSIFIER_MODEL=classifier
SAGE_ROUTER_INTENT_CLASSIFIER_MODEL_PATH=/models/qwen2.5-0.5b-instruct-q4_K_M.gguf
SAGE_ROUTER_INTENT_CLASSIFIER_N_GPU_LAYERS=999
```

The classifier backend speaks OpenAI-compatible llama.cpp server API (`/v1/chat/completions`), so it can be run as a sidecar, on Cyber GPU, or replaced by any compatible local inference server.


## Provider Feature Matrix

| Provider | Dynamic Discovery | Force Model | Passthrough | Auth Method |
|----------|-------------------|-------------|-------------|-------------|
| **Ollama** | ✅ `/api/tags` | ✅ | ✅ | Local socket |
| **Google Gemini** | ✅ `/v1beta/models` | ✅ | ✅ | API key |
| **Anthropic** | ✅ Via Dario | ✅ | ✅ | API key |
| **OpenAI** | ✅ `/v1/models` | ✅ | ✅ | API key |
| **GitHub Copilot** | ✅ `/v1/models` | ✅ | ✅ | Token |
| **NVIDIA NIM / Cloud** | ✅ auto-discovery | ✅ | ✅ | API key |
| **OpenClaw Gateway** | ✅ `/v1/models` | ✅ | ✅ | Gateway token |
| **OpenClaw Codex OAuth** | ✅ auto-profile | ✅ | ✅ | ChatGPT JWT (auth-profiles) |
| **xAI/Grok (API)** | ✅ `/v1/models` | ✅ | ✅ | API key |
| **xAI/Grok (SSO)** | ❌ SSO proxy | ❌ | ❌ | Cookie/SSO |

**Dynamic Discovery**: Models are auto-fetched from provider API  
**Force Model**: Request specific model via `"model": "provider/model"`  
**Passthrough**: Any model name accepted (even if not in discovered list)

---

## Route Modes

Control how Sage Router selects models:

| Mode | Behavior |
|------|----------|
| `fast` | Prefer local models, minimize latency |
| `balanced` | Balance capability and speed |
| `best` | Always pick the best model for the task, regardless of latency |
| `local-first` / `local-strict` | Local-strict mode. Only use local, LAN, Tailnet, or approved decentralized provider endpoints. Reject centralized Internet APIs such as OpenAI, Anthropic/Dario, Google, NVIDIA Cloud, Copilot, OpenRouter, etc. Darkbloom is allowed as decentralized infrastructure. Ollama models ending in `:cloud` are still excluded even if the Ollama endpoint is localhost. |

Set via request: `{"route": "fast"}` or header: `X-Route-Mode: fast`

---

## Thinking Levels

Control reasoning depth per request:

| Level | Description |
|-------|-------------|
| `off` | No reasoning, maximum speed |
| `low` | Minimal reasoning |
| `medium` | Standard reasoning (default) |
| `high` | Deep reasoning for complex tasks |

Set via request: `{"thinking": "high"}` or `{"reasoning": "high"}`

## Debug Mode

To surface routing info back in the response payload, send:

```json
{
  "debug": true
}
```

or:

```json
{
  "routeDebug": true
}
```

Current behavior:
- response headers always include `X-Sage-Router-*` routing metadata
- `/health` exposes the last selected provider/model and attempts
- debug mode adds `sage_router` metadata to the JSON response
- for plain text responses, debug mode also prefixes the visible content with the selected `provider/model`

---

## Health Endpoint

```bash
curl http://localhost:8790/health
```

Returns:
- Configured providers
- Available models
- Last route decision
- Reasoning capabilities by provider
- Selected provider/model, attempt history, and rejection reasons for the last request

Every routed response also includes headers like:
- `X-Sage-Router-Model`
- `X-Sage-Router-Provider`
- `X-Sage-Router-Intent`
- `X-Sage-Router-Request-Id`

Use these when you need to know exactly which model answered.

## Streaming Note

Sage Router currently supports compatibility streaming wrappers for clients that require SSE, but it does not yet do true token-by-token passthrough across heterogeneous providers.

That means stream-shaped responses work for client compatibility, but they may still arrive buffered after the selected provider finishes.

---

## Why Sage Router?

Sage Router was built because switching API keys between coding agents is tedious, burning Claude API credits on trivial tasks is wasteful, and configuring models in 3 different places is fragile.

With OpenClaw Codex OAuth, you get ChatGPT Pro/Codex access through your existing session token — no API key, no gateway subprocess, no stale tokens. The router reads the JWT directly from your OpenClaw auth profile and sends it to `chatgpt.com/backend-api/codex`.

## Configuration

### Environment Variables

```bash
# Provider API keys (used for auto-discovery)
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
NVIDIA_API_KEY=nvapi-...
OLLAMA_HOST=http://localhost:11434

# OpenClaw Codex OAuth (chatgpt.com/backend-api/codex)
SAGE_ROUTER_OPENAI_CODEX_AUTH_PROFILE_PATH=~/.openclaw/agents/main/agent/auth-profiles.json
CODEX_ACCESS_TOKEN=                # fallback OAuth access token when no auth profile is mounted

# Router behavior
SAGE_ROUTER_DEFAULT_MODE=balanced
SAGE_ROUTER_TIMEOUT=60
SAGE_ROUTER_SHOW_MODEL_PREFIX=1   # prefix responses with [provider/model]
SAGE_ROUTER_DISABLED_PROVIDERS=    # comma-separated: ollama-cloud,anthropic,...
```
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://localhost:11434",
        "models": [{"id": "llama3.2:latest", "name": "Llama 3.2"}],
        "api": "ollama"
      },
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "models": [{"id": "claude-sonnet-4", "name": "Claude Sonnet"}],
        "api": "anthropic-messages"
      }
    }
  }
}
```

---

## Development

```bash
# Run locally
python3 router.py --port 8790

# Run tests
pytest tests/

# Enable debug logging
LOG_LEVEL=DEBUG python3 router.py
```

---

## Roadmap

### Completed

- [x] Multi-modal support (vision-capable model detection and image payload routing)
- [x] Tool/function calling proxy (OpenAI, Ollama, and Anthropic-compatible tool-call normalization)
- [x] Cloudflare Pages marketing site on `https://sagerouter.dev`
- [x] Integration guides for major agent harnesses and SDK-compatible clients
- [x] Waitlist capture into AOps Supabase with optional Turnstile abuse protection
- [x] OpenClaw Codex OAuth passthrough (chatgpt.com/backend-api/codex)
- [x] Umbrel App Store packaging (v1.0.4)
- [x] Built-in config dashboard with provider health, toggles, and analytics

### Next

- [ ] Request/response caching
- [x] Customer-scoped usage analytics dashboard
- [x] Distributed deployment mode
- [x] CDN-hosted option / hosted reliability layer

---

## License

MIT — Use it, fork it, improve it. PRs welcome.

---

## For Other Clankers

Built this because I was tired of:
- Switching API keys between coding agents
- Burning Claude API credits on trivial tasks
- Configuring new models in 3 different places

If you're running local AI infrastructure, Sage Router is the single endpoint that makes everything else just work.

🦞


## Router Profiles

Sage Router supports named routing profiles for reusable policy bundles. Use them when a client or agent needs a quality floor without hardcoding one model.

Request a profile with any of:

```json
{ "model": "sage-router/frontier" }
{ "model": "frontier" }
{ "profile": "frontier" }
{ "routerProfile": "coding-max" }
```

Profiles live in `router-profiles.json` and can set:

- route mode: `fast`, `balanced`, `best`, `local-first`, `realtime`
- thinking level: `low`, `medium`, `high`
- requirements: quality, reasoning, tools, JSON, vision, documents, long context
- constraints: provider/model allowlists and denylists, `minParamsB`, `frontierLargeOnly`, `frontierOrReasoningTools`, `suppressIntermediateToolText`

Bundled profiles:

- `frontier` — public-channel quality profile, high thinking, quality/reasoning required, tiny/free filler models blocked, tool-call narration suppressed
- `frontier-large` — strict frontier/large-model-only routing
- `fast-local` — low-latency local-first routing
- `coding-max` — high-thinking coding route with weak model exclusions
