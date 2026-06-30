# Sage Router Activation Approval Review

Use this no-secret worksheet before approving real no-key signup activation
follow-ups. It turns the live activation approval packet into an operator
decision record without exposing emails, customer IDs, generated API keys,
prompts, OAuth tokens, provider credentials, raw campaign URLs, raw provider
responses, or private funnel rows.

Boundary: keep this worksheet aggregate-only. Do not paste customer emails,
customer IDs, generated keys, key hashes, provider credentials, prompts, OAuth
tokens, raw provider responses, private funnel rows, raw activation URLs, or
private token values.

Effect: this worksheet does not approve a send, copy a send command, send email,
write customer records, repair auth links, deploy infrastructure, change billing
state, or enable managed provider resale.

Refresh this worksheet from production aggregate telemetry:

```bash
scripts/update_activation_approval_review.sh --days 30 --write
```

## Live Packet

Source command:

```bash
scripts/summarize_sagerouter_launch_funnel.sh --days 30 --approval-packet --verify-recovery --verify-auth-repair
```

Current launch state:

- Approval readiness: `approval_required; blocker=explicit_operator_approval_required.`
- Decision needed: approve or hold the next real activation send for segment "verified".
- Approval packet freshness: `issuedAt=<CURRENT_APPROVAL_PACKET_ISSUED_AT>; expiresAt=<CURRENT_APPROVAL_PACKET_EXPIRES_AT>; validSeconds=900; requiredForRealSend=true.`
- Queue: `4 total; 2 sendable; 2 review-only; 0 unknown.`
- Dry-run coverage: `verified for 2 unique sendable recipient(s). Sent: 0; failed: 0.`
- Dry-run segments: `covered=verified, unverified; pending=none; duplicate raw recipient records=2.`
- Approval required: yes, do not send until explicit operator approval.
- Primary recovery CTA:
  `https://sagerouter.dev/setup-key-recovery?plan=pro&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&source_surface=operator_activation.`
- Success metric: Move no-key signups into generated-key accounts, then first routed request.

## Current No-Secret Packet

The packet below is safe for review, but any embedded real-send command expires
with its `approvalPacketIssuedAt`. Re-run the source command immediately before
any approved send. Persistent worksheet output replaces embedded real-send
`approvalPacketIssuedAt` values with `<CURRENT_APPROVAL_PACKET_ISSUED_AT>`
so the file cannot be reused as an approval token.

```text
Sage Router activation approval packet
Boundary: no emails, customer IDs, API keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider responses.
Effect: read-only review packet; this command does not approve, copy a send command, or send activation emails.

Approval readiness: approval_required; blocker=explicit_operator_approval_required.
Decision needed: approve or hold the next real activation send for segment "verified".
Approval packet freshness: issuedAt=<CURRENT_APPROVAL_PACKET_ISSUED_AT>; expiresAt=<CURRENT_APPROVAL_PACKET_EXPIRES_AT>; validSeconds=900; requiredForRealSend=true.
Queued: 4 total; 2 sendable; 2 review-only; 0 unknown.
Dry-run: verified for 2 unique sendable recipient(s). Sent: 0; failed: 0.
Dry-run segments: covered=verified, unverified; pending=none; duplicate raw recipient records=2.
Approval required: yes, do not send until explicit operator approval.
Next actions: fix_now:approve_activation_followups, next:review_auth_repair_segments.

Pre-send recovery proof:
- Current bottleneck: signupToGeneratedKey — Recovery handoff is verified with no persistence; the next blocker is explicit operator approval for segment "verified" or fresh recovery traffic, not recovery-page code.
- Verification command: bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff
- Verification result: stage=verified_handoff_waiting_for_fresh_traffic; checked=true; passed=true; noPersistence=true.
- Approval boundary: if the verification command does not report verified_handoff_waiting_for_fresh_traffic, hold real activation sends and inspect the recovery path first.

Approval checklist:
- review_no_secret_packet=ready: Packet excludes emails, customer IDs, generated keys, prompts, OAuth tokens, provider credentials, and raw provider responses.
- verify_dry_run_coverage=ready: 2 unique sendable recipient(s); 4 raw dry-run recipient record(s); 2 duplicate record(s); covered=verified, unverified; pending=none.
- exclude_review_only_segments=review: 2 review-only signup(s) need auth repair or exclusion before email outreach.
- repair_missing_auth_users=review: Review account-link repair or exclusion for segments missing_auth_user; hydration has no missing customer rows to create.
- refresh_recent_approval_packet=ready: Packet issued at <CURRENT_APPROVAL_PACKET_ISSUED_AT>; expires at <CURRENT_APPROVAL_PACKET_EXPIRES_AT>; re-run the approval packet after 900 seconds before any real send.
- approve_next_segment_only=needs_approval: Approve or hold only segment "verified"; do not broaden to other segments without a fresh packet.
- require_typed_confirmation=protected: Real sends require SEND_ACTIVATION_FOLLOWUPS plus the private operator token and trusted browser origin.

Sendable segments:
- verified: 1 queued; order=1; dryRun=verified; worked=verified_marked_worked
- unverified: 1 queued; order=2; dryRun=verified; worked=unverified_marked_worked

Review-only segments:
- missing_auth_user: 2 queued; reason=Needs auth-user repair before recovery email can be sent.

Auth repair handoff:
- Status: review_required; queued=2; segments=missing_auth_user; hydrateCandidates=0; accountLinkReview=2; endpoint=/admin/customers/hydrate-auth-users.
- Fallback/action boundary: Hydration has no missing customer rows to create; keep stale account-link rows excluded from activation sends until the customer auth binding is repaired..
- Hydrate command:
  not applicable: no auth signups without customer rows are queued for hydration
- Account-link repair dry-run command:
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/repair-auth-links \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"limit":1000,"dryRun":true}' \
  | jq '{status,dryRun,customersChecked,missingAuthCustomers,eligible,updated,skipped,byPlan,byStatus,privacy}'
- Account-link repair dry-run proof: stage=dry_run_completed; checked=true; passed=true; eligible=0; updated=0; missingAuthCustomers=2; noAuthEmailMatch=2; aggregateOnly=true.
- Auth repair approval boundary: if the dry run fails or reports eligible rows, hold broader sends until the bounded customer review or explicit repair path is reviewed; if eligible=0, keep review-only rows excluded from activation sends.
- Bounded auth review command:
curl -fsS 'https://api.sagerouter.dev/admin/customers?limit=20' \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  | jq '{count,statusCounts,emailVerification,noKeyCreateKey,customers:[.customers[]? | {status:.customer.status,plan:.customer.plan,hasEmail:(.customer.email != null and .customer.email != ""),activationNextAction:.activation.nextAction,activeKeyCount:.activation.activeKeyCount,verificationVerified:.emailVerification.verified,verificationSource:.emailVerification.source,reviewFlags:[.review.flagCodes[]?]}]}'

Primary recovery CTA: https://sagerouter.dev/setup-key-recovery?plan=pro&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&source_surface=operator_activation.
Success metric: Move no-key signups into generated-key accounts, then first routed request.

Safe command handoff:
- Re-run the segment dry-run before approval:
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"status":"inactive","segment":"verified","limit":25,"dryRun":true}' \
  | jq '{configured,dryRun,queued,sent,failed,segments,plans}'
- After explicit approval, run the typed-confirmation send command for this segment:
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"status":"inactive","segment":"verified","limit":25,"dryRun":false,"sendConfirmation":"SEND_ACTIVATION_FOLLOWUPS","approvalPacketIssuedAt":<CURRENT_APPROVAL_PACKET_ISSUED_AT>}'
- This printed command still requires SAGE_ROUTER_API_KEY in the shell, a fresh approvalPacketIssuedAt, and sendConfirmation=SEND_ACTIVATION_FOLLOWUPS in the request body.

Recording command: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-activation-approval-review --verify-recovery --verify-auth-repair
Privacy flags: containsEmails=false; containsApiKeys=false; containsProviderCredentials=false; promptsStored=false.
```

## Pre-Send Recovery Proof

Run the live no-persistence recovery verifier before approving a real send:

```bash
bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff
```

Current verified result:

- Verification result: `stage=verified_handoff_waiting_for_fresh_traffic; checked=true; passed=true; noPersistence=true.`
- Account-link repair dry-run proof: `stage=dry_run_completed; checked=true; passed=true; eligible=0; updated=0; missingAuthCustomers=2; noAuthEmailMatch=2; aggregateOnly=true.`

Hold real activation sends if the recovery verifier stops reporting
`verified_handoff_waiting_for_fresh_traffic`; inspect setup-key recovery before
sending more traffic. Hold broader sends if the account-link dry run fails or
reports eligible rows until the bounded customer review or explicit repair path
is reviewed.

## Approval Checklist

- No-secret packet reviewed: packet excludes emails, customer IDs, generated
  keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, raw
  provider responses, and private funnel rows.
- Dry-run coverage reviewed: sendable segments are covered, duplicate raw
  dry-run recipient records are understood, and the next segment is still
  `verified`.
- Review-only rows excluded: `missing_auth_user` rows stay out of real sends
  until auth repair or explicit exclusion is reviewed.
- Recovery proof reviewed: the verifier result is
  `verified_handoff_waiting_for_fresh_traffic`.
- Fresh packet timestamp: use only send commands from a current approval packet;
  stale commands are rejected when `approvalPacketIssuedAt` is missing or
  expired.
- Typed confirmation protected: real sends require the private operator token,
  trusted Sage Router browser origin, and
  `sendConfirmation=SEND_ACTIVATION_FOLLOWUPS`.

## Safe Commands

Regenerate this worksheet before approval:

```bash
scripts/update_activation_approval_review.sh --days 30 --write
```

Re-run the next-segment dry run before approval:

```bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \
  -H "Authorization: Bearer ${SAGE_ROUTER_API_KEY}" \
  -H "Origin: https://app.sagerouter.dev" \
  -H "Content-Type: application/json" \
  --data '{"status":"inactive","segment":"verified","limit":25,"dryRun":true}' \
  | jq '{configured,dryRun,queued,sent,failed,segments,plans}'
```

After explicit operator approval only, use a fresh typed-confirmation command
from the current approval packet. Do not reuse a copied command from this file
after the packet expires.

Template:

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
