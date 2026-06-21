# Sage Router vs OpenRouter

Both Sage Router and OpenRouter sit between your tools and many LLM providers, but they are built for different buyers and make different trust tradeoffs.

## TL;DR

- **OpenRouter** is a hosted model marketplace/proxy. You pay OpenRouter; OpenRouter holds the provider relationships and bills you per token.
- **Sage Router** is open-source, local-first routing infrastructure for the authorized provider access you already control. It routes, fails over, and observes across your own keys, subscriptions, and local models.

## At a glance

| Dimension | Sage Router | OpenRouter |
|---|---|---|
| Core model | Local-first routing infrastructure | Hosted marketplace/proxy |
| Open source | Yes (core router) | No |
| Where credentials live | Your machine/server by default | OpenRouter's hosted service |
| Bring your own keys/subscriptions | First-class (BYOK/BYOS) | Partial (you mostly buy access from OpenRouter) |
| Resell model access | No | Yes (marketplace) |
| Local model support (Ollama) | First-class, local-first | Limited/hosted |
| Provider failover | Yes, policy-based, session-safe | Yes |
| Self-host / air-gap | Yes | No |
| Pricing | Free local core; paid hosted convenience (analytics, team sync, reliability) | Per-token marketplace markup |
| Best for | Agent harness operators with their own providers who want control + reliability | Developers who want one bill and don't want to manage providers |

## When to pick Sage Router

- You already have OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama, or authorized CLI/subscription access.
- You want agent harnesses (Codex, Claude Code, Cursor, Aider, Continue, OpenHands, OpenClaw) to share one endpoint with smart per-task routing and fallback.
- You want provider credentials to stay on your hardware by default.
- You want local Ollama + Ollama Cloud hybrid routing.
- You need self-hosting, air-gapped, or private deployments.
- You want to own your routing policy and route-event telemetry.

## When to pick OpenRouter

- You don't have provider accounts and want to buy access from one party.
- You want a single per-token bill across many models.
- You're fine with a hosted service holding the provider relationships.

## Can you use both?

Yes. OpenRouter can be wired into Sage Router as a BYOK provider endpoint, so you can keep Sage Router's routing, failover, and observability while still using OpenRouter as one upstream among many. Sage Router does not resell OpenRouter access; you bring your own OpenRouter key if you use it.

## Compliance posture

Sage Router does not resell model access, pool accounts, share subscriptions, or bypass provider Terms of Service. Customers bring their own API keys, local models, or authorized access. The default architecture physically keeps provider credentials on the customer's machine or server so hosted Sage infrastructure cannot harvest them.
