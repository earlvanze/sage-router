# Sage Router launch posts

**Status: drafts. All links verified live (sagerouter.dev). Tune voice before posting. Do not post on behalf of the operator without explicit approval.**

Canonical links:
- Site: https://sagerouter.dev
- Repo: https://github.com/earlvanze/sage-router
- Codex guide: https://github.com/earlvanze/sage-router/blob/master/docs/integrations/codex.md
- vs OpenRouter: https://sagerouter.dev/vs-openrouter.html
- Pricing: https://sagerouter.dev/pricing
- Terms: https://sagerouter.dev/terms
- Privacy: https://sagerouter.dev/privacy

## Hacker News (Show HN)

**Title:** Show HN: Sage Router – open-source, local-first AI model router for agents

**Body:**

Hi HN, I built Sage Router because every agent harness (Codex, Claude Code, Cursor, Aider, Continue, OpenHands) ships its own model picker and breaks the moment a provider rate-limits or goes down.

Sage Router is a local-first routing layer: one OpenAI/Anthropic-compatible endpoint that selects the best model per request by task type, capability, latency, and policy, then fails over across your own providers with no mid-stream handoff.

The bet: routing is local-first infrastructure for access you already control, not a hosted marketplace. Your provider keys stay on your machine by default. The core is free and open source. Sage Cloud (paid) adds team config sync, health monitoring, dashboards, and a reliability layer — no model resale.

- Repo: https://github.com/earlvanze/sage-router
- Site: https://sagerouter.dev
- Local Ollama + Ollama Cloud hybrid routing, NVIDIA NIM, BYOK

30-second start:

    python3 router.py --port 8790
    export OPENAI_BASE_URL=http://localhost:8790/v1
    export OPENAI_API_KEY=local-router
    codex --model openai/gpt-4.1

Happy to answer questions on routing policy, the custody model, and how it differs from OpenRouter (short answer: they resell access, we route access you bring).

## Reddit (r/SideProject + r/selfhosted + r/Ollama)

**Title:** Sage Router – open-source local-first AI model router with automatic provider failover (your keys stay local)

**Body:**

I open-sourced the model router I run for my own agents. It sits between your tools and your providers, picks the best model per request, and fails over when a provider dies — all local-first, BYOK, no marketplace.

Why local-first vs OpenRouter: they're a hosted marketplace that resells access and holds your provider relationships. Sage Router routes the access you already have (OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama, Ollama Cloud) and keeps credentials on your box by default.

- Free local core (MIT)
- Paid Sage Cloud: analytics, health checks, team config sync, reliability layer
- Plans: free / lite $6 / pro $30 / max $72 + metered

Repo: https://github.com/earlvanze/sage-router
Site: https://sagerouter.dev
vs OpenRouter: https://sagerouter.dev/vs-openrouter.html

What’s your current provider-failover setup? Genuinely curious what people cobbled together.

### r/SideProject

**Title:** Sage Router – open-source local-first AI model router with automatic provider failover (your keys stay local)

**Body:**

I open-sourced the model router I run for my own agents. It sits between your tools and your providers, picks the best model per request, and fails over when a provider dies — all local-first, BYOK, no marketplace.

Why local-first vs OpenRouter: they're a hosted marketplace that resells access and holds your provider relationships. Sage Router routes the access you already have (OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama, Ollama Cloud) and keeps credentials on your box by default.

- Free local core (MIT)
- Paid Sage Cloud: analytics, health checks, team config sync, reliability layer
- Plans: free / lite $6 / pro $30 / max $72 + metered

Repo: https://github.com/earlvanze/sage-router
Site: https://sagerouter.dev
vs OpenRouter: https://sagerouter.dev/vs-openrouter.html

What's your current provider-failover setup? Genuinely curious what people cobbled together.

### r/selfhosted

**Title:** Sage Router – self-hosted AI model router with automatic provider failover (your API keys stay on your machine)

**Body:**

I built a self-hosted routing layer for AI agents. One OpenAI/Anthropic-compatible endpoint that selects the best model per request by task type, capability, latency, and policy, then fails over across your own providers with no mid-stream handoff.

The bet: routing is local-first infrastructure for access you already control, not a hosted marketplace. Your provider keys stay on your machine by default. The core is free and open source (MIT).

- Supports OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama, Ollama Cloud
- 30-second start: `python3 router.py --port 8790` then point `OPENAI_BASE_URL` at it
- Paid Sage Cloud adds team config sync, health monitoring, dashboards, reliability layer — no model resale

Repo: https://github.com/earlvanze/sage-router
Site: https://sagerouter.dev
vs OpenRouter: https://sagerouter.dev/vs-openrouter.html

What's your current provider-failover setup? What are you self-hosting for AI access?

### r/Ollama

**Title:** Sage Router – open-source model router with automatic Ollama failover and hybrid local/cloud routing

**Body:**

I open-sourced a local-first AI model router that supports Ollama (and Ollama Cloud) as a first-class provider.

It sits between your agent tools and your providers, picks the best model per request, and fails over when a provider dies — including falling back to local Ollama when cloud providers are down or rate-limited.

- One OpenAI/Anthropic-compatible endpoint: `python3 router.py --port 8790`
- Hybrid local/cloud routing: cloud-first with Ollama fallback, or local-first with cloud overflow
- Supports Ollama, Ollama Cloud, OpenAI, Anthropic, Gemini, NVIDIA NIM
- BYOK — your keys stay on your machine, no marketplace, no resale
- Free local core (MIT). Paid Sage Cloud adds analytics, health checks, team config sync.

Repo: https://github.com/earlvanze/sage-router
Site: https://sagerouter.dev
Codex guide: https://github.com/earlvanze/sage-router/blob/master/docs/integrations/codex.md

How are you handling failover between local Ollama and cloud providers today?


## Indie Hackers

**Title:** Launched Sage Router — open-source local-first AI model router for agents

**Body:**

I just launched Sage Router, an open-source local-first routing layer for AI agents.

One OpenAI/Anthropic-compatible endpoint. It picks the best model per request by task type, capability, latency, and policy, then fails over across your own providers with no mid-stream handoff.

The angle: routing is local-first infrastructure for access you already control, not a hosted marketplace. Your provider keys stay on your machine by default. The core is free and open source (MIT). Sage Cloud (paid) adds team config sync, health monitoring, dashboards, and a reliability layer — no model resale.

- Repo: https://github.com/earlvanze/sage-router
- Site: https://sagerouter.dev
- vs OpenRouter: https://sagerouter.dev/vs-openrouter.html
- Pricing: free / lite $6 / pro $30 / max $72 + metered

Happy to answer questions on routing policy, the custody model, and how it differs from OpenRouter.

## Dev.to

**Title:** Showoff Saturday: Sage Router — open-source local-first AI model router with automatic provider failover

**Tags:** `#ai`, `#opensource`, `#routing`, `#ollama`, `#selfhosted`, `#agents`

**Body:**

I open-sourced Sage Router, the model router I run between my agent tools and my providers.

Sage Router is a local-first routing layer: one OpenAI/Anthropic-compatible endpoint that selects the best model per request by task type, capability, latency, and policy, then fails over across your own providers with no mid-stream handoff.

The bet: routing is local-first infrastructure for access you already control, not a hosted marketplace. Your provider keys stay on your machine by default. The core is free and open source (MIT). Sage Cloud (paid) adds team config sync, health monitoring, dashboards, and a reliability layer — no model resale.

- Repo: https://github.com/earlvanze/sage-router
- Site: https://sagerouter.dev
- vs OpenRouter: https://sagerouter.dev/vs-openrouter.html

30-second start:

```bash
python3 router.py --port 8790
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router
codex --model openai/gpt-4.1
```

What's your current provider-failover setup? Genuinely curious what people cobbled together.

## X / Twitter (thread)

1/ I open-sourced Sage Router: a local-first AI model router for agents. One endpoint. Any provider. It picks the best model per request and fails over when a provider dies.

Your keys stay on your machine. No marketplace. No resale.

github.com/earlvanze/sage-router

2/ The problem: every harness (Codex, Claude Code, Cursor, Aider, Continue, OpenHands) has its own model picker and breaks on rate limits/outages. Sage Router puts routing+failover in one local layer.

3/ 30-second start:
python3 router.py --port 8790
export OPENAI_BASE_URL=http://localhost:8790/v1
codex --model openai/gpt-4.1

4/ How it differs from OpenRouter: they resell access and hold provider relationships. Sage Router routes access you already bring (BYOK/BYOS) and keeps credentials local by default.

5/ Free local core. Paid Sage Cloud adds analytics, health checks, team config sync, reliability. Plans: free / lite $6 / pro $30 / max $72 + metered.

sagerouter.dev

## LinkedIn

**Headline post:**

I just open-sourced the routing layer I run for my own AI agents.

Sage Router is a local-first AI model router: one endpoint that selects the best model per request and fails over across your providers automatically. Built for agent harnesses (Codex, Claude Code, Cursor, OpenHands) and teams running multiple providers + local models.

Two things make it different from a hosted marketplace like OpenRouter:
1. Local-first. Your provider credentials stay on your machine/server by default.
2. BYOK. It routes access you already control — it doesn't resell model access.

Free open-source core. Paid Sage Cloud layer (analytics, health monitoring, team config sync, reliability) for teams. Plans from free to $72/mo + usage-based.

Repo: https://github.com/earlvanze/sage-router
Site: https://sagerouter.dev

If you're running agentic workloads across multiple providers, I'd love your feedback.
