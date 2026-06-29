# Sage Router Provider Authorization Outreach

Use this when moving one-subscription managed access from demand capture toward
provider-reviewed authorization. This is a no-secret operator artifact. It does
not enable managed resale, acknowledge provider terms, write Cloud Run env,
write Secret Manager values, send email, or disclose private provider costs.

Current public boundary:

- Managed provider access remains disabled until provider authorization,
  provider terms acknowledgment, an authorized provider-family allowlist, a
  private provider cost model, and positive unit economics all pass.
- OpenRouter and BYOK-compatible gateways remain supported BYOK routing
  providers, but they are not part of the managed subscription resale offer
  unless separate authorization explicitly promotes them later.
- Public pages may show safe plan thresholds and maximum safe provider cost per
  1,000 requests, but actual provider costs and authorization evidence remain
  private.

Run this command for the live, copyable packet:

```bash
scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet
```

## Common Provider Request

Ask each provider for written confirmation of:

- Whether Sage Router may operate a managed-access service for end customers.
- Whether service-provider, reseller, marketplace, or hosted-agent routing use
  cases are permitted for the planned customer category.
- Allowed account type, billing relationship, customer terms/pass-through
  obligations, audit/logging expectations, data-processing restrictions, abuse
  contact, suspension process, rate/capacity limits, model exclusions, and
  termination requirements.
- Private commercial cost schedule or billing model, reviewed separately through
  `--unit-economics`.

Do not paste provider agreements, cost schedules, provider account IDs,
credentials, OAuth tokens, generated API keys, customer data, prompts, or raw
provider responses into public metadata, PRs, support channels, or launch posts.

## Ollama / Ollama Cloud

Subject: Sage Router managed access authorization review for Ollama-family
routing

Body:

Sage Router is preparing a private-beta managed access option for customers who
want one Sage Router subscription plus quota-bound routing. Before enabling any
Ollama-family managed access, we need written confirmation of the allowed
commercial use, account type, redistribution/resale or service-provider
boundary, model-family restrictions, rate/capacity limits, abuse process, and
any end-customer terms we must pass through. Public managed resale stays
disabled until authorization, terms acknowledgment, a private cost model, and
unit economics pass.

Please confirm whether Sage Router may include Ollama or Ollama Cloud access in
this managed-access pilot, and identify any required contract, addendum, usage
cap, model exclusion, or compliance process.

## OpenAI

Subject: Sage Router managed API access authorization review for OpenAI-family
routing

Body:

Sage Router is preparing a private-beta managed access option for generated
API-key customers who want quota-bound routing without bringing their own OpenAI
account. Before enabling any OpenAI-family managed access, we need written
confirmation of resale/service-provider rights, end-customer obligations,
permitted account/billing structure, data-processing and regional constraints,
rate/capacity limits, safety/abuse process, model exclusions, and termination
requirements. Public managed resale stays disabled until authorization, terms
acknowledgment, a private cost model, and unit economics pass.

Please confirm whether Sage Router may include OpenAI API access in this
managed-access pilot, and identify any required enterprise agreement, reseller
agreement, customer terms, usage cap, model exclusion, or compliance process.

## Anthropic

Subject: Sage Router managed API access authorization review for
Anthropic-family routing

Body:

Sage Router is preparing a private-beta managed access option for generated
API-key customers who want quota-bound routing without bringing their own
Anthropic account. Before enabling any Anthropic-family managed access, we need
written confirmation of resale/service-provider rights, customer-use
restrictions, permitted account/billing structure, content-safety obligations,
data-processing constraints, rate/capacity limits, abuse process, model
exclusions, and termination requirements. Public managed resale stays disabled
until authorization, terms acknowledgment, a private cost model, and unit
economics pass.

Please confirm whether Sage Router may include Anthropic API access in this
managed-access pilot, and identify any required contract, customer terms, usage
cap, model exclusion, or compliance process.

## After Provider Reply

- Save the provider reply or contract in a private system of record.
- Record only a private evidence reference, such as
  `provider-review-YYYYMMDD-doc-or-ticket-id`, in
  `SAGEROUTER_PROVIDER_RESALE_AUTHORIZATION_REF`.
- Run `scripts/configure_managed_provider_resale_readiness.sh --authorization-packet`.
- Run `scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template`
  and store the filled copy only in the private system of record.
- Run `scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet`.
- Run `SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST scripts/configure_managed_provider_resale_readiness.sh --unit-economics`.
- Keep `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0` until every
  readiness control passes.
