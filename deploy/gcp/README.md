# Sage Router on GCP Free-Tier-Style Cloud Run

This deployment is for a public Phase 2 demo of Sage Router on Google Cloud Run.

## Cost posture

- Cloud Run: `min-instances=0`, `max-instances=1`, 512Mi memory.
- No provider/customer API keys are deployed by default.
- Dario is bundled for Anthropic-compatible routing, but is not authenticated unless credentials are supplied via Secret Manager or a private runtime config.
- Ollama is bundled and started without local models so users can route to Ollama Cloud when they provide their own Ollama auth/config.
- Artifact Registry stores one small Python image.
- The service is public for demoability and exposes `/health`.


## Live Phase 2 deployment

- Project: `sage-router-demo-20260428`
- Region: `us-central1`
- Service: `sage-router`
- URL: `https://sage-router-434058661374.us-central1.run.app`
- Verified endpoints: `/`, `/health`, `/v1/models`
- Runtime boundary: Dario binary and Ollama daemon are present. Dario requires user-provided auth before Anthropic-compatible provider traffic can use it. Ollama requires user-provided Ollama Cloud auth/config for cloud inference; no local model weights are bundled.

## Deploy

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
./deploy/gcp/cloudrun-deploy.sh
```

The script enables required APIs, creates an Artifact Registry Docker repo if needed, builds the minimal Cloud Run image, deploys the service, and prints the Cloud Run URL.

## Verify

```bash
SERVICE_URL=$(gcloud run services describe sage-router --region us-central1 --format 'value(status.url)')
curl "$SERVICE_URL/health"
```

## Boundary

Do not deploy local OpenClaw configs, customer provider credentials, `.env` files, Dario credentials, or OAuth cookies to Cloud Run. This Phase 2 deployment is a public demo / credibility deployment, not a hosted customer key-custody layer.

## Self-Serve SaaS Readiness

The router now includes incremental account, API key, billing, crypto, and private analytics endpoints. Production deploys need these env vars configured by name only:

- Supabase Auth/REST: `SAGE_ROUTER_SUPABASE_URL`, `SAGE_ROUTER_SUPABASE_ANON_KEY`, `SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY`
- SaaS table names if non-default: `SAGE_ROUTER_SUPABASE_CUSTOMERS_TABLE`, `SAGE_ROUTER_SUPABASE_API_KEYS_TABLE`, `SAGE_ROUTER_SUPABASE_PAYMENT_INTENTS_TABLE`
- Generated key hashing: `SAGE_ROUTER_API_KEY_HASH_PEPPER` or `SAGE_ROUTER_SIGNING_SECRET`
- Stripe: `STRIPE_SECRET_KEY` or `SAGE_ROUTER_STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` or `SAGE_ROUTER_STRIPE_WEBHOOK_SECRET`, `SAGE_ROUTER_STRIPE_PRICE_ID` or `STRIPE_PRICE_ID`
- Public URLs: `SAGE_ROUTER_PUBLIC_BASE_URL`, `SAGE_ROUTER_API_BASE_URL`
- Optional manual crypto flow: `SAGE_ROUTER_CRYPTO_PAYMENT_ADDRESS`, `SAGE_ROUTER_CRYPTO_PAYMENT_ASSET`, `SAGE_ROUTER_CRYPTO_PAYMENT_NETWORK`

Apply `supabase/sage_router_saas.sql` before enabling self-serve account creation in production.

If Supabase customer tables are not configured, the backend falls back to `SAGE_ROUTER_CUSTOMER_STORE_PATH` for local development and tests. That fallback is not a production persistence layer.

Routing auth remains compatible with `SAGE_ROUTER_CLIENT_API_KEYS`. New self-serve API keys must be active and attached to an active paid/manual/trial customer before `/v1/chat/completions` or `/v1/messages` will route traffic. A valid Supabase user JWT can manage account APIs, but it is not treated as paid routing authorization by itself.
