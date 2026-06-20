#!/usr/bin/env python3
import json
import os
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('SAGE_ROUTER_DARIO_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_SUPABASE_AUTH_ENABLED', '0')

import sys
sys.path.insert(0, str(ROOT))
import router  # noqa: E402
# Tests in this module exercise the hosted billing tier. The router
# does not collect user identities by default, so opt in here.
os.environ.setdefault('SAGE_ROUTER_BILLING_ENABLED', '1')



class SaaSAuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        # Hosted billing tier is required to look up a customer for a user.
        self._billing_env = os.environ.get('SAGE_ROUTER_BILLING_ENABLED')
        os.environ['SAGE_ROUTER_BILLING_ENABLED'] = '1'
        self.old = {
            'CUSTOMER_STORE_PATH': router.CUSTOMER_STORE_PATH,
            'SUPABASE_URL': router.SUPABASE_URL,
            'SUPABASE_SERVICE_ROLE_KEY': router.SUPABASE_SERVICE_ROLE_KEY,
            'SUPABASE_USAGE_COUNTERS_TABLE': router.SUPABASE_USAGE_COUNTERS_TABLE,
            'SUPABASE_FUNNEL_EVENTS_TABLE': router.SUPABASE_FUNNEL_EVENTS_TABLE,
            'supabase_select': router.supabase_select,
            'CLIENT_API_KEYS': list(router.CLIENT_API_KEYS),
            'CLIENT_AUTH_REQUIRED': router.CLIENT_AUTH_REQUIRED,
            'ANALYTICS_TOKEN': router.ANALYTICS_TOKEN,
            'SUPABASE_AUTH_ENABLED': router.SUPABASE_AUTH_ENABLED,
            'REQUIRE_VERIFIED_EMAIL': router.REQUIRE_VERIFIED_EMAIL,
            'STRIPE_SECRET_KEY': router.STRIPE_SECRET_KEY,
            'STRIPE_PRICE_ID': router.STRIPE_PRICE_ID,
            'STRIPE_PRICE_IDS_RAW': router.STRIPE_PRICE_IDS_RAW,
            'STRIPE_WEBHOOK_SECRET': router.STRIPE_WEBHOOK_SECRET,
            'stripe_request': router.stripe_request,
            'CRYPTO_PAYMENT_ADDRESS': router.CRYPTO_PAYMENT_ADDRESS,
            'PUBLIC_BASE_URL': router.PUBLIC_BASE_URL,
            'MARKETING_BASE_URL': router.MARKETING_BASE_URL,
            'APP_BASE_URL': router.APP_BASE_URL,
            'API_BASE_URL': router.API_BASE_URL,
            'MAX_ACTIVE_API_KEYS_PER_CUSTOMER': router.MAX_ACTIVE_API_KEYS_PER_CUSTOMER,
            'PUBLIC_PLAN_RATE_LIMITS_RAW': router.PUBLIC_PLAN_RATE_LIMITS_RAW,
            'PUBLIC_PLAN_MONTHLY_QUOTAS_RAW': router.PUBLIC_PLAN_MONTHLY_QUOTAS_RAW,
            'supabase_user_for_bearer': router.supabase_user_for_bearer,
            'ROUTE_EVENTS_PATH': router.ROUTE_EVENTS_PATH,
            'FIRESTORE_ENABLED': router.FIRESTORE_ENABLED,
            'SUPABASE_MIRROR_ENABLED': router.SUPABASE_MIRROR_ENABLED,
            'read_launch_waitlist_counts': router.read_launch_waitlist_counts,
            'read_launch_marketing_funnel_counts': router.read_launch_marketing_funnel_counts,
        }
        router.CUSTOMER_STORE_PATH = os.path.join(self.tmp.name, 'customers.json')
        router.SUPABASE_URL = ''
        router.SUPABASE_SERVICE_ROLE_KEY = ''
        router.SUPABASE_USAGE_COUNTERS_TABLE = 'sage_router_usage_counters'
        router.SUPABASE_FUNNEL_EVENTS_TABLE = 'sage_router_funnel_events'
        router.CLIENT_API_KEYS = []
        router.CLIENT_AUTH_REQUIRED = True
        router.ANALYTICS_TOKEN = ''
        router.SUPABASE_AUTH_ENABLED = False
        router.REQUIRE_VERIFIED_EMAIL = True
        router.STRIPE_SECRET_KEY = ''
        router.STRIPE_PRICE_ID = ''
        router.STRIPE_PRICE_IDS_RAW = ''
        router.STRIPE_WEBHOOK_SECRET = ''
        router.CRYPTO_PAYMENT_ADDRESS = ''
        router.PUBLIC_BASE_URL = 'https://app.sagerouter.dev'
        router.MARKETING_BASE_URL = 'https://sagerouter.dev'
        router.APP_BASE_URL = 'https://app.sagerouter.dev'
        router.API_BASE_URL = 'https://api.sagerouter.dev'
        router.MAX_ACTIVE_API_KEYS_PER_CUSTOMER = 5
        router.PUBLIC_PLAN_RATE_LIMITS_RAW = 'trial=30,lite=60,pro=180,max=600,manual=600,paid=180,active=180,default=60'
        router.PUBLIC_PLAN_MONTHLY_QUOTAS_RAW = 'trial=1000,lite=10000,pro=50000,max=200000,paid=50000,active=50000,default=0'
        router.ROUTE_EVENTS_PATH = os.path.join(self.tmp.name, 'route-events.jsonl')
        router.FIRESTORE_ENABLED = False
        router.SUPABASE_MIRROR_ENABLED = False

    def tearDown(self):
        router.CUSTOMER_STORE_PATH = self.old['CUSTOMER_STORE_PATH']
        router.SUPABASE_URL = self.old['SUPABASE_URL']
        router.SUPABASE_SERVICE_ROLE_KEY = self.old['SUPABASE_SERVICE_ROLE_KEY']
        router.SUPABASE_USAGE_COUNTERS_TABLE = self.old['SUPABASE_USAGE_COUNTERS_TABLE']
        router.SUPABASE_FUNNEL_EVENTS_TABLE = self.old['SUPABASE_FUNNEL_EVENTS_TABLE']
        router.supabase_select = self.old['supabase_select']
        router.CLIENT_API_KEYS = self.old['CLIENT_API_KEYS']
        router.CLIENT_AUTH_REQUIRED = self.old['CLIENT_AUTH_REQUIRED']
        router.ANALYTICS_TOKEN = self.old['ANALYTICS_TOKEN']
        router.SUPABASE_AUTH_ENABLED = self.old['SUPABASE_AUTH_ENABLED']
        router.REQUIRE_VERIFIED_EMAIL = self.old['REQUIRE_VERIFIED_EMAIL']
        router.STRIPE_SECRET_KEY = self.old['STRIPE_SECRET_KEY']
        router.STRIPE_PRICE_ID = self.old['STRIPE_PRICE_ID']
        router.STRIPE_PRICE_IDS_RAW = self.old['STRIPE_PRICE_IDS_RAW']
        router.STRIPE_WEBHOOK_SECRET = self.old['STRIPE_WEBHOOK_SECRET']
        router.stripe_request = self.old['stripe_request']
        router.CRYPTO_PAYMENT_ADDRESS = self.old['CRYPTO_PAYMENT_ADDRESS']
        router.PUBLIC_BASE_URL = self.old['PUBLIC_BASE_URL']
        router.MARKETING_BASE_URL = self.old['MARKETING_BASE_URL']
        router.APP_BASE_URL = self.old['APP_BASE_URL']
        router.API_BASE_URL = self.old['API_BASE_URL']
        router.MAX_ACTIVE_API_KEYS_PER_CUSTOMER = self.old['MAX_ACTIVE_API_KEYS_PER_CUSTOMER']
        router.PUBLIC_PLAN_RATE_LIMITS_RAW = self.old['PUBLIC_PLAN_RATE_LIMITS_RAW']
        router.PUBLIC_PLAN_MONTHLY_QUOTAS_RAW = self.old['PUBLIC_PLAN_MONTHLY_QUOTAS_RAW']
        router.supabase_user_for_bearer = self.old['supabase_user_for_bearer']
        router.ROUTE_EVENTS_PATH = self.old['ROUTE_EVENTS_PATH']
        router.FIRESTORE_ENABLED = self.old['FIRESTORE_ENABLED']
        router.SUPABASE_MIRROR_ENABLED = self.old['SUPABASE_MIRROR_ENABLED']
        router.read_launch_waitlist_counts = self.old['read_launch_waitlist_counts']
        router.read_launch_marketing_funnel_counts = self.old['read_launch_marketing_funnel_counts']
        if self._billing_env is None:
            os.environ.pop('SAGE_ROUTER_BILLING_ENABLED', None)
        else:
            os.environ['SAGE_ROUTER_BILLING_ENABLED'] = self._billing_env
        self.tmp.cleanup()

    def active_customer(self):
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        data = router.local_customer_store()
        data['customers'][0]['plan'] = 'pro'
        data['customers'][0]['status'] = 'active'
        router.write_local_customer_store(data)
        return router.customer_for_user({'id': 'user-1'}, create=False)

    def signed_stripe_webhook_handler(self, event):
        body = json.dumps(event, separators=(',', ':')).encode()
        timestamp = str(router.now_epoch())
        sig = router.hmac.new(
            router.STRIPE_WEBHOOK_SECRET.encode(),
            f'{timestamp}.{body.decode()}'.encode(),
            router.hashlib.sha256,
        ).hexdigest()

        class Dummy:
            path = '/billing/stripe/webhook'
            def __init__(self):
                self.headers = {'Content-Length': str(len(body)), 'Stripe-Signature': f't={timestamp},v1={sig}'}
                self.rfile = BytesIO(body)
                self.status = None
                self.payload = None
            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        return Dummy()

    def test_generated_key_is_hashed_and_verifies_when_active(self):
        customer = self.active_customer()
        raw, row = router.create_api_key_for_customer(customer, 'prod')
        self.assertNotIn(raw, json.dumps(router.local_customer_store()))
        self.assertEqual(router.api_key_hash(raw), row['api_key_hash'])
        ctx = router.verify_generated_api_key(raw)
        self.assertEqual('generated_key', ctx['type'])
        self.assertEqual(customer['id'], ctx['customer']['id'])

    def test_active_api_key_limit_blocks_new_keys_until_revoke(self):
        router.MAX_ACTIVE_API_KEYS_PER_CUSTOMER = 2
        customer = self.active_customer()
        first_raw, first_row = router.create_api_key_for_customer(customer, 'first')
        router.create_api_key_for_customer(customer, 'second')

        with self.assertRaisesRegex(ValueError, 'active_api_key_limit_reached:2'):
            router.create_api_key_for_customer(customer, 'third')

        router.revoke_api_key_for_customer(customer['id'], first_row['id'])
        replacement_raw, _replacement = router.create_api_key_for_customer(customer, 'replacement')

        self.assertNotEqual(first_raw, replacement_raw)
        self.assertEqual(2, router.active_api_key_count_for_customer(customer['id']))

    def test_account_api_key_endpoint_returns_conflict_at_active_key_limit(self):
        router.MAX_ACTIVE_API_KEYS_PER_CUSTOMER = 1
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        router.update_customer(customer['id'], {'plan': 'pro', 'status': 'active'})
        router.create_api_key_for_customer(router.customer_by_id(customer['id']), 'existing')
        body = b'{"name":"overflow"}'

        class Dummy:
            path = '/account/api-keys'
            headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': str(len(body))}
            rfile = BytesIO(body)
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)

        self.assertEqual(409, handler.status)
        self.assertEqual('active_api_key_limit_reached', handler.payload['error'])
        self.assertEqual(1, handler.payload['maxActiveApiKeysPerCustomer'])

    def test_hosted_account_reports_unverified_email_state(self):
        router.SUPABASE_AUTH_ENABLED = True
        router.REQUIRE_VERIFIED_EMAIL = True
        router.supabase_user_for_bearer = lambda token: {
            'id': 'user-verify',
            'email': 'verify@example.com',
            'user_metadata': {'email': 'verify@example.com'},
        } if token == 'valid-user-jwt' else None

        class Dummy:
            path = '/account'
            headers = {'Authorization': 'Bearer valid-user-jwt'}
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_GET(handler)

        self.assertEqual(200, handler.status)
        self.assertEqual('verify@example.com', handler.payload['emailVerification']['email'])
        self.assertTrue(handler.payload['emailVerification']['required'])
        self.assertFalse(handler.payload['emailVerification']['verified'])

    def test_unverified_hosted_user_cannot_create_key_or_start_checkout(self):
        router.SUPABASE_AUTH_ENABLED = True
        router.REQUIRE_VERIFIED_EMAIL = True
        router.STRIPE_SECRET_KEY = 'sk_test'
        router.STRIPE_PRICE_IDS_RAW = 'pro=price_pro'
        router.supabase_user_for_bearer = lambda token: {
            'id': 'user-unverified',
            'email': 'unverified@example.com',
        } if token == 'valid-user-jwt' else None

        class Dummy:
            def __init__(self, path, body=b'{}'):
                self.path = path
                self.headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': str(len(body))}
                self.rfile = BytesIO(body)
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        key_handler = Dummy('/account/api-keys', b'{"name":"prod"}')
        router.Handler.do_POST(key_handler)
        self.assertEqual(403, key_handler.status)
        self.assertEqual('email_verification_required', key_handler.payload['error'])
        customer = router.customer_for_user({'id': 'user-unverified'}, create=False)
        self.assertEqual(0, router.active_api_key_count_for_customer(customer['id']))

        checkout_handler = Dummy('/billing/stripe/checkout', b'{"plan":"pro"}')
        router.Handler.do_POST(checkout_handler)
        self.assertEqual(403, checkout_handler.status)
        self.assertEqual('email_verification_required', checkout_handler.payload['error'])

    def test_verified_hosted_user_can_create_generated_key(self):
        router.SUPABASE_AUTH_ENABLED = True
        router.REQUIRE_VERIFIED_EMAIL = True
        router.supabase_user_for_bearer = lambda token: {
            'id': 'user-verified',
            'email': 'verified@example.com',
            'email_confirmed_at': '2026-06-20T00:00:00Z',
        } if token == 'valid-user-jwt' else None

        class Dummy:
            path = '/account/api-keys'
            headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': '15'}
            rfile = BytesIO(b'{"name":"prod"}')
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)

        self.assertEqual(201, handler.status)
        self.assertTrue(handler.payload['key'].startswith('sk_sage_'))
        self.assertNotIn(handler.payload['key'], json.dumps(router.local_customer_store()))

    def test_revoked_and_inactive_generated_keys_do_not_authorize(self):
        customer = self.active_customer()
        raw, row = router.create_api_key_for_customer(customer, 'prod')
        router.revoke_api_key_for_customer(customer['id'], row['id'])
        self.assertIsNone(router.verify_generated_api_key(raw))

        customer = router.customer_for_user({'id': 'user-2', 'email': 'u2@example.com'})
        raw, _row = router.create_api_key_for_customer(customer, 'inactive')
        self.assertIsNone(router.verify_generated_api_key(raw))

    def test_operator_suspend_customer_revokes_active_keys_and_blocks_routing(self):
        router.CLIENT_API_KEYS = ['operator-token']
        customer = self.active_customer()
        first_raw, _first = router.create_api_key_for_customer(customer, 'first')
        second_raw, _second = router.create_api_key_for_customer(customer, 'second')

        class Dummy:
            def __init__(self):
                self.path = f'/admin/customers/{customer["id"]}/suspend'
                self.headers = {'Authorization': 'Bearer operator-token', 'Content-Length': '2'}
                self.rfile = BytesIO(b'{}')
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)

        self.assertEqual(200, handler.status)
        self.assertEqual('suspended', handler.payload['status'])
        self.assertEqual(2, handler.payload['revokedApiKeys'])
        self.assertEqual('suspended', router.customer_by_id(customer['id'])['status'])
        self.assertEqual(0, router.active_api_key_count_for_customer(customer['id']))
        self.assertIsNone(router.verify_generated_api_key(first_raw))
        self.assertIsNone(router.verify_generated_api_key(second_raw))

    def test_operator_unsuspend_defaults_to_inactive_and_keeps_keys_revoked(self):
        router.CLIENT_API_KEYS = ['operator-token']
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'first')
        router.suspend_customer_for_operator(customer['id'])

        class Dummy:
            def __init__(self):
                self.path = f'/admin/customers/{customer["id"]}/unsuspend'
                self.headers = {'Authorization': 'Bearer operator-token', 'Content-Length': '2'}
                self.rfile = BytesIO(b'{}')
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)

        updated = router.customer_by_id(customer['id'])
        self.assertEqual(200, handler.status)
        self.assertEqual('inactive', handler.payload['status'])
        self.assertTrue(handler.payload['revokedApiKeysRemainRevoked'])
        self.assertEqual('inactive', updated['status'])
        self.assertFalse(router.customer_is_active(updated))
        self.assertEqual(0, router.active_api_key_count_for_customer(customer['id']))
        self.assertIsNone(router.verify_generated_api_key(raw))

    def test_operator_unsuspend_can_reactivate_without_restoring_revoked_keys(self):
        router.CLIENT_API_KEYS = ['operator-token']
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'first')
        router.suspend_customer_for_operator(customer['id'])
        body = b'{"status":"active"}'

        class Dummy:
            def __init__(self):
                self.path = f'/admin/customers/{customer["id"]}/unsuspend'
                self.headers = {'Authorization': 'Bearer operator-token', 'Content-Length': str(len(body))}
                self.rfile = BytesIO(body)
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)

        updated = router.customer_by_id(customer['id'])
        self.assertEqual(200, handler.status)
        self.assertEqual('active', handler.payload['status'])
        self.assertEqual('active', updated['status'])
        self.assertTrue(router.customer_is_active(updated))
        self.assertEqual(0, router.active_api_key_count_for_customer(customer['id']))
        self.assertIsNone(router.verify_generated_api_key(raw))

        fresh_raw, _fresh = router.create_api_key_for_customer(updated, 'after-review')
        self.assertIsNotNone(router.verify_generated_api_key(fresh_raw))

    def test_operator_customer_lookup_is_private_and_omits_key_hashes(self):
        router.CLIENT_API_KEYS = ['operator-token']
        customer = self.active_customer()
        _raw, _row = router.create_api_key_for_customer(customer, 'prod')
        other = router.customer_for_user({'id': 'user-2', 'email': 'other@example.com'})

        class Dummy:
            def __init__(self, path, token='operator-token'):
                self.path = path
                self.headers = {'Authorization': f'Bearer {token}'}
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        unauthorized = Dummy('/admin/customers', token='bad-token')
        router.Handler.do_GET(unauthorized)
        self.assertEqual(401, unauthorized.status)

        listing = Dummy('/admin/customers?q=u%40example.com&limit=10')
        router.Handler.do_GET(listing)
        self.assertEqual(200, listing.status)
        self.assertEqual(1, listing.payload['count'])
        self.assertEqual(customer['id'], listing.payload['customers'][0]['customer']['id'])
        self.assertTrue(listing.payload['privacy']['operatorOnly'])
        self.assertFalse(listing.payload['privacy']['containsApiKeyHashes'])
        self.assertNotIn('api_key_hash', json.dumps(listing.payload))

        detail = Dummy(f'/admin/customers/{other["id"]}')
        router.Handler.do_GET(detail)
        self.assertEqual(200, detail.status)
        self.assertEqual(other['id'], detail.payload['customer']['id'])
        self.assertEqual('inactive', detail.payload['activation']['status'])

    def test_stripe_payment_success_does_not_reactivate_suspended_customer(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        router.STRIPE_PRICE_IDS_RAW = 'lite=price_lite,pro=price_pro,max=price_max'
        customer = self.active_customer()
        router.update_customer(customer['id'], {
            'status': 'suspended',
            'stripe_customer_id': 'cus_1',
            'stripe_subscription_id': 'sub_1',
        })

        event = {
            'id': 'evt_suspended_payment_success',
            'type': 'invoice.payment_succeeded',
            'data': {'object': {
                'customer': 'cus_1',
                'subscription': 'sub_1',
                'metadata': {'customer_id': customer['id'], 'plan': 'pro'},
                'lines': {'data': [{'price': {'id': 'price_max'}}]},
            }},
        }
        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)

        updated = router.customer_by_id(customer['id'])
        self.assertEqual(200, handler.status)
        self.assertEqual('suspended', updated['status'])
        self.assertFalse(router.customer_is_active(updated))
        self.assertEqual('max', updated['plan'])

    def test_public_api_key_uses_effective_customer_plan_and_routing_state(self):
        customer = router.customer_for_user({'id': 'user-2', 'email': 'u2@example.com'})
        _raw, row = router.create_api_key_for_customer(customer, 'prepaid')
        inactive_public = router.public_api_key(row, customer)
        self.assertEqual('free', inactive_public['plan'])
        self.assertFalse(inactive_public['routing_enabled'])
        self.assertEqual('inactive', inactive_public['customer_status'])

        data = router.local_customer_store()
        data['customers'][0]['plan'] = 'max'
        data['customers'][0]['status'] = 'active'
        router.write_local_customer_store(data)
        active_customer = router.customer_for_user({'id': 'user-2'}, create=False)
        active_public = router.public_api_key(row, active_customer)
        self.assertEqual('max', active_public['plan'])
        self.assertEqual('free', active_public['key_plan'])
        self.assertTrue(active_public['routing_enabled'])

    def test_account_usage_defaults_to_current_plan_limits(self):
        customer = self.active_customer()
        usage = router.account_usage_for_customer(customer)

        self.assertEqual(customer['id'], usage['customer_id'])
        self.assertEqual('pro', usage['plan'])
        self.assertEqual(0, usage['requests'])
        self.assertEqual(50000, usage['quota'])
        self.assertEqual(50000, usage['remaining'])
        self.assertEqual(180, usage['rateLimitPerMinute'])
        self.assertFalse(usage['unlimited'])
        self.assertTrue(usage['routing_enabled'])

    def test_account_activation_reports_next_conversion_step(self):
        customer = self.active_customer()

        activation = router.account_activation_for_customer(customer)
        self.assertEqual('create_key', activation['nextAction'])
        self.assertTrue(activation['routingEnabled'])
        self.assertEqual(0, activation['activeKeyCount'])
        self.assertFalse(activation['firstRequestComplete'])

        _raw, key = router.create_api_key_for_customer(customer, 'prod')
        activation = router.account_activation_for_customer(customer, api_keys=[key])
        self.assertEqual('send_first_request', activation['nextAction'])
        self.assertEqual(1, activation['activeKeyCount'])
        self.assertEqual(0, activation['requestCount'])

        usage = router.account_usage_for_customer(customer)
        usage.update({'requests': 49950, 'quota': 50000})
        activation = router.account_activation_for_customer(customer, usage=usage, api_keys=[key])
        self.assertEqual('upgrade_before_quota', activation['nextAction'])
        self.assertTrue(activation['firstRequestComplete'])
        self.assertEqual(99.9, activation['quotaUsedPercent'])

        inactive_customer = router.customer_for_user({'id': 'user-free', 'email': 'free@example.com'})
        activation = router.account_activation_for_customer(inactive_customer)
        self.assertEqual('choose_plan', activation['nextAction'])
        self.assertFalse(activation['routingEnabled'])

    def test_account_usage_reads_only_current_customer_period_from_supabase(self):
        router.SUPABASE_URL = 'https://example.supabase.co'
        router.SUPABASE_SERVICE_ROLE_KEY = 'service'
        captured = {}
        customer = {
            'id': 'customer/1',
            'user_id': 'user-1',
            'plan': 'lite',
            'status': 'active',
            'created_at_epoch': router.now_epoch(),
        }

        def fake_select(table, query, timeout=8):
            captured.update({'table': table, 'query': query, 'timeout': timeout})
            return [{'requests': 321, 'updated_at_epoch': 123456}]

        router.supabase_select = fake_select
        usage = router.account_usage_for_customer(customer)

        self.assertEqual('sage_router_usage_counters', captured['table'])
        self.assertIn('customer_id=eq.customer%2F1', captured['query'])
        self.assertIn(f'period=eq.{router.current_usage_period()}', captured['query'])
        self.assertEqual(321, usage['requests'])
        self.assertEqual(10000, usage['quota'])
        self.assertEqual(9679, usage['remaining'])
        self.assertEqual(123456, usage['updated_at_epoch'])

    def test_public_launch_metadata_exposes_10k_mrr_positioning(self):
        metadata = router.public_launch_metadata()
        launch = metadata['publicLaunch']

        self.assertEqual(10000, launch['targetMrrUsd'])
        self.assertEqual('hosted_routing_control_plane', launch['primaryRevenueModel'])
        self.assertEqual('https://sagerouter.dev/pricing', launch['pricingPage'])
        self.assertEqual('https://sagerouter.dev/compare/openrouter', launch['comparisonPage'])
        self.assertEqual('https://sagerouter.dev/models', launch['modelCatalogPage'])
        self.assertEqual('https://sagerouter.dev/model-routing-calculator', launch['calculatorPage'])
        self.assertEqual('https://app.sagerouter.dev/account.html', launch['accountPage'])
        self.assertEqual(10200, launch['recommendedMix']['monthlyRevenueUsd'])
        self.assertIn('sagerouter.dev/pricing', router.PUBLIC_LAUNCH_POSITIONING['conversionSurfaces'])
        self.assertIn('sagerouter.dev/models', router.PUBLIC_LAUNCH_POSITIONING['conversionSurfaces'])
        self.assertIn('https://sagerouter.dev/models', launch['conversionSurfaces'])
        self.assertIn('sagerouter.dev/model-routing-calculator', router.PUBLIC_LAUNCH_POSITIONING['conversionSurfaces'])
        self.assertIn('https://sagerouter.dev/model-routing-calculator', launch['conversionSurfaces'])
        self.assertIn('usage quotas and request-per-minute limits', launch['sells'])
        self.assertIn('does not grant unauthorized model access', launch['complianceBoundary'])
        managed = launch['managedProviderAccess']
        self.assertFalse(managed['enabled'])
        self.assertEqual('disabled_pending_provider_terms', managed['status'])
        self.assertIn('provider_resale_terms', managed['requiredControls'])
        self.assertIn('margin_policy', managed['requiredControls'])
        self.assertIn('rate_limits_and_durable_quotas', managed['requiredControls'])
        self.assertIn('acceptable_use_managed_access_terms', managed['requiredControls'])
        self.assertEqual('https://sagerouter.dev/acceptable-use', managed['acceptableUseUrl'])

    def test_public_model_catalog_is_safe_discovery_metadata(self):
        catalog = router.public_model_catalog()

        self.assertTrue(catalog['modelApiRequiresGeneratedKey'])
        self.assertEqual('https://sagerouter.dev/models', catalog['catalogPage'])
        self.assertEqual('/v1/models', catalog['modelApiPath'])
        self.assertEqual('sage-router/frontier', catalog['recommendedModel'])
        self.assertEqual('https://api.sagerouter.dev/v1', catalog['openaiBaseUrl'])
        self.assertIn('sk_sage_', catalog['apiKeyPrefix'])
        family_ids = {row['id'] for row in catalog['families']}
        self.assertIn('sage-router-profiles', family_ids)
        self.assertIn('ollama', family_ids)
        self.assertIn('byok-compatible', family_ids)
        self.assertIn('not a promise of bundled model resale', catalog['safetyBoundary'])

    def test_managed_provider_access_requires_terms_and_margin_policy(self):
        old_env = {
            'SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED': os.environ.get('SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED'),
            'SAGEROUTER_PROVIDER_RESALE_TERMS_URL': os.environ.get('SAGEROUTER_PROVIDER_RESALE_TERMS_URL'),
            'SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL': os.environ.get('SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL'),
        }
        try:
            os.environ['SAGEROUTER_MANAGED_PROVIDER_RESALE_ENABLED'] = '1'
            os.environ.pop('SAGEROUTER_PROVIDER_RESALE_TERMS_URL', None)
            os.environ.pop('SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL', None)
            managed = router.public_launch_metadata()['publicLaunch']['managedProviderAccess']
            self.assertTrue(managed['enabled'])
            self.assertEqual('requires_readiness_verification', managed['status'])

            os.environ['SAGEROUTER_PROVIDER_RESALE_TERMS_URL'] = 'https://sagerouter.dev/provider-resale-terms'
            os.environ['SAGEROUTER_PROVIDER_RESALE_MARGIN_POLICY_URL'] = 'https://sagerouter.dev/margin-policy'
            managed = router.public_launch_metadata()['publicLaunch']['managedProviderAccess']
            self.assertTrue(managed['enabled'])
            self.assertEqual('ready_for_private_beta', managed['status'])
            self.assertEqual('https://sagerouter.dev/provider-resale-terms', managed['providerTermsUrl'])
            self.assertEqual('https://sagerouter.dev/margin-policy', managed['marginPolicyUrl'])
        finally:
            for key, value in old_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_account_usage_endpoint_requires_signed_in_customer(self):
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'} if token == 'valid-user-jwt' else None
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        router.update_customer(customer['id'], {'plan': 'max', 'status': 'active'})

        class Dummy:
            path = '/account/usage'
            headers = {'Authorization': 'Bearer valid-user-jwt'}
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_GET(handler)

        self.assertEqual(200, handler.status)
        self.assertEqual('max', handler.payload['usage']['plan'])
        self.assertEqual(200000, handler.payload['usage']['quota'])
        self.assertEqual('max', handler.payload['activation']['plan'])
        self.assertTrue(handler.payload['activation']['routingEnabled'])
        self.assertEqual('create_key', handler.payload['activation']['nextAction'])
        self.assertEqual(0, handler.payload['activation']['requestCount'])


    def test_route_events_are_scoped_to_generated_customer_keys(self):
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')
        ctx = router.verify_generated_api_key(raw)
        router.set_route_auth_context(ctx)
        try:
            router.append_route_event({
                'request_id': 'r1',
                'status': 'ok',
                'intent': 'GENERAL',
                'selected': {'provider': 'test', 'model': 'fast'},
                'attempts': [{'provider': 'test', 'model': 'fast', 'ok': True, 'elapsedMs': 10}],
                'totalElapsedMs': 10,
            })
        finally:
            router.clear_route_auth_context()
        router.append_route_event({
            'request_id': 'r2',
            'status': 'ok',
            'intent': 'GENERAL',
            'selected': {'provider': 'other', 'model': 'slow'},
            'attempts': [],
            'totalElapsedMs': 20,
            'customer_id': 'other-customer',
        })
        snapshot = router.build_analytics_snapshot(7 * 24 * 3600, customer_id=customer['id'])
        self.assertEqual(1, snapshot['eventsAnalyzed'])
        self.assertEqual(customer['id'], snapshot['scope']['customer_id'])
        self.assertIn('test', [p['id'] for p in snapshot['providers']])

    def test_global_analytics_rejects_customer_generated_key_when_hosted_auth_enabled(self):
        router.SUPABASE_AUTH_ENABLED = True
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')

        class Dummy:
            path = '/analytics?days=7'
            headers = {'Authorization': f'Bearer {raw}'}
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_GET(handler)

        self.assertEqual(401, handler.status)
        self.assertEqual('unauthorized', handler.payload['error'])

    def test_account_analytics_accepts_customer_generated_key_and_scopes_events(self):
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')
        ctx = router.verify_generated_api_key(raw)
        router.set_route_auth_context(ctx)
        try:
            router.append_route_event({
                'request_id': 'r-account',
                'status': 'ok',
                'intent': 'GENERAL',
                'selected': {'provider': 'local', 'model': 'frontier'},
                'attempts': [{'provider': 'local', 'model': 'frontier', 'ok': True, 'elapsedMs': 12}],
                'totalElapsedMs': 12,
            })
        finally:
            router.clear_route_auth_context()
        router.append_route_event({
            'request_id': 'r-other',
            'status': 'ok',
            'intent': 'GENERAL',
            'selected': {'provider': 'other', 'model': 'model'},
            'attempts': [{'provider': 'other', 'model': 'model', 'ok': True, 'elapsedMs': 99}],
            'totalElapsedMs': 99,
            'customer_id': 'other-customer',
        })

        class Dummy:
            path = '/account/analytics?days=7'
            headers = {'Authorization': f'Bearer {raw}'}
            status = None
            payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_GET(handler)

        self.assertEqual(200, handler.status)
        self.assertEqual(customer['id'], handler.payload['scope']['customer_id'])
        self.assertEqual(customer['id'], handler.payload['account']['customer_id'])
        self.assertEqual(1, handler.payload['eventsAnalyzed'])
        provider_requests = {p['id']: p.get('requests') for p in handler.payload['providers']}
        self.assertEqual(1, provider_requests.get('local'))
        self.assertNotIn('other', provider_requests)

    def test_launch_funnel_snapshot_counts_private_conversion_stages(self):
        router.read_launch_waitlist_counts = lambda _since, limit=10000: ({
            'total': 3,
            'interest': {
                'general': 1,
                'managedAccess': 2,
                'other': 0,
                'unknown': 0,
            },
            'managedAccessDemand': {
                'targetProviderFamily': {
                    'mixed-frontier': 1,
                    'ollama': 0,
                    'openai': 1,
                    'anthropic': 0,
                    'byok-compatible': 0,
                    'unknown': 0,
                },
                'commercialPreference': {
                    'one-subscription': 2,
                    'byok-plus-routing': 0,
                    'private-contract': 0,
                    'unknown': 0,
                },
            },
        }, None)
        router.read_launch_marketing_funnel_counts = lambda _since, limit=10000: ({
            'total': 5,
            'events': {
                'calculator_checkout_clicked': 2,
                'pricing_checkout_clicked': 1,
                'managed_access_interest_clicked': 1,
                'openrouter_compare_checkout_clicked': 1,
            },
            'plans': {
                'pro': 3,
                'max': 1,
            },
            'sourceSurfaces': {
                'pricing': 2,
                'compare-openrouter': 2,
                'account': 1,
            },
            'attributionChannels': {
                'github': 2,
                'openrouter': 1,
                'direct': 2,
            },
        }, None)
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')
        ctx = router.verify_generated_api_key(raw)
        router.set_route_auth_context(ctx)
        try:
            router.append_route_event({
                'request_id': 'r-funnel',
                'status': 'ok',
                'intent': 'GENERAL',
                'selected': {'provider': 'local', 'model': 'frontier'},
                'attempts': [{'provider': 'local', 'model': 'frontier', 'ok': True, 'elapsedMs': 12}],
                'totalElapsedMs': 12,
            })
        finally:
            router.clear_route_auth_context()
        router.customer_for_user({'id': 'user-2', 'email': 'second@example.com'})

        snapshot = router.build_launch_funnel_snapshot(30 * 24 * 3600)

        self.assertEqual(3, snapshot['stages']['waitlistLeads'])
        self.assertEqual(5, snapshot['stages']['marketingIntentEvents'])
        self.assertEqual(2, snapshot['marketingIntent']['events']['calculator_checkout_clicked'])
        self.assertEqual(1, snapshot['marketingIntent']['events']['openrouter_compare_checkout_clicked'])
        self.assertEqual(3, snapshot['marketingIntent']['plans']['pro'])
        self.assertEqual(2, snapshot['marketingIntent']['sourceSurfaces']['pricing'])
        self.assertEqual(2, snapshot['marketingIntent']['sourceSurfaces']['compare-openrouter'])
        self.assertEqual(2, snapshot['marketingIntent']['attributionChannels']['github'])
        self.assertEqual(1, snapshot['marketingIntent']['attributionChannels']['openrouter'])
        self.assertEqual(2, snapshot['stages']['managedAccessBetaInterest'])
        self.assertEqual(2, snapshot['waitlistInterest']['managedAccess'])
        self.assertEqual(1, snapshot['managedAccessDemand']['targetProviderFamily']['mixed-frontier'])
        self.assertEqual(1, snapshot['managedAccessDemand']['targetProviderFamily']['openai'])
        self.assertEqual(2, snapshot['managedAccessDemand']['commercialPreference']['one-subscription'])
        self.assertEqual(0.6667, snapshot['rates']['managedAccessShareOfWaitlist'])
        self.assertEqual(2, snapshot['stages']['signups'])
        self.assertEqual(1, snapshot['stages']['customersWithGeneratedApiKeys'])
        self.assertEqual(1, snapshot['stages']['customersWithActiveApiKeys'])
        self.assertEqual(1, snapshot['stages']['customersWithFirstRoutedRequest'])
        self.assertEqual(1, snapshot['stages']['paidConversions'])
        self.assertEqual(1, snapshot['stages']['paidCustomers'])
        self.assertEqual(1, snapshot['stages']['retainedPaidCustomers'])
        self.assertEqual(10000, snapshot['mrr']['targetMrrUsd'])
        self.assertEqual(30, snapshot['mrr']['estimatedCurrentMrrUsd'])
        self.assertEqual(0.003, snapshot['mrr']['targetAttainment'])
        self.assertEqual(1, snapshot['mrr']['byPlan']['pro']['paidCustomers'])
        self.assertEqual(30, snapshot['mrr']['byPlan']['pro']['monthlyPriceUsd'])
        self.assertEqual(199, snapshot['mrr']['byPlan']['pro']['remainingToTarget'])
        self.assertFalse(snapshot['mrr']['assumptions']['managedProviderAccessIncluded'])
        self.assertEqual(0.60, snapshot['targets']['signupToGeneratedKey']['targetRate'])
        self.assertEqual(0.50, snapshot['targets']['generatedKeyToFirstRequest']['targetRate'])
        self.assertEqual(0.15, snapshot['targets']['signupToPaidConversion']['targetRate'])
        self.assertEqual(0.85, snapshot['targets']['paidRecentUsage']['targetRate'])
        self.assertEqual(1.0, snapshot['targets']['mrrTargetAttainment']['targetRate'])
        self.assertEqual(0.5, snapshot['targets']['signupToGeneratedKey']['actualRate'])
        self.assertEqual('below_target', snapshot['targets']['signupToGeneratedKey']['status'])
        self.assertEqual('on_track', snapshot['targets']['generatedKeyToFirstRequest']['status'])
        bottleneck_metrics = [row['metric'] for row in snapshot['bottlenecks']]
        self.assertIn('mrrTargetAttainment', bottleneck_metrics)
        self.assertIn('signupToGeneratedKey', bottleneck_metrics)
        self.assertFalse(snapshot['privacy']['containsEmails'])
        self.assertFalse(snapshot['privacy']['containsApiKeys'])
        self.assertNotIn('u@example.com', json.dumps(snapshot))
        self.assertNotIn(raw, json.dumps(snapshot))

    def test_launch_waitlist_counts_group_managed_access_interest(self):
        router.SUPABASE_URL = 'https://example.supabase.co'
        router.SUPABASE_SERVICE_ROLE_KEY = 'service-role'

        def fake_select(table, query, timeout=8):
            self.assertIn('created_at=gte.', query)
            if table == router.SUPABASE_WAITLIST_TABLE:
                self.assertIn('select=created_at,metadata', query)
                return [
                    {
                        'created_at': '2026-06-19T00:00:00Z',
                        'metadata': {
                            'interest': 'managed-access',
                            'target_provider_family': 'openai',
                            'commercial_preference': 'one-subscription',
                        },
                    },
                    {
                        'created_at': '2026-06-19T00:00:00Z',
                        'metadata': json.dumps({
                            'interest': 'managed-access',
                            'targetProviderFamily': 'anthropic',
                            'commercialPreference': 'private-contract',
                        }),
                    },
                    {'created_at': '2026-06-19T00:00:00Z', 'metadata': {'interest': 'managed-access'}},
                    {'created_at': '2026-06-19T00:00:00Z', 'metadata': {'interest': 'general'}},
                    {'created_at': '2026-06-19T00:00:00Z', 'metadata': json.dumps({'interest': 'enterprise'})},
                ]
            return []

        router.supabase_select = fake_select

        metrics, error = router.read_launch_waitlist_counts(0)
        self.assertIsNone(error)
        self.assertEqual(5, metrics['total'])
        self.assertEqual(3, metrics['interest']['managedAccess'])
        self.assertEqual(1, metrics['interest']['general'])
        self.assertEqual(1, metrics['interest']['other'])
        self.assertEqual(0, metrics['interest']['unknown'])
        self.assertEqual(1, metrics['managedAccessDemand']['targetProviderFamily']['openai'])
        self.assertEqual(1, metrics['managedAccessDemand']['targetProviderFamily']['anthropic'])
        self.assertEqual(1, metrics['managedAccessDemand']['targetProviderFamily']['unknown'])
        self.assertEqual(1, metrics['managedAccessDemand']['commercialPreference']['one-subscription'])
        self.assertEqual(1, metrics['managedAccessDemand']['commercialPreference']['private-contract'])
        self.assertEqual(1, metrics['managedAccessDemand']['commercialPreference']['unknown'])

        count, error = router.read_launch_waitlist_count(0)
        self.assertIsNone(error)
        self.assertEqual(5, count)

    def test_launch_marketing_funnel_counts_group_events_without_identity(self):
        router.SUPABASE_URL = 'https://example.supabase.co'
        router.SUPABASE_SERVICE_ROLE_KEY = 'service-role'

        def fake_select(table, query, timeout=8):
            self.assertEqual(router.SUPABASE_FUNNEL_EVENTS_TABLE, table)
            self.assertIn('select=event,plan,created_at,metadata', query)
            self.assertIn('created_at=gte.', query)
            return [
                {
                    'event': 'calculator_checkout_clicked',
                    'plan': 'pro',
                    'created_at': '2026-06-19T00:00:00Z',
                    'metadata': {
                        'source': 'model-routing-calculator',
                        'utmSource': 'github',
                        'email': 'buyer@example.com',
                    },
                },
                {
                    'event': 'calculator_checkout_clicked',
                    'plan': 'pro',
                    'created_at': '2026-06-19T00:00:00Z',
                    'metadata': json.dumps({
                        'source': 'compare-openrouter',
                        'referrerHost': 'openrouter.ai',
                    }),
                },
                {
                    'event': 'pricing_checkout_clicked',
                    'plan': 'lite',
                    'created_at': '2026-06-19T00:00:00Z',
                    'metadata': {
                        'source': 'pricing',
                        'referrerHost': 'google.com',
                    },
                },
                {'event': '', 'plan': None, 'created_at': '2026-06-19T00:00:00Z', 'metadata': {}},
            ]

        router.supabase_select = fake_select

        metrics, error = router.read_launch_marketing_funnel_counts(0)

        self.assertIsNone(error)
        self.assertEqual(4, metrics['total'])
        self.assertEqual(2, metrics['events']['calculator_checkout_clicked'])
        self.assertEqual(1, metrics['events']['pricing_checkout_clicked'])
        self.assertEqual(1, metrics['events']['unknown'])
        self.assertEqual(2, metrics['plans']['pro'])
        self.assertEqual(1, metrics['plans']['lite'])
        self.assertEqual(1, metrics['sourceSurfaces']['model-routing-calculator'])
        self.assertEqual(1, metrics['sourceSurfaces']['compare-openrouter'])
        self.assertEqual(1, metrics['sourceSurfaces']['pricing'])
        self.assertEqual(1, metrics['sourceSurfaces']['unknown'])
        self.assertEqual(1, metrics['attributionChannels']['github'])
        self.assertEqual(1, metrics['attributionChannels']['openrouter'])
        self.assertEqual(1, metrics['attributionChannels']['google'])
        self.assertEqual(1, metrics['attributionChannels']['direct'])
        self.assertNotIn('email', json.dumps(metrics))
        self.assertNotIn('buyer@example.com', json.dumps(metrics))

    def test_analytics_funnel_requires_operator_auth_when_hosted_auth_enabled(self):
        router.SUPABASE_AUTH_ENABLED = True
        router.CLIENT_API_KEYS = ['operator-secret']

        class Dummy:
            path = '/analytics/funnel?days=30'

            def __init__(self, authorization=''):
                self.headers = {'Authorization': authorization} if authorization else {}
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        anonymous = Dummy()
        router.Handler.do_GET(anonymous)
        self.assertEqual(401, anonymous.status)
        self.assertEqual('unauthorized', anonymous.payload['error'])

        operator = Dummy('Bearer operator-secret')
        router.Handler.do_GET(operator)
        self.assertEqual(200, operator.status)
        self.assertIn('stages', operator.payload)
        self.assertIn('privacy', operator.payload)

    def test_legacy_key_still_authorizes(self):
        router.CLIENT_API_KEYS = ['legacy-key']

        class H:
            headers = {'Authorization': 'Bearer legacy-key'}

        self.assertTrue(router.client_request_authorized(H()))

    def test_arbitrary_supabase_jwt_is_not_paid_routing(self):
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}

        class H:
            headers = {'Authorization': 'Bearer valid-user-jwt'}

        self.assertFalse(router.client_request_authorized(H()))

    def test_origin_model_listing_requires_paid_or_operator_auth_when_enabled(self):
        class Dummy:
            path = '/v1/models'
            command = 'GET'

            def __init__(self, authorization=''):
                self.headers = {'Authorization': authorization} if authorization else {}
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        anonymous = Dummy()
        router.Handler.do_GET(anonymous)
        self.assertEqual(401, anonymous.status)
        self.assertEqual('unauthorized', anonymous.payload['error'])

        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')
        generated = Dummy(f'Bearer {raw}')
        router.Handler.do_GET(generated)
        self.assertEqual(200, generated.status)
        self.assertIn('models', generated.payload)

        router.CLIENT_API_KEYS = ['operator-secret']
        operator = Dummy('Bearer operator-secret')
        router.Handler.do_GET(operator)
        self.assertEqual(200, operator.status)
        self.assertIn('models', operator.payload)

    def test_operator_origin_routes_reject_generated_customer_keys(self):
        customer = self.active_customer()
        raw, _row = router.create_api_key_for_customer(customer, 'prod')
        body = b'{}'

        class Dummy:
            command = 'POST'

            def __init__(self, path, authorization=''):
                self.path = path
                self.headers = {
                    'Authorization': authorization,
                    'Content-Length': str(len(body)),
                }
                self.rfile = BytesIO(body)
                self.status = None
                self.payload = None

            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        for path in (
            '/setup/provider',
            '/setup/codex-auth',
            '/setup/codex-oauth/start',
            '/setup/codex-oauth/poll',
            '/setup/codex-oauth/cancel',
            '/api/restart',
        ):
            with self.subTest(path=path):
                handler = Dummy(path, f'Bearer {raw}')
                router.Handler.do_POST(handler)
                self.assertEqual(401, handler.status)
                self.assertEqual('unauthorized', handler.payload['error'])

        for path in ('/setup/state', '/dashboard', '/admin/blocks', '/admin/clear-blocks', '/discovery'):
            with self.subTest(path=path):
                handler = Dummy(path, f'Bearer {raw}')
                router.Handler.do_GET(handler)
                self.assertEqual(401, handler.status)
                self.assertEqual('unauthorized', handler.payload['error'])


    def test_stripe_signature_requires_current_timestamp(self):
        secret = 'whsec_test'
        router.STRIPE_WEBHOOK_SECRET = secret
        payload = b'{"id":"evt_test"}'
        fresh_ts = str(router.now_epoch())
        fresh_sig = router.hmac.new(secret.encode(), f'{fresh_ts}.{payload.decode()}'.encode(), router.hashlib.sha256).hexdigest()
        self.assertTrue(router.verify_stripe_signature(payload, f't={fresh_ts},v1={fresh_sig}'))

        stale_ts = str(router.now_epoch() - 1000)
        stale_sig = router.hmac.new(secret.encode(), f'{stale_ts}.{payload.decode()}'.encode(), router.hashlib.sha256).hexdigest()
        self.assertFalse(router.verify_stripe_signature(payload, f't={stale_ts},v1={stale_sig}'))
        self.assertFalse(router.verify_stripe_signature(payload, f't=not-a-time,v1={fresh_sig}'))

    def test_stripe_checkout_reuses_existing_customer(self):
        router.STRIPE_SECRET_KEY = 'sk_test'
        router.STRIPE_PRICE_IDS_RAW = 'lite=price_lite,pro=price_pro,max=price_max'
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        router.update_customer(customer['id'], {'stripe_customer_id': 'cus_existing'})
        captured = {}
        router.stripe_request = lambda path, fields, timeout=10: captured.update({'path': path, 'fields': fields}) or {'id': 'cs_test', 'url': 'https://checkout.test'}

        body = b'{"plan":"pro"}'

        class Dummy:
            path = '/billing/stripe/checkout'
            headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': str(len(body))}
            rfile = BytesIO(body)
            status = None
            payload = None
            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        self.assertEqual('/v1/checkout/sessions', captured['path'])
        self.assertEqual('cus_existing', captured['fields']['customer'])
        self.assertIsNone(captured['fields']['customer_email'])
        self.assertEqual('price_pro', captured['fields']['line_items[0][price]'])
        self.assertEqual(
            'https://app.sagerouter.dev/account.html?checkout=success&plan=pro&session_id={CHECKOUT_SESSION_ID}',
            captured['fields']['success_url'],
        )
        self.assertEqual(
            'https://app.sagerouter.dev/account.html?checkout=cancel&plan=pro',
            captured['fields']['cancel_url'],
        )

    def test_stripe_billing_portal_uses_existing_customer(self):
        router.STRIPE_SECRET_KEY = 'sk_test'
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        router.update_customer(customer['id'], {'stripe_customer_id': 'cus_existing'})
        captured = {}
        router.stripe_request = lambda path, fields, timeout=10: captured.update({'path': path, 'fields': fields}) or {'id': 'bps_test', 'url': 'https://billing.test'}

        class Dummy:
            path = '/billing/stripe/portal'
            headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': '2'}
            rfile = BytesIO(b'{}')
            status = None
            payload = None
            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        self.assertEqual('/v1/billing_portal/sessions', captured['path'])
        self.assertEqual('cus_existing', captured['fields']['customer'])
        self.assertEqual('https://app.sagerouter.dev/account.html?billing=portal', captured['fields']['return_url'])
        self.assertEqual('https://billing.test', handler.payload['portal_url'])

    def test_stripe_billing_portal_requires_existing_customer(self):
        router.STRIPE_SECRET_KEY = 'sk_test'
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}

        class Dummy:
            path = '/billing/stripe/portal'
            headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': '2'}
            rfile = BytesIO(b'{}')
            status = None
            payload = None
            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload

        handler = Dummy()
        router.Handler.do_POST(handler)
        self.assertEqual(409, handler.status)
        self.assertEqual('stripe_customer_missing', handler.payload['error'])

    def test_stripe_webhook_duplicate_event_is_ignored(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        customer = router.customer_for_user({'id': 'user-1', 'email': 'u@example.com'})
        event = {
            'id': 'evt_checkout_1',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'customer': 'cus_1',
                    'subscription': 'sub_1',
                    'client_reference_id': customer['id'],
                    'metadata': {'customer_id': customer['id'], 'plan': 'pro'},
                },
            },
        }
        first = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(first)
        self.assertEqual(200, first.status)
        self.assertEqual({'received': True, 'event_id': 'evt_checkout_1'}, first.payload)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('pro', updated['plan'])
        self.assertEqual('active', updated['status'])
        self.assertEqual('cus_1', updated['stripe_customer_id'])
        self.assertEqual(1, len(router.local_customer_store()['payment_intents']))

        second = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(second)
        self.assertEqual(200, second.status)
        self.assertTrue(second.payload['duplicate'])
        self.assertEqual('evt_checkout_1', second.payload['event_id'])
        self.assertEqual(1, len(router.local_customer_store()['payment_intents']))

    def test_stripe_subscription_lifecycle_controls_customer_routing_status(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        customer = self.active_customer()
        router.update_customer(customer['id'], {'stripe_customer_id': 'cus_1', 'stripe_subscription_id': 'sub_1'})

        subscription_update = {
            'id': 'evt_sub_past_due',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'status': 'past_due',
                    'metadata': {'customer_id': customer['id'], 'plan': 'pro'},
                },
            },
        }
        handler = self.signed_stripe_webhook_handler(subscription_update)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('past_due', updated['status'])
        self.assertFalse(router.customer_is_active(updated))

        subscription_recovered = {
            'id': 'evt_sub_active',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'status': 'active',
                    'metadata': {'customer_id': customer['id'], 'plan': 'pro'},
                },
            },
        }
        handler = self.signed_stripe_webhook_handler(subscription_recovered)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('active', updated['status'])
        self.assertTrue(router.customer_is_active(updated))

        subscription_deleted = {
            'id': 'evt_sub_deleted',
            'type': 'customer.subscription.deleted',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'metadata': {'customer_id': customer['id']},
                },
            },
        }
        handler = self.signed_stripe_webhook_handler(subscription_deleted)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('inactive', updated['status'])
        self.assertFalse(router.customer_is_active(updated))

    def test_stripe_subscription_update_derives_plan_from_price_id(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        router.STRIPE_PRICE_IDS_RAW = 'lite=price_lite,pro=price_pro,max=price_max'
        customer = self.active_customer()
        router.update_customer(customer['id'], {
            'plan': 'pro',
            'stripe_customer_id': 'cus_1',
            'stripe_subscription_id': 'sub_1',
        })

        event = {
            'id': 'evt_sub_plan_change',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'status': 'active',
                    'metadata': {'customer_id': customer['id'], 'plan': 'pro'},
                    'items': {
                        'data': [
                            {'price': {'id': 'price_max'}},
                        ],
                    },
                },
            },
        }

        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('max', updated['plan'])
        self.assertEqual('active', updated['status'])
        self.assertTrue(router.customer_is_active(updated))
        self.assertEqual(200000, router.account_usage_for_customer(updated)['quota'])

    def test_stripe_subscription_update_preserves_current_plan_without_metadata_or_price(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        customer = self.active_customer()
        router.update_customer(customer['id'], {
            'plan': 'max',
            'stripe_customer_id': 'cus_1',
            'stripe_subscription_id': 'sub_1',
        })

        event = {
            'id': 'evt_sub_no_plan_metadata',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'status': 'active',
                    'metadata': {'customer_id': customer['id']},
                },
            },
        }

        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('max', updated['plan'])
        self.assertEqual('active', updated['status'])

    def test_stripe_subscription_update_resolves_existing_customer_without_metadata(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        router.STRIPE_PRICE_IDS_RAW = 'lite=price_lite,pro=price_pro,max=price_max'
        customer = self.active_customer()
        router.update_customer(customer['id'], {
            'plan': 'pro',
            'stripe_customer_id': 'cus_1',
            'stripe_subscription_id': 'sub_1',
        })

        event = {
            'id': 'evt_sub_by_stripe_customer',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_1',
                    'customer': 'cus_1',
                    'status': 'active',
                    'items': {'data': [{'price': {'id': 'price_max'}}]},
                },
            },
        }

        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('max', updated['plan'])
        self.assertEqual('active', updated['status'])

    def test_stripe_webhook_rejects_metadata_customer_mismatch(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        customer_a = self.active_customer()
        router.update_customer(customer_a['id'], {
            'plan': 'pro',
            'stripe_customer_id': 'cus_a',
            'stripe_subscription_id': 'sub_a',
        })
        customer_b = router.customer_for_user({'id': 'user-2', 'email': 'u2@example.com'})
        router.update_customer(customer_b['id'], {
            'plan': 'lite',
            'status': 'active',
            'stripe_customer_id': 'cus_b',
            'stripe_subscription_id': 'sub_b',
        })

        event = {
            'id': 'evt_sub_mismatch',
            'type': 'customer.subscription.updated',
            'data': {
                'object': {
                    'id': 'sub_b',
                    'customer': 'cus_b',
                    'status': 'past_due',
                    'metadata': {'customer_id': customer_a['id'], 'plan': 'max'},
                },
            },
        }

        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(409, handler.status)
        self.assertEqual('stripe_customer_mismatch', handler.payload['error'])
        self.assertEqual('active', router.customer_by_id(customer_a['id'])['status'])
        self.assertEqual('active', router.customer_by_id(customer_b['id'])['status'])
        self.assertEqual(0, len(router.local_customer_store()['payment_intents']))

    def test_stripe_invoice_payment_failure_disables_generated_key_routing(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        customer = self.active_customer()
        router.update_customer(customer['id'], {'stripe_customer_id': 'cus_1', 'stripe_subscription_id': 'sub_1'})
        raw, _row = router.create_api_key_for_customer(router.customer_by_id(customer['id']), 'prod')
        self.assertIsNotNone(router.verify_generated_api_key(raw))

        event = {
            'id': 'evt_invoice_failed',
            'type': 'invoice.payment_failed',
            'data': {
                'object': {
                    'customer': 'cus_1',
                    'subscription': 'sub_1',
                },
            },
        }
        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('past_due', updated['status'])
        self.assertFalse(router.customer_is_active(updated))
        self.assertIsNone(router.verify_generated_api_key(raw))

    def test_stripe_invoice_payment_success_recovers_routing_from_invoice_line_price(self):
        router.STRIPE_WEBHOOK_SECRET = 'whsec_test'
        router.STRIPE_PRICE_IDS_RAW = 'lite=price_lite,pro=price_pro,max=price_max'
        customer = self.active_customer()
        router.update_customer(customer['id'], {
            'plan': 'pro',
            'status': 'past_due',
            'stripe_customer_id': 'cus_1',
            'stripe_subscription_id': 'sub_1',
        })
        raw, _row = router.create_api_key_for_customer(router.customer_by_id(customer['id']), 'prod')
        self.assertIsNone(router.verify_generated_api_key(raw))

        event = {
            'id': 'evt_invoice_paid',
            'type': 'invoice.payment_succeeded',
            'data': {
                'object': {
                    'customer': 'cus_1',
                    'subscription': 'sub_1',
                    'lines': {
                        'data': [
                            {'price': {'id': 'price_max'}},
                        ],
                    },
                },
            },
        }

        handler = self.signed_stripe_webhook_handler(event)
        router.Handler.do_POST(handler)
        self.assertEqual(200, handler.status)
        updated = router.customer_by_id(customer['id'])
        self.assertEqual('max', updated['plan'])
        self.assertEqual('active', updated['status'])
        self.assertTrue(router.customer_is_active(updated))
        self.assertIsNotNone(router.verify_generated_api_key(raw))

    def test_stripe_crypto_missing_config_and_options_cors(self):
        router.supabase_user_for_bearer = lambda token: {'id': 'user-1', 'email': 'u@example.com'}

        class Dummy:
            def __init__(self, path, body=b'{}'):
                self.path = path
                self.headers = {'Authorization': 'Bearer valid-user-jwt', 'Content-Length': str(len(body)), 'Origin': 'https://sagerouter.dev'}
                self.rfile = BytesIO(body)
                self.status = None
                self.payload = None
                self.sent_headers = {}
            def send_response(self, status):
                self.status = status
            def send_header(self, key, value):
                self.sent_headers[key] = value
            def end_headers(self):
                pass
            def write_json(self, status, payload, extra_headers=None):
                self.status = status
                self.payload = payload
            send_cors_headers = router.Handler.send_cors_headers

        opt = Dummy('/account/api-keys')
        router.Handler.do_OPTIONS(opt)
        self.assertEqual(204, opt.status)
        self.assertIn('Authorization', opt.sent_headers.get('Access-Control-Allow-Headers'))
        self.assertIn('HEAD', opt.sent_headers.get('Access-Control-Allow-Methods'))

        for path, expected in (
            ('/billing/stripe/checkout', 'stripe_not_configured'),
            ('/billing/stripe/portal', 'stripe_not_configured'),
            ('/billing/crypto/intent', 'crypto_not_configured'),
        ):
            handler = Dummy(path)
            router.Handler.do_POST(handler)
            self.assertEqual(expected, handler.payload['error'])

    def test_head_json_response_sends_headers_without_body(self):
        class Dummy:
            command = 'HEAD'
            headers = {'Origin': 'https://sagerouter.dev'}

            def __init__(self):
                self.status = None
                self.sent_headers = {}
                self.wfile = BytesIO()

            def send_response(self, status):
                self.status = status

            def send_header(self, key, value):
                self.sent_headers[key] = value

            def end_headers(self):
                pass

            send_cors_headers = router.Handler.send_cors_headers

        handler = Dummy()
        router.Handler.write_json(handler, 200, {'status': 'ok'})

        self.assertEqual(200, handler.status)
        self.assertEqual('application/json', handler.sent_headers['Content-Type'])
        self.assertGreater(int(handler.sent_headers['Content-Length']), 0)
        self.assertIn('HEAD', handler.sent_headers['Access-Control-Allow-Methods'])
        self.assertEqual(b'', handler.wfile.getvalue())

    def test_public_launch_metadata_exposes_onboarding_urls(self):
        metadata = router.public_launch_metadata()
        self.assertEqual('https://app.sagerouter.dev', metadata['publicBaseUrl'])
        self.assertEqual('https://sagerouter.dev', metadata['marketingBaseUrl'])
        self.assertEqual('https://app.sagerouter.dev', metadata['appBaseUrl'])
        self.assertEqual('https://api.sagerouter.dev', metadata['apiBaseUrl'])
        self.assertEqual('https://api.sagerouter.dev/v1', metadata['openaiBaseUrl'])
        self.assertEqual('https://api.sagerouter.dev', metadata['anthropicBaseUrl'])
        self.assertEqual('https://app.sagerouter.dev/account.html', metadata['accountUrl'])
        self.assertEqual('https://app.sagerouter.dev/login.html', metadata['loginUrl'])
        self.assertEqual('/billing/stripe/checkout', metadata['checkoutPath'])
        self.assertEqual('/billing/stripe/portal', metadata['billingPortalPath'])
        self.assertEqual('sk_sage_', metadata['apiKeyPrefix'])
        self.assertEqual(5, metadata['maxActiveApiKeysPerCustomer'])

    def test_public_plan_catalog_exposes_edge_limits(self):
        plans = router.public_plan_catalog()
        self.assertEqual(10000, plans['lite']['limits']['monthlyRequests'])
        self.assertEqual(60, plans['lite']['limits']['rateLimitPerMinute'])
        self.assertEqual(50000, plans['pro']['limits']['monthlyRequests'])
        self.assertEqual(180, plans['pro']['limits']['rateLimitPerMinute'])
        self.assertEqual(200000, plans['max']['limits']['monthlyRequests'])
        self.assertEqual(600, plans['max']['limits']['rateLimitPerMinute'])
        self.assertFalse(plans['free']['apiAccess'])
        self.assertTrue(plans['pro']['apiAccess'])

    def test_public_plan_catalog_uses_edge_limit_overrides(self):
        router.PUBLIC_PLAN_RATE_LIMITS_RAW = 'lite=7,pro=8,max=9,default=3'
        router.PUBLIC_PLAN_MONTHLY_QUOTAS_RAW = 'lite=70,pro=80,max=90,default=0'
        plans = router.public_plan_catalog()
        self.assertEqual({'monthlyRequests': 70, 'rateLimitPerMinute': 7}, plans['lite']['limits'])
        self.assertEqual({'monthlyRequests': 80, 'rateLimitPerMinute': 8}, plans['pro']['limits'])
        self.assertEqual({'monthlyRequests': 90, 'rateLimitPerMinute': 9}, plans['max']['limits'])


class AnalyticsModelConsolidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._billing_env = os.environ.get('SAGE_ROUTER_BILLING_ENABLED')
        os.environ['SAGE_ROUTER_BILLING_ENABLED'] = '1'
        self.old = {
            'ROUTE_EVENTS_PATH': router.ROUTE_EVENTS_PATH,
            'FIRESTORE_ENABLED': router.FIRESTORE_ENABLED,
            'SUPABASE_MIRROR_ENABLED': router.SUPABASE_MIRROR_ENABLED,
        }
        router.ROUTE_EVENTS_PATH = os.path.join(self.tmp.name, 'route-events.jsonl')
        router.FIRESTORE_ENABLED = False
        router.SUPABASE_MIRROR_ENABLED = False

    def tearDown(self):
        router.ROUTE_EVENTS_PATH = self.old['ROUTE_EVENTS_PATH']
        router.FIRESTORE_ENABLED = self.old['FIRESTORE_ENABLED']
        router.SUPABASE_MIRROR_ENABLED = self.old['SUPABASE_MIRROR_ENABLED']
        if self._billing_env is None:
            os.environ.pop('SAGE_ROUTER_BILLING_ENABLED', None)
        else:
            os.environ['SAGE_ROUTER_BILLING_ENABLED'] = self._billing_env
        self.tmp.cleanup()

    def test_analytics_consolidates_provider_prefixed_model_chains(self):
        router.append_route_event({
            'request_id': 'r1', 'status': 'ok', 'intent': 'GENERAL',
            'selected': {'provider': 'openrouter', 'model': 'anthropic/claude-sonnet-4.5'},
            'attempts': [{'provider': 'openrouter', 'model': 'anthropic/claude-sonnet-4.5', 'ok': True, 'elapsedMs': 100}],
            'totalElapsedMs': 100,
        })
        router.append_route_event({
            'request_id': 'r2', 'status': 'ok', 'intent': 'GENERAL',
            'selected': {'provider': 'anthropic', 'model': 'claude-sonnet-4.5'},
            'attempts': [{'provider': 'anthropic', 'model': 'claude-sonnet-4.5', 'ok': True, 'elapsedMs': 200}],
            'totalElapsedMs': 200,
        })
        snapshot = router.build_analytics_snapshot(7 * 24 * 3600)
        model_rows = {row['id']: row for row in snapshot['models']}
        self.assertIn('claude-sonnet-4.5', model_rows)
        self.assertEqual(2, model_rows['claude-sonnet-4.5']['requests'])
        self.assertEqual(['anthropic', 'openrouter'], model_rows['claude-sonnet-4.5']['providers'])


if __name__ == '__main__':
    unittest.main()
