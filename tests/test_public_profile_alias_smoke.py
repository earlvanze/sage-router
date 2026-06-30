import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "smoke_public_profile_alias.py"


spec = importlib.util.spec_from_file_location("smoke_public_profile_alias", SCRIPT)
smoke_public_profile_alias = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke_public_profile_alias)


class PublicProfileAliasSmokeTests(unittest.TestCase):
    def test_model_prefix_leak_detector_ignores_raw_json_arrays(self):
        self.assertTrue(smoke_public_profile_alias.has_model_prefix_leak("[ollama/glm-5] ok"))
        self.assertTrue(smoke_public_profile_alias.has_model_prefix_leak(" [tool calls omitted]"))
        self.assertFalse(smoke_public_profile_alias.has_model_prefix_leak('[{"token":"streaming"},{"done":true}]'))

    def test_raw_provider_stream_leak_detector_is_separate(self):
        self.assertTrue(smoke_public_profile_alias.has_raw_provider_stream_leak('[{"token":"streaming"},{"token":" ok"},{"done":true}]'))
        self.assertFalse(smoke_public_profile_alias.has_raw_provider_stream_leak("[ollama/glm-5] ok"))
        self.assertFalse(smoke_public_profile_alias.has_raw_provider_stream_leak("streaming ok"))

    def test_profile_smoke_retries_transient_timeout_once(self):
        calls = []
        original_request = smoke_public_profile_alias.request_profile_once
        original_sleep = smoke_public_profile_alias.time.sleep

        def fake_request(*_args, **_kwargs):
            calls.append(True)
            if len(calls) == 1:
                raise TimeoutError("first attempt timed out")
            return {"status": 200, "payload": {"output_text": "ok"}, "headers": {}}

        try:
            smoke_public_profile_alias.request_profile_once = fake_request
            smoke_public_profile_alias.time.sleep = lambda *_args, **_kwargs: None
            result = smoke_public_profile_alias.request_profile_with_retries(
                "https://api.sagerouter.dev",
                "sk_sage_test",
                "sage-router/frontier",
                "responses",
                5,
                2,
                0,
            )
        finally:
            smoke_public_profile_alias.request_profile_once = original_request
            smoke_public_profile_alias.time.sleep = original_sleep

        self.assertEqual(2, len(calls))
        self.assertEqual(200, result["status"])
        self.assertEqual(2, result["attempt"])
        self.assertEqual(2, result["attempts"])

    def test_profile_smoke_repeated_timeout_returns_structured_failure(self):
        original_request = smoke_public_profile_alias.request_profile_once
        original_sleep = smoke_public_profile_alias.time.sleep

        try:
            smoke_public_profile_alias.request_profile_once = lambda *_args, **_kwargs: (_ for _ in ()).throw(TimeoutError("still slow"))
            smoke_public_profile_alias.time.sleep = lambda *_args, **_kwargs: None
            result = smoke_public_profile_alias.request_profile_with_retries(
                "https://api.sagerouter.dev",
                "sk_sage_test",
                "sage-router/frontier",
                "responses-stream",
                5,
                2,
                0,
            )
        finally:
            smoke_public_profile_alias.request_profile_once = original_request
            smoke_public_profile_alias.time.sleep = original_sleep

        self.assertEqual("timeout", result["status"])
        self.assertEqual("transient_timeout", result["payload"]["error"]["type"])
        self.assertEqual(2, result["attempt"])
        self.assertEqual(2, result["attempts"])


if __name__ == "__main__":
    unittest.main()
