#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DAYS=30
WRITE=0
OUTPUT_PATH="${SAGEROUTER_ACTIVATION_APPROVAL_REVIEW_PATH:-docs/launch/execution/activation-approval-review.md}"

usage() {
  cat <<'EOF'
Usage: scripts/update_activation_approval_review.sh [--days N] [--write] [--path PATH]

Render the persistent no-secret activation approval review worksheet from the
current live approval packet, setup-key recovery verifier, and auth-repair dry
run. By default this prints the worksheet to stdout. Use --write to replace the
target file.

Boundary: no emails, customer IDs, generated API keys, prompts, OAuth tokens,
provider credentials, raw provider responses, raw private funnel rows, or token
values are printed.

Effect: read-only unless --write is supplied. It does not approve activation
sends, send email, repair auth links, mutate billing, deploy, or enable managed
provider resale.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      DAYS="${2:-}"
      if [[ -z "$DAYS" || ! "$DAYS" =~ ^[0-9]+$ || "$DAYS" -lt 1 ]]; then
        printf 'Invalid --days value: %s\n' "${DAYS:-}" >&2
        exit 2
      fi
      shift 2
      ;;
    --write)
      WRITE=1
      shift
      ;;
    --path)
      OUTPUT_PATH="${2:-}"
      if [[ -z "$OUTPUT_PATH" || "$OUTPUT_PATH" == -* ]]; then
        printf '%s\n' '--path requires a file path' >&2
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

packet_tmp="$(mktemp)"
doc_tmp="$(mktemp)"
cleanup() {
  rm -f "$packet_tmp" "$doc_tmp"
}
trap cleanup EXIT

scripts/summarize_sagerouter_launch_funnel.sh \
  --days "$DAYS" \
  --approval-packet \
  --verify-recovery \
  --verify-auth-repair \
  > "$packet_tmp"

# The live approval packet is useful review evidence, but the typed real-send
# command and freshness timestamps expire quickly. Keep persistent worksheets
# from embedding soon-stale values that an operator might later copy.
safe_packet="$(sed -E \
  -e 's/"approvalPacketIssuedAt":[0-9]+/"approvalPacketIssuedAt":<CURRENT_APPROVAL_PACKET_ISSUED_AT>/g' \
  -e 's/issuedAt=[0-9]+; expiresAt=[0-9]+;/issuedAt=<CURRENT_APPROVAL_PACKET_ISSUED_AT>; expiresAt=<CURRENT_APPROVAL_PACKET_EXPIRES_AT>;/g' \
  -e 's/(APPROVE_ACTIVATION_FOLLOWUP segment="[^"]*" )issuedAt=[0-9]+ expiresAt=[0-9]+/\1issuedAt=<CURRENT_APPROVAL_PACKET_ISSUED_AT> expiresAt=<CURRENT_APPROVAL_PACKET_EXPIRES_AT>/g' \
  -e 's/Packet issued at [0-9]+; expires at [0-9]+;/Packet issued at <CURRENT_APPROVAL_PACKET_ISSUED_AT>; expires at <CURRENT_APPROVAL_PACKET_EXPIRES_AT>;/g' \
  "$packet_tmp")"

extract_after_colon() {
  local pattern="$1"
  local fallback="$2"
  local value
  value="$(grep -m1 "$pattern" "$packet_tmp" | sed 's/^[^:]*: *//' || true)"
  printf '%s\n' "${value:-$fallback}"
}

approval_line="$(extract_after_colon '^Approval readiness:' 'unknown; blocker=unknown.')"
decision_line="$(extract_after_colon '^Decision needed:' 'approve or hold the next real activation send for the next segment.')"
freshness_line="$(extract_after_colon '^Approval packet freshness:' 'issuedAt=0; expiresAt=0; validSeconds=0; requiredForRealSend=true.')"
freshness_line="$(sed -E 's/issuedAt=[0-9]+; expiresAt=[0-9]+;/issuedAt=<CURRENT_APPROVAL_PACKET_ISSUED_AT>; expiresAt=<CURRENT_APPROVAL_PACKET_EXPIRES_AT>;/' <<<"$freshness_line")"
queue_line="$(extract_after_colon '^Queued:' '0 total; 0 sendable; 0 review-only; 0 unknown.')"
dry_run_line="$(extract_after_colon '^Dry-run:' 'not complete for 0 unique sendable recipient(s). Sent: 0; failed: 0.')"
dry_segments_line="$(extract_after_colon '^Dry-run segments:' 'covered=none; pending=unknown; duplicate raw recipient records=0.')"
approval_required_line="$(extract_after_colon '^Approval required:' 'yes, do not send until explicit operator approval.')"
recovery_result_line="$(extract_after_colon '^- Verification result:' 'stage=not_run; checked=false; passed=false; noPersistence=true.')"
auth_repair_line="$(extract_after_colon '^- Account-link repair dry-run proof:' 'stage=not_run; checked=false; passed=false; eligible=0; updated=0; aggregateOnly=true.')"
primary_cta="$(extract_after_colon '^Primary recovery CTA:' 'https://sagerouter.dev/setup-key-recovery?utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery')"
success_metric="$(extract_after_colon '^Success metric:' 'Move no-key signups into generated-key accounts, then first routed request.')"

approved_segment="$(sed -n 's/^Decision needed: .*segment "\([^"]*\)".*/\1/p' "$packet_tmp" | head -1)"
approved_segment="${approved_segment:-verified}"
recovery_stage="$(sed -n 's/.*stage=\([^;]*\);.*/\1/p' <<<"$recovery_result_line" | head -1)"
recovery_stage="${recovery_stage:-not_run}"

cat > "$doc_tmp" <<EOF
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

\`\`\`bash
scripts/update_activation_approval_review.sh --days ${DAYS} --write
\`\`\`

## Live Packet

Source command:

\`\`\`bash
scripts/summarize_sagerouter_launch_funnel.sh --days ${DAYS} --approval-packet --verify-recovery --verify-auth-repair
\`\`\`

Current launch state:

- Approval readiness: \`${approval_line}\`
- Decision needed: ${decision_line}
- Approval packet freshness: \`${freshness_line}\`
- Queue: \`${queue_line}\`
- Dry-run coverage: \`${dry_run_line}\`
- Dry-run segments: \`${dry_segments_line}\`
- Approval required: ${approval_required_line}
- Primary recovery CTA:
  \`${primary_cta}\`
- Success metric: ${success_metric}

## Current No-Secret Packet

The packet below is safe for review, but any embedded real-send command expires
with its \`approvalPacketIssuedAt\`. Re-run the source command immediately before
any approved send. Persistent worksheet output replaces embedded real-send
\`approvalPacketIssuedAt\` values with \`<CURRENT_APPROVAL_PACKET_ISSUED_AT>\`
so the file cannot be reused as an approval token.

\`\`\`text
${safe_packet}
\`\`\`

## Pre-Send Recovery Proof

Run the live no-persistence recovery verifier before approving a real send:

\`\`\`bash
bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff
\`\`\`

Current verified result:

- Verification result: \`${recovery_result_line}\`
- Account-link repair dry-run proof: \`${auth_repair_line}\`

Hold real activation sends if the recovery verifier stops reporting
\`verified_handoff_waiting_for_fresh_traffic\`; inspect setup-key recovery before
sending more traffic. Hold broader sends if the account-link dry run fails or
reports eligible rows until the bounded customer review or explicit repair path
is reviewed.

## Approval Checklist

- No-secret packet reviewed: packet excludes emails, customer IDs, generated
  keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, raw
  provider responses, and private funnel rows.
- Dry-run coverage reviewed: sendable segments are covered, duplicate raw
  dry-run recipient records are understood, and the next segment is still
  \`${approved_segment}\`.
- Review-only rows excluded: \`missing_auth_user\` rows stay out of real sends
  until auth repair or explicit exclusion is reviewed.
- Recovery proof reviewed: the verifier result is
  \`${recovery_stage}\`.
- Decision line reviewed: use the packet's
  \`APPROVE_ACTIVATION_FOLLOWUP segment="${approved_segment}"\` or
  \`HOLD_ACTIVATION_FOLLOWUP segment="${approved_segment}"\` line as the human
  decision record only; it does not send email by itself.
- Fresh packet timestamp: use only send commands from a current approval packet;
  stale commands are rejected when \`approvalPacketIssuedAt\` is missing or
  expired.
- Typed confirmation protected: real sends require the private operator token,
  trusted Sage Router browser origin, and
  \`sendConfirmation=SEND_ACTIVATION_FOLLOWUPS\`.

## Safe Commands

Regenerate this worksheet before approval:

\`\`\`bash
scripts/update_activation_approval_review.sh --days ${DAYS} --write
\`\`\`

Re-run the next-segment dry run before approval:

\`\`\`bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \\
  -H "Authorization: Bearer \${SAGE_ROUTER_API_KEY}" \\
  -H "Origin: https://app.sagerouter.dev" \\
  -H "Content-Type: application/json" \\
  --data '{"status":"inactive","segment":"${approved_segment}","limit":25,"dryRun":true}' \\
  | jq '{configured,dryRun,queued,sent,failed,segments,plans}'
\`\`\`

After explicit operator approval only, use a fresh typed-confirmation command
from the current approval packet. Do not reuse a copied command from this file
after the packet expires.

Template:

\`\`\`bash
curl -fsS -X POST https://api.sagerouter.dev/admin/customers/send-activation-followups \\
  -H "Authorization: Bearer \${SAGE_ROUTER_API_KEY}" \\
  -H "Origin: https://app.sagerouter.dev" \\
  -H "Content-Type: application/json" \\
  --data '{"status":"inactive","segment":"${approved_segment}","limit":25,"dryRun":false,"sendConfirmation":"SEND_ACTIVATION_FOLLOWUPS","approvalPacketIssuedAt":<CURRENT_APPROVAL_PACKET_ISSUED_AT>}'
\`\`\`

The command still requires \`SAGE_ROUTER_API_KEY\` in the shell and
\`sendConfirmation=SEND_ACTIVATION_FOLLOWUPS\` plus a fresh
\`approvalPacketIssuedAt\` in the request body.

## Outcome Fields

- reviewDate:
- reviewer:
- decision: pending
- approvedSegment: \`${approved_segment}\`
- approvalScope: next segment only
- recoveryVerifierResult: \`${recovery_stage}\`
- dryRunReviewed: false
- reviewOnlyRowsExcluded: true
- typedConfirmationAccepted: false
- notes:

Privacy flags: containsEmails=false; containsCustomerIds=false;
containsApiKeys=false; containsProviderCredentials=false; promptsStored=false;
mutatesRuntime=false; sendsEmail=false.
EOF

if [[ "$WRITE" == "1" ]]; then
  mkdir -p "$(dirname "$OUTPUT_PATH")"
  mv "$doc_tmp" "$OUTPUT_PATH"
  printf 'Updated %s from live no-secret activation approval telemetry.\n' "$OUTPUT_PATH"
else
  cat "$doc_tmp"
fi
