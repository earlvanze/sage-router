# Sage Router SaaS launch plan: $10k MRR

This plan turns the current hosted Sage Router surface into a measurable SaaS
launch target while preserving the product boundary: sell routing, account
management, reliability, quotas, analytics, and support. Do not claim model
resale, pooled provider accounts, or unauthorized provider access.

## Revenue target

Target: `$10,000 MRR` from hosted Sage Router subscriptions.

Current public plan ladder:

| Plan | Price | Included requests | Rate limit | Best fit |
| --- | ---: | ---: | ---: | --- |
| Lite | $6/month | 10,000/month | 60/minute | Individual agent experiments |
| Pro | $30/month | 50,000/month | 180/minute | Daily agent development |
| Max | $72/month | 200,000/month | 600/minute | Automation, teams, and high-volume agents |

Straight-line paths:

| Mix | Monthly revenue |
| --- | ---: |
| 334 Pro customers | $10,020 |
| 139 Max customers | $10,008 |
| 100 Lite + 200 Pro + 50 Max | $10,200 |
| 50 Lite + 150 Pro + 75 Max | $10,200 |

Recommended launch target: the mixed path. It proves low-friction signup, a
serious Pro workflow, and a high-volume Max segment without depending on a
single buyer type.

## Conversion funnel

| Stage | Target metric | Product surface |
| --- | ---: | --- |
| Visitor to waitlist/signup | 5% | `sagerouter.dev`, `/pricing`, `/compare/openrouter` |
| Signup to generated key | 60% | `app.sagerouter.dev/account.html` |
| Generated key to first routed request | 50% | OpenAI-compatible quickstart |
| Trial/free to paid | 15% | Stripe checkout and plan gating |
| Paid logo retention | 85% monthly | usage quotas, status, analytics, fallback value |

At those assumptions, 10,000 qualified visitors can produce roughly 500
signups, 300 API-key creators, 150 first routed users, and 22 to 25 paid users.
The first paid cohort is not enough for $10k MRR, so launch must combine
inbound SEO, direct agent-community outreach, and founder-led conversion for
Max accounts.

## Packaging

Sell one simple Sage Router subscription for:

- hosted account, API-key, and quota management;
- public edge routing at `https://api.sagerouter.dev/v1`;
- route health, fallback policy, and analytics;
- Tailnet/private router resilience;
- support and private deployment guidance.

Provider access remains customer-authorized by default. Managed provider
resale should only be introduced after explicit provider terms, billing, margin,
and abuse controls are in place.

## Near-term launch checklist

- Keep anonymous `/v1/*` blocked and generated `sk_sage_*` keys enforced.
- Keep `/pricing`, `/status`, `/account.html`, `/login.html`, `/api/waitlist`,
  and `/compare/openrouter` in the readiness gate.
- Add the public pricing page to readiness and LLM discovery.
- Enable GitHub OAuth in Supabase after the GitHub App manifest approval code is
  available.
- Track the funnel from waitlist to signup, generated key, first routed request,
  paid conversion, and retained paid account.
