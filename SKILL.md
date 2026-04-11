---
name: smart-router-v3
description: Dynamic AI model router with intent classification and automatic provider discovery
version: 3.0.0
---

# Smart Router V2

HTTP server that routes AI requests to optimal models based on intent classification with **dynamic provider discovery**.

## Features

- **Dynamic Discovery**: Automatically reads available providers from `~/.openclaw/openclaw.json`
- **Intent Classification**: Routes based on task type (CODE, ANALYSIS, CREATIVE, REALTIME, GENERAL)
- **Automatic Fallback**: Tries providers in priority order until success
- **Zero-config**: Works out of the box with OpenClaw provider config

## Installation

```bash
# Clone and run
python3 router.py --port 8788

# Or use systemd
systemctl --user enable smart-router.service
systemctl --user start smart-router.service
```

## API

### Health Check
```
GET /health
```
Returns discovered providers:
```json
{"status": "ok", "providers": ["ollama", "ollama-cyber", "openrouter", "claude-cli"]}
```

### Chat Completions
```
POST /v1/chat/completions
```
OpenAI-compatible endpoint with automatic routing.

## Routing Logic

| Intent    | Priority Chain                          |
|-----------|----------------------------------------|
| CODE      | claude-cli → ollama → ollama-cyber     |
| ANALYSIS  | claude-cli → ollama → ollama-cyber     |
| CREATIVE  | ollama → claude-cli                     |
| REALTIME  | ollama → openrouter                     |
| GENERAL   | ollama → claude-cli → ollama-cyber     |

## Intent Detection

Automatically classifies user messages:

- **CODE**: `write`, `debug`, `fix`, `function`, code blocks (```)
- **ANALYSIS**: `analyze`, `explain`, `compare`, `research`, `why`
- **CREATIVE**: `create`, `brainstorm`, `imagine`, `design`, `story`
- **REALTIME**: `now`, `today`, `current`, `latest`, `price`, `weather`
- **GENERAL**: Default for unmatched patterns

## Configuration

Reads providers from OpenClaw config:
- `~/.openclaw/openclaw.json` → `models.providers`
- Supports: ollama, openai-completions, anthropic-messages APIs
- Automatically skips `smart-router` (self-reference)

## Files

- `router.py` — Main HTTP routing server (V3 with dynamic discovery)
- `SKILL.md` — This documentation
- `_meta.json` — Metadata

## Changelog

### v2.0.0 (2026-04-11)
- Added dynamic provider discovery from OpenClaw config
- Removed hardcoded endpoints
- Added `/health` endpoint showing discovered providers
- Improved error handling and fallback logic

### v1.0.0
- Initial release with hardcoded routing

## License

MIT
