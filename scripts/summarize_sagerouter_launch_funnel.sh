#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/summarize_sagerouter_launch_funnel.sh [--days N] [--json] [--approval-packet]

Fetch the operator-only /analytics/funnel endpoint and print a privacy-safe
launch snapshot. The script never prints operator tokens, emails, generated API
keys, prompts, provider credentials, OAuth tokens, raw campaign URLs, or raw
provider responses.

Options:
  --json              Print the bounded machine-readable snapshot.
  --approval-packet   Print the no-secret activation send approval packet only.

Environment:
  SAGEROUTER_SECRET_ENV_FILE       Optional env file to source first
  SAGEROUTER_API_BASE_URL          Defaults to https://api.sagerouter.dev
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

if [[ "$RAW_JSON" == "1" && "$APPROVAL_PACKET" == "1" ]]; then
  printf '%s\n' '--json and --approval-packet cannot be combined' >&2
  exit 2
fi

if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [[ "$DAYS" -lt 1 ]]; then
  printf '%s\n' '--days must be a positive integer' >&2
  exit 2
fi

require_tool curl
require_tool jq

load_local_env_file "${SAGEROUTER_SECRET_ENV_FILE:-/home/digit/.openclaw/.env}"

API_BASE="${SAGEROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
TOKEN="${SAGE_ROUTER_ANALYTICS_TOKEN:-${SAGE_ROUTER_OPERATOR_TOKEN:-${SAGE_ROUTER_API_KEY:-}}}"
if [[ -z "$TOKEN" ]]; then
  printf 'Missing SAGE_ROUTER_ANALYTICS_TOKEN, SAGE_ROUTER_OPERATOR_TOKEN, or SAGE_ROUTER_API_KEY\n' >&2
  exit 2
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -fsS "${API_BASE%/}/analytics/funnel?days=${DAYS}&limit=10000" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$tmp"

if [[ "$APPROVAL_PACKET" == "1" ]]; then
  jq -r '
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
    | ($root.activationFollowUps // {}) as $followups
    | ($root.operatorExecutionPacket // {}) as $packet
    | ($packet.sendTelemetry // {}) as $telemetry
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
        nextActions: []
      }) as $approval
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
        "Queued: \(n($packet.totalQueued // $followups.total)) total; \(n($packet.sendableQueued // $followups.sendableQueued)) sendable; \(n($packet.reviewOnlyQueued // $followups.reviewOnlyQueued)) review-only; \(n($followups.unknownQueued)) unknown.",
        "Dry-run: \(if $dry then "verified" else "not complete" end) for \(n($telemetry.dryRunRecipients)) unique sendable recipient(s). Sent: \(n($telemetry.sentRecipients)); failed: \(n($telemetry.failedRecipients)).",
        "Dry-run segments: covered=\(list($telemetry.dryRunCoveredSegments)); pending=\(list($telemetry.dryRunPendingSegments)); duplicate raw recipient records=\(n($telemetry.dryRunDuplicateRecipients)).",
        "Approval required: \(if ($approval.approvalRequired // $telemetry.sendApprovalRequired // false) then "yes, do not send until explicit operator approval" else "no pending send" end).",
        "Next actions: \((($approval.nextActions // []) | map((.priority // "next") + ":" + (.id // "review")) | join(", ")) // "monitor_activation_queue").",
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
        "Primary recovery CTA: \($followups.primaryCtaUrl // $packet.recoveryUrls.setupKeyRecovery // $packet.recoveryUrls.passwordFallback // "https://sagerouter.dev/setup-key-recovery?utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery").",
        "Success metric: \($followups.successMetric // $packet.telemetry.successMetric // "Move no-key signups into generated-key accounts, then first routed request.")",
        "",
        "Safe command handoff:",
        "- Re-run the segment dry-run before approval:",
        (if $next_dry_run_command != "" then $next_dry_run_command else "  unavailable: no segment dry-run command returned by /analytics/funnel" end),
        "- After explicit approval, run the typed-confirmation send command for this segment:",
        (if $next_send_command != "" then $next_send_command else "  unavailable: no segment send command returned by /analytics/funnel" end),
        "- This printed command still requires SAGE_ROUTER_API_KEY in the shell and sendConfirmation=SEND_ACTIVATION_FOLLOWUPS in the request body.",
        "",
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); promptsStored=\($root.privacy.promptsStored // false)."
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
            setupCommand: "",
            stagePublicControlsCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.stagePublicControlsCommand // "scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls"),
            dryRunCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.dryRunCommand // "scripts/configure_managed_provider_resale_readiness.sh --check"),
            unitEconomicsCommand: "",
            enableCommandTemplate: "",
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
          stagePublicControlsCommand: (.readinessSetup.stagePublicControlsCommand // "scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls"),
          dryRunCommand: (.readinessSetup.dryRunCommand // "scripts/configure_managed_provider_resale_readiness.sh --check")
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

jq -r --arg days "$DAYS" '
  def n($v): ($v // 0);
  def pct($v): if $v == null then "n/a" else (($v * 10000 | round) / 100 | tostring) + "%" end;
  def money($v): "$" + ((n($v) | tostring));
  def list($v): if (($v // []) | length) > 0 then (($v // []) | join(", ")) else "none" end;
  def buckets($v):
    (($v // {}) | to_entries | map(select(.value != 0) | "\(.key)=\(.value)")) as $rows
    | if ($rows | length) > 0 then ($rows | join(", ")) else "none" end;

  . as $root
  | ($root.stages // {}) as $stages
  | ($root.rates // {}) as $rates
  | ($root.mrr // {}) as $mrr
  | ($root.nextBestAction // {}) as $action
  | ($root.marketingIntent.events // {}) as $events
  | ($root.managedProviderReadiness // $root.pricing.publicLaunch.managedProviderAccess // {}) as $managed
  | ($root.managedAccessDemand // {}) as $managedDemand
  | ($root.activationFollowUps // {}) as $followups
  | ($root.operatorExecutionPacket // {}) as $packet
  | ($root.activationApprovalReadiness // {}) as $approval
  | [
      "# Sage Router launch funnel snapshot",
      "",
      "- Window: last \($days) days",
      "- Generated at epoch: \(n($root.generatedAt))",
      "- Marketing intent events: \(n($stages.marketingIntentEvents))",
      "- Setup snippet copies: \(n($stages.setupSnippetCopies))",
      "- Recovery auth starts: magic=\(n($events.login_key_recovery_magic_link_requested) + n($events.setup_key_recovery_magic_link_requested)), password=\(n($events.login_key_recovery_password_submitted)), oauth=\(n($events.login_key_recovery_oauth_clicked))",
      "- Managed-access anonymous interest: clicks=\(n($events.managed_access_interest_clicked)), quickSubmitted=\(n($events.managed_access_quick_request_submitted)), quickReceived=\(n($events.managed_access_quick_request_received))",
      "- Managed-access demand signals: anonymous=\(n($stages.anonymousManagedAccessInterest)); waitlist=\(n($stages.managedAccessBetaInterest))",
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
      "- Action: \($action.action // "Review the live launch funnel.")",
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
      "- Packet command: scripts/summarize_sagerouter_launch_funnel.sh --days \($days) --approval-packet",
      "- Approval decision: \($approval.status // "unknown") for next segment \($packet.sendTelemetry.nextSendSegment // "all"); blocker=\($approval.blockedReason // "none").",
      "- Default snapshot policy: No send command is printed in this default snapshot. Real activation sends still require explicit operator approval and typed SEND_ACTIVATION_FOLLOWUPS confirmation.",
      "- Safe review: the approval packet is no-secret and excludes emails, customer IDs, generated keys, prompts, OAuth tokens, provider credentials, and raw responses.",
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
      "- Managed-access beta interest: \(n($stages.managedAccessBetaInterest)); anonymous interest: \(n($stages.anonymousManagedAccessInterest)); target-provider buckets: \(buckets($managedDemand.targetProviderFamily))",
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
