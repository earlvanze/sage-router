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
            'supabase_select': router.supabase_select,
            'CLIENT_API_KEYS': list(router.CLIENT_API_KEYS),
            'CLIENT_AUTH_REQUIRED': router.CLIENT_AUTH_REQUIRED,
            'ANALYTICS_TOKEN': router.ANALYTICS_TOKEN,
            'SUPABASE_AUTH_ENABLED': router.SUPABASE_AUTH_ENABLED,
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
        }
        router.CUSTOMER_STORE_PATH = os.path.join(self.tmp.name, 'customers.json')
        router.SUPABASE_URL = ''
        router.SUPABASE_SERVICE_ROLE_KEY = ''
        router.SUPABASE_USAGE_COUNTERS_TABLE = 'sage_router_usage_counters'
        router.CLIENT_API_KEYS = []
        router.CLIENT_AUTH_REQUIRED = True
        router.ANALYTICS_TOKEN = ''
        router.SUPABASE_AUTH_ENABLED = False
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
        router.supabase_select = self.old['supabase_select']
        router.CLIENT_API_KEYS = self.old['CLIENT_API_KEYS']
        router.CLIENT_AUTH_REQUIRED = self.old['CLIENT_AUTH_REQUIRED']
        router.ANALYTICS_TOKEN = self.old['ANALYTICS_TOKEN']
        router.SUPABASE_AUTH_ENABLED = self.old['SUPABASE_AUTH_ENABLED']
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

    def test_revoked_and_inactive_generated_keys_do_not_authorize(self):
        customer = self.active_customer()
        raw, row = router.create_api_key_for_customer(customer, 'prod')
        router.revoke_api_key_for_customer(customer['id'], row['id'])
        self.assertIsNone(router.verify_generated_api_key(raw))

        customer = router.customer_for_user({'id': 'user-2', 'email': 'u2@example.com'})
        raw, _row = router.create_api_key_for_customer(customer, 'inactive')
        self.assertIsNone(router.verify_generated_api_key(raw))


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
        self.assertEqual('https://sagerouter.dev/model-routing-calculator', launch['calculatorPage'])
        self.assertEqual('https://app.sagerouter.dev/account.html', launch['accountPage'])
        self.assertEqual(10200, launch['recommendedMix']['monthlyRevenueUsd'])
        self.assertIn('sagerouter.dev/pricing', router.PUBLIC_LAUNCH_POSITIONING['conversionSurfaces'])
        self.assertIn('sagerouter.dev/model-routing-calculator', router.PUBLIC_LAUNCH_POSITIONING['conversionSurfaces'])
        self.assertIn('https://sagerouter.dev/model-routing-calculator', launch['conversionSurfaces'])
        self.assertIn('usage quotas and request-per-minute limits', launch['sells'])
        self.assertIn('does not grant unauthorized model access', launch['complianceBoundary'])

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

        self.assertEqual(2, snapshot['stages']['signups'])
        self.assertEqual(1, snapshot['stages']['customersWithGeneratedApiKeys'])
        self.assertEqual(1, snapshot['stages']['customersWithActiveApiKeys'])
        self.assertEqual(1, snapshot['stages']['customersWithFirstRoutedRequest'])
        self.assertEqual(1, snapshot['stages']['paidConversions'])
        self.assertEqual(1, snapshot['stages']['paidCustomers'])
        self.assertEqual(1, snapshot['stages']['retainedPaidCustomers'])
        self.assertFalse(snapshot['privacy']['containsEmails'])
        self.assertFalse(snapshot['privacy']['containsApiKeys'])
        self.assertNotIn('u@example.com', json.dumps(snapshot))
        self.assertNotIn(raw, json.dumps(snapshot))

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
