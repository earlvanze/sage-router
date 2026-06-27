#!/usr/bin/env python3
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "deploy" / "tailnet-edge" / "cloudflare-api-worker.js"
WRANGLER_EXAMPLE = ROOT / "deploy" / "tailnet-edge" / "wrangler.api-sagerouter.example.toml"


class CloudflareWorkerEdgeTests(unittest.TestCase):
    def read_worker(self):
        return WORKER.read_text(encoding="utf-8")

    def read_wrangler_example(self):
        return WRANGLER_EXAMPLE.read_text(encoding="utf-8")

    def test_public_edge_health_uses_redacted_origin_snapshots(self):
        worker = self.read_worker()
        self.assertIn("function publicOriginSnapshot", worker)
        self.assertIn("function publicOriginsSnapshot", worker)
        self.assertIn("function selectedOriginId", worker)
        self.assertIn("originKind", worker)
        self.assertIn("selectedOriginId: selectedId", worker)
        self.assertIn('"x-sage-router-cloudflare-edge": "api.sagerouter.dev"', worker)
        self.assertIn('"x-sage-router-api-origin": selectedId || "origin-none"', worker)
        self.assertIn('"x-sage-router-api-origin-kind": healthy[0] ? originKind(healthy[0].url) : "none"', worker)
        self.assertNotRegex(worker, r"selected:\s*healthy\[0\]")
        self.assertNotRegex(worker, r"origins:\s*checks")

    def test_proxy_response_headers_do_not_expose_origin_urls(self):
        worker = self.read_worker()
        self.assertNotIn('"x-sage-router-api-origin-url"', worker)
        self.assertNotRegex(worker, re.compile(r"headers\.set\([^)]*origin\.url", re.DOTALL))
        self.assertIn('"x-sage-router-api-origin-kind"', worker)

    def test_public_snapshot_does_not_return_raw_url_or_health_path(self):
        worker = self.read_worker()
        match = re.search(
            r"function publicOriginSnapshot\(check, index\) \{\n  return \{(?P<body>.*?)\n  \};\n\}",
            worker,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        body = match.group("body")
        self.assertNotRegex(body, r"\burl\s*:")
        self.assertNotRegex(body, r"\bhealthPath\s*:")
        self.assertIn("id: publicOriginId(index)", body)
        self.assertIn("originKind: originKind(check.url)", body)

    def test_worker_requires_public_edge_health_by_default(self):
        worker = self.read_worker()
        self.assertIn("const PUBLIC_EDGE_HEALTH_ERROR", worker)
        self.assertIn("function publicEdgeHealthSatisfied", worker)
        self.assertIn("SAGE_ROUTER_REQUIRE_PUBLIC_EDGE_HEALTH", worker)
        self.assertIn("payload.authMode === \"supabase\"", worker)
        self.assertIn("enforcement.rateLimitEnabled === true", worker)
        self.assertIn("enforcement.authAttemptRateLimitEnabled === true", worker)
        self.assertIn("enforcement.quotaEnabled === true", worker)
        self.assertIn("Number(enforcement.apiKeyAuthCacheSeconds) === 0", worker)
        self.assertIn("enforcement.corsWildcardAllowed === false", worker)
        self.assertIn("enforcement.corsExplicitOriginRequired === true", worker)
        self.assertIn("Number(enforcement.corsAllowedOriginsCount || 0) > 0", worker)
        self.assertIn("modelModalities.sharedEnabled === true", worker)
        self.assertIn("modelModalities.rpcConfigured === true", worker)
        self.assertIn("failover.mode === \"lowest-latency-healthy\"", worker)
        self.assertIn("!hasRawOriginUrl(payload.upstreams || [])", worker)

    def test_worker_example_uses_edge_health_origins(self):
        example = self.read_wrangler_example()
        self.assertIn('SAGE_ROUTER_REQUIRE_PUBLIC_EDGE_HEALTH = "1"', example)
        self.assertIn('"healthPath": "/edge/health"', example)
        self.assertNotIn("run.app", example)
        self.assertNotIn('"healthPath": "/health"', example)

    def test_worker_records_successful_model_modalities_to_supabase(self):
        worker = self.read_worker()
        self.assertIn("function recordModelModalities(env, record)", worker)
        self.assertIn("function modalityRecordFromResponseHeaders(headers, status)", worker)
        self.assertIn("function modalityRecordFromResponse(headers, status, requestBodyText = \"\", responseBodyText = \"\")", worker)
        self.assertIn("function requestModalitiesFromBodyText(bodyText)", worker)
        self.assertIn("function applyModalityHeaders(headers, record)", worker)
        self.assertIn("function boundedStreamText(stream, maxBytes)", worker)
        self.assertIn("response.response.clone()", worker)
        self.assertIn("const requestLengthKnown =", worker)
        self.assertIn("!requestLengthKnown || requestLength <= maxModalityBodyBytes", worker)
        self.assertNotIn("if (!length || length > maxBytes", worker)
        self.assertIn('headers.get("x-sage-router-modalities")', worker)
        self.assertIn('headers.get("x-sage-router-provider")', worker)
        self.assertIn('headers.get("x-sage-router-model-name")', worker)
        self.assertIn('env.SAGE_ROUTER_SUPABASE_MODEL_MODALITIES_RPC || "sage_router_record_model_modalities"', worker)
        self.assertIn("ctx.waitUntil(modalityRecord)", worker)
        self.assertIn("function modelModalitiesState(env)", worker)
        self.assertIn("modelModalities: modelModalitiesState(env)", worker)

    def test_worker_example_enables_shared_modality_ledger(self):
        example = self.read_wrangler_example()
        self.assertIn('SAGE_ROUTER_MODEL_MODALITIES_SHARED_ENABLED = "1"', example)
        self.assertIn("SAGE_ROUTER_SUPABASE_URL", example)
        self.assertIn("wrangler secret put SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY", example)
        self.assertIn("SAGE_ROUTER_SUPABASE_MODEL_MODALITIES_RPC", example)


if __name__ == "__main__":
    unittest.main()
