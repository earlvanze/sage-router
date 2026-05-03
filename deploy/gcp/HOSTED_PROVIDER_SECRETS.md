# Hosted provider secrets for Cloud Run Sage Router

Cloud Run Sage Router can now keep upstream provider credentials server-side. Client apps only send a Sage Router subscription key via `Authorization: Bearer <client-key>`.

Create these Secret Manager secrets before deploy, using dedicated hosted-router credentials, not personal/local OpenClaw keys:

- `SAGE_ROUTER_CLIENT_API_KEYS` — comma-separated client/subscription keys
- `SAGE_ROUTER_OPENAI_API_KEY`
- `SAGE_ROUTER_OPENROUTER_API_KEY`
- `SAGE_ROUTER_ANTHROPIC_API_KEY`
- `SAGE_ROUTER_GOOGLE_API_KEY`
- `SAGE_ROUTER_XAI_API_KEY`
- `SAGE_ROUTER_ZAI_API_KEY`
- `NVIDIA_API_KEY` (also exposed as `SAGE_ROUTER_NVIDIA_API_KEY`)
- `SAGE_ROUTER_CLOUDFLARE_API_TOKEN`
- `OLLAMA_API_KEY` (also exposed as `SAGE_ROUTER_OLLAMA_API_KEY`)
- `SAGE_ROUTER_OPENAI_CODEX_ACCESS_TOKEN` — OpenAI Codex OAuth bearer token

Optional model allowlists, comma-separated env vars:

- `SAGE_ROUTER_OPENAI_MODELS`
- `SAGE_ROUTER_OPENROUTER_MODELS`
- `SAGE_ROUTER_ANTHROPIC_MODELS`
- `SAGE_ROUTER_GOOGLE_MODELS`
- `SAGE_ROUTER_XAI_MODELS`
- `SAGE_ROUTER_ZAI_MODELS`
- `SAGE_ROUTER_NVIDIA_MODELS`
- `SAGE_ROUTER_CLOUDFLARE_MODELS`
- `SAGE_ROUTER_OLLAMA_MODELS`
- `SAGE_ROUTER_OPENAI_CODEX_MODELS`

OpenAI Codex OAuth compatibility:

- Preferred hosted path: wire `SAGE_ROUTER_OPENAI_CODEX_ACCESS_TOKEN` from Secret Manager.
- Local/mounted compatibility: router will also read OpenClaw/Hermes-style auth profiles from `SAGE_ROUTER_OPENAI_CODEX_AUTH_PROFILE_PATH(S)` if mounted.
- OAuth access tokens are usually short-lived, so production should rotate/update this secret or mount a refresh-capable auth profile intentionally.

Cloudflare account id is configured as deploy env `SAGE_ROUTER_CLOUDFLARE_ACCOUNT_ID`.
