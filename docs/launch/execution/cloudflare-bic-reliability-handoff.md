# Sage Router Cloudflare BIC Reliability Handoff

Use this no-secret handoff when launch readiness reports that Cloudflare
Browser Integrity Check still blocks raw Python `urllib` before the request can
reach the Sage Router auth gate.

Boundary: do not paste Cloudflare token values, API keys, provider credentials,
OAuth tokens, customer data, prompts, private funnel rows, or raw provider
responses into this file or into public launch channels.

Effect: this handoff does not create rules, edit Cloudflare, deploy Pages,
change DNS, or disable Browser Integrity Check. It only tells the operator how
to verify or apply the host-scoped API exception.

## Live Check

Run the read-only operator packet:

```bash
scripts/configure_cloudflare_api_bic_skip.sh --operator-packet
```

Current launch-readiness state:

- OpenAI/Python-style API clients reach the guided Sage Router auth gate.
- Raw default Python `urllib` is still challenged by Cloudflare BIC.
- Local token-candidate audit reports no usable Rulesets token.
- Existing candidates can read some zone metadata, but cannot verify or edit
  the `http_config_settings` ruleset.
- Launch readiness keeps this as an operator warning rather than a hard
  customer-impacting failure while SDK-style clients work.

## Required Token Scope

Create or rotate `CLOUDFLARE_API_TOKEN` scoped only to the `sagerouter.dev`
zone with:

- `Zone:Zone:Read`
- `Zone Rulesets:Read`
- `Zone Rulesets:Edit`

Do not reuse a Pages deploy token, Sage Router customer API key, provider API
key, router backend token, or Supabase key for this purpose.

## Host-Scoped Rule

The intended rule is:

- Dashboard path: Cloudflare Dashboard > `sagerouter.dev` > Rules >
  Configuration Rules > Create rule
- Rule name/ref: `sage-router-api-disable-bic`
- Expression: `http.host eq "api.sagerouter.dev"`
- Action: set configuration setting `Browser Integrity Check` to `Off`

Scope warning: disable Browser Integrity Check only for `api.sagerouter.dev`.
Do not disable it for `sagerouter.dev`, `www.sagerouter.dev`,
`app.sagerouter.dev`, or the entire zone.

## Commands

Verify without mutation:

```bash
scripts/configure_cloudflare_api_bic_skip.sh --check
```

Apply after the token scope is correct:

```bash
scripts/configure_cloudflare_api_bic_skip.sh
```

Re-run hosted launch readiness after propagation:

```bash
scripts/check_sagerouter_launch_readiness.sh
```

## Success Criteria

- `scripts/configure_cloudflare_api_bic_skip.sh --check` can read the
  Cloudflare `http_config_settings` ruleset for `sagerouter.dev`.
- The host-scoped rule exists for `http.host eq "api.sagerouter.dev"`.
- Raw Python `urllib` reaches the Sage Router guided `401` instead of
  Cloudflare `403` / `1010`.
- OpenAI-compatible SDK clients continue to reach the same guided auth gate.
- Browser Integrity Check remains enabled for the marketing and app hosts.

Privacy flags: containsSecrets=false; containsCloudflareToken=false;
containsCustomerData=false; mutatesCloudflare=false.
