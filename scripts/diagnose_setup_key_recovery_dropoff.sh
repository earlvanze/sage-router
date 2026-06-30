#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/diagnose_setup_key_recovery_dropoff.sh [--days N] [--json] [--verify-handoff]

Read the privacy-safe launch funnel snapshot and classify the setup-key recovery
dropoff without printing emails, customer IDs, generated keys, prompts, OAuth
tokens, provider credentials, raw campaign URLs, or raw provider responses.

Options:
  --days N          Snapshot window, default 30.
  --json            Print bounded machine-readable diagnosis.
  --verify-handoff  Run the live setup-key recovery handoff smoke verifier and
                    fold that pass/fail state into the diagnosis.
EOF
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
VERIFY_HANDOFF=0
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
    --verify-handoff)
      VERIFY_HANDOFF=1
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

if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [[ "$DAYS" -lt 1 ]]; then
  printf '%s\n' '--days must be a positive integer' >&2
  exit 2
fi

require_tool jq

tmp="$(mktemp /tmp/sage-router-recovery-dropoff.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

bash scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --json > "$tmp"

handoff_smoke_checked=false
handoff_smoke_passed=false
handoff_smoke_output=""
if [[ "$VERIFY_HANDOFF" == "1" ]]; then
  handoff_smoke_checked=true
  handoff_tmp="$(mktemp /tmp/sage-router-recovery-handoff-smoke.XXXXXX)"
  if bash scripts/check_setup_key_recovery_handoff.sh > "$handoff_tmp" 2>&1; then
    handoff_smoke_passed=true
  fi
  handoff_smoke_output="$(tr '\n' ' ' < "$handoff_tmp" | sed 's/[[:space:]]\+/ /g' | cut -c 1-700)"
  rm -f "$handoff_tmp"
fi

if [[ "$RAW_JSON" == "1" ]]; then
  jq \
    --argjson days "$DAYS" \
    --argjson handoffSmokeChecked "$handoff_smoke_checked" \
    --argjson handoffSmokePassed "$handoff_smoke_passed" \
    --arg handoffSmokeOutput "$handoff_smoke_output" \
    '
    def n($v): ($v // 0);
    def events: (.nextBestAction.evidence // {});
    (events) as $e
    | (($e.nonGatedSetupCopyFallback // false) == true) as $setup_copy_fallback
    | (n($e.keyRecoveryViews)) as $views
    | (n($e.keyFirstRedirects)) as $redirects
    | (n($e.keyCreateAttempts)) as $attempts
    | (n($e.keyCreateSuccesses)) as $successes
    | {
        days: $days,
        stage: (
          if $views <= 0 then "no_recovery_traffic"
          elif $redirects <= 0 and $handoffSmokeChecked and $handoffSmokePassed then "verified_handoff_waiting_for_fresh_traffic"
          elif $redirects <= 0 then "recovery_view_to_account_handoff"
          elif $attempts <= 0 then "account_handoff_to_key_create"
          elif $successes <= 0 then "key_create_attempt_to_success"
          else "recovery_path_working"
          end
        ),
        action: (
          if $views <= 0 then "Drive qualified no-key users to setup-key recovery before debugging account handoff."
          elif $redirects <= 0 and $handoffSmokeChecked and $handoffSmokePassed and $setup_copy_fallback then "The live setup-key recovery handoff smoke passed and activation sends are approval-gated; copy the no-secret first-request setup bundle from the launch-funnel Do Next dock before any real send."
          elif $redirects <= 0 and $handoffSmokeChecked and $handoffSmokePassed then "The live setup-key recovery handoff smoke passed; wait for fresh real recovery traffic or use the no-secret approval packet before any real activation send."
          elif $redirects <= 0 then "Run bash scripts/check_setup_key_recovery_handoff.sh, then inspect the public recovery/login CTAs before sending more traffic."
          elif $attempts <= 0 then "Inspect /account start=create_key handling and signed-in no-key setup controls before sending more recovery traffic."
          elif $successes <= 0 then "Inspect account API-key creation errors, email verification gates, and checkout/key-first state."
          else "Monitor first routed request and paid conversion."
          end
        ),
        counts: {
          keyRecoveryViews: $views,
          keyFirstRedirects: $redirects,
          keyCreateAttempts: $attempts,
          keyCreateSuccesses: $successes,
          noKeyFollowUpsQueued: n($e.noKeyFollowUpsQueued),
          sendableQueued: n($e.sendableQueued),
          reviewOnlyQueued: n($e.reviewOnlyQueued)
        },
        viewsByState: ($e.keyRecoveryViewsByState // {}),
        redirectsByState: ($e.keyFirstRedirectsByState // {}),
        attemptsByState: ($e.keyCreateAttemptsByState // {}),
        successesByState: ($e.keyCreateSuccessesByState // {}),
        handoffSmoke: {
          checked: $handoffSmokeChecked,
          passed: $handoffSmokePassed,
          output: $handoffSmokeOutput,
          command: "bash scripts/check_setup_key_recovery_handoff.sh",
          noPersistence: true
        },
        commands: {
          handoffSmoke: "bash scripts/check_setup_key_recovery_handoff.sh",
          approvalPacket: ("bash scripts/summarize_sagerouter_launch_funnel.sh --days " + ($days | tostring) + " --approval-packet --verify-recovery --verify-auth-repair"),
          liveSnapshot: ("bash scripts/summarize_sagerouter_launch_funnel.sh --days " + ($days | tostring))
        },
        privacy: {
          containsEmails: false,
          containsCustomerIds: false,
          containsApiKeys: false,
          containsProviderCredentials: false,
          containsPrompts: false,
          aggregateOnly: true
        }
      }
  ' "$tmp"
  exit 0
fi

jq -r \
  --argjson days "$DAYS" \
  --argjson handoffSmokeChecked "$handoff_smoke_checked" \
  --argjson handoffSmokePassed "$handoff_smoke_passed" \
  --arg handoffSmokeOutput "$handoff_smoke_output" \
  '
  def n($v): ($v // 0);
  def list($v):
    (($v // {}) | to_entries | map(select(.value != 0) | "\(.key)=\(.value)")) as $rows
    | if ($rows | length) > 0 then ($rows | join(", ")) else "none" end;
  (.nextBestAction.evidence // {}) as $e
  | (n($e.keyRecoveryViews)) as $views
  | (n($e.keyFirstRedirects)) as $redirects
  | (n($e.keyCreateAttempts)) as $attempts
  | (n($e.keyCreateSuccesses)) as $successes
  | [
      "Sage Router setup-key recovery dropoff diagnosis",
      "Boundary: aggregate-only; no emails, customer IDs, generated keys, prompts, OAuth tokens, provider credentials, raw campaign URLs, or raw provider responses.",
      "",
      "Window: last \($days) days",
      "Counts: recoveryViews=\($views); accountHandoffs=\($redirects); keyCreateAttempts=\($attempts); keyCreateSuccesses=\($successes).",
      "Queue: noKey=\(n($e.noKeyFollowUpsQueued)); sendable=\(n($e.sendableQueued)); reviewOnly=\(n($e.reviewOnlyQueued)).",
      "Recovery view states: \(list($e.keyRecoveryViewsByState))",
      "Account handoff states: \(list($e.keyFirstRedirectsByState))",
      "Key-create attempt states: \(list($e.keyCreateAttemptsByState))",
      "Key-create success states: \(list($e.keyCreateSuccessesByState))",
      (
        if $handoffSmokeChecked then
          "Live handoff smoke: " + (if $handoffSmokePassed then "passed" else "failed" end) + ". " + $handoffSmokeOutput
        else
          "Live handoff smoke: not run. Add --verify-handoff to include production handoff proof."
        end
      ),
      "",
      (
        if $views <= 0 then
          "Diagnosis: no_recovery_traffic. Drive qualified no-key users to setup-key recovery before debugging account handoff."
        elif $redirects <= 0 and $handoffSmokeChecked and $handoffSmokePassed and (($e.nonGatedSetupCopyFallback // false) == true) then
          "Diagnosis: verified_handoff_waiting_for_fresh_traffic. The live setup-key recovery handoff smoke passed and activation sends are approval-gated; copy the no-secret first-request setup bundle from https://app.sagerouter.dev/launch-funnel.html#next-best-action-dock before any real send."
        elif $redirects <= 0 and $handoffSmokeChecked and $handoffSmokePassed then
          "Diagnosis: verified_handoff_waiting_for_fresh_traffic. The live setup-key recovery handoff smoke passed; wait for fresh real recovery traffic or use the no-secret approval packet before any real activation send."
        elif $redirects <= 0 then
          "Diagnosis: recovery_view_to_account_handoff. Users are viewing recovery but not reaching account setup. Run the handoff smoke test, then inspect public recovery/login CTAs before sending more traffic."
        elif $attempts <= 0 then
          "Diagnosis: account_handoff_to_key_create. Recovery reaches account setup but key creation is not starting. Inspect /account start=create_key handling and signed-in no-key controls."
        elif $successes <= 0 then
          "Diagnosis: key_create_attempt_to_success. Key creation starts but does not succeed. Inspect account API-key creation errors, email verification gates, and checkout/key-first state."
        else
          "Diagnosis: recovery_path_working. Monitor first routed request and paid conversion."
        end
      ),
      "",
      "Next safe commands:",
      "- bash scripts/check_setup_key_recovery_handoff.sh",
      "- bash scripts/summarize_sagerouter_launch_funnel.sh --days \($days) --approval-packet --verify-recovery --verify-auth-repair",
      "- bash scripts/summarize_sagerouter_launch_funnel.sh --days \($days)"
    ]
    | .[]
' "$tmp"
