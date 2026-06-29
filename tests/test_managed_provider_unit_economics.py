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
        self.assertTrue(report['recommendedActions'])
        self.assertEqual('binding_plan', report['recommendedActions'][0]['kind'])
        self.assertEqual('max', report['recommendedActions'][0]['plan'])
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
        self.assertIn('--authorization-ledger-template', script)
        self.assertIn('--provider-outreach-packet', script)
        self.assertIn('load_local_env_file', script)
        self.assertIn('SAGEROUTER_SECRET_ENV_FILE', script)
        self.assertIn('Sage Router managed resale operator packet', script)
        self.assertIn('Sage Router managed provider authorization packet', script)
        self.assertIn('Sage Router Managed Provider Authorization Ledger Template', script)
        self.assertIn('Sage Router managed provider outreach packet', script)
        self.assertIn('Provider-family authorization checklist', script)
        self.assertIn('Provider-specific copy blocks', script)
        self.assertIn('provider-review-YYYYMMDD-doc-or-ticket-id', script)
        self.assertIn('OpenRouter and BYOK-compatible gateways', script)
        self.assertIn('read-only review packet', script)
        self.assertIn('does not send email, acknowledge terms, write secrets, deploy Cloud Run, or enable managed resale', script)
        self.assertIn('does not acknowledge terms, write secrets, enable managed resale, deploy Cloud Run, or send customer email', script)
        self.assertIn('containsActualProviderCosts=false', script)
        self.assertIn('containsAuthorizationReference=false', script)
        self.assertIn('sendsEmail=false', script)
        self.assertIn('maxSafeProviderCostCentsPer1k', script)
        self.assertIn('SAGEROUTER_PROVIDER_RESALE_COST_CENTS_PER_1K_REQUESTS=REVIEWED_PRIVATE_COST', script)

        doc = OUTREACH_DOC.read_text(encoding='utf-8')
        self.assertIn('Sage Router Provider Authorization Outreach', doc)
        self.assertIn('scripts/configure_managed_provider_resale_readiness.sh --provider-outreach-packet', doc)
        self.assertIn('Ollama / Ollama Cloud', doc)
        self.assertIn('OpenAI', doc)
        self.assertIn('Anthropic', doc)
        self.assertIn('Do not paste provider agreements, cost schedules, provider account IDs', doc)
        self.assertIn('Keep `SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0`', doc)


if __name__ == '__main__':
    unittest.main()
