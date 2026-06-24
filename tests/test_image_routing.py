#!/usr/bin/env python3
"""Image/vision routing: image requests must go to image-capable models, never GLM*."""
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('SAGE_ROUTER_DARIO_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART', '0')

import router  # noqa: E402


def _img_msg():
    return [{'role': 'user', 'content': [
        {'type': 'text', 'text': 'describe this image'},
        {'type': 'image_url', 'image_url': {'url': 'https://x/y.png'}},
    ]}]


class ImageDetectionTests(unittest.TestCase):
    def test_glm_family_detected(self):
        for m in ['glm-5', 'glm-5.2:cloud', 'glm-5:cloud', 'glm-4v', 'AutoGLM-Phone-9B', 'glmocr']:
            self.assertTrue(router.is_glm_model(m), m)
        for m in ['gpt-5.4', 'gpt-4o', 'claude-sonnet-4', 'gemini-2.5-pro', 'qwen3-vl']:
            self.assertFalse(router.is_glm_model(m), m)

    def test_image_in_chat_message_content(self):
        payload = {'messages': _img_msg()}
        self.assertTrue(router.payload_vision_signal(payload))

    def test_image_in_responses_input(self):
        payload = {'input': [{'role': 'user', 'content': [
            {'type': 'input_text', 'text': 'describe'},
            {'type': 'input_image', 'image_url': 'https://x/y.jpg'},
        ]}]}
        self.assertTrue(router.payload_vision_signal(payload))

    def test_image_inside_tool_result(self):
        payload = {'messages': [{'role': 'tool', 'content': [
            {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,iVBORw0KG'}},
        ]}]}
        self.assertTrue(router.payload_vision_signal(payload))

    def test_text_only_no_vision_signal(self):
        payload = {'messages': [{'role': 'user', 'content': 'just text, no images'}]}
        self.assertFalse(router.payload_vision_signal(payload))


class VisionRoutingTests(unittest.TestCase):
    def setUp(self):
        self._old_providers = router.PROVIDERS
        self._old_disabled = set(router.DISABLED_PROVIDERS)
        self._old_fetch = router.fetch_ollama_models
        self._old_reach = router.provider_endpoint_reachable
        self._old_blocks = dict(router.TEMP_MODEL_BLOCKS)
        router.DISABLED_PROVIDERS.clear()
        router.fetch_ollama_models = lambda provider: provider.models
        router.provider_endpoint_reachable = lambda provider: True
        router.TEMP_MODEL_BLOCKS.clear()
        glm_meta = lambda: {'input': ['text'], 'supportsVision': False, 'supportsChat': True,
                            'supportsTools': True, 'supportsJson': True, 'reasoning': True}
        vis_meta = lambda: {'input': ['text', 'image'], 'supportsVision': True, 'supportsChat': True,
                            'supportsTools': True, 'supportsJson': True, 'reasoning': True}
        router.PROVIDERS = {
            'ollama-cloud': router.Provider(
                'ollama-cloud', 'ollama', 'https://ollama.com', 'k',
                ['glm-5.2:cloud', 'glm-5:cloud'],
                model_meta={'glm-5.2:cloud': glm_meta(), 'glm-5:cloud': glm_meta()},
            ),
            'openai': router.Provider(
                'openai', 'openai-completions', 'https://api.openai.com/v1', 'sk',
                ['gpt-5.4', 'gpt-4o'],
                model_meta={'gpt-5.4': vis_meta(), 'gpt-4o': {**vis_meta(), 'reasoning': False}},
            ),
        }

    def tearDown(self):
        router.PROVIDERS = self._old_providers
        router.DISABLED_PROVIDERS.clear()
        router.DISABLED_PROVIDERS.update(self._old_disabled)
        router.fetch_ollama_models = self._old_fetch
        router.provider_endpoint_reachable = self._old_reach
        router.TEMP_MODEL_BLOCKS.clear()
        router.TEMP_MODEL_BLOCKS.update(self._old_blocks)

    def test_glm_rejected_for_vision_even_if_vision_capable(self):
        prov = router.PROVIDERS['ollama-cloud']
        prov.models.append('glm-5v:cloud')
        prov.model_meta['glm-5v:cloud'] = {**prov.model_meta['glm-5.2:cloud'], 'input': ['text', 'image'], 'supportsVision': True}
        ok, reason = router.model_meets_requirements(prov, 'glm-5v:cloud', {'vision': True}, 100)
        self.assertFalse(ok)
        self.assertIn('glm', reason)

    def test_non_vision_glm_rejected_for_vision(self):
        prov = router.PROVIDERS['ollama-cloud']
        ok, _ = router.model_meets_requirements(prov, 'glm-5.2:cloud', {'vision': True}, 100)
        self.assertFalse(ok)
        ok, reason2 = router.model_meets_requirements(prov, 'glm-5.2:cloud', {}, 100)
        self.assertTrue(ok, f'glm should be allowed for non-vision: {reason2}')

    def test_vision_model_allowed_for_vision(self):
        prov = router.PROVIDERS['openai']
        ok, reason = router.model_meets_requirements(prov, 'gpt-5.4', {'vision': True}, 100)
        self.assertTrue(ok, reason)

    def test_prepare_route_relaxes_when_forced_provider_only_has_glm(self):
        _m, _i, _c, _t, chain = router.prepare_route(
            _img_msg(),
            request_id='test-vision-forced',
            route_mode='best',
            requirements={'vision': True, 'allowProviders': ['ollama-cloud'],
                          'allowModels': ['*glm-5*'], 'frontierLargeOnly': True},
            force_provider='ollama-cloud',
            requested_model='glm-5.2:cloud',
        )
        self.assertTrue(chain, 'expected a vision fallback chain, got empty')
        for pn, model in chain:
            self.assertFalse(router.is_glm_model(model), f'GLM routed for image request: {pn}/{model}')
        self.assertEqual(chain[0][0], 'openai')

    def test_prepare_route_auto_avoids_glm_for_vision(self):
        _m, _i, _c, _t, chain = router.prepare_route(
            _img_msg(),
            request_id='test-vision-auto',
            route_mode='best',
            requirements={'vision': True},
        )
        self.assertTrue(chain)
        for pn, model in chain:
            self.assertFalse(router.is_glm_model(model), f'GLM routed for image request: {pn}/{model}')


if __name__ == '__main__':
    unittest.main()
