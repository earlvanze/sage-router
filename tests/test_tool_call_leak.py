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


    def test_sanitizes_thinking_without_raw_fallback(self):
        self.assertEqual('final answer', router.sanitize_visible_output('<think>private chain</think> final answer'))
        self.assertEqual('', router.sanitize_visible_output('<think>private chain only</think>'))
        self.assertEqual('', router.sanitize_visible_output('<think>unterminated private chain'))

    def test_sanitizes_channel_tagged_analysis(self):
        raw = '<|channel|>analysis<|message|>private reasoning<|channel|>final<|message|>public answer'
        self.assertEqual('public answer', router.sanitize_visible_output(raw))

    def test_detects_structured_json_tool_leaks(self):
        leaked = '{"recipient_name":"functions.exec","parameters":{"command":"ls"}}'
        self.assertTrue(router.looks_like_visible_tool_call(leaked))

    def test_normalized_tool_arguments_stay_openai_compatible(self):
        call = {'function': {'name': 'message', 'arguments': {'action': 'send', 'message': 'hi'}}}
        converted = router.openai_tool_calls([call])
        args = converted[0]['function']['arguments']
        self.assertIsInstance(args, str)
        self.assertEqual(json.loads(args)['action'], 'send')

    def test_responses_tool_definition_converts_chat_completion_function_schema(self):
        converted = router.responses_tool_definition({
            'type': 'function',
            'function': {
                'name': 'lookup_record',
                'description': 'Look up a record.',
                'parameters': {'type': 'object', 'properties': {'id': {'type': 'string'}}},
                'strict': True,
            },
        })
        self.assertEqual({
            'type': 'function',
            'name': 'lookup_record',
            'description': 'Look up a record.',
            'parameters': {'type': 'object', 'properties': {'id': {'type': 'string'}}},
            'strict': True,
        }, converted)

    def test_responses_tool_choice_converts_named_function_choice(self):
        self.assertEqual(
            {'type': 'function', 'name': 'lookup_record'},
            router.responses_tool_choice({'type': 'function', 'function': {'name': 'lookup_record'}}),
        )
        self.assertEqual('required', router.responses_tool_choice('required'))
        self.assertIsNone(router.responses_tool_choice('auto'))

    def test_parse_responses_stream_returns_function_calls(self):
        lines = [
            b'event: response.output_item.added\n',
            b'data: {"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"lookup_record","arguments":""}}\n',
            b'event: response.function_call_arguments.delta\n',
            b'data: {"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"{\\"id\\":"}\n',
            b'event: response.function_call_arguments.done\n',
            b'data: {"type":"response.function_call_arguments.done","item_id":"fc_1","arguments":"{\\"id\\":\\"abc\\"}"}\n',
            b'data: [DONE]\n',
        ]
        text, tool_calls = router.parse_responses_stream(lines)
        self.assertEqual('', text)
        self.assertEqual('call_1', tool_calls[0]['id'])
        self.assertEqual('lookup_record', tool_calls[0]['function']['name'])
        self.assertEqual('{"id":"abc"}', tool_calls[0]['function']['arguments'])

    def test_direct_codex_scoring_is_not_capped_as_recursive_gateway(self):
        debug_scores = []
        provider = router.Provider('openai-codex', 'openai-codex-responses', 'https://codex.example/v1', 'token', ['gpt-5-codex'])
        router.score_provider_model(
            provider,
            'gpt-5-codex',
            router.Intent.CODE,
            router.Complexity.SIMPLE,
            debug_scores=debug_scores,
            requirements={'agentic': True},
        )
        contributions = [name for name, _ in debug_scores[0]['contributions']]
        self.assertNotIn('openclaw_gateway_recursive_cap', contributions)
        self.assertNotIn('openclaw_gateway_penalty', contributions)
        self.assertIn('agentic_code_codex_bonus', contributions)

    def test_anthropic_max_tokens_maps_to_length_and_back(self):
        self.assertEqual('length', router.anthropic_stop_reason_to_openai_finish_reason('max_tokens'))
        self.assertEqual('max_tokens', router.openai_finish_reason_to_anthropic_stop_reason('length'))

        response = router.build_openai_completion('dario', 'claude-sonnet-4', 'req1', 'partial', finish_reason='length')
        anthropic = router.openai_to_anthropic_response(response, 'claude-sonnet-4')
        self.assertEqual('max_tokens', anthropic['stop_reason'])

    def test_anthropic_end_turn_still_maps_to_openai_stop(self):
        self.assertEqual('stop', router.anthropic_stop_reason_to_openai_finish_reason('end_turn'))
        self.assertEqual('end_turn', router.openai_finish_reason_to_anthropic_stop_reason('stop'))

    def test_google_max_tokens_maps_to_length(self):
        self.assertEqual('length', router.google_finish_reason_to_openai_finish_reason('MAX_TOKENS'))
        self.assertEqual('stop', router.google_finish_reason_to_openai_finish_reason('STOP'))


if __name__ == '__main__':
    unittest.main()
