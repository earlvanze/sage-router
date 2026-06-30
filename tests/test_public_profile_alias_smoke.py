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


if __name__ == "__main__":
    unittest.main()
