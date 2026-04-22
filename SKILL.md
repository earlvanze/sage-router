---
name: sage-router
description: Intent-based AI model router that classifies requests and routes to the best provider. Auto-discovers OpenClaw providers and model lists from openclaw.json, skips self-recursion, and scores candidates dynamically by intent. Runs as a systemd service on port 8788. Use when configuring, debugging, or modifying the sage-router service.
env:
  - SAGE_ROUTER_HOME (required: path to sage-router repo)
  - SAGE_ROUTER_DISABLED_PROVIDERS (optional: comma-separated provider names to suppress)
  - SAGE_ROUTER_OLLAMA_TIMEOUT_SECONDS (optional, default 120)
  - SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS (optional, default :cloud)
  - OPENCLAW_GATEWAY_TOKEN (optional: token for OpenClaw gateway agent bridge)
---

# Sage Router

HTTP server on `:8788` that routes chat requests to the optimal provider based on intent classification.

## Endpoints

- `POST /v1/chat/completions` — OpenAI-compatible; routes automatically
- `POST /v1/messages` — Anthropic Messages API compatible; translates to/from OpenAI format internally
- `GET /health` — Provider status, model lists, routing debug

Any Anthropic-compatible tool (Cursor, Aider, Claude Code, Zed, Continue, OpenHands) can point at `http://localhost:8788` as the API base URL. Both streaming and non-streaming are supported.

## Active Providers

Providers are discovered from `~/.openclaw/openclaw.json` at startup.

Rules:
- skips the router's own `sage-router` provider entry to avoid recursion
- resolves `${ENV_VAR}` values for `baseUrl` and `apiKey`
- includes OpenClaw gateway `openai-codex` as a virtual provider when the auth profile exists
- recognizes Google Gemini providers from `generativelanguage.googleapis.com`
- auto-discovers Google models when the provider exists but `models` is empty in `openclaw.json`
- normalizes `anthropic` or Anthropic-hosted `anthropic-messages` providers onto the local Dario proxy at `localhost:3456`
- starts the Dario user service when Anthropic compatibility is needed and the service is not already running
- supports temporary provider suppression via `SAGE_ROUTER_DISABLED_PROVIDERS=name1,name2`

`GET /health` shows:
- `configured`: all discovered providers
- `providers`: reachable providers with model lists
- `disabled`: providers suppressed by env

## Routing Logic

The router does **not** perform mid-stream switching. Once a request is sent to a provider, the full response is returned or the attempt fails. If it fails, the next candidate in the chain is tried sequentially. There is no partial-output fallback or streaming handoff between providers.

Flow:
- detect intent from the latest user message
- estimate complexity from prompt length
- score every reachable (provider, model) pair globally — not per-provider — from `openclaw.json`
- for `GENERAL`, blend static heuristics with persisted empirical latency stats by provider and model
- rank candidates by API type, model-name hints, complexity, and measured latency
- attempt the top `SAGE_ROUTER_MAX_PROVIDER_ATTEMPTS` candidates in order
- `sage-router` provider (the router itself, model `auto`) is scored as a low-priority recursive fallback, never preferred

Intent scoring is generic, for example:
- code and analysis strongly favor Anthropic/OpenAI-style reasoning models
- general/realtime requests prefer fast direct providers first
- general traffic learns from real successful request latency over time, with light exploration for cold providers/models
- complex prompts boost larger reasoning models and penalize mini/haiku-class models

Intent is detected by keyword matching on the latest user message. Complexity is estimated by word count.

## API

- `GET /health` — JSON with reachable providers, configured providers, and disabled providers
- `POST /v1/chat/completions` — OpenAI-compatible; routes automatically

## Notes

- `openai-codex` is kept as an optional bridge, not a required first hop.
- Anthropic compatibility is provided through Dario, so `anthropic` can stay in `openclaw.json` while routing locally through `dario`.
- The repo `systemd` unit is template-style and expects local machine values in `~/.config/sage-router/sage-router.env`.
- Empirical latency memory is persisted at `~/.cache/sage-router/latency-stats.json` by default.
- When the OpenClaw gateway model-set path is unhealthy, the helper falls back to running without provider/model overrides instead of failing hard.
- If any provider starts misbehaving, suppress it with `SAGE_ROUTER_DISABLED_PROVIDERS` instead of editing the router.
- GitHub workflows now include CI syntax checks and CodeQL analysis for Python + JavaScript.
- See `BRANCH_PROTECTION.md` for the exact required-check setup on GitHub.
- `provider-profiles.json` includes a `grok-sso` template for the OpenClaw xAI auth plugin's local SuperGrok-backed proxy.

## Install

Install the user service from the repo copy:

```bash
mkdir -p ~/.config/systemd/user ~/.config/sage-router
cp systemd/sage-router.service ~/.config/systemd/user/sage-router.service
cp systemd/sage-router.env.example ~/.config/sage-router/sage-router.env
# edit ~/.config/sage-router/sage-router.env for your machine
systemctl --user daemon-reload
systemctl --user enable --now sage-router.service
```

Notes:
- the repo unit is now env-driven and does not hardcode your home path, Node version, or workspace location
- set `SAGE_ROUTER_HOME` to the actual repo path on your machine
- optionally set `SAGE_ROUTER_PATH_PREFIX` if your Python, Node, or Dario bins are not already on PATH

If an Anthropic provider is detected and Dario is not installed yet, install Dario first:
- GitHub: https://github.com/askalf/dario

## Service

```bash
systemctl --user status sage-router
systemctl --user restart sage-router
journalctl --user -u sage-router -f   # live logs
```
