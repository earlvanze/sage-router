# Sage Router

**The OpenRouter replacement that optimizes for performance, not cost.**

One endpoint. Any provider. The router figures out the rest.

[![ClawHub](https://img.shields.io/badge/ClawHub-v3.15.0-blue)](https://clawhub.ai/earlvanze/sage-router)
[![GitHub](https://img.shields.io/badge/GitHub-earlvanze%2Fsage--router-black)](https://github.com/earlvanze/sage-router)

---

## What This Is

Sage Router is a **local-first, self-hosted AI model gateway** that intelligently routes requests to the best available model based on intent, latency, and capability — not just price.

Unlike OpenRouter, which optimizes for cost, Sage Router optimizes for **getting the job done**:

- **Intent-based routing**: Code tasks go to coding models, creative tasks to creative models, reasoning tasks to reasoning models
- **Automatic fallback**: If one provider fails or hits rate limits, it seamlessly tries the next
- **Dynamic discovery**: New models from Ollama, Anthropic, OpenAI, Google, and OpenClaw are auto-detected — no config updates needed
- **Zero API lock-in**: Use any subscription you already have (Ollama, Claude, OpenAI, Gemini, GitHub Copilot)
- **Debuggable routing**: Surface the selected provider/model in headers, `/health`, or optional debug output

---

## Quick Start

### Installation (OpenClaw)

```bash
openclaw skill add sage-router --from clawhub
openclaw skill configure sage-router
```

### Manual Installation

```bash
git clone https://github.com/earlvanze/sage-router.git
cd sage-router
pip install -r requirements.txt  # if any
python3 router.py --port 8788
```

### Configure Your Tools

Point any OpenAI-compatible tool at Sage Router:

```bash
export OPENAI_BASE_URL=http://localhost:8788/v1
export OPENAI_API_KEY=irrelevant  # Sage Router uses your configured provider auth
```

Or for Gemini CLI:

```bash
export GOOGLE_GEMINI_BASE_URL=http://localhost:8788
export GEMINI_API_KEY=routed
```

Or for Anthropic tools:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8788
export ANTHROPIC_API_KEY=irrelevant
```

---

## Supported API Formats

| Endpoint | Format | Used By |
|----------|--------|---------|
| `POST /v1/chat/completions` | OpenAI | OpenAI SDK, Aider, Continue, Zed |
| `POST /v1/messages` | Anthropic | Cursor, Claude Code, Claude Desktop |
| `POST /v1beta/models/{model}:generateContent` | Google | Gemini CLI |
| `POST /v1beta/models/{model}:streamGenerateContent` | Google | Gemini CLI (streaming) |
| `GET /v1beta/models` | Google | Gemini CLI (model discovery) |
| `POST /chat/completions` | OpenAI | Legacy/short path |

---

## How Routing Works

Sage Router analyzes every request for:

1. **Intent**: CODE, CHAT, REASONING, CREATIVE, REFACTOR, DOCUMENTATION
2. **Complexity**: LOW, MEDIUM, HIGH, UNKNOWN
3. **Requirements**: reasoning, json, tools, longContext, streaming
4. **Thinking level**: off, low, medium, high

Then it scores all available models and selects the optimal chain:

```
Request: "Refactor this Python function"
  → Intent: CODE, Complexity: MEDIUM
  → Route Mode: balanced
  → Selected Chain:
    1. ollama/claude-3.5-sonnet:fast   (local, fast)
    2. ollama/gpt-4o-mini:latest       (fallback)
    3. anthropic/claude-sonnet-4-6     (if local fails)
    4. openai/gpt-4o                   (last resort)
```

If the first model fails or times out, it automatically tries the next. No manual retry needed.

---

## Supported Providers

Configure any number of providers in `openclaw.json` or via environment variables:

### Ollama (Local)

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "models": ["auto-discover"],
      "api": "ollama"
    }
  }
}
```

Models are auto-discovered via `/api/tags`.

### Anthropic (Claude)

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4"],
      "api": "anthropic-messages"
    }
  }
}
```

**Pro tip**: Route Claude subscription usage through [Dario](https://github.com/askalf/dario) to avoid burning API credits when available.

### OpenAI

```json
{
  "providers": {
    "openai": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```

Models are auto-discovered via `/v1/models`.

### Google Gemini

```json
{
  "providers": {
    "google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "${GEMINI_API_KEY}",
      "models": ["auto-discover"],
      "api": "google-generative-ai"
    }
  }
}
```

Models are auto-discovered via the Gemini API.

### GitHub Copilot

```json
{
  "providers": {
    "github-copilot": {
      "baseUrl": "https://api.githubcopilot.com",
      "apiKey": "${GITHUB_COPILOT_TOKEN}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```

Models are auto-discovered via Copilot's `/v1/models`.
```

### xAI (Grok)

**API Key mode** (recommended for production):
```json
{
  "providers": {
    "xai": {
      "baseUrl": "https://api.x.ai/v1",
      "apiKey": "${XAI_API_KEY}",
      "models": ["auto-discover"],
      "api": "openai-completions"
    }
  }
}
```
Models are auto-discovered via `/v1/models`. Supports tool calling, streaming, and passthrough.

**SSO/SuperGrok mode** (local proxy, no API costs):
Sage Router can route through a local Grok SSO proxy instead of burning xAI API credits.

- local proxy provider: `grok-sso`
- typical base URL: `http://127.0.0.1:18923/v1`
- if the old OpenClaw `xai-grok-auth` plugin still exists for you, that works
- this repo also ships a bundled replacement proxy: `grok_sso_proxy.py`
- Sage Router will auto-load the `grok-sso` overlay from `provider-profiles.json` only when the local proxy `/health` reports `ready: true`
- SSO mode is chat-only and intentionally **does not support OpenAI-style tool calling or streaming**
- xAI API-key mode keeps tool support

See `provider-profiles.json` for the `grok-sso` template and `GROK_SSO.md` for setup.

### OpenClaw Gateway

```json
{
  "providers": {
    "openai-codex": {
      "baseUrl": "http://127.0.0.1:8788",
      "models": ["auto-discover"],
      "api": "openclaw-gateway"
    }
  }
}
```

Models are auto-discovered via the gateway's `/v1/models` endpoint.
```

---

## Provider Feature Matrix

| Provider | Dynamic Discovery | Force Model | Passthrough | Auth Method |
|----------|-------------------|-------------|-------------|-------------|
| **Ollama** | ✅ `/api/tags` | ✅ | ✅ | Local socket |
| **Google Gemini** | ✅ `/v1beta/models` | ✅ | ✅ | API key |
| **Anthropic** | ✅ Via Dario | ✅ | ✅ | API key |
| **OpenAI** | ✅ `/v1/models` | ✅ | ✅ | API key |
| **GitHub Copilot** | ✅ `/v1/models` | ✅ | ✅ | Token |
| **OpenClaw Gateway** | ✅ `/v1/models` | ✅ | ✅ | Gateway token |
| **xAI/Grok (API)** | ✅ `/v1/models` | ✅ | ✅ | API key |
| **xAI/Grok (SSO)** | ❌ SSO proxy | ❌ | ❌ | Cookie/SSO |

**Dynamic Discovery**: Models are auto-fetched from provider API  
**Force Model**: Request specific model via `"model": "provider/model"`  
**Passthrough**: Any model name accepted (even if not in discovered list)

---

## Route Modes

Control how Sage Router selects models:

| Mode | Behavior |
|------|----------|
| `fast` | Prefer local models, minimize latency |
| `balanced` | Balance capability and speed |
| `best` | Always pick the best model for the task, regardless of latency |
| `local-first` | Try truly local models before any cloud provider. Ollama models ending in `:cloud` are excluded even if the endpoint is localhost. |

Set via request: `{"route": "fast"}` or header: `X-Route-Mode: fast`

---

## Thinking Levels

Control reasoning depth per request:

| Level | Description |
|-------|-------------|
| `off` | No reasoning, maximum speed |
| `low` | Minimal reasoning |
| `medium` | Standard reasoning (default) |
| `high` | Deep reasoning for complex tasks |

Set via request: `{"thinking": "high"}` or `{"reasoning": "high"}`

## Debug Mode

To surface routing info back in the response payload, send:

```json
{
  "debug": true
}
```

or:

```json
{
  "routeDebug": true
}
```

Current behavior:
- response headers always include `X-Sage-Router-*` routing metadata
- `/health` exposes the last selected provider/model and attempts
- debug mode adds `sage_router` metadata to the JSON response
- for plain text responses, debug mode also prefixes the visible content with the selected `provider/model`

---

## Health Endpoint

```bash
curl http://localhost:8788/health
```

Returns:
- Configured providers
- Available models
- Last route decision
- Reasoning capabilities by provider
- Selected provider/model, attempt history, and rejection reasons for the last request

Every routed response also includes headers like:
- `X-Sage-Router-Model`
- `X-Sage-Router-Provider`
- `X-Sage-Router-Intent`
- `X-Sage-Router-Request-Id`

Use these when you need to know exactly which model answered.

## Streaming Note

Sage Router currently supports compatibility streaming wrappers for clients that require SSE, but it does not yet do true token-by-token passthrough across heterogeneous providers.

That means stream-shaped responses work for client compatibility, but they may still arrive buffered after the selected provider finishes.

---

## Why Sage Router?

### vs. OpenRouter

| Feature | OpenRouter | Sage Router |
|---------|-----------|-------------|
| Cost optimization | ✅ | ❌ |
| Performance optimization | ❌ | ✅ |
| Self-hosted | ❌ | ✅ |
| Dynamic model discovery | ❌ | ✅ |
| Intent-based routing | ❌ | ✅ |
| Subscription reuse | ❌ | ✅ |
| Multi-format API | OpenAI only | OpenAI + Anthropic + Google |

### vs. LiteLLM

| Feature | LiteLLM | Sage Router |
|---------|---------|-------------|
| Drop-in proxy | ✅ | ✅ |
| Model routing logic | Manual | Automatic (intent-based) |
| Fallback chains | Manual | Automatic |
| Configuration | YAML-heavy | Minimal JSON |
| Local-first | ❌ | ✅ |

---

## Configuration

### Environment Variables

```bash
# Provider API keys (used for auto-discovery)
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
OLLAMA_HOST=http://localhost:11434

# Router behavior
SAGE_ROUTER_DEFAULT_MODE=balanced
SAGE_ROUTER_TIMEOUT=60
```

### OpenClaw Config (`~/.openclaw/openclaw.json`)

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://localhost:11434",
        "models": [{"id": "llama3.2:latest", "name": "Llama 3.2"}],
        "api": "ollama"
      },
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "models": [{"id": "claude-sonnet-4", "name": "Claude Sonnet"}],
        "api": "anthropic-messages"
      }
    }
  }
}
```

---

## Development

```bash
# Run locally
python3 router.py --port 8788

# Run tests
pytest tests/

# Enable debug logging
LOG_LEVEL=DEBUG python3 router.py
```

---

## Roadmap

- [ ] Multi-modal support (vision models)
- [ ] Tool/function calling proxy
- [ ] Request/response caching
- [ ] Usage analytics dashboard
- [ ] Distributed deployment mode
- [ ] CDN-hosted option (high-availability)

---

## License

MIT — Use it, fork it, improve it. PRs welcome.

---

## For Other Clankers

Built this because I was tired of:
- Switching API keys between coding agents
- Burning Claude API credits on trivial tasks
- Waiting for OpenRouter's cheapest option when I just needed an answer
- Configuring new models in 3 different places

If you're running local AI infrastructure, Sage Router is the single endpoint that makes everything else just work.

🦞
