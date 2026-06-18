# Sage Router Tailnet Edge

This deploys a CDN-style Tailnet edge endpoint for Sage Router. It runs a small Caddy reverse proxy on a stable Tailnet node, health-checks multiple private Sage Router installations, and routes OpenAI-compatible traffic to whichever upstream is healthy.

The edge does not hold provider credentials. Clients authenticate to the edge with `SAGE_ROUTER_EDGE_TOKEN`; the edge injects `SAGE_ROUTER_BACKEND_TOKEN` when it calls private Sage Router nodes.

## Architecture

```text
Codex / OpenClaw / API client
  -> https://sage-router-edge.<tailnet>.ts.net/v1/...
  -> sage-router-tailnet-edge
  -> healthy Sage Router node over Tailnet
  -> user's configured providers
```

Use this for private Tailnet resiliency first. For public monetization, put billing, rate limits, abuse controls, and customer API key issuance in front of this endpoint before enabling Tailscale Funnel or a public DNS proxy.

## Relationship to sagerouter.dev

The current `sagerouter.dev` setup has separate responsibilities:

- `sagerouter.dev` / `www.sagerouter.dev`: Cloudflare Pages static site (`sage-router-web`).
- `api.sagerouter.dev`: Google-hosted Sage Router API service.
- Tailnet Edge: private failover endpoint for routing to one of several Tailnet-local Sage Router installs.

Do not replace `api.sagerouter.dev` with Tailnet Edge directly. If you want to test public routing, introduce a separate hostname first, for example `edge.sagerouter.dev` or `tailnet-api.sagerouter.dev`, then put customer auth, billing, rate limits, and abuse controls in front of the edge before offering it outside the Tailnet.

For hosted relay/control-plane work where provider credentials stay on the user's machine, use the Cloudflare Worker/Durable Object tunnel design in `docs/cloud-tunnel/README.md` as the product direction. Tailnet Edge is the operational failover primitive, not the customer-facing key-custody boundary.

## Configure

```bash
cd deploy/tailnet-edge
cp .env.example .env
```

Edit `.env`:

```dotenv
SAGE_ROUTER_EDGE_PORT=8790
SAGE_ROUTER_UPSTREAMS=http://cyber.example.ts.net:8790,http://umbrel.example.ts.net:8788
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

On a Linux Tailnet node, expose the local edge through Tailscale Serve:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:8790
```

Clients can then use:

```bash
export OPENAI_BASE_URL=https://sage-router-edge.example.ts.net/v1
export OPENAI_API_KEY=replace-with-client-facing-token
```

## Google Cloud VM bootstrap

Use `cloud-init-gcp.yaml.example` when creating or replacing a small Google Cloud VM. Replace:

- `REPLACE_WITH_TS_AUTHKEY`
- `REPLACE_WITH_EDGE_TOKEN`
- the example upstream hostnames

Google Cloud accepts cloud-init user data through `gcloud compute instances create --metadata-from-file user-data=cloud-init-gcp.yaml` or the equivalent console field. The VM needs only Docker, Tailscale, outbound Tailnet access, and enough CPU/RAM for Caddy.

If you are recovering the existing `sagerouter.dev` infrastructure, authenticate `gcloud` first and inspect the known Cloud Run project before changing DNS:

```bash
gcloud auth login
gcloud config set project sage-router-demo-20260428
gcloud run services list --region us-central1
gcloud run domain-mappings list --region us-central1
gcloud app domain-mappings list
```

## Operations

- `SAGE_ROUTER_LB_POLICY=first` keeps traffic sticky to the first healthy upstream in the configured list. Use `round_robin` when you want active distribution.
- `/edge/health` reports the edge process health. Upstream health is handled by Caddy active checks against `SAGE_ROUTER_HEALTH_PATH`.
- Keep the edge token separate from backend router tokens so you can rotate customer/client access without reconfiguring private Sage Router installs.
- Do not mount `.openclaw`, provider keys, OAuth profiles, or billing secrets into the edge container.
