# Sage Router Tailnet Edge

This deploys a CDN-style Tailnet edge endpoint for Sage Router. It runs a small reverse proxy on a stable Tailnet node, health-checks multiple private Sage Router installations, tracks probe latency, and routes OpenAI-compatible traffic to the lowest-latency healthy upstream.

The edge does not hold provider credentials. Clients authenticate to the edge with `SAGE_ROUTER_EDGE_TOKEN`; the edge injects `SAGE_ROUTER_BACKEND_TOKEN` when it calls private Sage Router nodes.

## Architecture

```text
Codex / OpenClaw / API client
  -> https://sage-router-edge.<tailnet>.ts.net/v1/... or https://api.sagerouter.dev/v1/...
  -> sage-router-tailnet-edge
  -> lowest-latency healthy Sage Router node over Tailnet
  -> user's configured providers
```

Use this for private Tailnet resiliency first. For public monetization, put billing, rate limits, abuse controls, and customer API key issuance in front of this endpoint before enabling Tailscale Funnel or a public DNS proxy.

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
- Upstream health probes use `SAGE_ROUTER_HEALTH_PATH`, `SAGE_ROUTER_HEALTH_INTERVAL_SECONDS`, and `SAGE_ROUTER_HEALTH_TIMEOUT_SECONDS`.
- Keep the edge token separate from backend router tokens so you can rotate customer/client access without reconfiguring private Sage Router installs.
- Do not mount `.openclaw`, provider keys, OAuth profiles, or billing secrets into the edge container.
