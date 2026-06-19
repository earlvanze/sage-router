# Sage Router Tailnet Edge

This deploys a CDN-style Tailnet edge endpoint for Sage Router. It runs a small reverse proxy on a stable Tailnet node, health-checks multiple private Sage Router installations, tracks probe latency, and routes OpenAI-compatible traffic to the lowest-latency healthy upstream.

The edge does not hold provider credentials. In private mode, clients authenticate to the edge with `SAGE_ROUTER_EDGE_TOKEN`; the edge injects `SAGE_ROUTER_BACKEND_TOKEN` when it calls private Sage Router nodes. In public SaaS mode, set `SAGE_ROUTER_EDGE_AUTH_MODE=supabase` so `/v1/*` and `/v1beta/*` model routes require an active generated `sk_sage_*` customer API key while account and billing UI routes require a valid Supabase user JWT. Operator routes such as `/analytics` stay private to `SAGE_ROUTER_EDGE_TOKEN` and are pinned to the configured control-plane origin.

## Architecture

```text
Codex / OpenClaw / API client
  -> https://sage-router-edge.<tailnet>.ts.net/v1/... or https://api.sagerouter.dev/v1/...
  -> sage-router-tailnet-edge
  -> lowest-latency healthy Sage Router node over Tailnet
  -> user's configured providers
```

Use this for private Tailnet resiliency first. For public monetization, enable Supabase edge auth, keep billing and customer API key issuance on the hosted control-plane router, and add rate limits and abuse controls before enabling Tailscale Funnel or a public DNS proxy.

## Relationship to sagerouter.dev

The current `sagerouter.dev` setup has separate responsibilities:

- `sagerouter.dev` / `www.sagerouter.dev`: Cloudflare Pages static site (`sage-router-web`).
- `api.sagerouter.dev`: Cloudflare-proxied GCP edge VM that routes to the fastest healthy Sage Router origin.
- Tailnet Edge: failover endpoint for routing to the fastest healthy Tailnet-local Sage Router install, with the Google-hosted API service available as a public fallback origin.

Before replacing or moving `api.sagerouter.dev`, verify `/edge/health`, `/health`, `/v1/models`, and a small chat completion from the target edge, then update DNS. Keep customer auth, billing, rate limits, and abuse controls in front of the edge before offering it outside the Tailnet.

For hosted relay/control-plane work where provider credentials stay on the user's machine, use the Cloudflare Worker/Durable Object tunnel design in `docs/cloud-tunnel/README.md` as the product direction. Tailnet Edge is the operational failover primitive, not the customer-facing key-custody boundary.

## Configure

```bash
cd deploy/tailnet-edge
cp .env.example .env
```

Edit `.env`:

```dotenv
SAGE_ROUTER_EDGE_PORT=8790
SAGE_ROUTER_UPSTREAMS=http://cyber.example.ts.net:8790,http://umbrel.example.ts.net:8790
SAGE_ROUTER_EDGE_TOKEN=replace-with-client-facing-token
SAGE_ROUTER_BACKEND_TOKEN=local
```

Prefer MagicDNS names or stable Tailnet IPs. Include every Sage Router install that should be eligible for failover.

For the public `api.sagerouter.dev` mode, keep a private edge token for emergency/admin use and enable Supabase-backed customer auth:

```dotenv
SAGE_ROUTER_EDGE_AUTH_MODE=supabase
SAGE_ROUTER_EDGE_TOKEN=replace-with-private-admin-token
SAGE_ROUTER_BACKEND_TOKEN=local
SAGE_ROUTER_CONTROL_PLANE_TOKEN=replace-with-hosted-origin-operator-token
SAGE_ROUTER_SUPABASE_URL=https://awtangrlqqsdpksarhwo.supabase.co
SAGE_ROUTER_SUPABASE_ANON_KEY=...
SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY=...
SAGE_ROUTER_API_KEY_HASH_PEPPER=...
SAGE_ROUTER_CORS_ORIGIN=https://app.sagerouter.dev,https://sagerouter.dev,https://www.sagerouter.dev
SAGE_ROUTER_EDGE_RATE_LIMIT_ENABLED=1
SAGE_ROUTER_EDGE_RATE_LIMIT_WINDOW_SECONDS=60
SAGE_ROUTER_EDGE_RATE_LIMITS=trial=30,lite=60,pro=180,max=600,manual=600,paid=180,active=180,default=60
SAGE_ROUTER_EDGE_AUTH_CACHE_SECONDS=30
SAGE_ROUTER_EDGE_API_KEY_AUTH_CACHE_SECONDS=0
SAGE_ROUTER_EDGE_QUOTA_ENABLED=1
SAGE_ROUTER_EDGE_MONTHLY_QUOTAS=trial=1000,lite=10000,pro=50000,max=200000,paid=50000,active=50000,default=0
```

If browser account or billing requests go through the edge, route them to the hosted control-plane Sage Router instance rather than a random private model router:

```dotenv
SAGE_ROUTER_CONTROL_PLANE_UPSTREAM=https://sage-router-hosted.example.run.app
```

With that split, public metadata (`/pricing`, `/plans`, and `/features/agent-native`), `/account*`, supported `/billing/*` UI endpoints, and private operator analytics use the control-plane origin. Account and billing UI endpoints preserve the user's Supabase JWT, private operator analytics requires the edge admin token and injects `SAGE_ROUTER_CONTROL_PLANE_TOKEN` when set, while `/v1/*` and `/v1beta/*` model routes validate a generated customer API key and inject only `SAGE_ROUTER_BACKEND_TOKEN` into private Tailnet routers.

The edge enforces an in-memory fixed-window rate limit for generated customer API keys and Supabase user-JWT account/billing requests. Limits are keyed by generated key/customer or user id, grouped by the first path segment (`/v1`, `/account`, `/billing`), and return `429` with `Retry-After` plus `X-RateLimit-*` headers when exceeded. Supabase user JWT validation uses `SAGE_ROUTER_EDGE_AUTH_CACHE_SECONDS`; generated `sk_sage_*` API keys use `SAGE_ROUTER_EDGE_API_KEY_AUTH_CACHE_SECONDS`, which defaults to `0` so revoked keys and inactive accounts are rechecked on the next request. The private `SAGE_ROUTER_EDGE_TOKEN` remains exempt for emergency/admin operations.

Monthly SaaS quotas are optional and durable in Supabase. From the repository root, run `scripts/apply_supabase_quota_schema.sh` to apply `supabase/migrations/20260619021500_sage_router_usage_quotas.sql`, then set `SAGE_ROUTER_EDGE_QUOTA_ENABLED=1`. Generated customer API keys on `/v1/*` call the `sage_router_increment_usage` RPC before proxying and receive `X-Quota-*` headers. A plan limit of `0` means no monthly cap for that plan/status; omitted plans fall back to `default`.

## Run

```bash
docker compose up -d --build
curl http://127.0.0.1:8790/edge/health
```

Call it like any OpenAI-compatible Sage Router endpoint:

```bash
curl http://127.0.0.1:8790/v1/chat/completions \
  -H "Authorization: Bearer replace-with-client-facing-token" \
  -H "Content-Type: application/json" \
  -d '{"model":"sage-router/frontier","messages":[{"role":"user","content":"hello"}]}'
```

In Supabase auth mode, use a generated customer key from the account dashboard instead of the private edge token:

```bash
curl https://api.sagerouter.dev/v1/models \
  -H "Authorization: Bearer sk_sage_..."
```

## Publish inside the Tailnet

On a Tailnet node, expose the local edge privately through Tailscale Serve:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:8790
```

Clients can then use:

```bash
export OPENAI_BASE_URL=https://sage-router-edge.example.ts.net/v1
export OPENAI_API_KEY=replace-with-client-facing-token
```

## Publish publicly with Funnel

After Serve works, enable Tailscale Funnel for the same local edge target:

```bash
tailscale funnel --bg --https=443 http://127.0.0.1:8790
```

Funnel exposes the node's `*.ts.net` HTTPS name publicly. Verify the Funnel hostname before putting `api.sagerouter.dev` in front of it:

```bash
curl https://sage-router-edge.example.ts.net/edge/health
curl https://sage-router-edge.example.ts.net/v1/models -H "Authorization: Bearer replace-with-client-facing-token"
```

Do not CNAME `api.sagerouter.dev` directly to a Funnel hostname unless you have confirmed TLS/SNI behavior for that custom hostname. The safer public cutover is a Cloudflare Worker route on `api.sagerouter.dev/*` that health-checks a pool of public origins and fetches the lowest-latency healthy one:

```bash
cd deploy/tailnet-edge
cp wrangler.api-sagerouter.example.toml wrangler.toml
# Edit SAGE_ROUTER_ORIGINS to include the verified https://*.ts.net Funnel URL
# and the current Google-hosted API origin.
npx wrangler deploy --config wrangler.toml
```

The Worker exposes `GET /edge/health` on `api.sagerouter.dev` so you can see which public origin it selected. Cloudflare can then provide DNS, proxying, WAF, cache rules for cacheable non-streaming paths, and optional Load Balancing if you later expose multiple public edge origins. The Tailnet Edge process still performs the application-aware lowest-latency selection among private Sage Router installs.

## Publish publicly with a cloud VM origin

The current `api.sagerouter.dev` endpoint uses this path:

```text
Cloudflare proxy
  -> GCP VM public IP
  -> Caddy on the VM cloud interface
  -> sage-router-tailnet-edge on 127.0.0.1:8790
  -> lowest-latency healthy Tailnet or Google-hosted Sage Router origin
```

This keeps Tailscale Serve/Funnel available on the Tailnet interface while Caddy terminates `api.sagerouter.dev` on the VM's GCP interface. Copy `Caddyfile.api-sagerouter.example`, change the `bind` address to the VM's internal cloud-interface IP, and run Caddy with host networking:

```bash
docker run -d --name sage-router-public-caddy --restart unless-stopped \
  --network host \
  -v "$PWD/Caddyfile.api-sagerouter.example:/etc/caddy/Caddyfile:ro" \
  -v sage-router-caddy-data:/data \
  -v sage-router-caddy-config:/config \
  caddy:2-alpine
```

Set `api.sagerouter.dev` to an unproxied `A` record first so Caddy can obtain a public certificate, verify `https://api.sagerouter.dev/edge/health`, then enable Cloudflare proxying on the same record.

## Google Cloud VM bootstrap

Use `cloud-init-gcp.yaml.example` when creating or replacing a small Google Cloud VM. Replace:

- `REPLACE_WITH_TS_AUTHKEY`
- `REPLACE_WITH_EDGE_TOKEN`
- the example upstream hostnames

Google Cloud accepts cloud-init user data through `gcloud compute instances create --metadata-from-file user-data=cloud-init-gcp.yaml` or the equivalent console field. The VM needs only Docker, Tailscale, outbound Tailnet access, and enough CPU/RAM for the edge proxy.

If you are recovering the existing `sagerouter.dev` infrastructure, authenticate `gcloud` first and inspect the known Cloud Run project before changing DNS:

```bash
gcloud auth login
gcloud config set project sage-router-demo-20260428
gcloud run services list --region us-central1
gcloud run domain-mappings list --region us-central1
gcloud app domain-mappings list
```

## Operations

- `/edge/health` reports the selected upstream and last probe latency/error for every configured upstream.
- In `SAGE_ROUTER_EDGE_AUTH_MODE=supabase`, `/edge/health` remains public but all proxied routes fail closed unless the request has a private edge token, a valid generated customer API key for model API paths, or a valid Supabase user JWT for account/billing UI paths.
- Public SaaS traffic is rate-limited by `SAGE_ROUTER_EDGE_RATE_LIMITS` over `SAGE_ROUTER_EDGE_RATE_LIMIT_WINDOW_SECONDS`; responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` when a non-exempt identity is counted.
- If `SAGE_ROUTER_EDGE_QUOTA_ENABLED=1`, generated customer API key traffic on `/v1/*` is counted against `SAGE_ROUTER_EDGE_MONTHLY_QUOTAS` in Supabase. Exhausted plans receive `402` with `X-Quota-*` headers; quota RPC/configuration failures fail closed with `503`.
- Upstream health probes use `SAGE_ROUTER_HEALTH_PATH`, `SAGE_ROUTER_HEALTH_INTERVAL_SECONDS`, and `SAGE_ROUTER_HEALTH_TIMEOUT_SECONDS`.
- Proxied request timeout uses `SAGE_ROUTER_REQUEST_TIMEOUT_SECONDS` and defaults to 120 seconds so slower frontier/model fallback attempts can complete.
- Proxied requests retry the next healthy upstream on backend `401`, `429`, `502`, `503`, or `504`; responses include `X-Sage-Router-Retry-Count` when a retry was needed.
- Keep the edge token separate from backend router tokens so you can rotate customer/client access without reconfiguring private Sage Router installs.
- Do not mount `.openclaw`, provider keys, OAuth profiles, or billing secrets into the edge container.
