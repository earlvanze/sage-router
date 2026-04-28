# Use Sage Router with Anthropic-compatible clients

Sage Router exposes an Anthropic Messages-compatible endpoint for tools that use Claude-style requests.

```bash
export ANTHROPIC_BASE_URL=http://localhost:8788
export ANTHROPIC_API_KEY=local-router
```

Clients should send requests to `POST /v1/messages`. Sage Router handles downstream provider auth and can route to Anthropic or other configured fallback routes depending on policy.

Use provider-qualified models for hard pins, or `auto` for policy-based model selection.
