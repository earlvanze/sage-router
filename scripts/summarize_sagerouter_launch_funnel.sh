#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/summarize_sagerouter_launch_funnel.sh [--days N] [--json] [--approval-packet] [--record-activation-approval-review] [--founder-sales-packet] [--record-founder-sales] [--setup-copy-packet] [--record-setup-copy] [--managed-access-dropoff-packet] [--verify-recovery] [--verify-auth-repair] [--distribution-tracker-section] [--update-distribution-tracker]

Fetch the operator-only /analytics/funnel endpoint and print a privacy-safe
launch snapshot. The script never prints operator tokens, emails, generated API
keys, prompts, provider credentials, OAuth tokens, raw campaign URLs, or raw
provider responses.

Options:
  --json              Print the bounded machine-readable snapshot.
  --approval-packet   Print the no-secret activation send approval packet only.
  --record-activation-approval-review
                      Print the activation approval packet and record one
                      aggregate status_activation_approval_packet_copied event
                      for the operator terminal review. Run only after an
                      operator actually reviews the packet; this does not
                      approve or send activation follow-ups.
  --founder-sales-packet
                      Print the no-secret founder-sales next-revenue packet
                      for direct warm outreach while sends/resale are gated.
  --record-founder-sales
                      Print the founder-sales packet and record one aggregate
                      outreach_snippet_copied event for the operator terminal
                      handoff. Run only after an operator actually uses or
                      shares the packet.
  --setup-copy-packet
                      Print the no-secret first-request setup-copy activation
                      packet for terminal operators.
  --record-setup-copy Print the setup-copy packet and record one aggregate
                      status_first_request_setup_copied event for the
                      operator terminal handoff.
  --managed-access-dropoff-packet
                      Print the no-secret managed-access contact-capture
                      drop-off diagnosis packet for terminal operators.
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
  SAGEROUTER_APP_BASE_URL          Defaults to https://app.sagerouter.dev
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
      SAGEROUTER_API_BASE_URL|SAGEROUTER_APP_BASE_URL|SAGE_ROUTER_ANALYTICS_TOKEN|SAGE_ROUTER_OPERATOR_TOKEN|SAGE_ROUTER_API_KEY)
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
RECORD_ACTIVATION_APPROVAL_REVIEW=0
FOUNDER_SALES_PACKET=0
RECORD_FOUNDER_SALES=0
SETUP_COPY_PACKET=0
RECORD_SETUP_COPY=0
MANAGED_ACCESS_DROPOFF_PACKET=0
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
    --record-activation-approval-review)
      RECORD_ACTIVATION_APPROVAL_REVIEW=1
      shift
      ;;
    --founder-sales-packet)
      FOUNDER_SALES_PACKET=1
      shift
      ;;
    --record-founder-sales)
      RECORD_FOUNDER_SALES=1
      shift
      ;;
    --setup-copy-packet)
      SETUP_COPY_PACKET=1
      shift
      ;;
    --record-setup-copy)
      RECORD_SETUP_COPY=1
      shift
      ;;
    --managed-access-dropoff-packet)
      MANAGED_ACCESS_DROPOFF_PACKET=1
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

if (( RAW_JSON + APPROVAL_PACKET + RECORD_ACTIVATION_APPROVAL_REVIEW + FOUNDER_SALES_PACKET + RECORD_FOUNDER_SALES + SETUP_COPY_PACKET + RECORD_SETUP_COPY + MANAGED_ACCESS_DROPOFF_PACKET + TRACKER_SECTION + UPDATE_TRACKER > 1 )); then
  printf '%s\n' '--json, --approval-packet, --record-activation-approval-review, --founder-sales-packet, --record-founder-sales, --setup-copy-packet, --record-setup-copy, --managed-access-dropoff-packet, --distribution-tracker-section, and --update-distribution-tracker cannot be combined' >&2
  exit 2
fi
if [[ "$VERIFY_RECOVERY" == "1" && "$APPROVAL_PACKET" != "1" && "$RECORD_ACTIVATION_APPROVAL_REVIEW" != "1" ]]; then
  printf '%s\n' '--verify-recovery can only be used with --approval-packet or --record-activation-approval-review' >&2
  exit 2
fi
if [[ "$VERIFY_AUTH_REPAIR" == "1" && "$APPROVAL_PACKET" != "1" && "$RECORD_ACTIVATION_APPROVAL_REVIEW" != "1" ]]; then
  printf '%s\n' '--verify-auth-repair can only be used with --approval-packet or --record-activation-approval-review' >&2
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
--skip-readiness` to bundle the live funnel snapshot, setup-copy activation packet,
activation approval packet, founder-sales next-revenue packet, managed-access
drop-off packet, Cloudflare BIC reliability packet, managed-provider readiness packet,
provider terms approval packet, one-subscription pricing packet, provider outreach
packet, and provider reply triage packet without approving sends, sending email,
mutating Cloudflare,
deploying, acknowledging provider terms, enabling managed resale, or printing
secrets. Omit `--skip-readiness` when the operator packet should include the
full launch readiness probe.

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
APP_BASE="${SAGEROUTER_APP_BASE_URL:-https://app.sagerouter.dev}"
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
if [[ ("$APPROVAL_PACKET" == "1" || "$RECORD_ACTIVATION_APPROVAL_REVIEW" == "1") && "$VERIFY_RECOVERY" == "1" ]]; then
  bash scripts/diagnose_setup_key_recovery_dropoff.sh --days "$DAYS" --verify-handoff --json > "$recovery_tmp"
fi
if [[ "$APPROVAL_PACKET" != "1" && "$RECORD_ACTIVATION_APPROVAL_REVIEW" != "1" && "$RAW_JSON" != "1" && "$SETUP_COPY_PACKET" != "1" && "$RECORD_SETUP_COPY" != "1" && "$MANAGED_ACCESS_DROPOFF_PACKET" != "1" ]]; then
  if ! bash scripts/diagnose_setup_key_recovery_dropoff.sh --days "$DAYS" --verify-handoff --json > "$recovery_tmp"; then
    printf '{"stage":"failed","handoffSmoke":{"checked":true,"passed":false,"noPersistence":true},"privacy":{"aggregateOnly":true}}\n' > "$recovery_tmp"
  fi
fi

printf '{"stage":"not_run","checked":false,"passed":false,"dryRun":true,"privacy":{"aggregateOnly":true}}\n' > "$auth_repair_tmp"
if [[ ("$APPROVAL_PACKET" == "1" || "$RECORD_ACTIVATION_APPROVAL_REVIEW" == "1") && "$VERIFY_AUTH_REPAIR" == "1" ]]; then
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

if [[ "$SETUP_COPY_PACKET" == "1" || "$RECORD_SETUP_COPY" == "1" ]]; then
  plan="$(jq -r '.activationFollowUps.suggestedPlan // .nextBestAction.evidence.suggestedPlan // "pro"' "$tmp")"
  case "$plan" in
    lite|pro|max)
      ;;
    *)
      plan="pro"
      ;;
  esac
  account_url="${APP_BASE%/}/account.html?plan=${plan}&start=create_key&utm_source=operator&utm_medium=launch_funnel&utm_campaign=sage-router-launch&utm_content=operator-first-request-setup"
  source_page="${APP_BASE%/}/launch-funnel.html#next-best-action-dock"
  target_url="${APP_BASE%/}/account.html"

  cat <<EOF
Sage Router setup-copy activation packet
Boundary: no emails, customer IDs, generated API keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider responses.
Effect: no-secret terminal handoff for setup-copy activation without sending email, approving activation sends, changing billing, mutating providers, or enabling managed resale.

# Sage Router hosted setup
# 1. Create your generated setup key:
# ${account_url}
# 2. Replace the placeholder below with the one-time sk_sage key.

export OPENAI_BASE_URL=https://api.sagerouter.dev/v1
export OPENAI_API_KEY=sk_sage_your_key_here
export SAGE_ROUTER_MODEL=sage-router/frontier

curl "\$OPENAI_BASE_URL/models" \\
  -H "Authorization: Bearer \$OPENAI_API_KEY"

# Then run your first chat/completions request with sage-router/frontier.
# Boundary: do not paste real API keys, provider credentials, prompts, OAuth tokens, or customer data into public channels.

Setup-copy KPI: status_first_request_setup_copied with snippet operator-first-request-setup.
EOF

  if [[ "$RECORD_SETUP_COPY" != "1" ]]; then
    cat <<EOF

Recording command: scripts/summarize_sagerouter_launch_funnel.sh --days ${DAYS} --record-setup-copy
Recording boundary: only run that after an operator actually uses or shares this setup-copy packet; it records one aggregate event and still does not send email or expose a real key.
EOF
    exit 0
  fi

  payload="$(jq -n \
    --arg plan "$plan" \
    --arg sourcePage "$source_page" \
    --arg target "$target_url" \
    '{
      event: "status_first_request_setup_copied",
      plan: $plan,
      sourcePage: $sourcePage,
      target: $target,
      metadata: {
        sourceSurface: "launch-plan",
        source: "operator-launch-funnel-cli",
        button: "setup-copy-packet-cli",
        state: "operator_first_request_setup_copied",
        snippet: "operator-first-request-setup",
        resultCount: 1,
        utmSource: "operator",
        utmMedium: "launch_funnel",
        utmCampaign: "signup_to_key_recovery"
      }
    }')"

  curl -fsS -X POST "${APP_BASE%/}/api/funnel-event" \
    -H "Origin: ${APP_BASE%/}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: SageRouterLaunchFunnelCLI/1.0" \
    --data "$payload" \
    >/dev/null

  printf '\nRecorded setup-copy activation event status_first_request_setup_copied with snippet operator-first-request-setup from SageRouterLaunchFunnelCLI/1.0.\n'
  exit 0
fi

if [[ "$MANAGED_ACCESS_DROPOFF_PACKET" == "1" ]]; then
  jq -r --argjson days "$DAYS" '
    def n($v): ($v // 0);
    def buckets($v):
      (($v // {}) | to_entries | map(select(.value != 0) | "\(.key)=\(.value)")) as $rows
      | if ($rows | length) > 0 then ($rows | join(", ")) else "none" end;

    . as $root
    | ($root.stages // {}) as $stages
    | ($root.marketingIntent // {}) as $marketing
    | ($marketing.events // {}) as $events
    | ($root.managedAccessDemand // {}) as $managed_demand
    | ($root.managedAccessDemandConversion // {
        status: (
          if (($stages.anonymousManagedAccessInterest // 0) > 0 and ($stages.managedAccessBetaInterest // 0) <= 0) then "contact_capture_gap"
          elif (($stages.anonymousManagedAccessInterest // 0) > 0 or ($stages.managedAccessBetaInterest // 0) > 0) then "contact_capture_started"
          else "no_current_demand" end
        ),
        priority: (
          if (($stages.anonymousManagedAccessInterest // 0) > 0 and ($stages.managedAccessBetaInterest // 0) <= 0) then "fix_now"
          elif (($stages.anonymousManagedAccessInterest // 0) > 0 or ($stages.managedAccessBetaInterest // 0) > 0) then "next"
          else "monitor" end
        ),
        anonymousSignals: ($stages.anonymousManagedAccessInterest // 0),
        waitlistSignals: ($stages.managedAccessBetaInterest // 0),
        contactableLeadGap: ([ (($stages.anonymousManagedAccessInterest // 0) - ($stages.managedAccessBetaInterest // 0)), 0 ] | max),
        ctaPath: "https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=operator&utm_medium=launch_funnel&utm_campaign=managed_access_contact_capture&utm_content=anonymous-demand-to-review#managed-access-quick-form",
        action: "Convert anonymous one-subscription managed-access demand into contactable private-beta review requests before enabling managed provider resale.",
        successMetric: "managedAccessBetaInterest or managed_access_quick_request_received increases without enabling managed provider resale.",
        managedResaleEnabled: false
      }) as $conversion
    | ($events.managed_access_quick_form_presented // 0) as $presented
    | ($events.managed_access_contact_capture_landed // 0) as $landed
    | ($events.managed_access_quick_form_focused // 0) as $focused
    | ($events.managed_access_contact_draft_opened // 0) as $drafts
    | ($events.managed_access_contact_packet_copied // 0) as $contact_packets
    | ($events.managed_access_quick_form_started // 0) as $started
    | ($events.managed_access_quick_request_validation_failed // 0) as $validation_failed
    | ($events.managed_access_quick_request_submitted // 0) as $submitted
    | ($events.managed_access_quick_request_received // 0) as $received
    | ($events.managed_access_interest_clicked // 0) as $legacy_clicks
    | ($marketing.managedAccessPacketCopies // 0) as $packet_copies
    | ($conversion.anonymousSignals // $stages.anonymousManagedAccessInterest // 0) as $anonymous
    | ($conversion.waitlistSignals // $stages.managedAccessBetaInterest // 0) as $waitlist
    | ($conversion.contactableLeadGap // ([($anonymous - $waitlist), 0] | max)) as $gap
    | (
        if ($anonymous <= 0 and $waitlist <= 0 and $packet_copies <= 0) then
          "No current managed-access demand signal is visible; drive qualified one-subscription/Max traffic before changing resale controls."
        elif ($received > 0) then
          "Contact capture is working; follow up on received private-beta requests and keep provider resale disabled until authorization, terms, costs, quotas, and abuse controls pass."
        elif ($submitted > $received) then
          "Quick requests are being submitted but not counted as received; inspect the waitlist endpoint, Turnstile, and app/api routing before more traffic."
        elif ($validation_failed > 0 and $submitted <= 0) then
          "Visitors hit validation without a successful request; reduce form friction and verify Turnstile/contact-field error copy."
        elif ($presented > 0 and $landed <= 0 and ($focused + $started + $drafts + $contact_packets + $submitted + $received) <= 0) then
          "The fast form is visible, but no contact-capture landing is recorded; route operator/founder-sales CTAs to the anchored managed-access fast form."
        elif ($landed > 0 and ($focused + $started + $drafts + $contact_packets + $submitted + $received) <= 0) then
          "The fast form is being presented, but no focus or fallback action is recorded; make the operator CTA land on the fast form and tighten the first-screen request-review affordance."
        elif (($focused + $started + $drafts + $contact_packets) > 0 and $submitted <= 0) then
          "Visitors engage the fast path but do not submit; keep the email-draft and contact-packet fallbacks visible and tighten one-field completion copy."
        elif (($anonymous + $packet_copies + $legacy_clicks) > 0 and ($focused + $started + $drafts + $contact_packets + $submitted + $received) <= 0) then
          "Demand exists before the form, but no fast-form engagement is recorded; put the managed-access CTA in the operator outreach path and verify first-viewport form tracking."
        else
          "Managed-access interest is present; continue routing qualified buyers to the contactable review path and watch quickFocused, contactPackets, emailDrafts, quickSubmitted, and quickReceived."
        end
      ) as $diagnosis
    | [
        "Sage Router managed-access drop-off packet",
        "Boundary: no emails, customer IDs, generated API keys, OAuth tokens, provider credentials, provider authorization reference values, private provider costs, prompts, raw campaign URLs, raw model search text, or raw provider responses are printed.",
        "Effect: read-only diagnosis; this command does not send email, record events, acknowledge provider terms, stage authorization evidence, write provider costs, change prices, deploy, or enable managed resale.",
        "",
        "Window: last \($days) days",
        "Conversion: status=\($conversion.status // "unknown"); priority=\($conversion.priority // "monitor"); managedResaleEnabled=\($conversion.managedResaleEnabled // false).",
        "Demand: anonymousSignals=\(n($anonymous)); waitlistSignals=\(n($waitlist)); contactableLeadGap=\(n($gap)); reviewPacketCopies=\(n($packet_copies)); legacyClicks=\(n($legacy_clicks)).",
        "Fast funnel: quickPresented=\(n($presented)); contactCaptureLanded=\(n($landed)); quickFocused=\(n($focused)); contactPackets=\(n($contact_packets)); emailDrafts=\(n($drafts)); quickStarted=\(n($started)); quickValidationFailed=\(n($validation_failed)); quickSubmitted=\(n($submitted)); quickReceived=\(n($received)).",
        "Buckets: providers=\(buckets($managed_demand.targetProviderFamily)); commercial=\(buckets($managed_demand.commercialPreference)); intents=\(buckets($managed_demand.intent)).",
        "",
        "Diagnosis: \($diagnosis)",
        "",
        "Operator next actions:",
        "- Route one-subscription and Max conversations to the contactable CTA, not to public managed resale.",
        "- If quickPresented rises but contactCaptureLanded stays at zero, use the anchored operator CTA from this packet in founder-sales and support replies.",
        "- If quickPresented rises but quickFocused, contactPackets, and emailDrafts stay at zero, tighten the first-screen CTA, focus path, and direct founder-sales handoff copy.",
        "- If quickFocused, contactPackets, and emailDrafts stay at zero while anonymousSignals or packet copies rise, verify the first-viewport form and use direct founder-sales handoff copy.",
        "- If quickValidationFailed rises without quickReceived, inspect contact-field validation, Turnstile, and /api/waitlist routing before buying or posting more traffic.",
        "- If quickReceived rises, follow up privately and keep provider authorization, terms, cost model, quotas, and abuse-review gates closed until reviewed.",
        "",
        "CTA: \($conversion.ctaPath // "https://sagerouter.dev/managed-access")",
        "Success metric: \($conversion.successMetric // "managedAccessBetaInterest or managed_access_quick_request_received increases without enabling managed provider resale.")",
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); containsActualProviderCosts=false; aggregateOnly=true."
      ]
      | .[]
  ' "$tmp"
  exit 0
fi

if [[ "$APPROVAL_PACKET" == "1" || "$RECORD_ACTIVATION_APPROVAL_REVIEW" == "1" ]]; then
  jq -r \
    --slurpfile recoveryProof "$recovery_tmp" \
    --slurpfile authRepairProof "$auth_repair_tmp" \
    --arg recordApproval "$RECORD_ACTIVATION_APPROVAL_REVIEW" \
    --argjson days "$DAYS" '
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
    | (($approval.decisionLines // []) | map(.value // empty) | map(select(. != ""))) as $decision_lines
    | [
        "Sage Router activation approval packet",
        "Boundary: no emails, customer IDs, API keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider responses.",
        "Effect: read-only review packet; this command does not approve, copy a send command, or send activation emails.",
        "",
        "Approval readiness: \($approval.status // "unknown"); blocker=\($approval.blockedReason // "none").",
        "Decision needed: approve or hold the next real activation send for segment \"\($next_segment)\".",
        "Decision lines:",
        (if ($decision_lines | length) > 0 then ($decision_lines | map("- " + .)[]) else "- APPROVE_ACTIVATION_FOLLOWUP segment=\"\($next_segment)\" issuedAt=\(n($approval.approvalPacketIssuedAt)) expiresAt=\(n($approval.approvalPacketExpiresAt))", "- HOLD_ACTIVATION_FOLLOWUP segment=\"\($next_segment)\" reason=\"<reason>\"" end),
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
        if ($recordApproval == "1") then "Recording boundary: this terminal review records one aggregate status_activation_approval_packet_copied event with snippet operator-activation-approval-packet; it still does not approve, copy a real-send command into the default snapshot, send email, repair auth links, expose secrets, or enable managed resale." else "Recording command: scripts/summarize_sagerouter_launch_funnel.sh --days \($days) --record-activation-approval-review --verify-recovery --verify-auth-repair" end,
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); promptsStored=\($root.privacy.promptsStored // false)."
      ]
      | .[]
  ' "$tmp"

  if [[ "$RECORD_ACTIVATION_APPROVAL_REVIEW" != "1" ]]; then
    exit 0
  fi

  plan="$(jq -r '.activationFollowUps.suggestedPlan // .nextBestAction.evidence.suggestedPlan // "pro"' "$tmp")"
  case "$plan" in
    lite|pro|max)
      ;;
    *)
      plan="pro"
      ;;
  esac
  next_segment="$(jq -r '.activationApprovalReadiness.nextSendSegment // .operatorExecutionPacket.sendTelemetry.nextSendSegment // "verified"' "$tmp")"
  case "$next_segment" in
    verified|unverified|not_required|all)
      ;;
    *)
      next_segment="verified"
      ;;
  esac
  queued_count="$(jq -r '.activationApprovalReadiness.sendableQueued // .operatorExecutionPacket.sendableQueued // .activationFollowUps.sendableQueued // 0' "$tmp")"
  source_page="${APP_BASE%/}/launch-funnel.html#activation-approval"
  target_url="${APP_BASE%/}/launch-funnel.html#no-key-followups"

  payload="$(jq -n \
    --arg plan "$plan" \
    --arg segment "$next_segment" \
    --arg sourcePage "$source_page" \
    --arg target "$target_url" \
    --argjson resultCount "$queued_count" \
    '{
      event: "status_activation_approval_packet_copied",
      plan: $plan,
      sourcePage: $sourcePage,
      target: $target,
      metadata: {
        source: "operator-launch-funnel-cli",
        sourceSurface: "launch-funnel",
        button: "activation-approval-packet-cli",
        state: "operator_activation_approval_reviewed",
        snippet: "operator-activation-approval-packet",
        segment: $segment,
        resultCount: $resultCount,
        utmSource: "operator",
        utmMedium: "launch_funnel",
        utmCampaign: "signup_to_key_recovery"
      }
    }')"

  curl -fsS -X POST "${APP_BASE%/}/api/funnel-event" \
    -H "Origin: ${APP_BASE%/}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: SageRouterLaunchFunnelCLI/1.0" \
    --data "$payload" \
    >/dev/null

  printf '\nRecorded activation approval review event status_activation_approval_packet_copied with snippet operator-activation-approval-packet for segment %s from SageRouterLaunchFunnelCLI/1.0.\n' "$next_segment"
  exit 0
fi

if [[ "$FOUNDER_SALES_PACKET" == "1" || "$RECORD_FOUNDER_SALES" == "1" ]]; then
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
        "Copyable recommended first reply:",
        "Sage Router may fit if your agent stack needs one OpenAI-compatible endpoint with health-aware fallback, generated Sage keys, and route profiles for frontier/local/coding traffic.",
        "",
        "Best first step: create the generated key, then verify /v1/models before wiring it into Codex, OpenClaw, Cursor, Aider, Continue, or a custom OpenAI-compatible client:",
        "https://app.sagerouter.dev/account.html?plan=pro&start=create_key&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-recommended-first-reply",
        "",
        "60-second setup:",
        "https://sagerouter.dev/quickstart?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-recommended-first-reply",
        "",
        "If this is a team or production workflow, Max implementation review is better than guessing at a self-serve config:",
        "https://sagerouter.dev/managed-access?intent=max-implementation&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-recommended-first-reply#managed-access-quick-form",
        "",
        "Boundary: Sage Router is routing, generated-key, quota, analytics, and reliability infrastructure for provider/local access the customer is authorized to use. One-subscription managed access is review-only until provider authorization, terms, cost model, margin checks, quotas, audit, and acceptable-use controls pass.",
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
        if (($root.marketingIntent.founderSalesOutreachCopies // 0) == 0) then "- Recording command: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-founder-sales" else empty end,
        "- Recording boundary: only run the recording command after an operator actually uses or shares this packet; it records one aggregate outreach_snippet_copied event and still does not send email, approve activation sends, expose secrets, or enable managed resale.",
        "",
        "Privacy flags: containsEmails=\($root.privacy.containsEmails // false); containsApiKeys=\($root.privacy.containsApiKeys // false); containsProviderCredentials=\($root.privacy.containsProviderCredentials // false); containsActualProviderCosts=false; containsAuthorizationReference=false; promptsStored=\($root.privacy.promptsStored // false)."
      ]
      | .[]
  ' "$tmp"

  if [[ "$RECORD_FOUNDER_SALES" != "1" ]]; then
    exit 0
  fi

  plan="$(jq -r '(.mrr.planRevenueActions // [])[0].plan // "pro"' "$tmp")"
  case "$plan" in
    lite|pro|max)
      ;;
    *)
      plan="pro"
      ;;
  esac
  result_count="$(jq -r '
    (.mrr.planRevenueActions // [])[0].customerGap // 1
  ' "$tmp")"
  source_page="https://sagerouter.dev/founder-sales-kit?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch"
  target_url="https://app.sagerouter.dev/account.html?plan=${plan}&start=create_key&utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch&utm_content=operator-next-${plan}-outreach"

  payload="$(jq -n \
    --arg plan "$plan" \
    --arg sourcePage "$source_page" \
    --arg target "$target_url" \
    --argjson resultCount "$result_count" \
    '{
      event: "outreach_snippet_copied",
      plan: $plan,
      sourcePage: $sourcePage,
      target: $target,
      metadata: {
        source: "founder-sales",
        sourceSurface: "founder-sales",
        button: "founder-sales-packet-cli",
        state: "operator_next_outreach_copied",
        snippet: ("operator-next-" + $plan + "-outreach"),
        resultCount: $resultCount,
        utmSource: "founder-sales",
        utmMedium: "direct",
        utmCampaign: "sage-router-launch"
      }
    }')"

  curl -fsS -X POST "${APP_BASE%/}/api/funnel-event" \
    -H "Origin: ${APP_BASE%/}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: SageRouterLaunchFunnelCLI/1.0" \
    --data "$payload" \
    >/dev/null

  printf '\nRecorded founder-sales outreach event outreach_snippet_copied with snippet operator-next-%s-outreach from SageRouterLaunchFunnelCLI/1.0.\n' "$plan"
  exit 0
fi

if [[ "$RAW_JSON" == "1" ]]; then
  jq '
  def activation_decision_lines($root): [
    {
      id: "approve_after_review",
      label: "Approve after review",
      value: "APPROVE_ACTIVATION_FOLLOWUP segment=\"\($root.operatorExecutionPacket.sendTelemetry.nextSendSegment // $root.activationApprovalReadiness.nextSendSegment // "all")\" issuedAt=\($root.operatorExecutionPacket.emailReadiness.approvalPacketIssuedAt // $root.activationApprovalReadiness.approvalPacketIssuedAt // 0) expiresAt=\($root.operatorExecutionPacket.emailReadiness.approvalPacketExpiresAt // $root.activationApprovalReadiness.approvalPacketExpiresAt // 0)",
      mutatesRuntime: false,
      sendsEmail: false
    },
    {
      id: "hold",
      label: "Hold",
      value: "HOLD_ACTIVATION_FOLLOWUP segment=\"\($root.operatorExecutionPacket.sendTelemetry.nextSendSegment // $root.activationApprovalReadiness.nextSendSegment // "all")\" reason=\"<reason>\"",
      mutatesRuntime: false,
      sendsEmail: false
    }
  ];
  def activation_approval_readiness:
    . as $root
    | (.activationApprovalReadiness // {
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
    decisionLines: activation_decision_lines($root),
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
    }) as $approval
    | $approval + {
        decisionLines: (
          if (($approval.decisionLines // []) | length) > 0 then $approval.decisionLines
          else activation_decision_lines($root)
          end
        )
      };
  {
    generatedAt,
    stages,
    rates,
    mrr,
    nextBestAction,
    revenue: {
      currentMrrUsd: (.mrr.estimatedCurrentMrrUsd // 0),
      targetMrrUsd: (.mrr.targetMrrUsd // 10000),
      targetAttainment: (.mrr.targetAttainment // 0),
      byPlan: (.mrr.byPlan // {}),
      planRevenueActions: (.mrr.planRevenueActions // []),
      assumptions: (.mrr.assumptions // {}),
      privacy: {
        containsEmails: false,
        containsCustomerIds: false,
        containsApiKeys: false,
        containsProviderCredentials: false,
        aggregateOnly: true
      }
    },
    bottleneck: (.nextBestAction // {}),
    nextActions: (
      [
        if ((.nextBestAction.metric // "") != "") then .nextBestAction else empty end
      ]
      + ((.activationApprovalReadiness.nextActions // []) | map(. + {surface: "Activation approval"}))
      + ((.managedProviderReadiness.nextActions // .pricing.publicLaunch.managedProviderAccess.nextActions // []) | map(. + {surface: "Managed provider access"}))
    )[0:8],
    activationFollowUps: (
      .activationFollowUps
      | if type == "object" then
          {
            keyRecoveryHandoffScheduled: 0,
            keyRecoveryHandoffScheduledByState: {},
            keyRecoveryHandoffPaused: 0,
            keyRecoveryHandoffPausedByState: {}
          } + .
          |
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
    activationApprovalReadiness: activation_approval_readiness,
    activationApproval: activation_approval_readiness,
    managedAccessDemand: (.managedAccessDemand // {}),
    anonymousManagedAccessDemand: (.anonymousManagedAccessDemand // {}),
    waitlistManagedAccessDemand: (.waitlistManagedAccessDemand // {}),
    managedAccessDemandConversion: (.managedAccessDemandConversion // {
      status: (
        if ((.stages.anonymousManagedAccessInterest // 0) > 0 and (.stages.managedAccessBetaInterest // 0) <= 0) then "contact_capture_gap"
        elif ((.stages.anonymousManagedAccessInterest // 0) > 0 or (.stages.managedAccessBetaInterest // 0) > 0) then "contact_capture_started"
        else "no_current_demand" end
      ),
      priority: (
        if ((.stages.anonymousManagedAccessInterest // 0) > 0 and (.stages.managedAccessBetaInterest // 0) <= 0) then "fix_now"
        elif ((.stages.anonymousManagedAccessInterest // 0) > 0 or (.stages.managedAccessBetaInterest // 0) > 0) then "next"
        else "monitor" end
      ),
      anonymousSignals: (.stages.anonymousManagedAccessInterest // 0),
      waitlistSignals: (.stages.managedAccessBetaInterest // 0),
      contactableLeadGap: ([((.stages.anonymousManagedAccessInterest // 0) - (.stages.managedAccessBetaInterest // 0)), 0] | max),
      ctaPath: "https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=operator&utm_medium=launch_funnel&utm_campaign=managed_access_contact_capture&utm_content=anonymous-demand-to-review#managed-access-quick-form",
      action: "Convert anonymous one-subscription managed-access demand into contactable private-beta review requests before enabling managed provider resale.",
      successMetric: "managedAccessBetaInterest or managed_access_quick_request_received increases without enabling managed provider resale.",
      managedResaleEnabled: false,
      privacy: {
        containsEmails: false,
        containsCustomerIds: false,
        containsProviderCredentials: false,
        containsActualProviderCosts: false,
        aggregateOnly: true
      }
    }),
    marketingIntent: (
      (.marketingIntent // {}) as $marketing
      | {
        total: ($marketing.total // .stages.marketingIntentEvents // 0),
        events: ($marketing.events // {}),
        plans: ($marketing.plans // {}),
        sourceSurfaces: ($marketing.sourceSurfaces // {}),
        attributionChannels: ($marketing.attributionChannels // {}),
        setupSnippetCopies: ($marketing.setupSnippetCopies // .stages.setupSnippetCopies // 0),
        setupSnippetCopiesBySnippet: ($marketing.setupSnippetCopiesBySnippet // {}),
        founderSalesOutreachCopies: ($marketing.founderSalesOutreachCopies // 0),
        founderSalesOutreachCopiesBySnippet: ($marketing.founderSalesOutreachCopiesBySnippet // {}),
        managedAccessPacketCopies: ($marketing.managedAccessPacketCopies // 0),
        managedAccessPacketCopiesBySnippet: ($marketing.managedAccessPacketCopiesBySnippet // {}),
        providerAuthorizationOutreachCopies: ($marketing.providerAuthorizationOutreachCopies // 0),
        providerAuthorizationOutreachCopiesBySnippet: ($marketing.providerAuthorizationOutreachCopiesBySnippet // {}),
        providerAuthorizationReviewCopies: ($marketing.providerAuthorizationReviewCopies // 0),
        providerAuthorizationReviewCopiesBySnippet: ($marketing.providerAuthorizationReviewCopiesBySnippet // {}),
        providerTermsReviewCopies: ($marketing.providerTermsReviewCopies // 0),
        providerTermsReviewCopiesBySnippet: ($marketing.providerTermsReviewCopiesBySnippet // {}),
        activationApprovalPacketCopies: ($marketing.activationApprovalPacketCopies // 0),
        activationApprovalPacketCopiesBySnippet: ($marketing.activationApprovalPacketCopiesBySnippet // {}),
        operatorFollowUpCopies: ($marketing.operatorFollowUpCopies // 0),
        operatorFollowUpCopiesByKind: ($marketing.operatorFollowUpCopiesByKind // {}),
        operatorFollowUpWorked: ($marketing.operatorFollowUpWorked // 0),
        operatorFollowUpWorkedByKind: ($marketing.operatorFollowUpWorkedByKind // {}),
        keyFirstRedirects: ($marketing.keyFirstRedirects // 0),
        keyFirstRedirectsByState: ($marketing.keyFirstRedirectsByState // {}),
        keyRecoveryHandoffScheduled: ($marketing.keyRecoveryHandoffScheduled // 0),
        keyRecoveryHandoffScheduledByState: ($marketing.keyRecoveryHandoffScheduledByState // {}),
        keyRecoveryHandoffPaused: ($marketing.keyRecoveryHandoffPaused // 0),
        keyRecoveryHandoffPausedByState: ($marketing.keyRecoveryHandoffPausedByState // {}),
        keyRecoveryViews: ($marketing.keyRecoveryViews // 0),
        keyRecoveryViewsByState: ($marketing.keyRecoveryViewsByState // {}),
        keyCreateAttempts: ($marketing.keyCreateAttempts // 0),
        keyCreateAttemptsByState: ($marketing.keyCreateAttemptsByState // {}),
        keyCreateSuccesses: ($marketing.keyCreateSuccesses // 0),
        keyCreateSuccessesByState: ($marketing.keyCreateSuccessesByState // {}),
        privacy: {
          containsEmails: false,
          containsCustomerIds: false,
          containsApiKeys: false,
          containsProviderCredentials: false,
          aggregateOnly: true
        }
      }
    ),
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
            privateCostModelTemplateCommand: (.pricing.publicLaunch.managedProviderAccess.readinessSetup.privateCostModelTemplateCommand // "scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template"),
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
          privateCostModelTemplateCommand: (if ((.readinessSetup.privateCostModelTemplateCommand // "") != "") then .readinessSetup.privateCostModelTemplateCommand else "scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template" end),
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
  | ($root.managedAccessDemandConversion // {
      status: (
        if (($stages.anonymousManagedAccessInterest // 0) > 0 and ($stages.managedAccessBetaInterest // 0) <= 0) then "contact_capture_gap"
        elif (($stages.anonymousManagedAccessInterest // 0) > 0 or ($stages.managedAccessBetaInterest // 0) > 0) then "contact_capture_started"
        else "no_current_demand" end
      ),
      priority: (
        if (($stages.anonymousManagedAccessInterest // 0) > 0 and ($stages.managedAccessBetaInterest // 0) <= 0) then "fix_now"
        elif (($stages.anonymousManagedAccessInterest // 0) > 0 or ($stages.managedAccessBetaInterest // 0) > 0) then "next"
        else "monitor" end
      ),
      contactableLeadGap: ([ (($stages.anonymousManagedAccessInterest // 0) - ($stages.managedAccessBetaInterest // 0)), 0 ] | max),
      ctaPath: "https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=operator&utm_medium=launch_funnel&utm_campaign=managed_access_contact_capture&utm_content=anonymous-demand-to-review#managed-access-quick-form"
    }) as $managedConversion
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
      "- Provider authorization outreach copies: \(n($marketing.providerAuthorizationOutreachCopies))",
      "- Provider authorization outreach snippets: \(buckets($marketing.providerAuthorizationOutreachCopiesBySnippet))",
      "- Provider authorization review copies: \(n($marketing.providerAuthorizationReviewCopies))",
      "- Provider authorization review snippets: \(buckets($marketing.providerAuthorizationReviewCopiesBySnippet))",
      "- Provider terms review copies: \(n($marketing.providerTermsReviewCopies))",
      "- Provider terms review snippets: \(buckets($marketing.providerTermsReviewCopiesBySnippet))",
      "- Activation approval packet reviews: \(n($marketing.activationApprovalPacketCopies))",
      "- Activation approval packet snippets: \(buckets($marketing.activationApprovalPacketCopiesBySnippet))",
      "- Recovery auth starts: magic=\(n($events.login_key_recovery_magic_link_requested) + n($events.setup_key_recovery_magic_link_requested)), password=\(n($events.login_key_recovery_password_submitted)), oauth=\(n($events.login_key_recovery_oauth_clicked))",
      "- Key-first recovery: setupClicks=\(n($events.login_key_recovery_account_setup_clicked) + n($events.setup_key_recovery_account_clicked) + n($events.setup_key_recovery_next_account_clicked)); scheduled=\(n($followups.keyRecoveryHandoffScheduled)); redirects=\(n($followups.keyFirstRedirects)); paused=\(n($followups.keyRecoveryHandoffPaused)); recoveryViews=\(n($followups.keyRecoveryViews)); keyCreateAttempts=\(n($followups.keyCreateAttempts)); keyCreateSuccesses=\(n($followups.keyCreateSuccesses)); noKeyCreateClicks=\(n($events.account_no_key_setup_create_clicked))",
      "- Managed-access demand: anonymousSignals=\(n($stages.anonymousManagedAccessInterest)); waitlistSignals=\(n($stages.managedAccessBetaInterest)); legacyClicks=\(n($events.managed_access_interest_clicked)); contactCaptureLanded=\(n($events.managed_access_contact_capture_landed)); quickPresented=\(n($events.managed_access_quick_form_presented)); quickFocused=\(n($events.managed_access_quick_form_focused)); contactPackets=\(n($events.managed_access_contact_packet_copied)); emailDrafts=\(n($events.managed_access_contact_draft_opened)); quickStarted=\(n($events.managed_access_quick_form_started)); quickValidationFailed=\(n($events.managed_access_quick_request_validation_failed)); quickSubmitted=\(n($events.managed_access_quick_request_submitted)); quickReceived=\(n($events.managed_access_quick_request_received))",
      "- Managed-access conversion: status=\($managedConversion.status // "unknown"); priority=\($managedConversion.priority // "monitor"); contactableLeadGap=\(n($managedConversion.contactableLeadGap)); cta=\($managedConversion.ctaPath // "https://sagerouter.dev/managed-access")",
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
      "- Terminal review recording: scripts/summarize_sagerouter_launch_funnel.sh --days \($days) --record-activation-approval-review --verify-recovery --verify-auth-repair after an operator actually reviews the packet.",
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
      "- Evidence: checked=\($recovery_proof.handoffSmoke.checked // false); passed=\($recovery_proof.handoffSmoke.passed // false); noPersistence=\($recovery_proof.handoffSmoke.noPersistence // true); recoveryViews=\(n($followups.keyRecoveryViews)); scheduledHandoffs=\(n($followups.keyRecoveryHandoffScheduled)); accountHandoffs=\(n($followups.keyFirstRedirects)); pausedHandoffs=\(n($followups.keyRecoveryHandoffPaused)); keyCreateAttempts=\(n($followups.keyCreateAttempts)); keyCreateSuccesses=\(n($followups.keyCreateSuccesses)).",
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
      "- Provider outreach recording: scripts/configure_managed_provider_resale_readiness.sh --record-provider-outreach after an operator actually uses or shares the packet",
      "- Provider terms review recording: scripts/configure_managed_provider_resale_readiness.sh --record-terms-review after an operator actually reviews the terms packet",
      "- Authorization evidence packet: \(if (($managed.readinessSetup.authorizationPacketCommand // "") != "") then $managed.readinessSetup.authorizationPacketCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-packet" end)",
      "- Authorization evidence review recording: scripts/configure_managed_provider_resale_readiness.sh --record-authorization-review after an operator actually reviews the authorization packet",
      "- Authorization ledger template: \(if (($managed.readinessSetup.authorizationLedgerTemplateCommand // "") != "") then $managed.readinessSetup.authorizationLedgerTemplateCommand else "scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template" end)",
      "- One-subscription pricing packet: \(if (($managed.readinessSetup.oneSubscriptionPricingCommand // "") != "") then $managed.readinessSetup.oneSubscriptionPricingCommand else "scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet" end)",
      "- Private cost-model template: \(if (($managed.readinessSetup.privateCostModelTemplateCommand // "") != "") then $managed.readinessSetup.privateCostModelTemplateCommand else "scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template" end)",
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
