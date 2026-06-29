# Sage Router One-Subscription Pricing Review

Use this no-secret worksheet when deciding whether a one-subscription managed
provider beta can move from demand capture to private offer design. It converts
the live public pricing thresholds into operator decisions without exposing
private provider costs.

Boundary: do not paste provider agreements, provider account IDs, provider
credentials, OAuth tokens, generated API keys, private provider costs, cost
schedules, customer data, prompts, raw provider responses, or derived private
required prices into this worksheet. Store those artifacts in the private system
of record and reference them only through opaque review IDs.

Effect: this worksheet does not acknowledge provider terms, write secrets,
deploy Cloud Run, change Stripe prices, enable managed resale, or send provider
or customer email.

## Live Packet

Refresh the packet from production metadata:

```bash
scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet
```

Current launch state:

- Managed access enabled/requested/ready: `false / false / false`
- Missing controls: `provider_terms_acknowledgment`,
  `provider_authorization_evidence`, `provider_cost_model`,
  `positive_unit_economics`
- Allowed managed families: `ollama`, `openai`, `anthropic`
- BYOK-only families excluded from managed resale: `openrouter`,
  `byok-compatible`
- One-subscription ready families: `none`
- Binding public plan: `max`
- Minimum gross-margin floor: `35%`

## Public Fixed-Plan Thresholds

These are public thresholds only. They do not reveal actual provider costs.

| Plan | Price | Included requests | Public revenue / 1k requests | Max safe provider cost / 1k requests | Constraint rank |
| --- | ---: | ---: | ---: | ---: | ---: |
| Max | `$72/mo` | `200,000` | `36.0c` | `23.4c` | `1` |
| Lite | `$6/mo` | `10,000` | `60.0c` | `39.0c` | `2` |
| Pro | `$30/mo` | `50,000` | `60.0c` | `39.0c` | `3` |

The Max plan is the binding fixed-plan constraint because it has the lowest
public max-safe provider-cost threshold. A private provider-cost candidate must
fit below the applicable threshold before a plan can include managed access.

## Packaging Decision

- Keep BYOK/OpenRouter-compatible routing sellable in Lite/Pro/Max as
  customer-authorized routing infrastructure.
- Keep public managed provider resale disabled until provider terms,
  authorization evidence, cost model, and positive unit economics all pass.
- If a private provider-cost candidate is above any plan threshold, exclude that
  plan from one-subscription managed access, lower included managed-access
  quota, add a managed-access surcharge, or move the buyer to a private Max
  contract.
- Do not publish actual provider costs, exact gross-margin calculations, or
  derived required private prices in launch pages, pull requests, logs, support
  channels, or public metadata.

## Review Checklist

- Provider authorization packet has been reviewed:
  `scripts/configure_managed_provider_resale_readiness.sh --authorization-packet`
- Provider outreach has a private response or contract reference for every
  family in the managed allowlist.
- Terms approval packet has been reviewed:
  `scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet`
- Private cost model has been checked without printing the cost:
  `SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics`
- Public enablement remains off:
  `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0`

## Outcome Fields

- reviewDate:
- reviewer:
- providerFamiliesReviewed:
- privateAuthorizationReference:
- privateCostReviewReference:
- bindingPlan: `max`
- privateCostFitsMaxThreshold: pending
- managedAccessPackagingDecision: pending
- publicEnableApproved: false
- notes:

Privacy flags: containsSecrets=false; containsProviderCredentials=false;
containsActualProviderCosts=false; containsRequiredPrivatePrices=false;
containsAuthorizationReference=false; mutatesRuntime=false.
