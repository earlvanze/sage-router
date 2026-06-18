#!/usr/bin/env python3
import hashlib
import importlib.util
import os
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EDGE_PROXY = ROOT / "deploy" / "tailnet-edge" / "edge_proxy.py"


def load_edge_proxy():
    env = {
        "SAGE_ROUTER_UPSTREAMS": "http://backend.local:8790",
        "SAGE_ROUTER_EDGE_AUTH_MODE": "supabase",
        "SAGE_ROUTER_SUPABASE_URL": "https://example.supabase.co",
        "SAGE_ROUTER_SUPABASE_ANON_KEY": "anon",
        "SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY": "service",
        "SAGE_ROUTER_API_KEY_HASH_PEPPER": "pepper",
        "SAGE_ROUTER_EDGE_AUTH_CACHE_SECONDS": "0",
    }
    old = {key: os.environ.get(key) for key in env}
    os.environ.update(env)
    try:
        sys.modules.pop("edge_proxy_under_test", None)
        spec = importlib.util.spec_from_file_location("edge_proxy_under_test", EDGE_PROXY)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


class TailnetEdgeAuthTests(unittest.TestCase):
    def setUp(self):
        self.edge = load_edge_proxy()

    def test_generated_api_key_requires_active_paid_customer(self):
        raw_key = "sk_sage_test_key"
        digest = hashlib.sha256(("pepper" + raw_key).encode("utf-8")).hexdigest()
        patches = []

        def fake_get(path, service=False, token=None, timeout=6):
            self.assertTrue(service)
            if self.edge.SUPABASE_API_KEYS_TABLE in path:
                self.assertIn(digest, path)
                return [{
                    "id": "key-1",
                    "customer_id": "customer-1",
                    "status": "active",
                    "api_key_hash": digest,
                }]
            if self.edge.SUPABASE_CUSTOMERS_TABLE in path:
                return [{
                    "id": "customer-1",
                    "user_id": "user-1",
                    "plan": "pro",
                    "status": "active",
                }]
            return []

        def fake_patch(path, payload, timeout=4):
            patches.append((path, payload))

        self.edge.supabase_get_json = fake_get
        self.edge.supabase_patch_json = fake_patch

        ctx = self.edge.verify_supabase_generated_key(raw_key)
        self.assertEqual("generated_key", ctx["type"])
        self.assertEqual("customer-1", ctx["customer_id"])
        self.assertFalse(ctx["preserve_authorization"])
        self.assertEqual(1, len(patches))

    def test_generated_api_key_rejects_free_or_inactive_customer(self):
        self.edge.supabase_get_json = lambda path, **_kwargs: (
            [{"id": "key-1", "customer_id": "customer-1", "status": "active"}]
            if self.edge.SUPABASE_API_KEYS_TABLE in path
            else [{"id": "customer-1", "user_id": "user-1", "plan": "free", "status": "active"}]
        )
        self.assertFalse(self.edge.verify_supabase_generated_key("sk_sage_test_key"))

    def test_user_jwt_paths_preserve_authorization(self):
        self.edge.verify_supabase_user_jwt = lambda token: {
            "type": "supabase_user",
            "user_id": "user-1",
            "preserve_authorization": True,
        }

        class Handler:
            path = "/account/api-keys"
            headers = {"Authorization": "Bearer jwt"}

        ctx = self.edge.EdgeHandler._auth_context(Handler())
        self.assertEqual("supabase_user", ctx["type"])
        self.assertTrue(ctx["preserve_authorization"])

    def test_edge_token_bypasses_supabase_for_private_admin_access(self):
        self.edge.EDGE_TOKEN = "edge-secret"

        class Handler:
            path = "/v1/models"
            headers = {"Authorization": "Bearer edge-secret"}

        ctx = self.edge.EdgeHandler._auth_context(Handler())
        self.assertEqual("edge_token", ctx["type"])
        self.assertFalse(ctx["preserve_authorization"])


if __name__ == "__main__":
    unittest.main()
