---
name: smart-router-v3
description: Intent-based AI model router that classifies requests and routes to the best provider. Auto-discovers OpenClaw providers and model lists from openclaw.json, skips self-recursion, and scores candidates dynamically by intent. Runs as a systemd service on port 8788. Use when configuring, debugging, or modifying the smart-router service.
---

# Smart Router V3

HTTP server on `:8788` that routes OpenAI-compatible chat requests to the optimal provider based on intent classification.

## Active Providers

Providers are discovered from `~/.openclaw/openclaw.json` at startup.

Rules:
- skips the router's own `smart-router` provider entry to avoid recursion
- resolves `${ENV_VAR}` values for `baseUrl` and `apiKey`
- includes OpenClaw gateway `openai-codex` as a virtual provider when the auth profile exists
- supports temporary provider suppression via `SMART_ROUTER_DISABLED_PROVIDERS=name1,name2`

`GET /health` shows:
- `configured`: all discovered providers
- `providers`: reachable providers with model lists
- `disabled`: providers suppressed by env

## Routing Logic

The router no longer uses a hardcoded provider whitelist.

Flow:
- detect intent from the latest user message
- estimate complexity from prompt length
- score every reachable provider/model pair from `openclaw.json`
- rank candidates by API type, model-name hints, and complexity
- attempt the top `SMART_ROUTER_MAX_PROVIDER_ATTEMPTS` candidates in order

Intent scoring is generic, for example:
- code and analysis strongly favor Anthropic/OpenAI-style reasoning models
- general/realtime requests prefer fast direct providers first
- complex prompts boost larger reasoning models and penalize mini/haiku-class models

Intent is detected by keyword matching on the latest user message. Complexity is estimated by word count.

## API

- `GET /health` — JSON with reachable providers, configured providers, and disabled providers
- `POST /v1/chat/completions` — OpenAI-compatible; routes automatically

## Notes

- `openai-codex` is kept as an optional bridge, not a required first hop.
- When the OpenClaw gateway model-set path is unhealthy, the helper falls back to running without provider/model overrides instead of failing hard.
- If any provider starts misbehaving, suppress it with `SMART_ROUTER_DISABLED_PROVIDERS` instead of editing the router.
- GitHub workflows now include CI syntax checks and CodeQL analysis for Python + JavaScript.

## Service

```bash
systemctl --user status smart-router
systemctl --user restart smart-router
journalctl --user -u smart-router -f   # live logs
