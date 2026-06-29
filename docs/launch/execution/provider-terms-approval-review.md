# Sage Router Provider Terms Approval Review

Boundary: private operator review worksheet. Do not paste provider agreements,
provider account IDs, provider credentials, OAuth tokens, generated API keys,
private provider costs, cost schedules, customer data, prompts, raw provider
responses, or authorization-reference values into this file. Store those
artifacts in the private system of record and put only opaque references in the
local approval record.

Effect: this worksheet does not acknowledge provider terms, write environment
variables, write secrets, deploy Cloud Run, enable managed resale, change
prices, or send provider/customer email.

## Live Packet

Generate the current no-secret packet before review:

```bash
scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet
```

The packet prints public terms and margin-policy URLs, local input presence,
resale-eligible provider families, BYOK-only exclusions, one-subscription
readiness, and safe next commands. It must not print provider credentials,
provider authorization-reference values, actual provider costs, prompts, raw
provider responses, OAuth tokens, generated API keys, or customer data.

## Current Launch State

- Managed provider access: disabled until every private readiness control passes.
- Missing controls: provider_terms_acknowledgment,
  provider_authorization_evidence, provider_cost_model,
  positive_unit_economics.
- Terms acknowledged: false.
- Authorization evidence configured: false.
- Cost model configured: false.
- Unit economics satisfied: false.
- Managed resale families under review: ollama, openai, anthropic.
- BYOK-only families excluded from bundled resale: openrouter,
  byok-compatible gateways.

## Decision Gates

1. Provider authorization evidence exists privately for every managed resale
   family under review.
2. Provider terms permit the planned managed-access customer category, resale or
   service-provider boundary, and one-subscription packaging.
3. Customer terms, acceptable-use policy, quota limits, revocation path, audit
   logging, and abuse-review process satisfy provider obligations.
4. The private cost model has a separate review owner. Do not acknowledge terms
   only because public provider terms pages exist.
5. Public managed resale remains disabled until the terms acknowledgment,
   authorization evidence, provider-cost model, and positive unit-economics
   controls all pass.

## Review Outcome

- reviewDate:
- reviewer:
- providerFamiliesReviewed: ollama, openai, anthropic
- privateAuthorizationReference: provider-review-YYYYMMDD-doc-or-ticket-id
- termsAcknowledgmentApproved: false
- authorizationEvidenceReady: false
- costReviewReady: false
- publicEnableApproved: false
- notes:

## Safe Commands After Private Approval

Re-run the packet immediately before approval:

```bash
scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet
```

If private legal/provider review approves terms and the authorization evidence
reference exists, stage the acknowledgment while keeping public managed resale
disabled:

```bash
SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' \
SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' \
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' \
scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls
```

Then run the secret-safe private cost preflight:

```bash
SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' \
scripts/configure_managed_provider_resale_readiness.sh --unit-economics
```

Privacy flags: containsSecrets=false; containsProviderCredentials=false;
containsActualProviderCosts=false; containsAuthorizationReference=false;
publicEnableApproved=false.
