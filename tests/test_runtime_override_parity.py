#!/usr/bin/env python3
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_runtime_override_parity.py"

spec = importlib.util.spec_from_file_location("runtime_override_parity", SCRIPT)
parity = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = parity
spec.loader.exec_module(parity)


class RuntimeOverrideParityTests(unittest.TestCase):
    def test_reports_in_sync_runtime_overrides(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            cyber = root / "cyber-gateway"
            override = cyber / "overrides" / "sage-router" / "router.py"
            proxy = root / "codex-sage-router-proxy.py"
            override.parent.mkdir(parents=True)
            override.write_bytes((parity.ROOT / "router.py").read_bytes())
            proxy.write_bytes((parity.ROOT / "scripts" / "codex_sage_router_proxy.py").read_bytes())

            payload = parity.check_parity(cyber_gateway_root=cyber, codex_proxy_path=proxy)

            self.assertTrue(payload["ok"])
            self.assertEqual(2, payload["checked"])
            self.assertEqual(["in_sync", "in_sync"], [item["status"] for item in payload["results"]])

    def test_reports_mismatched_existing_override(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            cyber = root / "cyber-gateway"
            override = cyber / "overrides" / "sage-router" / "router.py"
            proxy = root / "codex-sage-router-proxy.py"
            override.parent.mkdir(parents=True)
            override.write_text("# stale override\n")
            proxy.write_bytes((parity.ROOT / "scripts" / "codex_sage_router_proxy.py").read_bytes())

            payload = parity.check_parity(cyber_gateway_root=cyber, codex_proxy_path=proxy)

            self.assertFalse(payload["ok"])
            statuses = {item["name"]: item["status"] for item in payload["results"]}
            self.assertEqual("mismatch", statuses["cyber_gateway_router_override"])
            self.assertEqual("in_sync", statuses["codex_responses_proxy_mount"])

    def test_accepts_custom_override_with_required_sanitizer_markers(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            cyber = root / "cyber-gateway"
            override = cyber / "overrides" / "sage-router" / "router.py"
            proxy = root / "codex-sage-router-proxy.py"
            override.parent.mkdir(parents=True)
            override.write_text(
                "\n".join([
                    "# custom Cyber override",
                    "def strip_model_prefix_tool_placeholder_noise(text: str):",
                    "    pass",
                    "if not labels and '/' in stripped and stripped.rsplit('/', 1)[1] and re.fullmatch(PARTIAL_MODEL_PREFIX_LABEL_RE, stripped):",
                    "    pass",
                    "def sanitize_provider_visible_text(text, provider_name, model):",
                    "    pass",
                ])
            )
            proxy.write_bytes((parity.ROOT / "scripts" / "codex_sage_router_proxy.py").read_bytes())

            payload = parity.check_parity(cyber_gateway_root=cyber, codex_proxy_path=proxy)

            self.assertTrue(payload["ok"])
            self.assertEqual("custom_with_required_markers", payload["results"][0]["status"])
            self.assertFalse(payload["results"][0]["exactMatch"])

            strict_payload = parity.check_parity(cyber_gateway_root=cyber, codex_proxy_path=proxy, strict=True)
            self.assertFalse(strict_payload["ok"])
            self.assertEqual("mismatch", strict_payload["results"][0]["status"])

    def test_sync_replaces_mismatch_and_keeps_backup(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            cyber = root / "cyber-gateway"
            override = cyber / "overrides" / "sage-router" / "router.py"
            proxy = root / "missing-codex-sage-router-proxy.py"
            override.parent.mkdir(parents=True)
            override.write_text("# stale override\n")

            payload = parity.check_parity(cyber_gateway_root=cyber, codex_proxy_path=proxy, sync=True)

            self.assertTrue(payload["ok"])
            router_result = payload["results"][0]
            self.assertEqual("synced", router_result["status"])
            self.assertTrue(Path(router_result["backup"]).exists())
            self.assertEqual((parity.ROOT / "router.py").read_bytes(), override.read_bytes())
            self.assertEqual("target_missing", payload["results"][1]["status"])


if __name__ == "__main__":
    unittest.main()
