# Use Sage Router with Codex CLI

Codex CLI can use Sage Router as an OpenAI-compatible endpoint.

## Setup

Start Sage Router on port `8790`, then export:

```bash
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router
```

Use a provider-qualified model when you want an explicit route:

```bash
codex --model openai/gpt-4.1
codex --model ollama/qwen2.5-coder:latest
```

Recommended policy:

- Coding/refactor/debugging: coding-strong local model first, cloud fallback second.
- Large reasoning or fragile edits: higher-capability cloud model first.
- Background maintenance: local-first mode.
