#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'managed_provider_unit_economics.py'
CONFIGURE_SCRIPT = ROOT / 'scripts' / 'configure_managed_provider_resale_readiness.sh'
OUTREACH_DOC = ROOT / 'docs' / 'launch' / 'execution' / 'provider-authorization-outreach.md'
PRICING_REVIEW_DOC = ROOT / 'docs' / 'launch' / 'execution' / 'one-subscription-pricing-review.md'
TERMS_REVIEW_DOC = ROOT / 'docs' / 'launch' / 'execution' / 'provider-terms-approval-review.md'


class ManagedProviderUnitEconomicsCliTests(unittest.TestCase):
    def env(self, cost='1.234567'):
        env = os.environ.copy()
        env.update({
            'SAGE_ROUTER_DARIO_AUTOSTART': '0',
            'SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART': '0',
            'SAGE_ROUTER_EDGE_MONTHLY_QUOTAS': (
                'trial=1000,lite=10000,pro=50000,max=200000,paid=50000,active=50000,default=0'
            ),
            'SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS': cost,
            'SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT': '35',
        })
        return env

    def test_json_output_does_not_print_private_cost_or_exact_margin(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), '--json'],
            cwd=ROOT,
            env=self.env(),
            text=True,
            capture_output=True,
            check=True,
        )
        self.assertNotIn('1.234567', result.stdout)
        self.assertNotIn('"grossMarginPercent":', result.stdout)
        report = json.loads(result.stdout)
        self.assertTrue(report['candidateCostProvided'])
        self.assertFalse(report['candidateCostPrinted'])
        self.assertFalse(report['actualProviderCostExposed'])
        self.assertFalse(report['grossMarginPercentExposed'])
        self.assertTrue(report['satisfied'])
        self.assertEqual([], report['failedPlans'])
        self.assertEqual('max', report['bindingPlan'])
        self.assertEqual(3, len(report['pricingGuardrails']))
        guardrails = {row['plan']: row for row in report['pricingGuardrails']}
        self.assertEqual('public_threshold_only', guardrails['max']['privacy'])
        self.assertEqual('review_quota_or_add_on_before_bundling_expensive_frontier_access', guardrails['max']['guidance'])
        self.assertTrue(guardrails['max']['candidatePasses'])
        self.assertNotIn('actualProviderCost', json.dumps(report['pricingGuardrails']))
        self.assertNotIn('grossMarginPercent', json.dumps(report['pricingGuardrails']))
        self.assertTrue(report['recommendedActions'])
        self.assertEqual('binding_plan', report['recommendedActions'][0]['kind'])
        self.assertEqual('max', report['recommendedActions'][0]['plan'])
        self.assertEqual(3, len(report['managedAccessAddOnGuardrails']))
        add_ons = {row['id']: row for row in report['managedAccessAddOnGuardrails']}
        self.assertEqual('public_threshold_only', add_ons['managed-access-max-contract-floor']['privacy'])
        self.assertEqual(75000, add_ons['managed-access-max-contract-floor']['monthlyManagedRequests'])
        self.assertEqual(86.6667, add_ons['managed-access-max-contract-floor']['maximumProviderCostCentsPerThousandRequests'])
        self.assertTrue(add_ons['managed-access-pilot']['candidatePasses'])
        self.assertEqual('managed-access-max-contract-floor', report['firstPassingManagedAccessOffer'])
        self.assertNotIn('actualProviderCost', json.dumps(report['managedAccessAddOnGuardrails']))
        self.assertNotIn('grossMarginPercent', json.dumps(report['managedAccessAddOnGuardrails']))
        self.assertTrue(report['privacy']['containsActualProviderCosts'] is False)
        for row in report['evaluatedPlans']:
            self.assertIn('maximumProviderCostCentsPerThousandRequests', row)
            self.assertIn('constraintRank', row)
            self.assertIn('meetsMinimumGrossMargin', row)
            self.assertNotIn('grossMarginPercent', row)

    def test_text_output_fails_closed_without_printing_failing_candidate_cost(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=ROOT,
            env=self.env(cost='30.123456'),
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(0, result.returncode)
        combined = result.stdout + result.stderr
        self.assertNotIn('30.123456', combined)
        self.assertNotIn('grossMarginPercent=', combined)
        self.assertNotIn('requiredPrice', combined)
        self.assertNotIn('required_private_price', combined)
        self.assertIn('candidateCostProvided=true', combined)
        self.assertIn('satisfied=false', combined)
        self.assertIn('bindingPlan=max', combined)
        self.assertIn('failedPlans=max', combined)
        self.assertIn('pricingGuardrails:', combined)
        self.assertIn('exclude_or_add_managed_access_surcharge_until_private_cost_passes', combined)
        self.assertIn('managedAccessAddOnGuardrails:', combined)
        self.assertIn('managed-access-max-contract-floor', combined)
        self.assertIn('maxSafeProviderCostCentsPer1k=86.6667', combined)
        self.assertIn('firstPassingManagedAccessOffer=managed-access-max-contract-floor', combined)
        self.assertIn('review_managed_access_add_on', combined)
        self.assertIn('recommendedActions:', combined)
        self.assertIn('revise_fixed_plan_economics plans=max', combined)
        self.assertIn('keep_public_resale_disabled plans=max', combined)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0', combined)

    def test_configure_helper_unit_economics_mode_delegates_safely(self):
        result = subprocess.run(
            [str(CONFIGURE_SCRIPT), '--unit-economics'],
            cwd=ROOT,
            env=self.env(),
            text=True,
            capture_output=True,
            check=True,
        )
        combined = result.stdout + result.stderr
        self.assertNotIn('1.234567', combined)
        self.assertIn('candidateCostPrinted=false', combined)
        self.assertIn('satisfied=true', combined)
        self.assertIn('bindingPlan=max', combined)

    def test_configure_helper_authorization_ledger_template_is_no_secret(self):
        template = ROOT / 'docs' / 'launch' / 'execution' / 'provider-authorization-ledger-template.md'
        self.assertTrue(template.exists())
        self.assertIn('privateEvidenceReference: provider-review-YYYYMMDD-doc-or-ticket-id', template.read_text(encoding='utf-8'))

        result = subprocess.run(
            [str(CONFIGURE_SCRIPT), '--authorization-ledger-template'],
            cwd=ROOT,
            env=self.env(),
            text=True,
            capture_output=True,
            check=True,
        )
        combined = result.stdout + result.stderr
        self.assertIn('Sage Router Managed Provider Authorization Ledger Template', combined)
        self.assertIn('privateEvidenceReference: provider-review-YYYYMMDD-doc-or-ticket-id', combined)
        self.assertIn('--provider-reply-triage-packet', combined)
        self.assertIn('| ollama | pending | pending | private-ref-only', combined)
        self.assertIn('| openai | pending | pending | private-ref-only', combined)
        self.assertIn('| anthropic | pending | pending | private-ref-only', combined)
        self.assertIn('OpenRouter, remain outside managed resale', combined)
        self.assertIn('publicEnableApproved=false', combined)
        self.assertIn('containsActualProviderCosts=false', combined)
        self.assertNotIn('1.234567', combined)
        self.assertNotIn('provider account ID:', combined)

    def test_configure_helper_documents_no_secret_operator_packet(self):
        script = CONFIGURE_SCRIPT.read_text(encoding='utf-8')
        self.assertIn('--operator-packet', script)
        self.assertIn('--authorization-packet', script)
        self.assertIn('--record-authorization-review', script)
        self.assertIn('--authorization-ledger-template', script)
        self.assertIn('--provider-outreach-packet', script)
        self.assertIn('--record-provider-outreach', script)
        self.assertIn('--provider-reply-triage-packet', script)
        self.assertIn('--terms-approval-packet', script)
        self.assertIn('--record-terms-review', script)
        self.assertIn('provider-authorization-ledger-template.md', script)
        self.assertIn('--one-subscription-pricing-packet', script)
        self.assertIn('load_local_env_file', script)
        self.assertIn('SAGEROUTER_SECRET_ENV_FILE', script)
        self.assertIn('Sage Router managed resale operator packet', script)
        self.assertIn('Sage Router managed provider authorization packet', script)
        self.assertIn('Sage Router Managed Provider Authorization Ledger Template', script)
        self.assertIn('Sage Router managed provider outreach packet', script)
        self.assertIn('Sage Router provider reply triage packet', script)
        self.assertIn('Sage Router one-subscription pricing packet', script)
        self.assertIn('Provider-family authorization checklist', script)
        self.assertIn('Provider-specific copy blocks', script)
        self.assertIn('status_managed_provider_outreach_copied', script)
        self.assertIn('operator-provider-outreach-packet', script)
        self.assertIn('Recorded provider outreach handoff event status_managed_provider_outreach_copied', script)
        self.assertIn('status_managed_provider_authorization_review_copied', script)
        self.assertIn('operator-provider-authorization-review-packet', script)
        self.assertIn('Recorded provider authorization review event status_managed_provider_authorization_review_copied', script)
        self.assertIn('status_managed_provider_terms_review_copied', script)
        self.assertIn('operator-provider-terms-review-packet', script)
        self.assertIn('Recorded provider terms review event status_managed_provider_terms_review_copied', script)
        self.assertIn('Reply triage matrix:', script)
        self.assertIn('containsProviderReplyBody=false', script)
        self.assertIn('provider-review-YYYYMMDD-doc-or-ticket-id', script)
        self.assertIn('OpenRouter and BYOK-compatible gateways', script)
        self.assertIn('read-only review packet', script)
        self.assertIn('DEFAULT_RESALE_ALLOWED_PROVIDERS="ollama,openai,anthropic"', script)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_REQUESTED=1', script)
        self.assertIn('reviewRequested', script)
        self.assertIn('requestedEnv', script)
        self.assertIn('allowed_providers_input_state', script)
        self.assertIn("default:%s", script)
        self.assertIn('does not send email, acknowledge terms, write secrets, deploy Cloud Run, or enable managed resale', script)
        self.assertIn('does not acknowledge terms, write secrets, enable managed resale, deploy Cloud Run, or send customer email', script)
        self.assertIn('containsActualProviderCosts=false', script)
        self.assertIn('containsAuthorizationReference=false', script)
        self.assertIn('sendsEmail=false', script)
        self.assertIn('maxSafeProviderCostCentsPer1k', script)
        self.assertIn('Public managed-access offer ladder:', script)
        self.assertIn('managed-access-max-contract-floor', script)
        self.assertIn('managedAccessAddOnGuardrails', (ROOT / 'scripts' / 'managed_provider_unit_economics.py').read_text(encoding='utf-8'))
        self.assertIn('SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST', script)
        self.assertIn('containsRequiredPrivatePrices=false', script)
        self.assertIn('mutatesRuntime=false', script)

        doc = OUTREACH_DOC.read_text(encoding='utf-8')
        self.assertIn('Sage Router Provider Authorization Outreach', doc)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet', doc)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet', doc)
        self.assertIn('Ollama / Ollama Cloud', doc)
        self.assertIn('OpenAI', doc)
        self.assertIn('Anthropic', doc)
        self.assertIn('Do not paste provider agreements, cost schedules, provider account IDs', doc)
        self.assertIn('Keep `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0`', doc)
        ledger = (ROOT / 'docs' / 'launch' / 'execution' / 'provider-authorization-ledger-template.md').read_text(encoding='utf-8')
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --record-authorization-review', ledger)
        self.assertIn('review-only handoff', ledger)

        pricing_review = PRICING_REVIEW_DOC.read_text(encoding='utf-8')
        self.assertIn('Sage Router One-Subscription Pricing Review', pricing_review)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --one-subscription-pricing-packet', pricing_review)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --private-cost-model-template', pricing_review)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet', pricing_review)
        self.assertIn('Binding public plan: `max`', pricing_review)
        self.assertIn('| Max | `$72/mo` | `200,000` | `36.0c` | `23.4c` | `1` |', pricing_review)
        self.assertIn('Public Managed-Access Offer Ladder', pricing_review)
        self.assertIn('| Managed Access Max Contract Floor | `$100/mo` | `75,000` | `133.3333c` | `86.6667c` |', pricing_review)
        self.assertIn('public-threshold-only managed-access pilot/add-on/private Max contract ladder', self.read_text('README.md') if hasattr(self, 'read_text') else ROOT.joinpath('README.md').read_text(encoding='utf-8'))
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0', pricing_review)
        self.assertIn('containsActualProviderCosts=false', pricing_review)
        self.assertIn('containsRequiredPrivatePrices=false', pricing_review)

        terms_review = TERMS_REVIEW_DOC.read_text(encoding='utf-8')
        self.assertIn('Sage Router Provider Terms Approval Review', terms_review)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --terms-approval-packet', terms_review)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --record-terms-review', terms_review)
        self.assertIn('provider_terms_acknowledgment', terms_review)
        self.assertIn('status_managed_provider_terms_review_copied', terms_review)
        self.assertIn('operator-provider-terms-review-packet', terms_review)
        self.assertIn('SAGEROUTER_PROVIDER_RESALE_TERMS_ACKNOWLEDGED', terms_review)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC', terms_review)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_REQUESTED', terms_review)
        self.assertIn('publicEnableApproved: false', terms_review)
        self.assertIn('containsActualProviderCosts=false', terms_review)
        self.assertIn('containsAuthorizationReference=false', terms_review)

    def test_configure_helper_one_subscription_pricing_packet_is_public_threshold_only(self):
        script = CONFIGURE_SCRIPT.read_text(encoding='utf-8')
        self.assertIn('Usage: scripts/configure_managed_provider_resale_readiness.sh', script)
        self.assertIn('--one-subscription-pricing-packet', script)
        self.assertIn('--private-cost-model-template', script)
        self.assertIn('Sage Router one-subscription pricing packet', script)
        self.assertIn('Sage Router Private Managed-Provider Cost Model Template', script)
        self.assertIn('Public fixed-plan thresholds:', script)
        self.assertIn('Public managed-access offer ladder:', script)
        self.assertIn('Packaging decision for one-subscription beta:', script)
        self.assertIn('binding public plan', script)
        self.assertIn('privateCostStatus=not_printed', script)
        self.assertIn('includedManagedRequests', script)
        self.assertIn('managed-access-pro-add-on', script)
        self.assertIn('add a managed-access surcharge', script)
        self.assertIn('private Max contract', script)
        self.assertIn('Provider outreach: scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet', script)
        self.assertIn('Provider reply triage: scripts/configure_managed_provider_resale_readiness.sh --provider-reply-triage-packet', script)
        self.assertIn('SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST', script)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0', script)
        self.assertIn('containsActualProviderCosts=false', script)
        self.assertIn('containsRequiredPrivatePrices=false', script)
        self.assertIn('containsAuthorizationReference=false', script)
        self.assertIn('mutatesRuntime=false', script)
        self.assertIn('providerCostCentsPer1kRequests: PRIVATE_VALUE_NOT_FOR_CHAT_OR_GIT', script)
        self.assertIn('publicEnableApproved=false', script)
        self.assertNotIn('required_private_price', script)

    def test_configure_helper_provider_reply_triage_packet_is_no_secret(self):
        script = CONFIGURE_SCRIPT.read_text(encoding='utf-8')
        self.assertIn('--provider-reply-triage-packet', script)
        self.assertIn('Sage Router provider reply triage packet', script)
        self.assertIn('Reply triage matrix:', script)
        self.assertIn('managedAccessDecision', script)
        self.assertIn('privateEvidenceReference', script)
        self.assertIn('privateCostReviewReference', script)
        self.assertIn('Keep OpenRouter and BYOK-compatible gateways outside the managed resale allowlist', script)
        self.assertIn('mutatesRuntime=false; sendsEmail=false', script)
        self.assertIn('containsProviderReplyBody=false', script)

        result = subprocess.run(
            [str(CONFIGURE_SCRIPT), '--provider-reply-triage-packet'],
            cwd=ROOT,
            env=self.env(),
            text=True,
            capture_output=True,
            check=True,
        )
        combined = result.stdout + result.stderr
        self.assertIn('Sage Router provider reply triage packet', combined)
        self.assertIn('Reply triage matrix:', combined)
        self.assertIn('| ollama | pending | pending | pending |', combined)
        self.assertIn('| openai | pending | pending | pending |', combined)
        self.assertIn('| anthropic | pending | pending | pending |', combined)
        self.assertIn('private-ref-only', combined)
        self.assertIn('managedAccessDecision', combined)
        self.assertIn('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC', combined)
        self.assertIn('containsProviderReplyBody=false', combined)
        self.assertIn('containsActualProviderCosts=false', combined)
        self.assertIn('containsAuthorizationReference=false', combined)
        self.assertNotIn('1.234567', combined)
        self.assertNotIn('provider account ID:', combined)


if __name__ == '__main__':
    unittest.main()
