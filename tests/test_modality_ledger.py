#!/usr/bin/env python3
"""Per-model modality ledger: record, persist, and feed back into capabilities."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('SAGE_ROUTER_DARIO_AUTOSTART', '0')
os.environ.setdefault('SAGE_ROUTER_BUNDLED_OLLAMA_AUTOSTART', '0')

import router  # noqa: E402


class ModalityLedgerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False)
        self._tmp.write('{}')
        self._tmp.close()
        self._old_path = router.APP_MODEL_MODALITIES
        self._old_ledger = dict(router.MODEL_MODALITIES)
        router.APP_MODEL_MODALITIES = self._tmp.name
        router.MODEL_MODALITIES.clear()
        router._MODEL_MODALITIES_DIRTY = False
        router._MODEL_MODALITIES_LAST_SAVE = 0.0

    def tearDown(self):
        router.APP_MODEL_MODALITIES = self._old_path
        router.MODEL_MODALITIES.clear()
        router.MODEL_MODALITIES.update(self._old_ledger)
        os.unlink(self._tmp.name)

    def test_request_modalities(self):
        req = {'vision': True, 'audio': True}
        self.assertEqual(set(router.request_modalities(req)), {'text', 'image', 'audio'})
        self.assertEqual(set(router.request_modalities({})), {'text'})
        payload = {'messages': [{'role': 'user', 'content': [
            {'type': 'input_video', 'video_url': 'https://x/c.mp4'}]}]}
        self.assertIn('video', set(router.request_modalities({}, payload)))

    def test_record_unique_modalities_and_persist(self):
        router.record_model_modalities('openai', 'gpt-5.4', ['text', 'image'])
        router.record_model_modalities('openai', 'gpt-5.4', ['text', 'image', 'audio'])
        router.record_model_modalities('openai', 'gpt-5.4', ['text'])  # no new modality
        learned = router.model_learned_modalities('openai', 'gpt-5.4')
        self.assertEqual(learned, {'text', 'image', 'audio'})
        entry = router.MODEL_MODALITIES['openai/gpt-5.4']
        self.assertEqual(entry['count'], 3)
        # Force persist and reload from disk.
        router._persist_model_modalities(force=True)
        on_disk = json.load(open(router.APP_MODEL_MODALITIES))
        self.assertEqual(set(on_disk['openai/gpt-5.4']['modalities']), {'text', 'image', 'audio'})
        router.MODEL_MODALITIES.clear()
        router.load_model_modalities()
        self.assertIn('openai/gpt-5.4', router.MODEL_MODALITIES)

    def test_capability_augmented_from_learned_modalities(self):
        # A model with no declared vision but a learned 'image' modality should
        # become vision-capable, improving routing over time.
        router.record_model_modalities('ollama', 'some-model', ['text', 'image'])
        router._persist_model_modalities(force=True)
        prov = router.Provider('ollama', 'ollama', 'http://x', '', ['some-model'],
                               model_meta={'some-model': {'input': ['text'], 'supportsChat': True,
                                                          'supportsTools': True, 'supportsJson': True, 'reasoning': True}})
        caps = router.model_capabilities(prov, 'some-model')
        self.assertTrue(caps['vision'])
        # Audio augmentation too.
        router.record_model_modalities('ollama', 'some-model', ['audio'])
        caps2 = router.model_capabilities(prov, 'some-model')
        self.assertTrue(caps2['audio'])

    def test_edit_and_reset_model_modalities(self):
        router.record_model_modalities('openai', 'gpt-5.4', ['text', 'image'])
        result = router.set_model_modalities({'key': 'openai/gpt-5.4', 'modalities': ['text', 'audio', 'bad']})
        self.assertEqual(set(result['modelModalities']['openai/gpt-5.4']['modalities']), {'text', 'audio'})
        self.assertEqual(router.model_learned_modalities('openai', 'gpt-5.4'), {'text', 'audio'})
        reset = router.reset_model_modalities({'key': 'openai/gpt-5.4'})
        self.assertEqual(reset['removed'], 1)
        self.assertNotIn('openai/gpt-5.4', router.MODEL_MODALITIES)

    def test_learned_modality_influences_scoring(self):
        prov = router.Provider('openai', 'openai-completions', 'https://api.example/v1', 'token', ['gpt-5.4'])
        before = []
        base_score = router.score_provider_model(
            prov,
            'gpt-5.4',
            router.Intent.GENERAL,
            router.Complexity.SIMPLE,
            debug_scores=before,
            requirements={'vision': True},
        )
        router.record_model_modalities('openai', 'gpt-5.4', ['image'])
        after = []
        learned_score = router.score_provider_model(
            prov,
            'gpt-5.4',
            router.Intent.GENERAL,
            router.Complexity.SIMPLE,
            debug_scores=after,
            requirements={'vision': True},
        )
        contributions = [name for name, _ in after[0]['contributions']]
        self.assertGreater(learned_score, base_score)
        self.assertIn('learned_modality:image', contributions)


if __name__ == '__main__':
    unittest.main()
