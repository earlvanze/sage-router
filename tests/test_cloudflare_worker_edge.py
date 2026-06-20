#!/usr/bin/env python3
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "deploy" / "tailnet-edge" / "cloudflare-api-worker.js"


class CloudflareWorkerEdgeTests(unittest.TestCase):
    def read_worker(self):
        return WORKER.read_text(encoding="utf-8")

    def test_public_edge_health_uses_redacted_origin_snapshots(self):
        worker = self.read_worker()
        self.assertIn("function publicOriginSnapshot", worker)
        self.assertIn("function publicOriginsSnapshot", worker)
        self.assertIn("function selectedOriginId", worker)
        self.assertIn("originKind", worker)
        self.assertIn("selectedOriginId: selectedId", worker)
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


if __name__ == "__main__":
    unittest.main()
