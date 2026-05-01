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
        self.assertIn('*mini*', req.get('denyModels', []))
        self.assertFalse(router.model_meets_requirements(router.Provider('openai-codex', 'openai-codex-responses', '', '', ['gpt-5.4-mini']), 'gpt-5.4-mini', req, 100)[0])

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

    def test_normalized_tool_arguments_stay_openai_compatible(self):
        call = {'function': {'name': 'message', 'arguments': {'action': 'send', 'message': 'hi'}}}
        converted = router.openai_tool_calls([call])
        args = converted[0]['function']['arguments']
        self.assertIsInstance(args, str)
        self.assertEqual(json.loads(args)['action'], 'send')


if __name__ == '__main__':
    unittest.main()
