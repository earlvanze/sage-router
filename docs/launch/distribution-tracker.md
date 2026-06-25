# Sage Router launch distribution tracker

This tracker converts the `$10k MRR` launch plan into measurable distribution
work. Keep public claims aligned with the local-first/BYOK boundary: Sage Router
sells routing infrastructure, hosted keys, quotas, analytics, reliability, and
support. It does not advertise bundled provider resale unless the runtime
readiness guard enables it.

## Campaign

- Campaign: `sage-router-launch`
- Primary CTA: `https://sagerouter.dev/quickstart`
- Self-hosted CTA: `https://sagerouter.dev/self-hosted-ai-model-router`
- Buyer-intent CTA: `https://sagerouter.dev/pricing`
- Comparison CTA: `https://sagerouter.dev/compare/openrouter`
- Founder-sales CTA: `https://sagerouter.dev/managed-access`
- Operator dashboard: `https://app.sagerouter.dev/launch-funnel.html`

## Posting queue

Live funnel snapshot from 2026-06-25: internal Sage Router traffic is the
largest source, Reddit is the strongest external channel currently visible
(`15` privacy-safe clicks), and pricing/quickstart are the highest-intent
surfaces after landing. Prioritize Reddit-style reliability/comparison posts
before broader social batching.

| Channel | Status | Link to use | Success signal |
| --- | --- | --- | --- |
| GitHub repository discovery | Live; README now leads with hosted activation and repo topics include `ai-gateway`, `llm-gateway`, `model-router`, `codex-cli`, `openai-api`, `openai-compatible-api`, `ollama-cloud`, and `nvidia-nim` | `https://app.sagerouter.dev/account.html?plan=pro&start=checkout&utm_source=github&utm_medium=readme&utm_campaign=sage-router-launch` | `github` attribution clicks, account page views, generated keys, GitHub stars |
| Moltbook | Pre-approved by operator; API rechecked 2026-06-25 and still `pending_claim`; post attempt returned `403` until the local `sagerouter` agent is claimed; OpenClaw update should post after claim | `https://sagerouter.dev/openclaw-ai-model-router?utm_source=moltbook&utm_medium=community&utm_campaign=openclaw-ai-model-router` | Post URL captured; `moltbook` appears in acquisition actions |
| Reddit r/selfhosted | Priority 1 after owner approval; final copy in `docs/launch/final/reddit-selfhosted-post.md`; self-hosted page now includes direct Pro magic-link activation | `https://sagerouter.dev/self-hosted-ai-model-router?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | `reddit` source clicks, self-hosted magic-link events, quickstart copies, GitHub stars |
| Reddit r/Ollama | Priority 2 after owner approval; final copy in `docs/launch/final/reddit-ollama-post.md`; public evaluation kit includes a copyable r/Ollama block | `https://sagerouter.dev/ollama-ai-model-router?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | Ollama route clicks, model-catalog demand, quickstart copies, GitHub stars |
| Reddit r/SideProject | Priority 3 after owner approval; final copy in `docs/launch/final/reddit-sideproject-post.md`; public evaluation kit includes a copyable r/SideProject block | `https://sagerouter.dev/pricing?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | Pricing/account CTA intent, generated hosted keys, founder-sales replies |
| Hacker News | Ready after owner approval; final copy in `docs/launch/final/hackernews-showhn-post.md`; public community launch kit includes a copyable Show HN block | `https://sagerouter.dev/?utm_source=hackernews&utm_medium=community&utm_campaign=sage-router-launch` | Referral traffic, GitHub stars, quickstart copies, generated keys, substantive HN comments |
| Indie Hackers | Ready after owner approval; final copy in `docs/launch/final/indiehackers-post.md`; public community launch kit includes a copyable Indie Hackers block | `https://sagerouter.dev/launch-plan?utm_source=indiehackers&utm_medium=community&utm_campaign=sage-router-launch` | Signup, pricing, generated keys, and founder-sales replies |
| Dev.to | Ready after owner approval; final copy in `docs/launch/final/devto-post.md`; public community launch kit includes a copyable Dev.to block | `https://sagerouter.dev/quickstart?utm_source=devto&utm_medium=community&utm_campaign=sage-router-launch` | Quickstart copies, GitHub traffic, and generated-key activation clicks |
| X / Twitter | Ready after owner approval; final copy in `docs/launch/final/x-thread.txt`; public community launch kit includes a copyable X thread block | `https://sagerouter.dev/pricing?utm_source=x&utm_medium=social&utm_campaign=sage-router-launch` | Thread clicks, replies, profile visits, and pricing CTA intent |
| LinkedIn | Ready after owner approval; final copy in `docs/launch/final/linkedin-post.txt`; public community launch kit includes a copyable LinkedIn block | `https://sagerouter.dev/compare/openrouter?utm_source=linkedin&utm_medium=social&utm_campaign=sage-router-launch` | Pro/Max conversations, OpenRouter comparison clicks, and managed-access review requests |

## Execution rules

- Post one high-context channel first, then wait for replies before batching
  more channels.
- Keep the question at the end genuine and channel-specific; avoid dropping the
  same copy everywhere in one burst.
- Do not paste prompts, provider credentials, generated API keys, OAuth tokens,
  customer data, raw provider responses, or private operator dashboard data into
  public posts.
- After each post, record the live post URL, timestamp, channel, UTM link, and
  observed launch-funnel signal.

## Approval boundary

Existing community/social drafts are ready to use, but public posting still
requires owner approval for each non-Moltbook channel. Moltbook posting is
pre-approved by the operator but technically blocked until the `sagerouter`
agent is claimed.
