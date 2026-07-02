# Sage Router Provider Source Review

Boundary: private operator review worksheet. Do not paste provider agreements,
provider account IDs, provider credentials, OAuth tokens, generated API keys,
private provider costs, cost schedules, customer data, prompts, raw provider
responses, or authorization-reference values into this file. Store those
artifacts in the private system of record and put only opaque references in the
local approval record.

Effect: this worksheet does not contact providers, acknowledge provider terms,
write environment variables, write secrets, deploy Cloud Run, change prices, or
enable managed resale.

## Live Packet

Generate the current no-secret packet before outreach, terms acknowledgment,
authorization evidence staging, or private cost review:

```bash
scripts/configure_managed_provider_resale_readiness.sh --provider-source-review-packet
```

The packet prints official source URLs, live public readiness context, provider
family review rows, and safe next commands. It must not print provider
credentials, provider authorization-reference values, actual provider costs,
prompts, raw provider responses, OAuth tokens, generated API keys, or customer
data.

## Current Source Review Targets

- OpenAI Services Agreement:
  `https://openai.com/policies/services-agreement/`
- OpenAI Service Terms:
  `https://openai.com/policies/service-terms/`
- Anthropic Commercial Terms:
  `https://www.anthropic.com/legal/commercial-terms`
- Anthropic Usage Policy:
  `https://www.anthropic.com/legal/aup`
- Anthropic Consumer Terms:
  `https://www.anthropic.com/legal/consumer-terms`
- Ollama Terms:
  `https://ollama.com/terms`
- Sage Router provider resale terms:
  `https://sagerouter.dev/provider-resale-terms`
- Sage Router margin policy:
  `https://sagerouter.dev/margin-policy`

## Provider Family Rows

| providerFamily | currentPublicTermsUrl | sourceReviewReference | providerAuthorizationReference | costReviewReference | currentDecision |
| --- | --- | --- | --- | --- | --- |
| ollama | `https://ollama.com/terms` | private-ref-only | private-ref-only | private-ref-only | hold |
| openai | `https://openai.com/policies/services-agreement/`, `https://openai.com/policies/service-terms/` | private-ref-only | private-ref-only | private-ref-only | hold |
| anthropic | `https://www.anthropic.com/legal/commercial-terms`, `https://www.anthropic.com/legal/aup` | private-ref-only | private-ref-only | private-ref-only | hold |
| openrouter | separate provider/account terms review | private-ref-only | private-ref-only | private-ref-only | BYOK-only hold |

## Decision Rules

- Source review is required before provider terms acknowledgment,
  authorization evidence staging, private cost review, public enablement, or
  customer-facing one-subscription entitlement language.
- Review official provider terms and usage policies on the review date. Do not
  infer permission from public pages alone; record written provider
  authorization and private legal/commercial review references.
- Record only opaque `sourceReviewReference`,
  `providerAuthorizationReference`, and `costReviewReference` values in
  operator worksheets or environment variables.
- Do not use consumer, subscription, OAuth, trial, or personal-plan access as
  managed-resale provider-cost sources.
- Consumer/subscription plans are not provider-cost sources for managed resale.
- OpenRouter remains BYOK-only unless separate written authorization and cost
  review explicitly promote it later.
- Only run `--terms-approval-packet`, `--authorization-ledger-template`, and
  `--unit-economics` after source review has a private reference.

## Safe Commands After Source Review

```bash
scripts/configure_managed_provider_resale_readiness.sh --provider-source-review-packet
scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet
scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet
scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template
scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet
SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' \
scripts/configure_managed_provider_resale_readiness.sh --unit-economics
```

Privacy flags: containsSecrets=false; containsProviderCredentials=false;
containsActualProviderCosts=false; containsAuthorizationReference=false;
containsProviderReplyBody=false; mutatesRuntime=false; sendsEmail=false;
publicEnableApproved=false.
