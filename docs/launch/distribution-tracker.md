# Sage Router launch distribution tracker

This tracker converts the `$10k MRR` launch plan into measurable distribution
work. Keep public claims aligned with the local-first/BYOK boundary: Sage Router
sells routing infrastructure, hosted keys, quotas, analytics, reliability, and
support. It does not advertise bundled provider resale unless the runtime
readiness guard enables it.

## Campaign

- Campaign: `sage-router-launch`
- Primary CTA: `https://sagerouter.dev/quickstart`
- Self-hosted CTA: `https://sagerouter.dev/self-hosted-ai-model-router`
- Proof CTA: `https://sagerouter.dev/reliability-proof`
- Buyer-intent CTA: `https://sagerouter.dev/pricing`
- Comparison CTA: `https://sagerouter.dev/compare/openrouter`
- Founder-sales CTA: `https://sagerouter.dev/managed-access`
- Operator dashboard: `https://app.sagerouter.dev/launch-funnel.html`

## Current live snapshot

Refresh this section from live aggregate telemetry with:

```bash
scripts/summarize_sagerouter_launch_funnel.sh --days 30 --update-distribution-tracker
```

- Window: last 30 days
- Generated at epoch: 1783003921
- Marketing intent events: 463
- Setup snippet copies: 2
- Founder-sales outreach copies: 0
- Founder-sales outreach snippets: none
- Managed-access packet copies: 0
- Managed-access packet snippets: none
- Provider authorization outreach copies: 0
- Provider authorization outreach snippets: none
- Provider authorization review copies: 1
- Provider authorization review snippets: operator-provider-authorization-review-packet=1
- Provider terms review copies: 1
- Provider terms review snippets: operator-provider-terms-review-packet=1
- Activation approval packet reviews: 2
- Activation approval packet snippets: operator-activation-approval-packet=2
- Activation approval decision copies: 1
- Activation approval decision snippets: activation-approval-hold-decision=1
- Cloudflare BIC token-scope copies: 0
- Cloudflare BIC token-scope snippets: none
- Recovery auth starts: magic=0, password=0, oauth=0
- Key-first recovery: setupClicks=0; scheduled=0; redirects=1; paused=0; recoveryViews=12; manualPrompts=0; keyCreateAttempts=0; keyCreateSuccesses=0; noKeyCreateClicks=0
- Managed-access demand: anonymousSignals=13; waitlistSignals=0; legacyClicks=0; contactCaptureLanded=4; handoffPrompts=0; quickPresented=5; quickFocused=0; contactPackets=0; emailDrafts=0; quickStarted=0; quickValidationFailed=0; quickSubmitted=0; quickReceived=0
- Managed-access conversion: status=contact_capture_gap; priority=fix_now; contactableSignals=0; quickReceivedSignals=0; contactableLeadGap=13; cta=https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=operator&utm_medium=launch_funnel&utm_campaign=managed_access_contact_capture&utm_content=anonymous-demand-to-review#managed-access-quick-form
- Managed-access provider buckets: mixed-frontier=12, unknown=1
- Managed-access commercial buckets: one-subscription=12, unknown=1
- Managed-access intent buckets: one-subscription=12, unknown=1
- Signups: 6
- Generated-key customers: 1
- First-routed-request customers: 1
- Paid customers: 2
- Estimated MRR: $60 / $10000 target (0.6%)

### Current Bottleneck

- Metric: signupToGeneratedKey
- Priority: fix_now
- Owner/surface: Activation / account setup
- Action: Recovery handoffs are reaching account setup but no key-create attempts have been recorded yet. Auto-key telemetry is now deployed and accepted by the hosted funnel endpoint; the remaining proof needs fresh signed-in recovery traffic or explicit operator approval before real activation sends.
- Success metric: Move no-key signups into generated-key accounts, then first routed request.
- CTA: https://app.sagerouter.dev/account.html?start=create_key&plan=pro&utm_source=operator&utm_medium=launch_funnel&utm_campaign=signup_to_key_recovery&auth=github

### Activation Queue

- Total no-key follow-ups: 6
- Sendable queued: 4
- Review-only queued: 2
- Unknown queued: 0
- Dry-run unique sendable recipients: 4
- Dry-run raw recorded recipients: 4
- Dry-run duplicate recipient records: 0
- Dry-run covered segments: verified, unverified
- Dry-run pending segments: none
- Real sends recorded: 0
- Send approval required: true
- Approval readiness: approval_required (blockedReason=explicit_operator_approval_required)
- Approval next actions: fix_now:approve_activation_followups, next:review_auth_repair_segments
- Recommended send segments: unverified, verified
- Review-only segments: missing_auth_user

### Activation Approval Handoff

- Packet command: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --approval-packet --verify-recovery --verify-auth-repair
- Terminal review recording: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-activation-approval-review --verify-recovery --verify-auth-repair after an operator actually reviews the packet.
- Review worksheet: docs/launch/execution/activation-approval-review.md
- Decision handoff status: decision_recorded; priority=monitor; packetReviewed=true; decisionRecorded=true.
- Decision handoff action: Decision handoff has been recorded; execute only the approved next step if separately authorized.
- Approval decision: approval_required for next segment verified; blocker=explicit_operator_approval_required.
- Decision lines: approve=APPROVE_ACTIVATION_FOLLOWUP segment="verified" issuedAt=1783003924 expiresAt=1783004824; hold=HOLD_ACTIVATION_FOLLOWUP segment="verified" reason="<reason>".
- Decision copy tracking: activationApprovalDecisionCopies counts copied APPROVE_ACTIVATION_FOLLOWUP or HOLD_ACTIVATION_FOLLOWUP handoff lines; it does not send email or approve by itself.
- Default snapshot policy: No send command is printed in this default snapshot. Real activation sends still require explicit operator approval and typed SEND_ACTIVATION_FOLLOWUPS confirmation.
- Safe review: the approval packet is no-secret and excludes emails, customer IDs, generated keys, prompts, OAuth tokens, provider credentials, and raw responses.

### Managed Access Contact Handoff

- Status: contact_capture_gap; priority=fix_now; leadGap=13; managedResaleEnabled=false.
- Drop-off packet: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --managed-access-dropoff-packet
- Contactable CTA: https://sagerouter.dev/managed-access?intent=one-subscription&utm_source=operator&utm_medium=launch_funnel&utm_campaign=managed_access_contact_capture&utm_content=anonymous-demand-to-review#managed-access-quick-form
- Copy-ready handoff: use the drop-off packet text for founder-sales/support replies when one-subscription is the buying trigger.
- Success metric: managedAccessBetaInterest or managed_access_quick_request_received increases without enabling managed provider resale.
- Safety boundary: this is private-beta contact capture only; it does not acknowledge provider terms, stage authorization evidence, write provider costs, change prices, send email, or enable managed resale.

### Cloudflare BIC Reliability Handoff

- Token-scope copies recorded: 0; snippets: none
- Operator packet: bash scripts/configure_cloudflare_api_bic_skip.sh --operator-packet
- Execution handoff: docs/launch/execution/cloudflare-bic-reliability-handoff.md
- Status-page copy action: https://app.sagerouter.dev/status#cloudflare-bic-token-scope
- Required token scope: Zone:Zone:Read; Zone Rulesets:Read; Zone Rulesets:Edit for sagerouter.dev.
- Verification command: bash scripts/configure_cloudflare_api_bic_skip.sh --check
- Safety boundary: the packet is read-only and no-secret; copying it records status_cloudflare_bic_token_scope_copied only when the operator uses the status-page action, and it does not mutate Cloudflare or print token values.
- Manual fallback: Cloudflare Dashboard > sagerouter.dev > Rules > Configuration Rules; disable Browser Integrity Check only when http.host eq "api.sagerouter.dev".

### Verified Recovery Diagnosis

- Command: bash scripts/diagnose_setup_key_recovery_dropoff.sh --verify-handoff
- Result: account_handoff_to_key_create
- Interpretation: Recovery handoff verification has not produced a final send-ready diagnosis yet.
- Evidence: checked=true; passed=true; noPersistence=true; recoveryViews=12; scheduledHandoffs=0; accountHandoffs=1; pausedHandoffs=0; keyCreateAttempts=0; keyCreateSuccesses=0.
- Next action: Follow the recovery diagnosis before approving any real activation send.

### Top Acquisition Actions
- attributionChannel/sagerouter: 360 clicks - Cross-link internal Sage Router pages toward the current lowest-performing activation step.
- sourceSurface/landing: 137 clicks - Keep the homepage focused on account creation, pricing, model catalog, and migration CTAs.
- sourceSurface/article: 123 clicks - Turn long-form local-first routing readers into quickstart, Codex setup, and gateway comparison CTAs.
- sourceSurface/account: 48 clicks - Reduce signed-in friction from plan selection to generated key and first routed request.
- attributionChannel/reddit: 45 clicks - Package comparison, migration, and reliability proof for Reddit-style evaluation threads.

### Revenue Gap
- pro: 198 customers, $5940 remaining MRR - Convert active generated-key users into Pro with frontier profile, analytics, and fallback proof.
- max: 50 customers, $3600 remaining MRR - Book founder-led Max demos for automation/team users and attach private deployment support.
- lite: 100 customers, $600 remaining MRR - Use low-friction Lite checkout from pricing, calculator, and quickstart entry points.

### Founder Sales Fallback

- Use when: activation sends are approval-gated or provider resale is waiting on terms/evidence, but founder-led Lite/Pro/Max conversations can still move.
- Kit: https://sagerouter.dev/founder-sales-kit?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch
- Terminal packet: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --founder-sales-packet
- Outreach copies recorded: 0; snippets: none
- Managed-access packet copies recorded: 0; snippets: none
- Primary revenue motion: pro needs 198 customers and $5940 remaining MRR; Convert active generated-key users into Pro with frontier profile, analytics, and fallback proof.
- Lite pilot motion: 100 Lite customers and $600 remaining MRR; use the Lite pilot snippet for one-agent evaluations and low-friction hosted key trials.
- Max review motion: 50 Max customers and $3600 remaining MRR; use the Max implementation snippet for teams with production agents, Tailnet/local routing, or gateway migration pain.
- Copy-ready path: use the packet recommended first reply for a warm thread; use next-revenue packet when the buyer needs Lite/Pro/Max options and one-subscription review boundary in one message.
- Recording command: scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-founder-sales
- Recording boundary: only run the recording command after an operator actually uses or shares this packet; it records one aggregate outreach_snippet_copied event and does not send email, approve activation sends, expose secrets, or enable managed resale.
- Safety rule: use one no-secret snippet per warm conversation; do not paste prompts, provider credentials, generated keys, customer data, private funnel rows, OAuth tokens, or raw provider responses.

### Managed Access Readiness

- Enabled/requested/ready: false / true / false
- Status: requires_readiness_verification
- Missing controls: provider_terms_acknowledgment, provider_authorization_evidence, provider_cost_model, positive_unit_economics
- Next managed actions: fix_now:provider_terms_acknowledgment, next:provider_authorization_evidence, next:provider_cost_model
- Allowed provider families: ollama, openai, anthropic
- One-subscription ready families: none
- One-subscription blocked families: ollama, openai, anthropic, openrouter, byok-compatible
- Terms acknowledged: false
- Authorization evidence configured: false
- Cost model configured: false; unit economics satisfied: false
- Public-control staging command: SAGEROUTER_PROVIDER_RESALE_TERMS_URL='https://sagerouter.dev/provider-resale-terms' \
SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL='https://sagerouter.dev/margin-policy' \
SAGEROUTER_MANAGED_PROVIDER_RESALE_REQUESTED='1' \
SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED='0' \
SAGEROUTER_PROVIDER_RESALE_ALLOWED_PROVIDERS='ollama,openai,anthropic' \
SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT='35' \
SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC='0' \
scripts/configure_managed_provider_resale_readiness.sh --stage-public-controls
- Provider outreach packet: scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet
- Provider outreach recording: scripts/configure_managed_provider_resale_readiness.sh --record-provider-outreach after an operator actually uses or shares the packet
- Provider terms review recording: scripts/configure_managed_provider_resale_readiness.sh --record-terms-review after an operator actually reviews the terms packet
- Authorization evidence packet: scripts/configure_managed_provider_resale_readiness.sh --authorization-packet
- Authorization evidence review recording: scripts/configure_managed_provider_resale_readiness.sh --record-authorization-review after an operator actually reviews the authorization packet
- Authorization ledger template: scripts/configure_managed_provider_resale_readiness.sh --authorization-ledger-template
- One-subscription pricing packet: scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet
- Private cost-model template: scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template
- One-subscription pricing review: docs/launch/execution/one-subscription-pricing-review.md
- Unit-economics preflight: SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS='REVIEWED_PRIVATE_COST' scripts/configure_managed_provider_resale_readiness.sh --unit-economics
- Managed-access beta interest: 0; anonymous interest: 13; target-provider buckets: mixed-frontier=12, unknown=1; commercial buckets: one-subscription=12, unknown=1; intent buckets: one-subscription=12, unknown=1

### Privacy

- Contains emails: false
- Contains API keys: false
- Contains provider credentials: false
- Prompts stored: false

Prioritize the no-key activation queue before broad public posting: moving the
current sendable signups into generated-key accounts should raise the conversion
rate faster than buying or posting into more top-of-funnel traffic. After that,
scale Reddit reliability/comparison posts and GitHub README/docs traffic because
those are the strongest external signals currently visible.

For a single read-only launch packet before operator review, run
`scripts/summarize_sagerouter_launch_operator_handoff.sh --days 30
--skip-readiness` to bundle the live funnel snapshot, setup-copy activation packet,
activation approval packet, founder-sales next-revenue packet, managed-access
drop-off packet, Cloudflare BIC reliability packet, managed-provider readiness packet,
provider terms approval packet, one-subscription pricing packet, Moltbook
pre-approved channel packet, provider outreach packet, and provider reply
triage packet without approving sends, sending email, mutating Cloudflare,
deploying, claiming the Moltbook agent, posting publicly, acknowledging provider
terms, enabling managed resale, or printing
secrets. Omit `--skip-readiness` when the operator packet should include the
full launch readiness probe.

## Posting queue

| Channel | Status | Link to use | Success signal |
| --- | --- | --- | --- |
| No-key activation recovery | Priority 0; live funnel says send verified/unverified drafts first, review the missing-auth-user segment separately, then mark the worked segment through launch-funnel telemetry. Operator follow-up drafts now lead with `/setup-key-recovery` so returning no-key signups can request the same-email setup link from a focused page before falling back to app login or GitHub/OAuth. Account page still shows a signed-in no-key setup panel so returning users can copy setup, then self-serve key creation before any approved follow-up send. Use `docs/launch/execution/activation-approval-review.md` before approving any real send; terminal reviewers can run `scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-activation-approval-review --verify-recovery --verify-auth-repair` after actually reviewing the packet so approval-review work is measured without sending email or approving outreach. | `https://app.sagerouter.dev/launch-funnel.html#no-key-followups:segments` | `activationApprovalPacketCopies`, `operatorFollowUpCopies` or approved sends increase, then `setup_key_recovery_magic_link_requested`, `keyRecoveryViews`, `keyCreateAttempts`, `account_no_key_setup_create_clicked`, and `customersWithGeneratedApiKeys` increase |
| GitHub repository discovery | Live; README now leads with hosted activation, issue-template contact links route setup/billing/support questions to key-first hosted onboarding before public issues, and repo topics include `ai-gateway`, `llm-gateway`, `model-router`, `codex-cli`, `openai-api`, `openai-compatible-api`, `ollama-cloud`, and `nvidia-nim`; keep using README/docs traffic to push users into key-first setup. | `https://app.sagerouter.dev/account.html?plan=pro&start=create_key&utm_source=github&utm_medium=readme&utm_campaign=sage-router-launch` | `github` attribution clicks, account page views, generated keys, GitHub stars |
| Founder sales | Ready; public founder-sales kit includes a first-viewport recommended first reply, revenue packet, and Pro reply/setup bundle copies, no-secret email-draft buttons for the first reply and revenue packet, Pro activation, Max implementation, one-subscription review, gateway migration, OpenRouter migration, and calculator follow-up snippets; terminal operators can also run `scripts/summarize_sagerouter_launch_funnel.sh --days 30 --founder-sales-packet` for the same no-secret recommended first reply plus next-revenue handoff when activation sends are approval-gated, then `scripts/summarize_sagerouter_launch_funnel.sh --days 30 --record-founder-sales` after actually using or sharing that packet so terminal work is measured as an aggregate outreach copy | `https://sagerouter.dev/founder-sales-kit?utm_source=founder-sales&utm_medium=direct&utm_campaign=sage-router-launch` | `founderSalesOutreachCopies`, `founderSalesOutreachCopiesBySnippet`, `setupSnippetCopies`, direct replies, Pro generated keys, Max review requests, one-subscription review requests, OpenRouter comparison clicks, calculator completions |
| Provider authorization outreach | Ready; no-secret copy in `docs/launch/execution/provider-authorization-outreach.md`, canonical ledger worksheet in `docs/launch/execution/provider-authorization-ledger-template.md`, one-subscription pricing worksheet in `docs/launch/execution/one-subscription-pricing-review.md`, and live CLI packets via `scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet`, `--provider-reply-triage-packet`, `--one-subscription-pricing-packet`, and `--private-cost-model-template`; use them to request Ollama, OpenAI, and Anthropic managed-access authorization, triage provider replies, and review fixed-plan thresholds without enabling public resale or exposing private costs. After an operator actually uses or shares the terminal provider outreach packet, run `scripts/configure_managed_provider_resale_readiness.sh --record-provider-outreach` so provider-authorization work is measured without sending email, acknowledging terms, staging evidence, writing costs, or enabling resale. After an operator actually reviews the authorization packet, run `scripts/configure_managed_provider_resale_readiness.sh --record-authorization-review` so evidence-review work is measured without staging evidence, acknowledging terms, writing costs, or enabling resale. After an operator actually reviews the terms packet, run `scripts/configure_managed_provider_resale_readiness.sh --record-terms-review` so terms-review work is measured without acknowledging terms, staging evidence, writing costs, or enabling resale. After replies arrive, generate `--provider-reply-triage-packet` and `--authorization-ledger-template` or start from the ledger file, then fill the private copy only in the private system of record. | Private provider contact channels only | `providerAuthorizationOutreachCopies`, `providerAuthorizationReviewCopies`, and `providerTermsReviewCopies` increase; written authorization reference captured privately, then `--authorization-packet`, `--provider-reply-triage-packet`, `--authorization-ledger-template`, `--terms-approval-packet`, pricing review, private cost-model template, and `--unit-economics` pass |
| Reliability proof | Ready; public proof kit includes copyable 429 failover, credential load-balancing, multimodal routing, and Reddit proof-reply snippets | `https://sagerouter.dev/reliability-proof?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | Proof CTA clicks, quickstart snippet copies, Pro generated keys, Max review requests |
| Moltbook | Pre-approved by operator; API rechecked 2026-06-25 and still `pending_claim`; post attempt returned `403` until the local `sagerouter` agent is claimed; OpenClaw update should post after claim | `https://sagerouter.dev/openclaw-ai-model-router?utm_source=moltbook&utm_medium=community&utm_campaign=openclaw-ai-model-router` | Post URL captured; `moltbook` appears in acquisition actions |
| Reddit r/selfhosted | Priority 1 after activation recovery and owner approval; final copy in `docs/launch/final/reddit-selfhosted-post.md`; self-hosted page now includes direct Pro magic-link activation; current live Reddit signal is `34` privacy-safe clicks | `https://sagerouter.dev/self-hosted-ai-model-router?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | `reddit` source clicks, self-hosted magic-link events, quickstart copies, GitHub stars |
| Reddit r/Ollama | Priority 2 after owner approval; final copy in `docs/launch/final/reddit-ollama-post.md`; public evaluation kit includes a copyable r/Ollama block | `https://sagerouter.dev/ollama-ai-model-router?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | Ollama route clicks, model-catalog demand, quickstart copies, GitHub stars |
| Reddit r/SideProject | Priority 3 after owner approval; final copy in `docs/launch/final/reddit-sideproject-post.md`; public evaluation kit includes a copyable r/SideProject block | `https://sagerouter.dev/pricing?utm_source=reddit&utm_medium=community&utm_campaign=sage-router-launch` | Pricing/account CTA intent, generated hosted keys, founder-sales replies |
| Hacker News | Ready after owner approval; final copy in `docs/launch/final/hackernews-showhn-post.md`; public community launch kit includes a copyable Show HN block | `https://sagerouter.dev/?utm_source=hackernews&utm_medium=community&utm_campaign=sage-router-launch` | Referral traffic, GitHub stars, quickstart copies, generated keys, substantive HN comments |
| Indie Hackers | Ready after owner approval; final copy in `docs/launch/final/indiehackers-post.md`; public community launch kit includes a copyable Indie Hackers block | `https://sagerouter.dev/launch-plan?utm_source=indiehackers&utm_medium=community&utm_campaign=sage-router-launch` | Signup, pricing, generated keys, and founder-sales replies |
| Dev.to | Ready after owner approval; final copy in `docs/launch/final/devto-post.md`; public community launch kit includes a copyable Dev.to block | `https://sagerouter.dev/quickstart?utm_source=devto&utm_medium=community&utm_campaign=sage-router-launch` | Quickstart copies, GitHub traffic, and generated-key activation clicks |
| X / Twitter | Ready after owner approval; final copy in `docs/launch/final/x-thread.txt`; public community launch kit includes a copyable X thread block | `https://sagerouter.dev/pricing?utm_source=x&utm_medium=social&utm_campaign=sage-router-launch` | Thread clicks, replies, profile visits, and pricing CTA intent |
| LinkedIn | Ready after owner approval; final copy in `docs/launch/final/linkedin-post.txt`; public community launch kit includes a copyable LinkedIn block | `https://sagerouter.dev/compare/openrouter?utm_source=linkedin&utm_medium=social&utm_campaign=sage-router-launch` | Pro/Max conversations, OpenRouter comparison clicks, and managed-access review requests |

## Execution rules

- Post one high-context channel first, then wait for replies before batching
  more channels.
- Keep the question at the end genuine and channel-specific; avoid dropping the
  same copy everywhere in one burst.
- Do not paste prompts, provider credentials, generated API keys, OAuth tokens,
  customer data, raw provider responses, or private operator dashboard data into
  public posts.
- After each post, record the live post URL, timestamp, channel, UTM link, and
  observed launch-funnel signal.

## Approval boundary

Existing community/social drafts are ready to use, but public posting still
requires owner approval for each non-Moltbook channel. Moltbook posting is
pre-approved by the operator but technically blocked until the `sagerouter`
agent is claimed.
