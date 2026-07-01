#!/usr/bin/env python3
"""Secret-safe managed-provider unit-economics preflight."""

import argparse
import json
import logging
import os
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# This CLI only needs public plan math. Keep import-time provider discovery from
# touching external provider APIs while an operator is reviewing private costs.
os.environ['SAGE_ROUTER_OLLAMA_CLOUD_CATALOG_ENABLED'] = '0'
os.environ['SAGE_ROUTER_PROFILE_OVERLAYS'] = ''
_disabled = {
    item.strip()
    for item in os.environ.get('SAGE_ROUTER_DISABLED_PROVIDERS', '').split(',')
    if item.strip()
}
_disabled.update({
    'anthropic',
    'darkbloom',
    'dario',
    'google',
    'google-vertex',
    'nvidia-nim',
    'ollama',
    'ollama-cloud',
    'ollama-cyber',
    'openai',
    'openai-codex',
    'openrouter',
})
os.environ['SAGE_ROUTER_DISABLED_PROVIDERS'] = ','.join(sorted(_disabled))
logging.basicConfig(level=logging.ERROR)

import router  # noqa: E402


MANAGED_ACCESS_ADD_ON_OFFERS = [
    {
        'id': 'managed-access-pilot',
        'label': 'Managed Access Pilot',
        'monthlyPriceUsd': 10.0,
        'monthlyManagedRequests': 10000,
        'recommendedUse': 'small private-beta trial before bundling managed provider access into fixed plans',
    },
    {
        'id': 'managed-access-pro-add-on',
        'label': 'Managed Access Pro Add-on',
        'monthlyPriceUsd': 30.0,
        'monthlyManagedRequests': 25000,
        'recommendedUse': 'paid Pro/Max add-on when fixed-plan included quota fails private cost review',
    },
    {
        'id': 'managed-access-max-contract-floor',
        'label': 'Managed Access Max Contract Floor',
        'monthlyPriceUsd': 100.0,
        'monthlyManagedRequests': 75000,
        'recommendedUse': 'private Max contract floor for buyers who need bundled managed provider access',
    },
]


def parse_margin(raw):
    try:
        return max(0, int(float(str(raw or '').strip() or '35')))
    except (TypeError, ValueError):
        return 0


def offer_guardrail(row, failed_plans):
    plan = row.get('plan')
    max_safe_cost = float(row.get('maximumProviderCostCentsPerThousandRequests') or 0)
    guidance = 'eligible_if_private_cost_is_at_or_below_public_threshold'
    if plan in failed_plans:
        guidance = 'exclude_or_add_managed_access_surcharge_until_private_cost_passes'
    elif max_safe_cost < 30:
        guidance = 'review_quota_or_add_on_before_bundling_expensive_frontier_access'
    return {
        'plan': plan,
        'monthlyRequests': row.get('monthlyRequests'),
        'monthlyPriceUsd': row.get('monthlyPriceUsd'),
        'maximumSafeProviderCostCentsPerThousandRequests': row.get(
            'maximumProviderCostCentsPerThousandRequests'
        ),
        'constraintRank': row.get('constraintRank'),
        'candidatePasses': bool(row.get('meetsMinimumGrossMargin')),
        'guidance': guidance,
        'privacy': 'public_threshold_only',
    }


def cents_per_thousand(monthly_price_usd, monthly_requests):
    if not monthly_requests:
        return 0.0
    value = (Decimal(str(monthly_price_usd)) * Decimal('100')) / (
        Decimal(str(monthly_requests)) / Decimal('1000')
    )
    return float(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))


def max_safe_cost(revenue_cents_per_thousand, minimum_margin_percent):
    margin = Decimal(str(minimum_margin_percent)) / Decimal('100')
    multiplier = max(Decimal('0'), Decimal('1') - margin)
    value = Decimal(str(revenue_cents_per_thousand)) * multiplier
    return float(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))


def max_safe_cost_for_offer(monthly_price_usd, monthly_requests, minimum_margin_percent):
    if not monthly_requests:
        return 0.0
    revenue = (Decimal(str(monthly_price_usd)) * Decimal('100')) / (
        Decimal(str(monthly_requests)) / Decimal('1000')
    )
    margin = Decimal(str(minimum_margin_percent)) / Decimal('100')
    multiplier = max(Decimal('0'), Decimal('1') - margin)
    value = revenue * multiplier
    return float(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))


def managed_access_add_on_guardrails(candidate_cost, minimum_margin_percent):
    rows = []
    candidate_configured = candidate_cost is not None
    for offer in MANAGED_ACCESS_ADD_ON_OFFERS:
        revenue = cents_per_thousand(
            offer['monthlyPriceUsd'],
            offer['monthlyManagedRequests'],
        )
        threshold = max_safe_cost_for_offer(
            offer['monthlyPriceUsd'],
            offer['monthlyManagedRequests'],
            minimum_margin_percent,
        )
        candidate_passes = bool(candidate_configured and float(candidate_cost) <= threshold)
        rows.append({
            'id': offer['id'],
            'label': offer['label'],
            'monthlyPriceUsd': offer['monthlyPriceUsd'],
            'monthlyManagedRequests': offer['monthlyManagedRequests'],
            'revenueCentsPerThousandRequests': revenue,
            'maximumProviderCostCentsPerThousandRequests': threshold,
            'minimumGrossMarginPercent': minimum_margin_percent,
            'candidatePasses': candidate_passes,
            'guidance': (
                'eligible_private_beta_offer_if_authorization_and_terms_pass'
                if candidate_passes
                else 'review_private_cost_before_offering_managed_access'
            ),
            'recommendedUse': offer['recommendedUse'],
            'privacy': 'public_threshold_only',
        })
    rows.sort(
        key=lambda row: float(row.get('maximumProviderCostCentsPerThousandRequests') or 0),
        reverse=True,
    )
    return rows


def public_safe_preflight(minimum_margin_percent):
    candidate_cost = router.parse_provider_resale_cost_cents_per_thousand_requests()
    economics = router.managed_provider_unit_economics(candidate_cost, minimum_margin_percent)
    rows = []
    source_rows = economics.get('evaluatedPlans') or []
    ranked_rows = sorted(
        source_rows,
        key=lambda row: float(row.get('maximumProviderCostCentsPerThousandRequests') or 0),
    )
    constraint_rank = {
        str(row.get('plan')): index + 1
        for index, row in enumerate(ranked_rows)
        if row.get('plan')
    }
    for row in source_rows:
        rows.append({
            'plan': row.get('plan'),
            'monthlyRequests': row.get('monthlyRequests'),
            'monthlyPriceUsd': row.get('monthlyPriceUsd'),
            'revenueCentsPerThousandRequests': row.get('revenueCentsPerThousandRequests'),
            'minimumGrossMarginPercent': row.get('minimumGrossMarginPercent'),
            'maximumProviderCostCentsPerThousandRequests': row.get(
                'maximumProviderCostCentsPerThousandRequests'
            ),
            'constraintRank': constraint_rank.get(str(row.get('plan'))),
            'meetsMinimumGrossMargin': bool(row.get('meetsMinimumGrossMargin')),
        })
    failed = [row['plan'] for row in rows if not row.get('meetsMinimumGrossMargin')]
    pricing_guardrails = [offer_guardrail(row, failed) for row in rows]
    add_on_guardrails = managed_access_add_on_guardrails(candidate_cost, minimum_margin_percent)
    binding = min(
        rows,
        key=lambda row: float(row.get('maximumProviderCostCentsPerThousandRequests') or 0),
        default=None,
    )
    recommendations = []
    if binding:
        recommendations.append({
            'kind': 'binding_plan',
            'plan': binding.get('plan'),
            'message': (
                f"{binding.get('plan')} is the tightest fixed-plan constraint because it "
                "has the lowest public maximum safe provider cost per 1,000 requests."
            ),
            'privacy': 'public_threshold_only',
        })
    if failed:
        recommendations.extend([
            {
                'kind': 'revise_fixed_plan_economics',
                'plans': failed,
                'message': (
                    "For failed plans, raise public price, lower included monthly "
                    "requests, require a managed-access add-on, or exclude the plan "
                    "from one-subscription access until the private cost candidate "
                    "falls below its public safe threshold. Use pricingGuardrails "
                    "for public threshold-only plan guidance."
                ),
                'privacy': 'does_not_print_private_cost_or_required_private_price',
            },
            {
                'kind': 'review_managed_access_add_on',
                'message': (
                    "Use managedAccessAddOnGuardrails to test a separate managed-access "
                    "pilot/add-on/private-contract offer before bundling managed provider "
                    "access into all fixed public plans."
                ),
                'privacy': 'public_threshold_only',
            },
            {
                'kind': 'keep_public_resale_disabled',
                'plans': failed,
                'message': (
                    "Keep SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLE_PUBLIC=0 while any "
                    "fixed public API plan fails the unit-economics preflight."
                ),
                'privacy': 'public_threshold_only',
            },
        ])
    else:
        recommendations.append({
            'kind': 'stage_private_cost_model',
            'message': (
                "The candidate cost passes the public fixed-plan thresholds; stage the "
                "cost model only after provider authorization evidence and terms "
                "approval are current, and keep public managed resale disabled until "
                "final approval."
            ),
            'privacy': 'does_not_print_private_cost',
        })
    return {
        'kind': 'managed_provider_unit_economics_preflight',
        'costModel': economics.get('costModel'),
        'costModelConfigured': bool(economics.get('costModelConfigured')),
        'costModelEnv': economics.get('costModelEnv'),
        'candidateCostProvided': bool(economics.get('costModelConfigured')),
        'candidateCostPrinted': False,
        'actualProviderCostExposed': False,
        'grossMarginPercentExposed': False,
        'minimumGrossMarginPercent': minimum_margin_percent,
        'evaluatedPlans': rows,
        'failedPlans': failed,
        'bindingPlan': binding.get('plan') if binding else None,
        'pricingGuardrails': pricing_guardrails,
        'managedAccessAddOnGuardrails': add_on_guardrails,
        'firstPassingManagedAccessOffer': next(
            (row['id'] for row in add_on_guardrails if row.get('candidatePasses')),
            None,
        ),
        'recommendedActions': recommendations,
        'satisfied': bool(economics.get('satisfied')),
        'privacy': {
            'containsSecrets': False,
            'containsProviderCredentials': False,
            'containsActualProviderCosts': False,
            'containsGrossMarginPercent': False,
            'containsPrompts': False,
            'containsRawProviderResponses': False,
        },
    }


def print_text(report):
    print('Managed provider unit-economics preflight')
    print(f"candidateCostProvided={'true' if report['candidateCostProvided'] else 'false'}")
    print('candidateCostPrinted=false')
    print('actualProviderCostExposed=false')
    print('grossMarginPercentExposed=false')
    print(f"minimumGrossMarginPercent={report['minimumGrossMarginPercent']}")
    print(f"satisfied={'true' if report['satisfied'] else 'false'}")
    if report.get('bindingPlan'):
        print(f"bindingPlan={report['bindingPlan']}")
    print('plans:')
    for row in report['evaluatedPlans']:
        status = 'pass' if row['meetsMinimumGrossMargin'] else 'fail'
        print(
            f"- {row['plan']}: revenueCentsPer1k={row['revenueCentsPerThousandRequests']} "
            f"maxSafeProviderCostCentsPer1k={row['maximumProviderCostCentsPerThousandRequests']} "
            f"minimumGrossMarginPercent={row['minimumGrossMarginPercent']} "
            f"constraintRank={row['constraintRank']} "
            f"status={status}"
        )
    if report['failedPlans']:
        print('failedPlans=' + ','.join(report['failedPlans']))
    print('pricingGuardrails:')
    for row in report.get('pricingGuardrails') or []:
        print(
            f"- {row['plan']}: "
            f"maxSafeProviderCostCentsPer1k={row['maximumSafeProviderCostCentsPerThousandRequests']} "
            f"constraintRank={row['constraintRank']} "
            f"candidatePasses={'true' if row['candidatePasses'] else 'false'} "
            f"guidance={row['guidance']}"
        )
    print('managedAccessAddOnGuardrails:')
    for row in report.get('managedAccessAddOnGuardrails') or []:
        print(
            f"- {row['id']}: "
            f"priceUsd={row['monthlyPriceUsd']} "
            f"includedManagedRequests={row['monthlyManagedRequests']} "
            f"revenueCentsPer1k={row['revenueCentsPerThousandRequests']} "
            f"maxSafeProviderCostCentsPer1k={row['maximumProviderCostCentsPerThousandRequests']} "
            f"candidatePasses={'true' if row['candidatePasses'] else 'false'} "
            f"guidance={row['guidance']}"
        )
    if report.get('firstPassingManagedAccessOffer'):
        print(f"firstPassingManagedAccessOffer={report['firstPassingManagedAccessOffer']}")
    print('recommendedActions:')
    for action in report.get('recommendedActions') or []:
        plans = action.get('plans')
        suffix = f" plans={','.join(plans)}" if plans else ''
        plan = action.get('plan')
        if plan and not suffix:
            suffix = f" plan={plan}"
        print(f"- {action.get('kind')}{suffix}: {action.get('message')}")


def main():
    parser = argparse.ArgumentParser(
        description='Validate managed-provider resale unit economics without printing provider costs.'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Print a machine-readable secret-free report.',
    )
    parser.add_argument(
        '--min-margin',
        default=os.environ.get('SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT', '35'),
        help='Minimum gross margin percent. Defaults to SAGEROUTER_PROVIDER_RESALE_MIN_GROSS_MARGIN_PERCENT or 35.',
    )
    args = parser.parse_args()

    report = public_safe_preflight(parse_margin(args.min_margin))
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_text(report)
    return 0 if report['satisfied'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
