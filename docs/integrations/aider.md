# Use Sage Router with Aider

Aider can use Sage Router through the OpenAI-compatible endpoint.

```bash
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router
```

Use `auto` for policy routing, or pin a provider-qualified model when needed:

```bash
aider --model openai/gpt-4.1
aider --model ollama/qwen2.5-coder:latest
```

Recommended routing: coding-strong model first, then cloud fallback for larger edits or failed local routes.
