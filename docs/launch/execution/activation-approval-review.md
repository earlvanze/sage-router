# Sage Router Activation Approval Review

Use this no-secret worksheet before approving real no-key signup activation
follow-ups. It turns the live activation approval packet into an operator
decision record without exposing emails, customer IDs, generated API keys,
prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider
responses.

Boundary: keep this worksheet aggregate-only. Do not paste customer emails,
customer IDs, generated keys, key hashes, provider credentials, prompts, OAuth
tokens, raw provider responses, private funnel rows, or raw activation URLs.

Effect: this worksheet does not approve a send, copy a send command, send email,
write customer records, repair auth links, deploy infrastructure, or change
billing state.

## Live Packet

Refresh the approval packet from production aggregate telemetry:

```bash
scripts/summarize_sagerouter_launch_funnel.sh --days 30 --approval-packet --verify-recovery --verify-auth-repair
```

Current launch state:

- Approval readiness: `approval_required`
- Blocker: `explicit_operator_approval_required`
- Decision needed: approve or hold the next real activation send for segment
  `verified`
- Queue: `4` total, `2` sendable, `2` review-only, `0` unknown
- Dry-run coverage: `2` unique sendable recipients; covered segments
  `verified`, `unverified`; pending `none`
- Real sends recorded: `0`
- Approval packet freshness: real sends require a fresh
  `approvalPacketIssuedAt` from the current packet; the default validity window
  is 15 minutes.
- Primary recovery CTA:
  `https://sagerouter.dev/setup-key-recovery?plan=pro&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&source_surface=operator_activation`
- Success metric: move no-key signups into generated-key accounts, then first
  routed request

## Pre-Send Recovery Proof

Run the live no-persistence recovery verifier before approving a real send:

```bash
bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff
```

Current verified result:

- Stage: `verified_handoff_waiting_for_fresh_traffic`
- Handoff smoke checked: `true`
- Handoff smoke passed: `true`
- No-persistence smoke: `true`

Hold real activation sends if this verifier stops reporting
`verified_handoff_waiting_for_fresh_traffic`; inspect setup-key recovery before
sending more traffic.

## Approval Checklist

- No-secret packet reviewed: packet excludes emails, customer IDs, generated
  keys, prompts, OAuth tokens, provider credentials, and raw provider responses.
- Dry-run coverage reviewed: sendable segments are covered, and duplicate raw
  dry-run recipient records are understood before approval.
- Review-only rows excluded: `missing_auth_user` rows stay out of real sends
  until auth repair or explicit exclusion is reviewed.
- Next segment only: approval covers only the next `verified` segment; do not
  broaden to `unverified`, `missing_auth_user`, or all segments without a fresh
  packet.
- Fresh packet timestamp: use only send commands from a current approval packet;
  stale commands are rejected when `approvalPacketIssuedAt` is missing or
  expired.
- Typed confirmation protected: real sends require the private operator token,
  trusted Sage Router browser origin, and
  `sendConfirmation=SEND_ACTIVATION_FOLLOWUPS`.

## Review-Only Auth Repair

Current review-only segment:

- Segment: `missing_auth_user`
- Count: `2`
- Hydrate candidates: `0`
- Account-link review: `2`
- Current dry-run proof: `eligible=0`, `updated=0`,
  `missingAuthCustomers=2`, `noAuthEmailMatch=2`, `aggregateOnly=true`

Dry-run account-link repair before broadening activation:

```bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/repair-auth-links \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"limit":1000,"dryRun":true}' \
  | jq '{status,dryRun,customersChecked,missingAuthCustomers,eligible,updated,skipped,byPlan,byStatus,privacy}'
```

If the dry run reports eligible rows, hold broader activation sends until the
bounded customer review or explicit repair path is reviewed. If `eligible=0`,
keep review-only rows excluded.

## Safe Commands

Re-run the next-segment dry run before approval:

```bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"status":"inactive","segment":"verified","limit":25,"dryRun":true}' \
  | jq '{configured,dryRun,queued,sent,failed,segments,plans}'
```

After explicit operator approval only, run the typed-confirmation command for
the next segment:

```bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"status":"inactive","segment":"verified","limit":25,"dryRun":false,"sendConfirmation":"SEND_ACTIVATION_FOLLOWUPS","approvalPacketIssuedAt":<CURRENT_APPROVAL_PACKET_ISSUED_AT>}'
```

The command still requires `SAGE_ROUTER_API_KEY` in the shell and
`sendConfirmation=SEND_ACTIVATION_FOLLOWUPS` plus a fresh
`approvalPacketIssuedAt` in the request body.

## Outcome Fields

- reviewDate:
- reviewer:
- decision: pending
- approvedSegment: `verified`
- approvalScope: next segment only
- recoveryVerifierResult: `verified_handoff_waiting_for_fresh_traffic`
- dryRunReviewed: false
- reviewOnlyRowsExcluded: true
- typedConfirmationAccepted: false
- notes:

Privacy flags: containsEmails=false; containsCustomerIds=false;
containsApiKeys=false; containsProviderCredentials=false; promptsStored=false;
mutatesRuntime=false; sendsEmail=false.
