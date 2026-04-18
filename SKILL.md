---
name: smart-router-v3
description: Intent-based AI model router that classifies requests and routes to the best provider. Uses dario (Claude), ollama, ollama-cyber, and an optional OpenClaw gateway codex bridge. Code defaults to Claude → Ollama, General defaults to Ollama. Runs as systemd service on port 8788. Use when configuring, debugging, or modifying the smart-router service.
---

# Smart Router V3

HTTP server on `:8788` that routes OpenAI-compatible chat requests to the optimal provider based on intent classification.

## Active Providers

| Provider | API | Base URL | Auth |
|---|---|---|---|
| ollama | ollama | `http://127.0.0.1:11434` | Bearer (env) |
| ollama-cyber | ollama | `http://100.115.208.70:11434` | Bearer (env) |
| dario | anthropic-messages | `http://127.0.0.1:3456` | Direct (no key) |
| openai-codex | OpenClaw gateway bridge | Proxied via OpenClaw gateway `:18789` | OAuth (gateway-managed) |

Controlled by `ALLOWED_PROVIDERS` in `router.py`. Provider configs read from `~/.openclaw/openclaw.json`.
`openai-codex` may remain configured but be intentionally disabled from live routing when the gateway bridge is unstable.

## Routing Logic

| Intent | Priority | Preferred Models |
|---|---|---|
| CODE | dario → ollama → ollama-cyber | opus-4-6, kimi-k2.5 |
| ANALYSIS | dario → ollama → ollama-cyber | opus-4-6, kimi-k2.5 |
| CREATIVE | dario → ollama → ollama-cyber | opus-4-6, kimi-k2.5 |
| GENERAL | ollama → dario → ollama-cyber | kimi-k2.5, sonnet-4-6 |
| COMPLEX (>200 words) | dario → ollama → ollama-cyber | opus-4-6, kimi-k2.5 |

Intent detected by keyword matching on user message. Complexity by word count.

## API

- `GET /health` — JSON with active providers and allowed list
- `POST /v1/chat/completions` — OpenAI-compatible; routes automatically

## Notes

- `openai-codex` is kept as an optional bridge, not a required first hop.
- When the OpenClaw gateway model-set path is unhealthy, the helper falls back to running without provider/model overrides instead of failing hard.
- If codex gateway calls start timing out again, keep it disabled in live routing until the gateway RPC path is fixed.

## Service

```bash
systemctl --user status smart-router
systemctl --user restart smart-router
journalctl --user -u smart-router -f   # live logs
