# Use Sage Router for BYOK provider fallback

Sage Router is designed for teams that bring their own authorized provider access and want policy-based fallback.

Example provider mix:

```json
{
  "providers": {
    "ollama": { "baseUrl": "http://localhost:11434", "models": ["auto-discover"], "api": "ollama" },
    "openai": { "baseUrl": "https://api.openai.com/v1", "apiKey": "${OPENAI_API_KEY}", "models": ["auto-discover"], "api": "openai-completions" },
    "anthropic": { "baseUrl": "https://api.anthropic.com", "apiKey": "${ANTHROPIC_API_KEY}", "models": ["auto-discover"], "api": "anthropic-messages" },
    "nvidia": { "baseUrl": "https://integrate.api.nvidia.com/v1", "apiKey": "${NVIDIA_API_KEY}", "models": ["auto-discover"], "api": "openai-completions" }
  }
}
```

Recommended modes: `fast`, `balanced`, `best`, and `local-first`.
