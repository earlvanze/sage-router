#!/usr/bin/env python3
import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('SAGE_ROUTER_DARIO_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART', '0')

import router  # noqa: E402


class ToolCallLeakTests(unittest.TestCase):

    def test_default_thinking_is_high(self):
        self.assertEqual(router.ThinkingLevel.HIGH, router.DEFAULT_THINKING_LEVEL)
        self.assertEqual(router.ThinkingLevel.HIGH, router.normalize_thinking(None))
        self.assertEqual(router.ThinkingLevel.HIGH, router.normalize_thinking({}))
        self.assertEqual(router.ThinkingLevel.LOW, router.normalize_thinking('low'))
        self.assertEqual(router.ThinkingLevel.MEDIUM, router.normalize_thinking('medium'))

    def test_detects_visible_tool_code_blocks(self):
        self.assertTrue(router.looks_like_visible_tool_call('tool_code\nmessage(action="delete")'))
        self.assertTrue(router.looks_like_visible_tool_call('```tool_code\n{"tool":"message","arguments":{}}\n```'))
        self.assertTrue(router.looks_like_visible_tool_call('functions.exec(command="ls")'))

    def test_does_not_reject_normal_text_or_structured_tool_calls(self):
        payload = {'tools': [{'type': 'function', 'function': {'name': 'message'}}]}
        self.assertEqual('', router.reject_visible_tool_call_leak(payload, 'I can help with that.', []))
        self.assertEqual('', router.reject_visible_tool_call_leak({}, 'tool_code\nmessage(action="send")', []))
        self.assertEqual('', router.reject_visible_tool_call_leak(payload, 'tool_code\nmessage(action="send")', [{'id': 'call_1'}]))



    def test_discord_public_profile_preserves_model_denies(self):
        payload = {
            'profile': 'discord-public',
            'model': 'openai-codex/gpt-5.4-mini',
            'messages': [{'role': 'user', 'content': 'discord-public test'}],
            'tools': [{'type': 'function', 'function': {'name': 'exec', 'parameters': {'type': 'object'}}}],
        }
        self.assertEqual('discord-public', router.apply_router_profile(payload))
        self.assertTrue(router.apply_discord_public_route_profile(payload))
        req = router.normalize_requirements(payload, router.normalize_thinking(payload.get('thinking')))
        self.assertIn('*-mini*', req.get('denyModels', []))
        self.assertFalse(router.model_meets_requirements(router.Provider('openai-codex', 'openai-codex-responses', '', '', ['gpt-5.4-mini']), 'gpt-5.4-mini', req, 100)[0])

    def test_profile_pattern_matching_does_not_treat_wildcards_as_substrings(self):
        self.assertFalse(router._match_any_pattern('gemini-3-flash-preview', ['*-mini*', 'mini-*', 'mini:*']))
        self.assertTrue(router._match_any_pattern('gpt-5.4-mini', ['*-mini*', 'mini-*', 'mini:*']))
        self.assertTrue(router._match_model_patterns('google-vertex', 'gemini-2.5-pro', ['google-vertex/gemini-2.5-pro']))
        self.assertFalse(router._match_model_patterns('ollama-cloud', 'gemini-2.5-pro:cloud', ['google-vertex/gemini-2.5-pro']))

    def test_frontier_profile_allows_available_frontier_model_without_reasoning_flag(self):
        payload = {'profile': 'frontier', 'model': 'sage-router/frontier', 'messages': [{'role': 'user', 'content': 'Say OK'}]}
        self.assertEqual('frontier', router.apply_router_profile(payload))
        req = router.normalize_requirements(payload, router.normalize_thinking(payload.get('thinking')))
        provider = router.Provider('google-vertex', 'google', '', '', ['gemini-2.5-pro'])
        ok, reason = router.model_meets_requirements(provider, 'gemini-2.5-pro', req, 100)
        self.assertTrue(ok, reason)
        self.assertFalse(req.get('reasoning'))


    def test_model_prefix_is_opt_in_by_default(self):
        response = router.build_openai_completion('ollama', 'qwen3-coder-next:cloud', 'req1', 'hello')
        content = response['choices'][0]['message']['content']
        self.assertEqual('hello', content)
        self.assertNotIn('[ollama/qwen3-coder-next:cloud]', content)

    def test_structured_tool_calls_never_include_visible_narration(self):
        response = router.build_openai_completion(
            'ollama',
            'qwen3-coder-next:cloud',
            'req1',
            'I will check this first.',
            [{'function': {'name': 'message', 'arguments': {'action': 'read'}}}],
        )
        message = response['choices'][0]['message']
        self.assertEqual('', message['content'])
        self.assertEqual('tool_calls', response['choices'][0]['finish_reason'])
        self.assertIn('tool_calls', message)

    def test_detects_codex_inline_tool_leaks(self):
        noisy = '''I’ll pull the records.
{"cmd":"cd /data/.openclaw/workspace-discord-public && find EARLCoin -maxdepth 4 -type f", "yieldMs":1000}
{"path":"/home/umbrel/.openclaw/workspace-discord-public/AGENTS.md"}
to=exec {"cmd":"cd /data/.openclaw/workspace-discord-public && pwd"}
 I can calculate it, but need source records.'''
        self.assertTrue(router.looks_like_visible_tool_call(noisy))

    def test_rejects_codex_inline_tool_leaks_when_tools_present(self):
        payload = {'tools': [{'type': 'function', 'function': {'name': 'exec'}}]}
        text = 'I will inspect it. {"cmd":"cd /data/.openclaw/workspace-discord-public && ls EARLCoin"}'
        self.assertEqual(
            'provider leaked tool call as visible text instead of structured tool_calls',
            router.reject_visible_tool_call_leak(payload, text, []),
        )


    def test_sanitizes_reasoning_alias_blocks(self):
        self.assertEqual('Final answer.', router.sanitize_visible_output('<think>private</think> Final answer.'))
        self.assertEqual('Visible.', router.sanitize_visible_output('<thinking>private</thinking>Visible.'))
        self.assertEqual('Done.', router.sanitize_visible_output('<analysis>secret chain</analysis>Done.'))
        self.assertEqual('Answer only.', router.sanitize_visible_output('old scratch</reasoning>Answer only.'))

    def test_sanitizes_visible_tool_invocation_blocks(self):
        text = """Before.
```tool_code
{"cmd":"ls /tmp"}
```
After."""
        self.assertEqual('Before.\nAfter.', router.sanitize_visible_output(text))
        self.assertEqual('Final.', router.sanitize_visible_output('{\"cmd\":\"cd /tmp && ls\"}\nFinal.'))
        self.assertEqual('Final.', router.sanitize_visible_output('functions.exec(command=\"ls\")\nFinal.'))

    def test_normalized_tool_arguments_stay_openai_compatible(self):
        call = {'function': {'name': 'message', 'arguments': {'action': 'send', 'message': 'hi'}}}
        converted = router.openai_tool_calls([call])
        args = converted[0]['function']['arguments']
        self.assertIsInstance(args, str)
        self.assertEqual(json.loads(args)['action'], 'send')



    def test_kimi_is_reasoning_and_tool_capable(self):
        provider = router.Provider('ollama', 'ollama', 'http://127.0.0.1:11434', None, ['kimi-k2.6:cloud'], set(), {'kimi-k2.6:cloud': {'supportsTools': True, 'supportsJson': True, 'contextWindow': 256000}})
        caps = router.model_capabilities(provider, 'kimi-k2.6:cloud')
        self.assertTrue(caps['reasoning'])
        self.assertTrue(caps['tools'])
        self.assertEqual(256000, caps['longContext'])

    def test_kimi_ollama_payload_preserves_tools_and_reasoning(self):
        payload = {
            'messages': [{'role': 'user', 'content': 'Use lookup'}],
            'tools': [{'type': 'function', 'function': {'name': 'lookup', 'parameters': {'type': 'object'}}}],
        }
        built = router.build_ollama_payload('kimi-k2.6:cloud', payload, thinking=router.ThinkingLevel.HIGH)
        self.assertTrue(built['think'])
        self.assertIn('tools', built)
        self.assertGreaterEqual(built['options']['num_predict'], 4096)
        self.assertGreaterEqual(built['options']['num_ctx'], 65536)


if __name__ == '__main__':
    unittest.main()
