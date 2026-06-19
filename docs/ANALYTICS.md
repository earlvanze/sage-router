# Sage Router Analytics

Sage Router Analytics is the paid observability layer: hosted routing can be free/cheap, while performance intelligence is the monetized feature.

## Product promise

One endpoint for your AI subscriptions, with live performance analytics so you always use the best model.

Users bring provider subscriptions/keys. Sage sells:

- provider/model latency trends
- success/error rates
- fallback frequency
- fastest model recommendations
- most reliable model recommendations
- degraded-provider alerts
- team/project analytics history
- policy recommendations

## Runtime endpoint

```bash
GET /analytics?days=7&limit=10000
Authorization: Bearer $SAGE_ROUTER_ANALYTICS_TOKEN # optional when configured
```

The endpoint returns:

- `providers[]` performance summaries
- `models[]` performance summaries
- `intents[]` task-level summaries
- `recommendations.fastestModels[]`
- `recommendations.mostReliableModels[]`
- `recommendations.degradedModels[]`

## Launch Funnel Endpoint

```bash
GET /analytics/funnel?days=30&limit=10000
Authorization: Bearer $SAGE_ROUTER_ANALYTICS_TOKEN # or an operator key
```

The operator-only funnel summarizes the hosted launch path without returning
PII or request content:

- waitlist leads
- managed-access beta interest and share of waitlist
- signups
- customers with generated API keys
- customers with a first routed request
- paid conversions
- paid customers with recent routed usage
- estimated current MRR, target attainment, and per-plan gaps against the
  public `$10k MRR` recommended launch mix

The funnel reads only timestamps and countable customer/key status fields from
the customer store, API-key store, waitlist tables, and route telemetry. It does
not return email addresses, prompts, message bodies, API keys, provider
credentials, OAuth tokens, or raw responses.

The hosted operator dashboard at
`https://app.sagerouter.dev/launch-funnel.html` is a static shell for this
endpoint. It requires a private operator/admin token in the browser, sends it as
an `Authorization: Bearer` header, and stores the token only in tab-scoped
`sessionStorage` when the operator explicitly enables that option. Customer
accounts never use this page; signed-in customer analytics remain scoped to
`/account/analytics`.

## Account readiness

The hosted customer dashboard at `https://app.sagerouter.dev/analytics.html`
combines signed-in route analytics with the existing account control-plane
endpoints:

- `/account/plan`
- `/account/usage` (`usage` plus server-derived `activation`)
- `/account/api-keys`

This keeps conversion guidance close to the customer's telemetry. A signed-in
user can see whether they still need to create a generated key, finish Stripe
checkout, send a first routed request, or upgrade before monthly quota blocks
agent traffic. The `activation` object contains only safe state such as plan,
routing status, active key count, current-period request count, quota percent,
first-request completion, and `nextAction`; it does not expose keys, prompts,
provider credentials, or global customer totals. The dashboard does not expose
operator funnel data.

## Privacy model

The analytics feed is built from route telemetry only. It does not store prompts, message bodies, provider credentials, OAuth tokens, or API keys.

Tracked telemetry:

- timestamp
- intent
- selected provider/model
- attempted providers/models
- elapsed milliseconds
- success/failure status
- coarse requirements flags

## Monetization shape

- Free: hosted endpoint, short/no history, basic routing
- Pro: 30-90 day analytics, recommendations, exports
- Power: long-term history, alerts, A/B tests, custom policies
- Team: shared dashboards, audit logs, per-project provider analytics

## Why this is valuable when users bring their own subscriptions

The value is not model access. The value is knowing which subscription performs best for each workload over time, and automatically routing around slow or failing providers.


## Durable Cloud Analytics

Production analytics now writes privacy-safe route telemetry to Google Firestore and mirrors the same event stream plus generated snapshots into the Autonomous Ops Studio Supabase project.

### Storage

- Firestore collection: `sage_router_route_events`
- Supabase tables:
  - `public.sage_router_route_events`
  - `public.sage_router_analytics_snapshots`

Stored events intentionally exclude prompts, message bodies, provider credentials, API keys, OAuth tokens, and raw responses.

### Auth

The hosted browser dashboard on `https://app.sagerouter.dev/analytics.html`
uses `GET /account/analytics` with the signed-in customer's Supabase session.
That route only returns telemetry for the active customer account.

`GET /analytics` is the operator/global route and accepts either:

- `Authorization: Bearer $SAGE_ROUTER_ANALYTICS_TOKEN`, or
- a configured operator key from `SAGE_ROUTER_CLIENT_API_KEYS`.

Supabase service-role credentials are used only server-side for mirror writes and backend analytics reads.
