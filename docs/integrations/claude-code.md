# Use Sage Router with Claude Code

Claude Code and Anthropic-compatible clients can talk to Sage Router through the Anthropic Messages endpoint.

Start Sage Router on port `8788`, then export:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8788
export ANTHROPIC_API_KEY=local-router
```

Sage Router accepts `POST /v1/messages` and routes the request according to model name, route mode, provider health, and fallback policy.

Recommended use:

- Keep Claude Code pointed at one local endpoint.
- Configure Sage Router with Anthropic, OpenAI-compatible, Ollama, and NVIDIA routes.
- Let fallback keep the coding session alive when one provider is slow, down, or rate-limited.
