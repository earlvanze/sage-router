# Sage Router Managed Provider Authorization Ledger Template

Boundary: private operator review artifact. Do not paste provider agreements,
provider account IDs, provider credentials, OAuth tokens, generated API keys,
private provider costs, cost schedules, customer data, prompts, or raw provider
responses into this template. Store those artifacts in the private system of
record and put only opaque references here.

Effect: this template does not acknowledge terms, write secrets, deploy Cloud
Run, enable managed resale, or send provider/customer email.

## Review Metadata

- reviewDate:
- reviewer:
- decision: pending
- publicEnableApproved: false
- termsAcknowledgmentApproved: false
- costModelReviewed: false
- unitEconomicsPreflightPassed: false
- privateEvidenceReference: provider-review-YYYYMMDD-doc-or-ticket-id
- privateCostReviewReference:
- notes:

## Provider Family Rows

| providerFamily | authorizationStatus | termsStatus | evidenceReference | costReviewReference | allowedAccountType | allowedUseCase | resaleOrServiceProviderBoundary | quotaOrCapacityLimit | modelExclusions | dataProcessingRestrictions | abuseContactOrProcess | renewalOrExpiry | publicEnableApproved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ollama | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |
| openai | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |
| anthropic | pending | pending | private-ref-only | private-ref-only | TBD | managed access private beta | TBD | TBD | TBD | TBD | TBD | TBD | false |

## Approval Checklist

- Provider replies have been classified with:
  `scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet`
- Provider authorization covers every family in the managed resale allowlist.
- Provider terms permit the planned managed-access customer category.
- BYOK-only providers, including OpenRouter, remain outside managed resale
  unless separately authorized.
- Customer terms, acceptable-use policy, quotas, rate limits, revocation,
  operator audit events, and abuse review match provider obligations.
- Private cost candidate has been reviewed with:
  `SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics`
- If unit economics pass, stage the cost model while keeping public enablement
  off until final approval.

## Safe Commands After Private Review

```bash
SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF='PRIVATE_PROVIDER_AUTH_REF' \
SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='1' \
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' \
scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls

SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' \
scripts/configure_managed_provider_resale_readiness.sh --unit-economics
```

Privacy flags: containsSecrets=false; containsProviderCredentials=false; containsActualProviderCosts=false; containsAuthorizationReference=false; publicEnableApproved=false.
