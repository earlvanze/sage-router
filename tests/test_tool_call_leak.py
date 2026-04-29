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
    def test_detects_visible_tool_code_blocks(self):
        self.assertTrue(router.looks_like_visible_tool_call('tool_code\nmessage(action="delete")'))
        self.assertTrue(router.looks_like_visible_tool_call('```tool_code\n{"tool":"message","arguments":{}}\n```'))
        self.assertTrue(router.looks_like_visible_tool_call('functions.exec(command="ls")'))

    def test_does_not_reject_normal_text_or_structured_tool_calls(self):
        payload = {'tools': [{'type': 'function', 'function': {'name': 'message'}}]}
        self.assertEqual('', router.reject_visible_tool_call_leak(payload, 'I can help with that.', []))
        self.assertEqual('', router.reject_visible_tool_call_leak({}, 'tool_code\nmessage(action="send")', []))
        self.assertEqual('', router.reject_visible_tool_call_leak(payload, 'tool_code\nmessage(action="send")', [{'id': 'call_1'}]))

    def test_normalized_tool_arguments_stay_openai_compatible(self):
        call = {'function': {'name': 'message', 'arguments': {'action': 'send', 'message': 'hi'}}}
        converted = router.openai_tool_calls([call])
        args = converted[0]['function']['arguments']
        self.assertIsInstance(args, str)
        self.assertEqual(json.loads(args)['action'], 'send')


if __name__ == '__main__':
    unittest.main()
