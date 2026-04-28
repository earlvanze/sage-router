# Use Sage Router with OpenClaw

Sage Router can sit between OpenClaw and multiple model providers so agents can use one stable endpoint.

```bash
openclaw skill add sage-router --from clawhub
openclaw skill configure sage-router
```

Start Sage Router on port `8788`.

OpenAI-compatible tools:

```bash
export OPENAI_BASE_URL=http://localhost:8788/v1
export OPENAI_API_KEY=local-router
```

Anthropic-compatible tools:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8788
export ANTHROPIC_API_KEY=local-router
```

Use provider-qualified names when needed, for example `ollama/qwen2.5-coder:latest`, `openai/gpt-4.1`, `anthropic/claude-sonnet-4-6`, or `nvidia/meta/llama-3.1-405b-instruct`.
