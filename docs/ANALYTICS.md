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

`GET /analytics` accepts either:

- `Authorization: Bearer $SAGE_ROUTER_ANALYTICS_TOKEN`, or
- a valid Supabase user JWT from the AOPS Supabase project.

Supabase service-role credentials are used only server-side for mirror writes and backend analytics reads.
