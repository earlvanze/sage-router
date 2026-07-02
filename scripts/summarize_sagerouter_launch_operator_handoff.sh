#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DAYS=30
SKIP_READINESS=0

usage() {
  cat <<'EOF'
Usage: scripts/summarize_sagerouter_launch_operator_handoff.sh [--days N] [--skip-readiness]

Print a read-only Sage Router launch operator handoff that bundles the live
funnel snapshot, no-secret setup-copy activation packet, activation approval
packet, Cloudflare BIC reliability packet, founder-sales next-revenue packet,
managed-access drop-off packet, managed-provider readiness packet, provider
terms approval packet, one-subscription pricing packet, private cost-model
template, Moltbook pre-approved channel packet, provider outreach packet,
provider reply triage packet, and optional launch readiness check.

Boundary: no emails, customer IDs, generated API keys, OAuth tokens, provider
credentials, provider authorization reference values, private provider costs,
prompts, raw campaign URLs, raw model search text, raw provider responses, or
Cloudflare token values are printed.

Effect: read-only; does not approve sends, send email, repair account links,
mutate Cloudflare, write secrets, deploy, claim the Moltbook agent, post
publicly, acknowledge provider terms, enable managed resale, change prices, or
copy generated keys.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      DAYS="${2:-}"
      if [[ -z "$DAYS" || ! "$DAYS" =~ ^[0-9]+$ ]]; then
        printf 'Invalid --days value: %s\n' "${DAYS:-}" >&2
        exit 2
      fi
      shift 2
      ;;
    --skip-readiness)
      SKIP_READINESS=1
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

section() {
  printf '\n## %s\n\n' "$1"
}

run_read_only() {
  printf '+ %s\n\n' "$*"
  "$@"
}

cat <<EOF
# Sage Router launch operator handoff

Window: last ${DAYS} days

Boundary: no emails, customer IDs, generated API keys, OAuth tokens, provider
credentials, provider authorization reference values, private provider costs,
prompts, raw campaign URLs, raw model search text, raw provider responses, or
Cloudflare token values are printed.

Effect: read-only; does not approve sends, send email, repair account links,
mutate Cloudflare, write secrets, deploy, claim the Moltbook agent, post
publicly, acknowledge provider terms, enable managed resale, change prices, or
copy generated keys.
EOF

section "Live Funnel Snapshot"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS"

section "Setup-Copy Activation Packet"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --setup-copy-packet

section "Activation Approval Packet"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --approval-packet --verify-recovery --verify-auth-repair

section "Founder Sales Next-Revenue Packet"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --founder-sales-packet

section "Managed Access Drop-Off Packet"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --managed-access-dropoff-packet

section "Cloudflare BIC Reliability Packet"
run_read_only bash scripts/configure_cloudflare_api_bic_skip.sh --operator-packet

section "Managed Provider Readiness Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --operator-packet

section "Provider Source Review Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --provider-source-review-packet

section "Provider Terms Approval Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet

section "One-Subscription Pricing Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet

section "Private Cost-Model Template"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template

section "Moltbook Pre-Approved Channel Packet"
run_read_only scripts/summarize_sagerouter_launch_funnel.sh --days "$DAYS" --moltbook-packet

section "Provider Authorization Outreach Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet

section "Provider Reply Triage Packet"
run_read_only bash scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet

if [[ "$SKIP_READINESS" == "1" ]]; then
  section "Launch Readiness Check"
  printf 'Skipped. Re-run without --skip-readiness to include:\n\n'
  printf '+ scripts/check_sagerouter_launch_readiness.sh\n'
else
  section "Launch Readiness Check"
  set +e
  scripts/check_sagerouter_launch_readiness.sh
  readiness_status=$?
  set -e
  if [[ "$readiness_status" -ne 0 ]]; then
    printf '\nLaunch readiness exited with %s. Review the failure above; earlier handoff packets remain read-only and no-secret.\n' "$readiness_status" >&2
    exit "$readiness_status"
  fi
fi
