#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/summarize_sagerouter_launch_funnel.sh [--days N] [--json] [--approval-packet] [--founder-sales-packet] [--verify-recovery] [--verify-auth-repair] [--distribution-tracker-section] [--update-distribution-tracker]

Fetch the operator-only /analytics/funnel endpoint and print a privacy-safe
launch snapshot. The script never prints operator tokens, emails, generated API
keys, prompts, provider credentials, OAuth tokens, raw campaign URLs, or raw
provider responses.

Options:
  --json              Print the bounded machine-readable snapshot.
  --approval-packet   Print the no-secret activation send approval packet only.
  --founder-sales-packet
                      Print the no-secret founder-sales next-revenue packet
                      for direct warm outreach while sends/resale are gated.
  --verify-recovery   With --approval-packet, run the no-persistence setup-key
                      recovery handoff verifier and include the result.
  --verify-auth-repair
                      With --approval-packet, run the non-mutating
                      account-link repair dry run for review-only signup rows
                      and include aggregate-only proof.
  --distribution-tracker-section
                      Print a docs/launch/distribution-tracker.md-ready
                      live snapshot section.
  --update-distribution-tracker
                      Replace only the Current live snapshot section in
                      docs/launch/distribution-tracker.md with fresh
                      aggregate telemetry.

Environment:
  SAGEROUTER_SECRET_ENV_FILE       Optional env file to source first
  SAGEROUTER_API_BASE_URL          Defaults to https://api.sagerouter.dev
  SAGEROUTER_DISTRIBUTION_TRACKER_PATH
                                  Defaults to docs/launch/distribution-tracker.md
  SAGE_ROUTER_ANALYTICS_TOKEN      Preferred read-only funnel token
  SAGE_ROUTER_OPERATOR_TOKEN       Fallback operator token
  SAGE_ROUTER_API_KEY              Final fallback admin token
EOF
}

load_local_env_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0

  local key value current
  while IFS='=' read -r -d '' key value; do
    case "$key" in
      SAGEROUTER_API_BASE_URL|SAGE_ROUTER_ANALYTICS_TOKEN|SAGE_ROUTER_OPERATOR_TOKEN|SAGE_ROUTER_API_KEY)
        ;;
      *)
        continue
        ;;
    esac
    current="${!key:-}"
    if [[ -z "$current" && -n "$value" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < <(set +u; set -a; source "$path" >/dev/null 2>&1; env -0)
}

require_tool() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf 'Missing required tool: %s\n' "$name" >&2
    exit 2
  fi
}

DAYS=30
RAW_JSON=0
APPROVAL_PACKET=0
FOUNDER_SALES_PACKET=0
VERIFY_RECOVERY=0
VERIFY_AUTH_REPAIR=0
TRACKER_SECTION=0
UPDATE_TRACKER=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      if [[ $# -lt 2 || "${2:-}" == -* ]]; then
        printf '%s\n' '--days requires a positive integer value' >&2
        exit 2
      fi
      DAYS="${2:-}"
      shift 2
      ;;
    --json)
      RAW_JSON=1
      shift
      ;;
    --approval-packet)
      APPROVAL_PACKET=1
      shift
      ;;
    --founder-sales-packet)
      FOUNDER_SALES_PACKET=1
      shift
      ;;
    --verify-recovery)
      VERIFY_RECOVERY=1
      shift
      ;;
    --verify-auth-repair)
      VERIFY_AUTH_REPAIR=1
      shift
      ;;
    --distribution-tracker-section)
      TRACKER_SECTION=1
      shift
      ;;
    --update-distribution-tracker)
      UPDATE_TRACKER=1
      shift
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

if (( RAW_JSON + APPROVAL_PACKET + FOUNDER_SALES_PACKET + TRACKER_SECTION + UPDATE_TRACKER > 1 )); then
  printf '%s\n' '--json, --approval-packet, --founder-sales-packet, --distribution-tracker-section, and --update-distribution-tracker cannot be combined' >&2
  exit 2
fi
if [[ "$VERIFY_RECOVERY" == "1" && "$APPROVAL_PACKET" != "1" ]]; then
  printf '%s\n' '--verify-recovery can only be used with --approval-packet' >&2
  exit 2
fi
if [[ "$VERIFY_AUTH_REPAIR" == "1" && "$APPROVAL_PACKET" != "1" ]]; then
  printf '%s\n' '--verify-auth-repair can only be used with --approval-packet' >&2
  exit 2
fi

if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [[ "$DAYS" -lt 1 ]]; then
  printf '%s\n' '--days must be a positive integer' >&2
  exit 2
fi

require_tool curl
require_tool jq

if [[ "$TRACKER_SECTION" == "1" ]]; then
  require_tool awk
  cat <<EOF
## Current live snapshot

Refresh this section from live aggregate telemetry with:

\`\`\`bash
scripts/summarize_sagerouter_launch_funnel.sh --days ${DAYS} --update-distribution-tracker
\`\`\`

EOF
  "$0" --days "$DAYS" | awk '
    NR == 1 { next }
    NR == 2 && $0 == "" { next }
    /^## / {
      sub(/^## /, "### ")
    }
    { print }
  '
  cat <<'EOF'

Prioritize the no-key activation queue before broad public posting: moving the
two sendable signups into generated-key accounts should raise the conversion
rate faster than buying or posting into more top-of-funnel traffic. After that,
scale Reddit reliability/comparison posts and GitHub README/docs traffic because
those are the strongest external signals currently visible.

For a single read-only launch packet before operator review, run
`scripts/summarize_sagerouter_launch_operator_handoff.sh --days 30
--skip-readiness` to bundle the live funnel snapshot, activation approval
packet, founder-sales next-revenue packet, Cloudflare BIC reliability packet,
managed-provider readiness packet, one-subscription pricing packet, provider
outreach packet, and provider reply triage packet without approving sends, sending email, mutating
Cloudflare, deploying, enabling managed resale, or printing secrets. Omit
`--skip-readiness` when the operator packet should include the full launch
readiness probe.

EOF
  exit 0
fi

if [[ "$UPDATE_TRACKER" == "1" ]]; then
  require_tool awk
  TRACKER_PATH="${SAGEROUTER_DISTRIBUTION_TRACKER_PATH:-docs/launch/distribution-tracker.md}"
  if [[ ! -f "$TRACKER_PATH" ]]; then
    printf 'Missing distribution tracker: %s\n' "$TRACKER_PATH" >&2
    exit 2
  fi

  section_tmp="$(mktemp)"
  doc_tmp="$(mktemp)"
  cleanup_update_tracker() {
    rm -f "$section_tmp" "$doc_tmp"
  }
  trap cleanup_update_tracker EXIT

  "$0" --days "$DAYS" --distribution-tracker-section > "$section_tmp"
  awk -v section_path="$section_tmp" '
    BEGIN {
      while ((getline line < section_path) > 0) {
        section = section line ORS
      }
      close(section_path)
      replaced = 0
      skipping = 0
    }
    $0 == "## Current live snapshot" {
      printf "%s", section
      replaced = 1
      skipping = 1
      next
    }
    skipping && $0 == "## Posting queue" {
      skipping = 0
      print
      next
    }
    !skipping {
      print
    }
    END {
      if (replaced != 1 || skipping != 0) {
        exit 3
      }
    }
  ' "$TRACKER_PATH" > "$doc_tmp" || {
    printf 'Failed to update Current live snapshot in %s\n' "$TRACKER_PATH" >&2
    exit 3
  }
  mv "$doc_tmp" "$TRACKER_PATH"
  printf 'Updated %s Current live snapshot from live aggregate telemetry.\n' "$TRACKER_PATH"
  exit 0
fi

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

API_BASE="${SAGEROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
TOKEN="${SAGE_ROUTER_ANALYTICS_TOKEN:-${SAGE_ROUTER_OPERATOR_TOKEN:-${SAGE_ROUTER_API_KEY:-}}}"
if [[ -z "$TOKEN" ]]; then
  printf 'Missing SAGE_ROUTER_ANALYTICS_TOKEN, SAGE_ROUTER_OPERATOR_TOKEN, or SAGE_ROUTER_API_KEY\n' >&2
  exit 2
fi

tmp="$(mktemp)"
recovery_tmp="$(mktemp)"
auth_repair_tmp="$(mktemp)"
auth_repair_raw_tmp="$(mktemp)"
trap 'rm -f "$tmp" "$recovery_tmp" "$auth_repair_tmp" "$auth_repair_raw_tmp"' EXIT

curl -fsS "${API_BASE%/}/analytics/funnel?days=${DAYS}&limit=10000" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$tmp"

printf '{"stage":"not_run","handoffSmoke":{"checked":false,"passed":false,"noPersistence":true},"privacy":{"aggregateOnly":true}}\n' > "$recovery_tmp"
if [[ "$APPROVAL_PACKET" == "1" && "$VERIFY_RECOVERY" == "1" ]]; then
  bash scripts/diagnose_setup_key_recovery_dropoff.sh --days "$DAYS" --verify-handoff --json > "$recovery_tmp"
fi
if [[ "$APPROVAL_PACKET" != "1" && "$RAW_JSON" != "1" ]]; then
  if ! bash scripts/diagnose_setup_key_recovery_dropoff.sh --days "$DAYS" --verify-handoff --json > "$recovery_tmp"; then
    printf '{"stage":"failed","handoffSmoke":{"checked":true,"passed":false,"noPersistence":true},"privacy":{"aggregateOnly":true}}\n' > "$recovery_tmp"
  fi
fi

printf '{"stage":"not_run","checked":false,"passed":false,"dryRun":true,"privacy":{"aggregateOnly":true}}\n' > "$auth_repair_tmp"
if [[ "$APPROVAL_PACKET" == "1" && "$VERIFY_AUTH_REPAIR" == "1" ]]; then
  AUTH_REPAIR_TOKEN="${SAGE_ROUTER_OPERATOR_TOKEN:-${SAGE_ROUTER_API_KEY:-}}"
  if [[ -z "$AUTH_REPAIR_TOKEN" ]]; then
    printf '{"stage":"skipped_missing_admin_token","checked":false,"passed":false,"dryRun":true,"privacy":{"aggregateOnly":true}}\n' > "$auth_repair_tmp"
  else
    if curl -fsS -X POST "${API_BASE%/}/admin/customers/repair-auth-links" \
      -H "Authorization: Bearer ${AUTH_REPAIR_TOKEN}" \
      -H "Origin: https://app.sagerouter.dev" \
      -H "Content-Type: application/json" \
      --data '{"limit":1000,"dryRun":true}' \
      -o "$auth_repair_raw_tmp"; then
      jq '{
        stage: (if (.dryRun == true) then "dry_run_completed" else "unexpected_non_dry_run_response" end),
        checked: true,
        passed: ((.dryRun == true) and ((.privacy.aggregateOnly // false) == true)),
        dryRun: (.dryRun // false),
        status: (.status // "unknown"),
        customersChecked: (.customersChecked // 0),
        missingAuthCustomers: (.missingAuthCustomers // 0),
        eligible: (.eligible // 0),
        updated: (.updated // 0),
        skipped: (.skipped // {}),
        privacy: {
          containsEmails: (.privacy.containsEmails // false),
          containsUserIds: (.privacy.containsUserIds // false),
          containsCustomerIds: (.privacy.containsCustomerIds // false),
          containsApiKeys: (.privacy.containsApiKeys // false),
          containsProviderCredentials: (.privacy.containsProviderCredentials // false),
          aggregateOnly: (.privacy.aggregateOnly // true)
        }
      }' "$auth_repair_raw_tmp" > "$auth_repair_tmp"
    else
      printf '{"stage":"failed","checked":true,"passed":false,"dryRun":true,"privacy":{"aggregateOnly":true}}\n' > "$auth_repair_tmp"
    fi
  fi
fi

if [[ "$APPROVAL_PACKET" == "1" ]]; then
  jq -r --slurpfile recoveryProof "$recovery_tmp" --slurpfile authRepairProof "$auth_repair_tmp" '
    def n($v): ($v // 0);
    def list($v): if (($v // []) | length) > 0 then (($v // []) | join(", ")) else "none" end;
    def command_for($rows; $segment; $field):
      (
        ($rows // [])
        | map(select((.segment // "all") == ($segment // "all")))
        | .[0][$field]
      ) // "";
    def segment_lines($rows; $sendable; $dry):
      ($rows // [])
      | map(select((.sendable != false) == $sendable))
      | if length > 0 then
          map(
            if $sendable then
              "- \(.segment // "all"): \(n(.count)) queued; order=\(n(.sendOrder)); dryRun=\(if $dry then "verified" else "pending" end); worked=\(.workedKind // "")"
            else
              "- \(.segment // "review"): \(n(.count)) queued; reason=\(.reviewReason // "Review before sending.")"
            end
          )
        else ["- none"] end;

    . as $root
    | (($recoveryProof[0] // {})) as $recovery_proof
    | (($authRepairProof[0] // {})) as $auth_repair_proof
    | ($root.activationFollowUps // {}) as $followups
    | ($root.nextBestAction // {}) as $next_action
    | ($root.operatorExecutionPacket // {}) as $packet
    | ($packet.sendTelemetry // {}) as $telemetry
    | ($packet.emailReadiness // {}) as $email_readiness
    | ($root.activationApprovalReadiness // {
        status: (
          if (($telemetry.sendApprovalRequired // false) == true) then "approval_required"
          elif (($telemetry.dryRunVerified // false) == false and ($packet.sendableQueued // 0) > 0) then "dry_run_required"
          else "unknown"
          end
        ),
        approvalRequired: ($telemetry.sendApprovalRequired // false),
        dryRunVerified: ($telemetry.dryRunVerified // false),
        blockedReason: (
          if (($packet.sendableQueued // 0) <= 0) then "no_sendable_segments"
          elif (($telemetry.dryRunVerified // false) == false) then "dry_run_not_verified"
          elif (($telemetry.sendApprovalRequired // false) == true) then "explicit_operator_approval_required"
          else ""
          end
        ),
        nextSendSegment: ($telemetry.nextSendSegment // ""),
        approvalPacketIssuedAt: ($email_readiness.approvalPacketIssuedAt // 0),
        approvalPacketExpiresAt: ($email_readiness.approvalPacketExpiresAt // 0),
        approvalPacketValidSeconds: ($email_readiness.approvalPacketValidSeconds // 0),
        approvalPacketRequiredForRealSend: ($email_readiness.approvalPacketRequiredForRealSend // true),
        nextActions: []
      }) as $approval
    | (($approval.authRepair // $packet.authRepair // {})) as $auth_repair
    | ($packet.segmentActions // []) as $segments
    | ($telemetry.dryRunVerified // false) as $dry
    | ($approval.nextSendSegment // $telemetry.nextSendSegment // "all") as $next_segment
    | (command_for($segments; $next_segment; "dryRunCommand")) as $next_dry_run_command
    | (command_for($segments; $next_segment; "sendCommand")) as $next_send_command
    | [
        "Sage Router activation approval packet",
        "Boundary: no emails, customer IDs, API keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider responses.",
        "Effect: read-only review packet; this command does not approve, copy a send command, or send activation emails.",
        "",
        "Approval readiness: \($approval.status // "unknown"); blocker=\($approval.blockedReason // "none").",
        "Decision needed: approve or hold the next real activation send for segment \"\($next_segment)\".",
        "Approval packet freshness: issuedAt=\(n($approval.approvalPacketIssuedAt)); expiresAt=\(n($approval.approvalPacketExpiresAt)); validSeconds=\(n($approval.approvalPacketValidSeconds)); requiredForRealSend=\($approval.approvalPacketRequiredForRealSend // true).",
        "Queued: \(n($packet.totalQueued // $followups.total)) total; \(n($packet.sendableQueued // $followups.sendableQueued)) sendable; \(n($packet.reviewOnlyQueued // $followups.reviewOnlyQueued)) review-only; \(n($followups.unknownQueued)) unknown.",
        "Dry-run: \(if $dry then "verified" else "not complete" end) for \(n($telemetry.dryRunRecipients)) unique sendable recipient(s). Sent: \(n($telemetry.sentRecipients)); failed: \(n($telemetry.failedRecipients)).",
        "Dry-run segments: covered=\(list($telemetry.dryRunCoveredSegments)); pending=\(list($telemetry.dryRunPendingSegments)); duplicate raw recipient records=\(n($telemetry.dryRunDuplicateRecipients)).",
        "Approval required: \(if ($approval.approvalRequired // $telemetry.sendApprovalRequired // false) then "yes, do not send until explicit operator approval" else "no pending send" end).",
        "Next actions: \((($approval.nextActions // []) | map((.priority // "next") + ":" + (.id // "review")) | join(", ")) // "monitor_activation_queue").",
        "",
        "Pre-send recovery proof:",
        "- Current bottleneck: \($next_action.metric // "unknown") — \(if (($recovery_proof.stage // "") == "verified_handoff_waiting_for_fresh_traffic" and ($approval.status // "") == "approval_required" and (($next_action.evidence.nonGatedSetupCopyFallback // false) | not)) then "Recovery handoff is verified with no persistence; the next blocker is explicit operator approval for segment \"\($next_segment)\" or fresh recovery traffic, not recovery-page code." else ($next_action.action // "Review the live launch funnel before approving any activation send.") end)",
        "- Verification command: \($next_action.evidence.recoveryDiagnosticCommand // "bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff")",
        "- Verification result: stage=\($recovery_proof.stage // "not_run"); checked=\($recovery_proof.handoffSmoke.checked // false); passed=\($recovery_proof.handoffSmoke.passed // false); noPersistence=\($recovery_proof.handoffSmoke.noPersistence // true).",
        "- Approval boundary: if the verification command does not report verified_handoff_waiting_for_fresh_traffic, hold real activation sends and inspect the recovery path first.",
        "",
        "Approval checklist:",
        (
          (($approval.decisionChecklist // []) | if length > 0 then
            map("- \(.id // "approval_gate")=\(.status // "review"): \(.detail // "")")
          else
            ["- unavailable: refresh /analytics/funnel after deploying decisionChecklist support"]
          end)[]
        ),
        "",
        "Sendable segments:",
        (segment_lines($segments; true; $dry)[]),
        "",
        "Review-only segments:",
        (segment_lines($segments; false; $dry)[]),
        "",
        "Auth repair handoff:",
        "- Status: \($auth_repair.status // "unknown"); queued=\(n($auth_repair.reviewOnlyQueued)); segments=\(list($auth_repair.reviewOnlySegments)); hydrateCandidates=\(n($auth_repair.hydrateCandidateCount)); accountLinkReview=\(n($auth_repair.accountLinkReviewQueued)); endpoint=\($auth_repair.endpoint // "/admin/customers/hydrate-auth-users").",
        "- Fallback/action boundary: \($auth_repair.noopFallbackAction // "none").",
        "- Hydrate command:",
        (if (($auth_repair.command // "") != "") then $auth_repair.command else "  not applicable: no auth signups without customer rows are queued for hydration" end),
        "- Account-link repair dry-run command:",
        (if (($auth_repair.accountLinkRepairCommand // "") != "") then $auth_repair.accountLinkRepairCommand else "  not applicable: no account-link review segment is queued" end),
        "- Account-link repair dry-run proof: stage=\($auth_repair_proof.stage // "not_run"); checked=\($auth_repair_proof.checked // false); passed=\($auth_repair_proof.passed // false); eligible=\(n($auth_repair_proof.eligible)); updated=\(n($auth_repair_proof.updated)); missingAuthCustomers=\(n($auth_repair_proof.missingAuthCustomers)); noAuthEmailMatch=\(n($auth_repair_proof.skipped.no_auth_email_match)); aggregateOnly=\($auth_repair_proof.privacy.aggregateOnly // true).",
        "- Auth repair approval boundary: if the dry run fails or reports eligible rows, hold broader sends until the bounded customer review or explicit repair path is reviewed; if eligible=0, keep review-only rows excluded from activation sends.",
        "- Bounded auth review command:",
        (if (($auth_repair.reviewCommand // "") != "") then $auth_repair.reviewCommand else "  unavailable: no bounded auth review command returned by /analytics/funnel" end),
        "",
        "Primary recovery CTA: \($followups.primaryCtaUrl // $packet.recoveryUrls.setupKeyRecovery // $packet.recoveryUrls.passwordFallback // "https://sagerouter.dev/setup-key-recovery?utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery").",
        "Success metric: \($followups.successMetric // $packet.telemetry.successMetric // "Move no-key signups into generated-key accounts, then first routed request.")",
        "",
        "Safe command handoff:",
        "- Re-run the segment dry-run before approval:",
        (if $next_dry_run_command != "" then $next_dry_run_command else "  unavailable: no segment dry-run command returned by /analytics/funnel" end),
        "- After explicit approval, run the typed-confirmation send command for this segment:",
        (if $next_send_command != "" then $next_send_command else "  unavailable: no segment send command returned by /analytics/funnel" end),
        "- This printed command still requires SAGE_ROUTER_API_KEY in the shell, a fresh approvalPacketIssuedAt, and sendConfirmation=SEND_ACTIVATION_FOLLOWUPS in the request body.",
        "",
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); promptsStored=\($root.privacy.promptsStored // false)."
      ]
      | .[]
  ' "$tmp"
  exit 0
fi

if [[ "$FOUNDER_SALES_PACKET" == "1" ]]; then
  jq -r '
    def n($v): ($v // 0);
    def money($v): "$" + ((n($v) | tostring));
    def pct($v): if $v == null then "n/a" else (($v * 10000 | round) / 100 | tostring) + "%" end;
    def buckets($v):
      (($v // {}) | to_entries | map(select(.value != 0) | "\(.key)=\(.value)")) as $rows
      | if ($rows | length) > 0 then ($rows | join(", ")) else "none" end;

    . as $root
    | ($root.stages // {}) as $stages
    | ($root.mrr // {}) as $mrr
    | ($root.marketingIntent // {}) as $marketing
    | (($mrr.planRevenueActions // [])[0] // {}) as $primaryRevenue
    | (($mrr.planRevenueActions // []) | map(select((.plan // "") == "lite")) | .[0] // {}) as $liteRevenue
    | (($mrr.planRevenueActions // []) | map(select((.plan // "") == "max")) | .[0] // {}) as $maxRevenue
    | [
        "Sage Router founder-sales next-revenue packet",
        "Boundary: no emails, customer IDs, generated API keys, OAuth tokens, provider credentials, private funnel rows, prompts, raw campaign URLs, raw model search text, raw provider responses, private provider costs, or provider authorization evidence are printed.",
        "Effect: read-only outreach packet; this command does not approve sends, send email, mutate customer records, mutate Cloudflare, write secrets, change prices, acknowledge provider terms, enable managed resale, or copy generated keys.",
        "",
        "$10k MRR snapshot:",
        "- Estimated MRR: \(money($mrr.estimatedCurrentMrrUsd)) / \(money($mrr.targetMrrUsd)) target (\(pct($mrr.targetAttainment))).",
        "- Paid customers: \(n($stages.paidCustomers)); generated-key customers: \(n($stages.customersWithGeneratedApiKeys)); first routed request customers: \(n($stages.customersWithFirstRoutedRequest)).",
        "- Setup snippet copies: \(n($stages.setupSnippetCopies)); founder-sales outreach copies: \(n($marketing.founderSalesOutreachCopies)); snippets=\(buckets($marketing.founderSalesOutreachCopiesBySnippet)).",
        "- Managed-access packet copies: \(n($marketing.managedAccessPacketCopies)); snippets=\(buckets($marketing.managedAccessPacketCopiesBySnippet)).",
        "",
        "Prioritized revenue motions:",
        "- Primary: \($primaryRevenue.plan // "pro") needs \(n($primaryRevenue.customerGap)) customer(s), \(money($primaryRevenue.remainingMrrToTargetUsd)) remaining MRR. \($primaryRevenue.action // "Use direct founder-sales follow-up to move qualified prospects into generated-key activation.")",
        "- Lite pilot: \(n($liteRevenue.customerGap)) Lite customer(s), \(money($liteRevenue.remainingMrrToTargetUsd)) remaining MRR. Use one-agent evaluation and low-friction hosted key trials.",
        "- Max review: \(n($maxRevenue.customerGap)) Max customer(s), \(money($maxRevenue.remainingMrrToTargetUsd)) remaining MRR. Use Max implementation review for teams with production agents, Tailnet/local routing, or gateway migration pain.",
        "",
        "Copyable next-revenue packet:",
        "Sage Router may fit your agent/model routing work if you want one OpenAI-compatible endpoint with health-aware fallback, generated Sage keys, and route profiles for frontier/local/coding traffic.",
        "",
        "Fastest path:",
        "1. Create a Pro generated key, then verify /v1/models:",
        "https://app.sagerouter.dev/account.html?plan=pro&start=create_key&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-next-revenue-packet",
        "",
        "2. Copy the 60-second setup:",
        "https://sagerouter.dev/quickstart?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-next-revenue-packet",
        "",
        "Lite pilot for one-agent evaluations:",
        "https://app.sagerouter.dev/account.html?plan=lite&start=create_key&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-lite-pilot",
        "",
        "Max implementation review for production/team workflows:",
        "https://sagerouter.dev/managed-access?intent=max-implementation&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-max-review",
        "",
        "One-subscription review without assuming public bundled resale is enabled:",
        "https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-one-subscription-review",
        "",
        "Boundary: Sage Router is routing, generated-key, quota, analytics, and reliability infrastructure for provider/local access the customer is authorized to use. Public managed-provider access remains gated behind provider authorization, terms, cost model, unit economics, quotas, and acceptable-use controls.",
        "",
        "Operator use:",
        "- Use one no-secret snippet per warm conversation; do not paste private funnel rows or raw customer/provider artifacts into outreach.",
        "- Track success by founderSalesOutreachCopies, setupSnippetCopies, generated-key customers, first routed requests, paid customers, and managed-access review requests.",
        "- Use /founder-sales-kit for browser copy telemetry when possible; use this packet when the operator needs a terminal-only handoff.",
        "",
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); containsActualProviderCosts=false; containsAuthorizationReference=false; promptsStored=\($root.privacy.promptsStored // false)."
      ]
      | .[]
  ' "$tmp"
  exit 0
fi

if [[ "$RAW_JSON" == "1" ]]; then
  jq '{
    generatedAt,
    stages,
    rates,
    mrr,
    nextBestAction,
    activationFollowUps: (
      .activationFollowUps
      | if type == "object" then
          del(
            .emailReadiness.dryRunCommand,
            .emailReadiness.sendCommandTemplate,
            .emailReadiness.setupCommand
          )
        else . end
    ),
    operatorExecutionPacket: (
      .operatorExecutionPacket
      | if type == "object" then
          del(
            .draft.body,
            .emailReadiness.dryRunCommand,
            .emailReadiness.sendCommandTemplate,
            .emailReadiness.setupCommand
          )
        else . end
    ),
    activationApprovalReadiness: (.activationApprovalReadiness // {
      status: (
        if ((.operatorExecutionPacket.sendTelemetry.sendApprovalRequired // false) == true) then "approval_required"
        elif ((.operatorExecutionPacket.sendTelemetry.dryRunVerified // false) == false and (.operatorExecutionPacket.sendableQueued // 0) > 0) then "dry_run_required"
        else "unknown"
        end
      ),
      approvalRequired: (.operatorExecutionPacket.sendTelemetry.sendApprovalRequired // false),
      dryRunVerified: (.operatorExecutionPacket.sendTelemetry.dryRunVerified // false),
      blockedReason: (
        if ((.operatorExecutionPacket.sendableQueued // 0) <= 0) then "no_sendable_segments"
        elif ((.operatorExecutionPacket.sendTelemetry.dryRunVerified // false) == false) then "dry_run_not_verified"
        elif ((.operatorExecutionPacket.sendTelemetry.sendApprovalRequired // false) == true) then "explicit_operator_approval_required"
        else ""
        end
      ),
      nextSendSegment: (.operatorExecutionPacket.sendTelemetry.nextSendSegment // ""),
      approvalPacketIssuedAt: (.operatorExecutionPacket.emailReadiness.approvalPacketIssuedAt // 0),
      approvalPacketExpiresAt: (.operatorExecutionPacket.emailReadiness.approvalPacketExpiresAt // 0),
      approvalPacketValidSeconds: (.operatorExecutionPacket.emailReadiness.approvalPacketValidSeconds // 0),
      approvalPacketRequiredForRealSend: (.operatorExecutionPacket.emailReadiness.approvalPacketRequiredForRealSend // true),
      totalQueued: (.operatorExecutionPacket.totalQueued // .activationFollowUps.total // 0),
      sendableQueued: (.operatorExecutionPacket.sendableQueued // .activationFollowUps.sendableQueued // 0),
      reviewOnlyQueued: (.operatorExecutionPacket.reviewOnlyQueued // .activationFollowUps.reviewOnlyQueued // 0),
      unknownQueued: (.activationFollowUps.unknownQueued // 0),
      dryRunRecipients: (.operatorExecutionPacket.sendTelemetry.dryRunRecipients // 0),
      dryRunCoveredSegments: (.operatorExecutionPacket.sendTelemetry.dryRunCoveredSegments // []),
      dryRunPendingSegments: (.operatorExecutionPacket.sendTelemetry.dryRunPendingSegments // []),
      sentRecipients: (.operatorExecutionPacket.sendTelemetry.sentRecipients // 0),
      failedRecipients: (.operatorExecutionPacket.sendTelemetry.failedRecipients // 0),
      nextActions: (
        [
          if ((.operatorExecutionPacket.sendableQueued // 0) > 0 and (.operatorExecutionPacket.sendTelemetry.dryRunVerified // false) == false) then {
            id: "dry_run_activation_followups",
            priority: "fix_now",
            owner: "Activation"
          } else empty end,
          if ((.operatorExecutionPacket.sendableQueued // 0) > 0 and (.operatorExecutionPacket.sendTelemetry.dryRunVerified // false) == true and (.operatorExecutionPacket.sendTelemetry.sendApprovalRequired // false) == true) then {
            id: "approve_activation_followups",
            priority: "fix_now",
            owner: "Operator"
          } else empty end,
          if ((.operatorExecutionPacket.reviewOnlyQueued // .activationFollowUps.reviewOnlyQueued // 0) > 0) then {
            id: "review_auth_repair_segments",
            priority: "next",
            owner: "Activation"
          } else empty end
        ]
      ),
      privacy: {
        containsEmails: false,
        containsCustomerIds: false,
        containsApiKeys: false,
        containsProviderCredentials: false,
        aggregateOnly: true
      }
    }),
    managedAccessDemand: (.managedAccessDemand // {}),
    anonymousManagedAccessDemand: (.anonymousManagedAccessDemand // {}),
    waitlistManagedAccessDemand: (.waitlistManagedAccessDemand // {}),
    managedProviderReadiness: (
      (
        .managedProviderReadiness
        // {
          enabled: (.pricing.publicLaunch.managedProviderAccess.enabled // false),
          requested: (.pricing.publicLaunch.managedProviderAccess.requested // false),
          readinessSatisfied: (.pricing.publicLaunch.managedProviderAccess.readinessSatisfied // false),
          status: (.pricing.publicLaunch.managedProviderAccess.status // "unknown"),
          missingControls: (.pricing.publicLaunch.managedProviderAccess.missingControls // []),
          nextActions: (.pricing.publicLaunch.managedProviderAccess.nextActions // []),
          allowedProviderFamilies: (.pricing.publicLaunch.managedProviderAccess.allowedProviderFamilies // []),
          resaleEligibleProviderFamilies: (.pricing.publicLaunch.managedProviderAccess.resaleEligibleProviderFamilies // []),
          byokOnlyProviderFamilies: (.pricing.publicLaunch.managedProviderAccess.byokOnlyProviderFamilies // []),
          providerAuthorizationEvidenceConfigured: (.pricing.publicLaunch.managedProviderAccess.providerAuthorizationEvidenceConfigured // false),
          providerTermsAcknowledged: (.pricing.publicLaunch.managedProviderAccess.providerTermsAcknowledged // false),
          unitEconomics: {
            costModelConfigured: (.pricing.publicLaunch.managedProviderAccess.unitEconomics.costModelConfigured // false),
            satisfied: (.pricing.publicLaunch.managedProviderAccess.unitEconomics.satisfied // false)
          },
          oneSubscriptionReadiness: (.pricing.publicLaunch.managedProviderAccess.oneSubscriptionReadiness // {}),
          readinessSetup: {
            setupScript: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.setupScript // "scripts/configure_managed_provider_resale_readiness.sh"),
            setupCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.setupCommand // ""),
            stagePublicControlsCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.stagePublicControlsCommand // "scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls"),
            dryRunCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.dryRunCommand // "scripts/configure_managed_provider_resale_readiness.sh --check"),
            termsApprovalCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.termsApprovalCommand // "scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet"),
            authorizationPacketCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.authorizationPacketCommand // "scripts/configure_managed_provider_resale_readiness.sh --authorization-packet"),
            authorizationLedgerTemplateCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.authorizationLedgerTemplateCommand // "scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template"),
            providerOutreachCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.providerOutreachCommand // "scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet"),
            oneSubscriptionPricingCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.oneSubscriptionPricingCommand // "scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet"),
            unitEconomicsCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.unitEconomicsCommand // "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics"),
            enableCommandTemplate: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.enableCommandTemplate // ""),
            requiredEnv: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.requiredEnv // []),
            secretManagerNames: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.secretManagerNames // []),
            requiresExplicitPublicEnableEnv: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.requiresExplicitPublicEnableEnv // "SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC"),
            operatorAction: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.operatorAction // "Keep managed provider access disabled until provider authorization, allowlist, and unit economics pass."),
            privacy: {
              containsSecrets: false,
              containsProviderCredentials: false,
              containsActualProviderCosts: false
            }
          },
          privacy: {
            containsSecrets: false,
            containsProviderCredentials: false,
            containsActualProviderCosts: false
          }
        }
      )
      | .readinessSetup = ((.readinessSetup // {}) + {
          setupScript: (.readinessSetup.setupScript // "scripts/configure_managed_provider_resale_readiness.sh"),
          stagePublicControlsCommand: (if ((.readinessSetup.stagePublicControlsCommand // "") != "") then .readinessSetup.stagePublicControlsCommand else "scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls" end),
          dryRunCommand: (if ((.readinessSetup.dryRunCommand // "") != "") then .readinessSetup.dryRunCommand else "scripts/configure_managed_provider_resale_readiness.sh --check" end),
          termsApprovalCommand: (if ((.readinessSetup.termsApprovalCommand // "") != "") then .readinessSetup.termsApprovalCommand else "scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet" end),
          authorizationPacketCommand: (if ((.readinessSetup.authorizationPacketCommand // "") != "") then .readinessSetup.authorizationPacketCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-packet" end),
          authorizationLedgerTemplateCommand: (if ((.readinessSetup.authorizationLedgerTemplateCommand // "") != "") then .readinessSetup.authorizationLedgerTemplateCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template" end),
          providerOutreachCommand: (if ((.readinessSetup.providerOutreachCommand // "") != "") then .readinessSetup.providerOutreachCommand else "scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet" end),
          oneSubscriptionPricingCommand: (if ((.readinessSetup.oneSubscriptionPricingCommand // "") != "") then .readinessSetup.oneSubscriptionPricingCommand else "scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet" end),
          unitEconomicsCommand: (if ((.readinessSetup.unitEconomicsCommand // "") != "") then .readinessSetup.unitEconomicsCommand else "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics" end)
        })
      | .nextActions = (
          if ((.nextActions // []) | length) > 0 then .nextActions else ((.missingControls // []) | to_entries | map({
            id: .value,
            title: (.value | gsub("_"; " ")),
            priority: (if .key == 0 then "fix_now" else "next" end),
            secretFree: true,
            publicSafe: true,
            privacy: {
              containsSecrets: false,
              containsProviderCredentials: false,
              containsActualProviderCosts: false,
              containsAuthorizationReference: false
            }
          })) end
        )
    ),
    activationQueue: {
      total: (
        .operatorExecutionPacket.totalQueued
        // .activationFollowUps.total
        // .nextBestAction.evidence.noKeyFollowUpsQueued
        // 0
      ),
      sendableQueued: (
        .operatorExecutionPacket.sendableQueued
        // .activationFollowUps.sendableQueued
        // .nextBestAction.evidence.sendableQueued
        // 0
      ),
      reviewOnlyQueued: (
        .operatorExecutionPacket.reviewOnlyQueued
        // .activationFollowUps.reviewOnlyQueued
        // .nextBestAction.evidence.reviewOnlyQueued
        // 0
      ),
      unknownQueued: (
        .activationFollowUps.unknownQueued
        // .nextBestAction.evidence.unknownQueued
        // 0
      ),
      sendableSegments: (
        .activationFollowUps.sendableSegments
        // .nextBestAction.evidence.sendableSegments
        // []
      ),
      reviewOnlySegments: (
        .activationFollowUps.reviewOnlySegments
        // .nextBestAction.evidence.reviewOnlySegments
        // []
      ),
      dryRunRecipients: (.operatorExecutionPacket.sendTelemetry.dryRunRecipients // 0),
      dryRunRecordedRecipients: (.operatorExecutionPacket.sendTelemetry.dryRunRecordedRecipients // .operatorExecutionPacket.sendTelemetry.dryRunRecipients // 0),
      dryRunDuplicateRecipients: (.operatorExecutionPacket.sendTelemetry.dryRunDuplicateRecipients // 0),
      dryRunCoveredSegments: (.operatorExecutionPacket.sendTelemetry.dryRunCoveredSegments // []),
      dryRunPendingSegments: (.operatorExecutionPacket.sendTelemetry.dryRunPendingSegments // []),
      sentRecipients: (.operatorExecutionPacket.sendTelemetry.sentRecipients // 0),
      sendApprovalRequired: (.operatorExecutionPacket.sendTelemetry.sendApprovalRequired // false),
      nextSendSegment: (.operatorExecutionPacket.sendTelemetry.nextSendSegment // "")
    },
    acquisitionActions: (.acquisitionActions // [])[0:8],
    privacy
  }' "$tmp"
  exit 0
fi

jq -r --arg days "$DAYS" --slurpfile recoveryProof "$recovery_tmp" '
  def n($v): ($v // 0);
  def pct($v): if $v == null then "n/a" else (($v * 10000 | round) / 100 | tostring) + "%" end;
  def money($v): "$" + ((n($v) | tostring));
  def list($v): if (($v // []) | length) > 0 then (($v // []) | join(", ")) else "none" end;
  def buckets($v):
    (($v // {}) | to_entries | map(select(.value != 0) | "\(.key)=\(.value)")) as $rows
    | if ($rows | length) > 0 then ($rows | join(", ")) else "none" end;

  . as $root
  | (($recoveryProof[0] // {})) as $recovery_proof
  | ($root.stages // {}) as $stages
  | ($root.rates // {}) as $rates
  | ($root.mrr // {}) as $mrr
  | ($root.nextBestAction // {}) as $action
  | ($root.marketingIntent // {}) as $marketing
  | ($marketing.events // {}) as $events
  | ($root.managedProviderReadiness // $root.pricing.publicLaunch.managedProviderAccess // {}) as $managed
  | ($root.managedAccessDemand // {}) as $managedDemand
  | ($root.activationFollowUps // {}) as $followups
  | ($root.operatorExecutionPacket // {}) as $packet
  | ($root.activationApprovalReadiness // {}) as $approval
  | (($mrr.planRevenueActions // [])[0] // {}) as $primaryRevenue
  | (($mrr.planRevenueActions // []) | map(select((.plan // "") == "lite")) | .[0] // {}) as $liteRevenue
  | (($mrr.planRevenueActions // []) | map(select((.plan // "") == "max")) | .[0] // {}) as $maxRevenue
  | [
      "# Sage Router launch funnel snapshot",
      "",
      "- Window: last \($days) days",
      "- Generated at epoch: \(n($root.generatedAt))",
      "- Marketing intent events: \(n($stages.marketingIntentEvents))",
      "- Setup snippet copies: \(n($stages.setupSnippetCopies))",
      "- Founder-sales outreach copies: \(n($marketing.founderSalesOutreachCopies))",
      "- Founder-sales outreach snippets: \(buckets($marketing.founderSalesOutreachCopiesBySnippet))",
      "- Managed-access packet copies: \(n($marketing.managedAccessPacketCopies))",
      "- Managed-access packet snippets: \(buckets($marketing.managedAccessPacketCopiesBySnippet))",
      "- Recovery auth starts: magic=\(n($events.login_key_recovery_magic_link_requested) + n($events.setup_key_recovery_magic_link_requested)), password=\(n($events.login_key_recovery_password_submitted)), oauth=\(n($events.login_key_recovery_oauth_clicked))",
      "- Key-first recovery: setupClicks=\(n($events.login_key_recovery_account_setup_clicked) + n($events.setup_key_recovery_account_clicked) + n($events.setup_key_recovery_next_account_clicked)); redirects=\(n($followups.keyFirstRedirects)); recoveryViews=\(n($followups.keyRecoveryViews)); keyCreateAttempts=\(n($followups.keyCreateAttempts)); keyCreateSuccesses=\(n($followups.keyCreateSuccesses)); noKeyCreateClicks=\(n($events.account_no_key_setup_create_clicked))",
      "- Managed-access demand: anonymousSignals=\(n($stages.anonymousManagedAccessInterest)); waitlistSignals=\(n($stages.managedAccessBetaInterest)); legacyClicks=\(n($events.managed_access_interest_clicked)); quickStarted=\(n($events.managed_access_quick_form_started)); quickValidationFailed=\(n($events.managed_access_quick_request_validation_failed)); quickSubmitted=\(n($events.managed_access_quick_request_submitted)); quickReceived=\(n($events.managed_access_quick_request_received))",
      "- Managed-access provider buckets: \(buckets($managedDemand.targetProviderFamily))",
      "- Managed-access commercial buckets: \(buckets($managedDemand.commercialPreference))",
      "- Managed-access intent buckets: \(buckets($managedDemand.intent))",
      "- Signups: \(n($stages.signups))",
      "- Generated-key customers: \(n($stages.customersWithGeneratedApiKeys))",
      "- First-routed-request customers: \(n($stages.customersWithFirstRoutedRequest))",
      "- Paid customers: \(n($stages.paidCustomers))",
      "- Estimated MRR: \(money($mrr.estimatedCurrentMrrUsd)) / \(money($mrr.targetMrrUsd)) target (\(pct($mrr.targetAttainment)))",
      "",
      "## Current Bottleneck",
      "",
      "- Metric: \($action.metric // "unknown")",
      "- Priority: \($action.priority // "unknown")",
      "- Owner/surface: \($action.owner // "unknown") / \($action.surface // "unknown")",
      "- Action: \(if (($recovery_proof.stage // "") == "verified_handoff_waiting_for_fresh_traffic" and ($approval.status // "") == "approval_required" and (($action.evidence.nonGatedSetupCopyFallback // false) | not)) then "Recovery handoff is verified with no persistence; the next blocker is explicit operator approval for the next sendable follow-up or fresh recovery traffic, not recovery-page code." else ($action.action // "Review the live launch funnel.") end)",
      "- Success metric: \($action.successMetric // "Improve the next funnel stage.")",
      "- CTA: \($action.ctaPath // "https://app.sagerouter.dev/launch-funnel.html")",
      "",
      "## Activation Queue",
      "",
      "- Total no-key follow-ups: \(n($followups.total))",
      "- Sendable queued: \(n($packet.sendableQueued // $action.evidence.sendableQueued))",
      "- Review-only queued: \(n($packet.reviewOnlyQueued // $action.evidence.reviewOnlyQueued))",
      "- Unknown queued: \(n($action.evidence.unknownQueued))",
      "- Dry-run unique sendable recipients: \(n($packet.sendTelemetry.dryRunRecipients))",
      "- Dry-run raw recorded recipients: \(n($packet.sendTelemetry.dryRunRecordedRecipients // $packet.sendTelemetry.dryRunRecipients))",
      "- Dry-run duplicate recipient records: \(n($packet.sendTelemetry.dryRunDuplicateRecipients))",
      "- Dry-run covered segments: \(list($packet.sendTelemetry.dryRunCoveredSegments))",
      "- Dry-run pending segments: \(list($packet.sendTelemetry.dryRunPendingSegments))",
      "- Real sends recorded: \(n($packet.sendTelemetry.sentRecipients))",
      "- Send approval required: \($packet.sendTelemetry.sendApprovalRequired // false)",
      "- Approval readiness: \($approval.status // "unknown") (blockedReason=\($approval.blockedReason // ""))",
      "- Approval next actions: \((($approval.nextActions // [])[0:3]) | map((.priority // "next") + ":" + (.id // "review")) | join(", "))",
      "- Recommended send segments: \(list($action.evidence.sendableSegments))",
      "- Review-only segments: \(list($action.evidence.reviewOnlySegments))",
      "",
      "## Activation Approval Handoff",
      "",
      "- Packet command: scripts/summarize_sagerouter_launch_funnel.sh --days \($days) --approval-packet --verify-recovery --verify-auth-repair",
      "- Review worksheet: docs/launch/execution/activation-approval-review.md",
      "- Approval decision: \($approval.status // "unknown") for next segment \($packet.sendTelemetry.nextSendSegment // "all"); blocker=\($approval.blockedReason // "none").",
      "- Default snapshot policy: No send command is printed in this default snapshot. Real activation sends still require explicit operator approval and typed SEND_ACTIVATION_FOLLOWUPS confirmation.",
      "- Safe review: the approval packet is no-secret and excludes emails, customer IDs, generated keys, prompts, OAuth tokens, provider credentials, and raw responses.",
      "",
      "## Verified Recovery Diagnosis",
      "",
      "- Command: bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff",
      "- Result: \($recovery_proof.stage // "not_run")",
      "- Interpretation: \(if (($recovery_proof.stage // "") == "verified_handoff_waiting_for_fresh_traffic") then "Recovery handoff is verified with no persistence; the remaining activation work is fresh setup-copy traffic or explicit operator approval for real follow-up sends." elif (($recovery_proof.stage // "") == "failed") then "Recovery handoff verification failed; hold real activation sends and inspect setup-key recovery." else "Recovery handoff verification has not produced a final send-ready diagnosis yet." end)",
      "- Evidence: checked=\($recovery_proof.handoffSmoke.checked // false); passed=\($recovery_proof.handoffSmoke.passed // false); noPersistence=\($recovery_proof.handoffSmoke.noPersistence // true); recoveryViews=\(n($followups.keyRecoveryViews)); accountHandoffs=\(n($followups.keyFirstRedirects)); keyCreateAttempts=\(n($followups.keyCreateAttempts)); keyCreateSuccesses=\(n($followups.keyCreateSuccesses)).",
      "- Next action: \(if (($action.evidence.nonGatedSetupCopyFallback // false) == true) then "Copy the no-secret first-request setup bundle from https://app.sagerouter.dev/launch-funnel.html#next-best-action-dock before any real activation send; this records status_first_request_setup_copied with snippet operator-first-request-setup and does not send email or expose a real key." elif (($recovery_proof.stage // "") == "verified_handoff_waiting_for_fresh_traffic") then "Use the no-secret approval packet for the next sendable activation follow-up or wait for fresh real recovery traffic." elif (($recovery_proof.stage // "") == "failed") then "Hold real activation sends and inspect the recovery handoff smoke failure." else "Follow the recovery diagnosis before approving any real activation send." end)",
      "",
      "## Top Acquisition Actions",
      (
        (($root.acquisitionActions // [])[0:5])
        | map("- \(.kind)/\(.bucket): \(n(.clicks)) clicks - \(.action)")
        | .[]
      ),
      "",
      "## Revenue Gap",
      (
        (($mrr.planRevenueActions // [])[0:3])
        | map("- \(.plan): \(n(.customerGap)) customers, \(money(.remainingMrrToTargetUsd)) remaining MRR - \(.action)")
        | .[]
      ),
      "",
      "## Founder Sales Fallback",
      "",
      "- Use when: activation sends are approval-gated or provider resale is waiting on terms/evidence, but founder-led Lite/Pro/Max conversations can still move.",
      "- Kit: https://sagerouter.dev/founder-sales-kit?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch",
      "- Outreach copies recorded: \(n($marketing.founderSalesOutreachCopies)); snippets: \(buckets($marketing.founderSalesOutreachCopiesBySnippet))",
      "- Managed-access packet copies recorded: \(n($marketing.managedAccessPacketCopies)); snippets: \(buckets($marketing.managedAccessPacketCopiesBySnippet))",
      "- Primary revenue motion: \($primaryRevenue.plan // "pro") needs \(n($primaryRevenue.customerGap)) customers and \(money($primaryRevenue.remainingMrrToTargetUsd)) remaining MRR; \($primaryRevenue.action // "Use direct founder-sales follow-up to move qualified prospects into generated-key activation.")",
      "- Lite pilot motion: \(n($liteRevenue.customerGap)) Lite customers and \(money($liteRevenue.remainingMrrToTargetUsd)) remaining MRR; use the Lite pilot snippet for one-agent evaluations and low-friction hosted key trials.",
      "- Max review motion: \(n($maxRevenue.customerGap)) Max customers and \(money($maxRevenue.remainingMrrToTargetUsd)) remaining MRR; use the Max implementation snippet for teams with production agents, Tailnet/local routing, or gateway migration pain.",
      "- Safety rule: use one no-secret snippet per warm conversation; do not paste prompts, provider credentials, generated keys, customer data, private funnel rows, OAuth tokens, or raw provider responses.",
      "",
      "## Managed Access Readiness",
      "",
      "- Enabled/requested/ready: \($managed.enabled // false) / \($managed.requested // false) / \($managed.readinessSatisfied // false)",
      "- Status: \($managed.status // "unknown")",
      "- Missing controls: \(list($managed.missingControls))",
      "- Next managed actions: \((if (($managed.nextActions // []) | length) > 0 then $managed.nextActions else (($managed.missingControls // []) | to_entries | map({id: .value, priority: (if .key == 0 then "fix_now" else "next" end)})) end)[0:3] | map((.priority // "next") + ":" + (.id // .title // "review")) | join(", "))",
      "- Allowed provider families: \(list($managed.allowedProviderFamilies))",
      "- One-subscription ready families: \(list($managed.oneSubscriptionReadiness.readyProviderFamilies))",
      "- One-subscription blocked families: \(list($managed.oneSubscriptionReadiness.blockedProviderFamilies))",
      "- Terms acknowledged: \($managed.providerTermsAcknowledged // false)",
      "- Authorization evidence configured: \($managed.providerAuthorizationEvidenceConfigured // false)",
      "- Cost model configured: \($managed.unitEconomics.costModelConfigured // false); unit economics satisfied: \($managed.unitEconomics.satisfied // false)",
      "- Public-control staging command: \($managed.readinessSetup.stagePublicControlsCommand // "scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls")",
      "- Provider outreach packet: \(if (($managed.readinessSetup.providerOutreachCommand // "") != "") then $managed.readinessSetup.providerOutreachCommand else "scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet" end)",
      "- Authorization evidence packet: \(if (($managed.readinessSetup.authorizationPacketCommand // "") != "") then $managed.readinessSetup.authorizationPacketCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-packet" end)",
      "- Authorization ledger template: \(if (($managed.readinessSetup.authorizationLedgerTemplateCommand // "") != "") then $managed.readinessSetup.authorizationLedgerTemplateCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template" end)",
      "- One-subscription pricing packet: \(if (($managed.readinessSetup.oneSubscriptionPricingCommand // "") != "") then $managed.readinessSetup.oneSubscriptionPricingCommand else "scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet" end)",
      "- One-subscription pricing review: docs/launch/execution/one-subscription-pricing-review.md",
      "- Unit-economics preflight: \(if (($managed.readinessSetup.unitEconomicsCommand // "") != "") then $managed.readinessSetup.unitEconomicsCommand else "SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics" end)",
      "- Managed-access beta interest: \(n($stages.managedAccessBetaInterest)); anonymous interest: \(n($stages.anonymousManagedAccessInterest)); target-provider buckets: \(buckets($managedDemand.targetProviderFamily)); commercial buckets: \(buckets($managedDemand.commercialPreference)); intent buckets: \(buckets($managedDemand.intent))",
      "",
      "## Privacy",
      "",
      "- Contains emails: \($root.privacy.containsEmails // false)",
      "- Contains API keys: \($root.privacy.containsApiKeys // false)",
      "- Contains provider credentials: \($root.privacy.containsProviderCredentials // false)",
      "- Prompts stored: \($root.privacy.promptsStored // false)"
    ]
    | .[]
' "$tmp"
