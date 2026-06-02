# Security & Privacy

Sage Router is a **router, not a collector**. It exists to forward requests to model providers using the credentials you already configured for them. This document explains what the router does and does not do with secrets, identities, and request data.

## TL;DR

- The router **does not collect user identities** by default.
- The router **does not store** OAuth tokens, API keys, prompts, or responses.
- The router **does not phone home**. The only outbound calls are the ones you make to upstream providers.
- All persisted state is local: a route event log and (optionally) a customer record for the hosted billing tier.

## Default posture (no opt-in required)

| Capability | Default | Toggle |
| --- | --- | --- |
| Collect user identities (Supabase Auth) | **Off** | `SAGE_ROUTER_SUPABASE_AUTH_ENABLED=1` |
| Mirror analytics/customers to Supabase | **Off** | `SAGE_ROUTER_SUPABASE_MIRROR_ENABLED=1` |
| Hosted billing tier (creates customer rows) | **Off** | `SAGE_ROUTER_BILLING_ENABLED=1` |
| Stripe / crypto checkout endpoints | Returns `503 *_not_configured` | `STRIPE_SECRET_KEY` / `SAGE_ROUTER_CRYPTO_PAYMENT_ADDRESS` |

If none of the toggles above are set:

- `customer_for_user()` returns `None` for every request.
- The local `~/.cache/sage-router/customers.json` file is **never created**.
- The route event log is the only persisted state, and it is sanitized:
  - `Authorization` and `Cookie` headers are stripped.
  - Email addresses are masked to `<email-N>` tokens.
  - Bodies are kept at a compact summary; raw prompts are not logged.

## What the router does store (when the hosted tier is enabled)

When the operator explicitly turns on the hosted billing tier (`SAGE_ROUTER_BILLING_ENABLED=1`), the router will:

- Create a `customers.json` row with `{id, user_id, email, plan, status, ...}`.
- Store a SHA-256 hash (salted) of generated API keys, never the raw key.
- Append a sanitized event line to the local route log per request.

No payload content is stored. No upstream responses are stored. Tokens never leave the runtime process.

## Credentials handling

Sage Router only ever reads credentials from these sources:

1. Environment variables (e.g. `OPENAI_API_KEY`, `OPENAI_CODEX_API_KEY`).
2. `~/.openclaw/agents/main/agent/auth-profiles.json` for OpenClaw OAuth tokens.

Credentials are held in memory and used as `Authorization: Bearer …` headers. They are not logged, not persisted, and not forwarded to any destination other than the upstream provider they authenticate against.

## What the router does **not** do

- It does not run a separate authentication backend.
- It does not call Supabase, Stripe, or any third party unless the operator has set the corresponding env var.
- It does not record prompts, completions, tool calls, or attachments.
- It does not track users across requests. The `/health`, `/v1/models`, and analytics endpoints are anonymous.

## Threat model assumptions

- The host running Sage Router is trusted. Anyone with shell access can read the env / auth-profiles.json.
- The Docker network between Sage Router and bundled providers (Ollama, OpenClaw) is trusted; nothing leaves the host unless you tunnel it.
- Untrusted clients should put a reverse proxy in front of port `8788` and supply `SAGE_ROUTER_CLIENT_API_KEYS`.

## Reporting issues

Email `security@earlvanze.dev` or open a private security advisory on GitHub. Please do not file public issues for vulnerabilities.
