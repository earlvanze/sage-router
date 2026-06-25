#!/usr/bin/env python3
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('SAGE_ROUTER_DARIO_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART', '0')

import router  # noqa: E402


class ProviderSwitchingTests(unittest.TestCase):
    def setUp(self):
        self.old_providers = router.PROVIDERS
        self.old_disabled = set(router.DISABLED_PROVIDERS)
        self.old_fetch_ollama_models = router.fetch_ollama_models
        self.old_provider_endpoint_reachable = router.provider_endpoint_reachable
        self.old_temp_blocks = dict(router.TEMP_MODEL_BLOCKS)
        router.PROVIDERS = {
            'ollama': router.Provider('ollama', 'ollama', 'http://ollama.invalid', '', ['glm-5']),
            'ollama-cloud': router.Provider('ollama-cloud', 'ollama', 'https://ollama.com', 'test-key', ['glm-5.1:cloud']),
            'openai-codex': router.Provider('openai-codex', 'openclaw-gateway', 'ws://gateway.invalid', '', ['gpt-5.5', 'gpt-5.4']),
        }
        router.DISABLED_PROVIDERS.clear()
        router.fetch_ollama_models = lambda provider: provider.models
        router.provider_endpoint_reachable = lambda provider: True
        router.TEMP_MODEL_BLOCKS.clear()

    def tearDown(self):
        router.PROVIDERS = self.old_providers
        router.DISABLED_PROVIDERS.clear()
        router.DISABLED_PROVIDERS.update(self.old_disabled)
        router.fetch_ollama_models = self.old_fetch_ollama_models
        router.provider_endpoint_reachable = self.old_provider_endpoint_reachable
        router.TEMP_MODEL_BLOCKS.clear()
        router.TEMP_MODEL_BLOCKS.update(self.old_temp_blocks)

    def test_stale_ollama_prefix_switches_to_provider_that_has_model(self):
        provider, model = router.resolve_requested_provider_model({'model': 'ollama/gpt-5.5'})
        self.assertEqual('openai-codex', provider)
        self.assertEqual('gpt-5.5', model)

    def test_stale_provider_field_switches_to_provider_that_has_model(self):
        provider, model = router.resolve_requested_provider_model({'provider': 'ollama', 'model': 'gpt-5.5'})
        self.assertEqual('openai-codex', provider)
        self.assertEqual('gpt-5.5', model)

    def test_valid_ollama_model_keeps_ollama_provider(self):
        provider, model = router.resolve_requested_provider_model({'model': 'ollama/glm-5'})
        self.assertEqual('ollama', provider)
        self.assertEqual('glm-5', model)

    def test_ollama_cloud_model_switches_to_hosted_provider(self):
        provider, model = router.resolve_requested_provider_model({'model': 'ollama/glm-5.1:cloud'})
        self.assertEqual('ollama-cloud', provider)
        self.assertEqual('glm-5.1:cloud', model)

    def test_prepare_route_uses_inferred_provider_for_stale_forced_provider(self):
        _messages, _intent, _complexity, _tokens, chain = router.prepare_route(
            [{'role': 'user', 'content': 'hello'}],
            request_id='test-provider-switch',
            force_provider='ollama',
            requested_model='gpt-5.5',
        )
        self.assertEqual([('openai-codex', 'gpt-5.5')], chain[:1])

    def test_gpt_family_switches_to_openai_provider_even_if_catalog_is_incomplete(self):
        router.PROVIDERS['openai-codex'].models = ['gpt-5.4']
        provider, model = router.resolve_requested_provider_model({'model': 'ollama/gpt-5.5'})
        self.assertEqual('openai-codex', provider)
        self.assertEqual('gpt-5.5', model)

        _messages, _intent, _complexity, _tokens, chain = router.prepare_route(
            [{'role': 'user', 'content': 'hello'}],
            request_id='test-provider-family-switch',
            force_provider='ollama',
            requested_model='gpt-5.5',
        )
        self.assertEqual([('openai-codex', 'gpt-5.5')], chain[:1])

    def test_codex_subscription_beats_google_when_ollama_is_rate_limited(self):
        router.PROVIDERS = {
            'ollama': router.Provider('ollama', 'ollama', 'http://ollama.invalid', '', ['glm-5']),
            'openai-codex': router.Provider('openai-codex', 'openai-codex-responses', 'https://codex.invalid', 'token', ['gpt-5.4']),
            'google': router.Provider('google', 'google-generative-language', 'https://google.invalid', 'key', ['gemini-2.5-pro']),
        }
        router.TEMP_MODEL_BLOCKS['ollama/glm-5'] = {
            'until': 9999999999,
            'reason': 'HTTP 429 Too Many Requests',
        }

        chain, scores, _rejections = router.select_model(
            router.Intent.ANALYSIS,
            router.Complexity.COMPLEX,
            router.ThinkingLevel.HIGH,
            'best',
            {'document': True, 'qualitySensitive': True},
            10000,
        )

        self.assertEqual(('openai-codex', 'gpt-5.4'), chain[0])
        codex_score = next(row for row in scores if row['provider'] == 'openai-codex')
        google_score = next(row for row in scores if row['provider'] == 'google')
        self.assertGreater(codex_score['score'], google_score['score'])
        self.assertIn(
            'user_pref_analysis_codex_subscription',
            [name for name, _value in codex_score['contributions']],
        )

    def test_balanced_profile_is_explicit_non_frontier_ollama_first(self):
        payload = {'model': 'sage-router/balanced', 'messages': [{'role': 'user', 'content': 'hello'}]}
        profile = router.apply_router_profile(payload)

        self.assertEqual('balanced', profile)
        self.assertEqual('sage-router/auto', payload['model'])
        self.assertEqual('balanced', payload['route'])
        self.assertEqual({'effort': 'medium'}, payload['thinking'])
        requirements = payload['requirements']
        self.assertEqual(['ollama-cyber', 'ollama'], requirements['allowProviders'][:2])
        self.assertIn('openai-codex', requirements['fallbackProviders'])
        self.assertIn('google', requirements['fallbackProviders'])
        self.assertFalse(requirements.get('frontierLargeOnly', False))
        self.assertFalse(requirements.get('reasoning', False))

    def test_google_tool_declarations_strip_unsupported_schema_keys(self):
        tools = [{
            'type': 'function',
            'function': {
                'name': 'lookup',
                'parameters': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        'filters': {
                            'type': 'object',
                            'additionalProperties': {'type': 'string'},
                            'properties': {
                                'query': {'type': 'string'},
                                'mode': {
                                    'any_of': [
                                        {'const': 'fast', 'type': 'string'},
                                        {'const': 'deep', 'type': 'string'},
                                    ],
                                },
                                'count': {
                                    'type': ['integer', 'null'],
                                    'exclusiveMinimum': 0,
                                },
                            },
                        },
                    },
                },
            },
        }]

        declarations = router.google_tool_declarations(tools)

        parameters = declarations[0]['parameters']
        self.assertNotIn('additionalProperties', parameters)
        self.assertNotIn('additionalProperties', parameters['properties']['filters'])
        self.assertNotIn('any_of', parameters['properties']['filters']['properties']['mode'])
        self.assertNotIn('const', parameters['properties']['filters']['properties']['mode'])
        self.assertNotIn('exclusiveMinimum', parameters['properties']['filters']['properties']['count'])
        self.assertEqual('integer', parameters['properties']['filters']['properties']['count']['type'])
        self.assertEqual('string', parameters['properties']['filters']['properties']['query']['type'])


if __name__ == '__main__':
    unittest.main()
