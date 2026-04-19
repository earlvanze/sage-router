#!/usr/bin/env python3
"""Smart Router V3 - Dynamic provider discovery and routing"""
import argparse, json, logging, math, os, shutil, socket, subprocess, threading, time, urllib.error, urllib.parse, urllib.request, uuid
from dataclasses import dataclass
from enum import Enum, auto
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("router")
OPENCLAW_CONFIG = os.path.expanduser("~/.openclaw/openclaw.json")
OPENCLAW_GATEWAY_HELPER = os.path.join(os.path.dirname(__file__), 'openclaw_gateway_agent.mjs')
SELF_PROVIDER_NAMES = {'smart-router'}
DARIO_PROVIDER_NAME = os.environ.get('SMART_ROUTER_DARIO_PROVIDER_NAME', 'dario')
DARIO_LOCAL_BASE_URL = os.environ.get('SMART_ROUTER_DARIO_BASE_URL', 'http://127.0.0.1:3456')
DARIO_LOCAL_API_KEY = os.environ.get('SMART_ROUTER_DARIO_API_KEY', 'dario')
DARIO_SERVICE_NAME = os.environ.get('SMART_ROUTER_DARIO_SERVICE', 'dario.service')
DISABLED_PROVIDERS = {
    name.strip() for name in os.environ.get('SMART_ROUTER_DISABLED_PROVIDERS', '').split(',')
    if name.strip()
}
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get('SMART_ROUTER_OLLAMA_TIMEOUT_SECONDS', '30'))
OPENAI_COMPAT_TIMEOUT_SECONDS = int(os.environ.get('SMART_ROUTER_OPENAI_TIMEOUT_SECONDS', '35'))
ANTHROPIC_TIMEOUT_SECONDS = int(os.environ.get('SMART_ROUTER_ANTHROPIC_TIMEOUT_SECONDS', '35'))
GOOGLE_TIMEOUT_SECONDS = int(os.environ.get('SMART_ROUTER_GOOGLE_TIMEOUT_SECONDS', '35'))
OPENCLAW_GATEWAY_TIMEOUT_SECONDS = int(os.environ.get('SMART_ROUTER_OPENCLAW_TIMEOUT_SECONDS', '20'))
OPENCLAW_GATEWAY_AGENT_ID = os.environ.get('SMART_ROUTER_OPENCLAW_AGENT_ID', 'main')
REACHABILITY_TIMEOUT_SECONDS = float(os.environ.get('SMART_ROUTER_REACHABILITY_TIMEOUT_SECONDS', '0.5'))
REACHABILITY_TTL_SECONDS = int(os.environ.get('SMART_ROUTER_REACHABILITY_TTL_SECONDS', '120'))
PROVIDER_HEALTH_CACHE = {}
LATENCY_STATS_PATH = os.path.expanduser(os.environ.get('SMART_ROUTER_LATENCY_STATS_PATH', '~/.cache/smart-router-v3/latency-stats.json'))
LATENCY_EWMA_ALPHA = float(os.environ.get('SMART_ROUTER_LATENCY_EWMA_ALPHA', '0.35'))
GENERAL_EMPIRICAL_EXPLORATION_BONUS = float(os.environ.get('SMART_ROUTER_GENERAL_EXPLORATION_BONUS', '20'))
GENERAL_EMPIRICAL_SUCCESS_EXPLORATION_CAP = float(os.environ.get('SMART_ROUTER_GENERAL_SUCCESS_EXPLORATION_CAP', '8'))
GENERAL_EMPIRICAL_LATENCY_BONUS_CAP = float(os.environ.get('SMART_ROUTER_GENERAL_LATENCY_BONUS_CAP', '18'))
GENERAL_EMPIRICAL_LATENCY_PIVOT_MS = float(os.environ.get('SMART_ROUTER_GENERAL_LATENCY_PIVOT_MS', '2500'))
GENERAL_EMPIRICAL_FAILURE_PENALTY = float(os.environ.get('SMART_ROUTER_GENERAL_FAILURE_PENALTY', '4'))
DEFAULT_OPENAI_CODEX_MODELS = ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.1']
DEFAULT_ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-opus-4-5', 'claude-opus-4-1', 'claude-opus-4-0', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4-0', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest']
MAX_PROVIDER_ATTEMPTS = int(os.environ.get('SMART_ROUTER_MAX_PROVIDER_ATTEMPTS', '8'))
LATENCY_STATS_LOCK = threading.Lock()

INTENT_API_SCORES = {
    'CODE': {'anthropic-messages': 60, 'google-generative-language': 58, 'openai-completions': 56, 'ollama': 50, 'openclaw-gateway': 44},
    'ANALYSIS': {'anthropic-messages': 60, 'google-generative-language': 58, 'openai-completions': 57, 'ollama': 52, 'openclaw-gateway': 46},
    'CREATIVE': {'anthropic-messages': 60, 'google-generative-language': 59, 'openai-completions': 55, 'ollama': 50, 'openclaw-gateway': 44},
    'REALTIME': {'google-generative-language': 60, 'openai-completions': 60, 'anthropic-messages': 54, 'ollama': 48, 'openclaw-gateway': 42},
    'GENERAL': {'anthropic-messages': 58, 'google-generative-language': 57, 'openai-completions': 56, 'ollama': 50, 'openclaw-gateway': 42},
}

INTENT_MODEL_HINTS = {
    'CODE': ['opus', 'sonnet', 'codex', 'gpt-5', 'deepseek', 'qwen', 'kimi', 'glm'],
    'ANALYSIS': ['opus', 'sonnet', 'gpt-5', 'o3', 'qwen', 'kimi', 'minimax', 'glm'],
    'CREATIVE': ['opus', 'sonnet', 'minimax', 'kimi', 'gpt-5', 'qwen'],
    'REALTIME': ['gpt-4o', 'gpt-5', 'sonnet', 'kimi', 'qwen', 'glm'],
    'GENERAL': ['sonnet', 'gpt-4o', 'gpt-5', 'kimi', 'minimax', 'qwen', 'glm', 'opus'],
}

COMPLEX_MODEL_HINTS = ['opus', 'sonnet', 'gpt-5', 'o3', 'qwen', 'kimi', 'deepseek']
LIGHTWEIGHT_MODEL_HINTS = ['mini', 'small', 'haiku']

class Intent(Enum):
    CODE = auto(); ANALYSIS = auto(); CREATIVE = auto(); REALTIME = auto(); GENERAL = auto()
class Complexity(Enum):
    SIMPLE = auto(); MEDIUM = auto(); COMPLEX = auto()

@dataclass
class Provider:
    name: str; api_type: str; base_url: str; api_key: str; models: List[str]


def dedupe_keep_order(items):
    seen = set()
    ordered = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def merge_provider(providers, provider):
    existing = providers.get(provider.name)
    if not existing:
        providers[provider.name] = provider
        return
    providers[provider.name] = Provider(
        provider.name,
        existing.api_type or provider.api_type,
        existing.base_url or provider.base_url,
        existing.api_key or provider.api_key,
        dedupe_keep_order((existing.models or []) + (provider.models or [])),
    )

def resolve_config_value(value):
    if isinstance(value, str) and value.startswith('${') and value.endswith('}'):
        return os.environ.get(value[2:-1], '')
    return value


def is_self_provider(name, base_url):
    if name in SELF_PROVIDER_NAMES:
        return True
    parsed = urllib.parse.urlparse(base_url or '')
    return parsed.hostname in {'127.0.0.1', 'localhost'} and parsed.port == 8788


def is_local_dario_endpoint(base_url):
    parsed = urllib.parse.urlparse(base_url or '')
    return parsed.hostname in {'127.0.0.1', 'localhost'} and parsed.port == 3456


def should_route_anthropic_to_dario(name, api_type, base_url):
    host = (urllib.parse.urlparse(base_url or '').hostname or '').lower()
    if name == DARIO_PROVIDER_NAME or is_local_dario_endpoint(base_url):
        return False
    if name == 'anthropic':
        return True
    return api_type == 'anthropic-messages' and ('anthropic.com' in host or host == 'api.anthropic.com')


def ensure_dario_proxy_ready():
    try:
        active = subprocess.run(
            ['systemctl', '--user', 'is-active', '--quiet', DARIO_SERVICE_NAME],
            check=False,
            capture_output=True,
            timeout=5,
        )
        if active.returncode == 0:
            return True

        if not shutil.which('dario'):
            logger.warning('Anthropic provider detected but dario is not installed on PATH')
            return False

        start = subprocess.run(
            ['systemctl', '--user', 'start', DARIO_SERVICE_NAME],
            check=False,
            capture_output=True,
            timeout=10,
        )
        if start.returncode != 0:
            detail = (start.stderr or start.stdout or b'').decode('utf-8', errors='replace').strip()
            logger.warning(f'Failed to start {DARIO_SERVICE_NAME}: {detail[:300]}')
            return False
        logger.info(f'Started {DARIO_SERVICE_NAME} for Anthropic compatibility')
        return True
    except Exception as e:
        logger.warning(f'Failed to ensure Dario proxy readiness: {e}')
        return False


def infer_api_type(name, cfg, base_url):
    api_type = cfg.get('api')
    if api_type:
        return api_type
    host = (urllib.parse.urlparse(base_url or '').hostname or '').lower()
    if 'generativelanguage.googleapis.com' in host or name == 'google':
        return 'google-generative-language'
    return 'openai-completions'


def discover_google_models(base_url, api_key):
    if not base_url or not api_key:
        return []
    try:
        url = base_url.rstrip('/') + '/models'
        req = urllib.request.Request(url, headers={'x-goog-api-key': api_key})
        with urllib.request.urlopen(req, timeout=GOOGLE_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
        models = []
        for entry in payload.get('models', []):
            methods = entry.get('supportedGenerationMethods') or []
            if 'generateContent' not in methods and 'streamGenerateContent' not in methods:
                continue
            model_name = entry.get('name', '')
            if model_name.startswith('models/'):
                model_name = model_name.split('/', 1)[1]
            if model_name:
                models.append(model_name)
        return dedupe_keep_order(models)
    except Exception as e:
        logger.warning(f"Google model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_provider_models(name, cfg, base_url, api_key, api_type):
    configured = [m.get('id') for m in cfg.get('models', []) if m.get('id')]
    if configured:
        return dedupe_keep_order(configured)
    if api_type == 'google-generative-language':
        return discover_google_models(base_url, api_key)
    return []

def load_openclaw_providers():
    providers = {}
    try:
        with open(OPENCLAW_CONFIG) as f:
            config = json.load(f)
        for name, cfg in config.get('models', {}).get('providers', {}).items():
            base_url = resolve_config_value(cfg.get('baseUrl', '') or '')
            if is_self_provider(name, base_url):
                continue
            api_key = resolve_config_value(cfg.get('apiKey', '') or '')
            api_type = infer_api_type(name, cfg, base_url)
            models = discover_provider_models(name, cfg, base_url, api_key, api_type)

            if should_route_anthropic_to_dario(name, api_type, base_url):
                ensure_dario_proxy_ready()
                merge_provider(providers, Provider(
                    DARIO_PROVIDER_NAME,
                    'anthropic-messages',
                    DARIO_LOCAL_BASE_URL,
                    DARIO_LOCAL_API_KEY,
                    dedupe_keep_order(models or DEFAULT_ANTHROPIC_MODELS),
                ))
                logger.info(f'Normalized provider {name} -> {DARIO_PROVIDER_NAME} via local Dario proxy')
                continue

            merge_provider(providers, Provider(
                name,
                api_type,
                base_url,
                api_key,
                models,
            ))

        auth_profiles = config.get('auth', {}).get('profiles', {})
        agent_defaults = config.get('agents', {}).get('defaults', {})
        codex_models = []
        for model_ref in agent_defaults.get('model', {}).get('fallbacks', []):
            if isinstance(model_ref, str) and model_ref.startswith('openai-codex/'):
                codex_models.append(model_ref.split('/', 1)[1])
        for model_ref in (agent_defaults.get('models', {}) or {}).keys():
            if isinstance(model_ref, str) and model_ref.startswith('openai-codex/'):
                codex_models.append(model_ref.split('/', 1)[1])
        codex_models = dedupe_keep_order(codex_models) or DEFAULT_OPENAI_CODEX_MODELS
        if 'openai-codex:default' in auth_profiles:
            merge_provider(providers, Provider(
                'openai-codex',
                'openclaw-gateway',
                'ws://127.0.0.1:18789',
                '',
                codex_models,
            ))

        logger.info(f"Loaded {len(providers)} configured providers: {list(providers.keys())}")
    except Exception as e:
        logger.error(f"Config load failed: {e}")
        providers['ollama'] = Provider('ollama', 'ollama', 'http://127.0.0.1:11434', '', ['qwen3.5:cloud', 'kimi-k2.5:cloud'])
    return providers

PROVIDERS = load_openclaw_providers()


def normalize_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                block_type = block.get('type')
                if block_type == 'text':
                    parts.append(block.get('text', ''))
                elif 'content' in block:
                    parts.append(normalize_content(block.get('content')))
        return ' '.join(part for part in parts if part).strip()
    if isinstance(content, dict):
        if 'text' in content:
            return str(content.get('text', ''))
        if 'content' in content:
            return normalize_content(content.get('content'))
    return '' if content is None else str(content)


def normalize_messages(messages):
    normalized = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        normalized.append({
            'role': msg.get('role', 'user'),
            'content': normalize_content(msg.get('content', '')),
        })
    return normalized


def load_latency_stats():
    try:
        with open(LATENCY_STATS_PATH) as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.warning(f'Latency stats load failed: {e}')
    return {'version': 1, 'intents': {}}


LATENCY_STATS = load_latency_stats()


def save_latency_stats():
    try:
        os.makedirs(os.path.dirname(LATENCY_STATS_PATH), exist_ok=True)
        tmp_path = LATENCY_STATS_PATH + '.tmp'
        with open(tmp_path, 'w') as f:
            json.dump(LATENCY_STATS, f, indent=2, sort_keys=True)
        os.replace(tmp_path, LATENCY_STATS_PATH)
    except Exception as e:
        logger.warning(f'Latency stats save failed: {e}')


def get_latency_stat(intent_name, provider_name, model):
    return (((LATENCY_STATS.get('intents') or {}).get(intent_name) or {}).get(provider_name) or {}).get(model)


def get_intent_provider_stats(intent_name, provider_name):
    return (((LATENCY_STATS.get('intents') or {}).get(intent_name) or {}).get(provider_name) or {})


def record_latency_outcome(intent_name, provider_name, model, elapsed_seconds, ok):
    elapsed_ms = max(1.0, float(elapsed_seconds) * 1000.0)
    now = int(time.time())
    with LATENCY_STATS_LOCK:
        intents = LATENCY_STATS.setdefault('intents', {})
        intent_stats = intents.setdefault(intent_name, {})
        provider_stats = intent_stats.setdefault(provider_name, {})
        stat = provider_stats.setdefault(model, {
            'successes': 0,
            'failures': 0,
            'latency_ewma_ms': elapsed_ms,
            'last_latency_ms': elapsed_ms,
            'updated_at': now,
        })

        stat['last_latency_ms'] = elapsed_ms
        stat['updated_at'] = now
        if ok:
            stat['successes'] = int(stat.get('successes', 0)) + 1
            previous = float(stat.get('latency_ewma_ms', elapsed_ms) or elapsed_ms)
            stat['latency_ewma_ms'] = round((LATENCY_EWMA_ALPHA * elapsed_ms) + ((1.0 - LATENCY_EWMA_ALPHA) * previous), 2)
        else:
            stat['failures'] = int(stat.get('failures', 0)) + 1

        save_latency_stats()


def general_empirical_adjustment(provider, model):
    provider_name = provider.name
    stat = get_latency_stat('GENERAL', provider_name, model)
    provider_stats = get_intent_provider_stats('GENERAL', provider_name)
    if not stat:
        if provider.api_type == 'openclaw-gateway':
            return -4.0, 'cold-gateway'
        if provider_stats:
            return -2.0, 'provider-known,cold-model'
        return GENERAL_EMPIRICAL_EXPLORATION_BONUS, 'cold'

    successes = int(stat.get('successes', 0))
    failures = int(stat.get('failures', 0))
    samples = successes + failures
    exploration = GENERAL_EMPIRICAL_EXPLORATION_BONUS / math.sqrt(samples + 1)

    if successes <= 0:
        penalty = GENERAL_EMPIRICAL_FAILURE_PENALTY * failures
        return exploration - penalty, f'explore={exploration:.2f},fail={penalty:.2f}'

    latency_ewma_ms = float(stat.get('latency_ewma_ms', GENERAL_EMPIRICAL_LATENCY_PIVOT_MS) or GENERAL_EMPIRICAL_LATENCY_PIVOT_MS)
    exploration = min(exploration, GENERAL_EMPIRICAL_SUCCESS_EXPLORATION_CAP)
    speed_bonus = (GENERAL_EMPIRICAL_LATENCY_PIVOT_MS - latency_ewma_ms) / 250.0
    speed_bonus = max(-GENERAL_EMPIRICAL_LATENCY_BONUS_CAP, min(GENERAL_EMPIRICAL_LATENCY_BONUS_CAP, speed_bonus))
    penalty = GENERAL_EMPIRICAL_FAILURE_PENALTY * failures
    total = speed_bonus + exploration - penalty
    return total, f'ewma_ms={latency_ewma_ms:.0f},explore={exploration:.2f},fail={penalty:.2f}'


def build_openclaw_gateway_prompt(messages):
    system_parts = []
    conversation_parts = []
    for msg in messages or []:
        role = msg.get('role', 'user')
        content = (msg.get('content') or '').strip()
        if not content:
            continue
        if role in ('system', 'developer'):
            system_parts.append(content)
            continue
        sender = 'Assistant' if role == 'assistant' else 'Tool' if role == 'tool' else 'User'
        conversation_parts.append(f'{sender}: {content}')

    sections = []
    if system_parts:
        sections.append('System instructions:\n' + '\n\n'.join(system_parts))
    if conversation_parts:
        sections.append('Conversation so far:\n' + '\n'.join(conversation_parts))
    sections.append('Reply as the assistant to the latest user message.')
    return '\n\n'.join(section for section in sections if section).strip()


def extract_http_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read().decode('utf-8', errors='replace').strip()
        except Exception:
            body = ''
        detail = f"HTTP {exc.code} {exc.reason}"
        return f"{detail} | {body[:300]}" if body else detail
    return str(exc)


def provider_endpoint_reachable(provider: Provider) -> bool:
    now = time.time()
    cached = PROVIDER_HEALTH_CACHE.get(provider.name)
    if cached and now - cached['checked_at'] < REACHABILITY_TTL_SECONDS:
        return cached['reachable']

    reachable = False
    try:
        parsed = urllib.parse.urlparse(provider.base_url)
        host = parsed.hostname
        port = parsed.port
        if not host:
            reachable = False
        else:
            if port is None:
                port = 443 if parsed.scheme == 'https' else 80
            with socket.create_connection((host, port), timeout=REACHABILITY_TIMEOUT_SECONDS):
                reachable = True
    except Exception:
        reachable = False

    PROVIDER_HEALTH_CACHE[provider.name] = {'reachable': reachable, 'checked_at': now}
    return reachable


def available_provider_names():
    return [
        name for name, provider in PROVIDERS.items()
        if name not in DISABLED_PROVIDERS and provider.models and provider_endpoint_reachable(provider)
    ]


def classify_intent(text):
    tl = text.lower(); scores = {i:0 for i in Intent}
    for kw in ['write','code','debug','fix','refactor','implement','function','bug','test','.py','.js']:
        if kw in tl: scores[Intent.CODE] += 1
    if '```' in text: scores[Intent.CODE] += 3
    for kw in ['analyze','explain','compare','research','why','how does','review']:
        if kw in tl: scores[Intent.ANALYSIS] += 1
    for kw in ['create','brainstorm','imagine','design','story']:
        if kw in tl: scores[Intent.CREATIVE] += 2
    for kw in ['now','today','current','latest','price','weather']:
        if kw in tl: scores[Intent.REALTIME] += 2
    m = max(scores, key=scores.get)
    return (m if scores[m] > 0 else Intent.GENERAL), scores

def estimate_complexity(text):
    w = len(text.split())
    return Complexity.SIMPLE if w < 30 else (Complexity.COMPLEX if w > 200 else Complexity.MEDIUM)

def pick_model(prov, prefer=None):
    if not prov.models: return ''
    if prefer:
        for wanted in prefer:
            for m in prov.models:
                if m == wanted or wanted in m:
                    return m
    return prov.models[0]


def score_provider_model(provider, model, intent, complexity):
    intent_key = intent.name
    api_score = INTENT_API_SCORES.get(intent_key, {}).get(provider.api_type, 40)
    model_l = model.lower()
    provider_l = provider.name.lower()
    score = api_score

    for idx, hint in enumerate(INTENT_MODEL_HINTS.get(intent_key, [])):
        if hint in model_l:
            score += max(1, 12 - idx)

    if provider.api_type == 'anthropic-messages' and intent in (Intent.CODE, Intent.ANALYSIS, Intent.GENERAL):
        score += 4
    if provider.api_type == 'openclaw-gateway':
        score -= 4
    if 'cyber' in provider_l:
        score -= 2
    if complexity == Complexity.COMPLEX and any(hint in model_l for hint in COMPLEX_MODEL_HINTS):
        score += 5
    if complexity == Complexity.COMPLEX and any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
        score -= 8
    if complexity == Complexity.SIMPLE and any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
        score += 2
    if intent == Intent.GENERAL and provider.api_type == 'ollama':
        score -= 1
    if intent == Intent.GENERAL:
        score = 50 + ((score - 50) * 0.35)
        empirical_bonus, empirical_note = general_empirical_adjustment(provider, model)
        score += empirical_bonus
        logger.debug(f"[scoring] GENERAL {provider.name}/{model}: base={score - empirical_bonus:.2f}, empirical={empirical_bonus:.2f} ({empirical_note}), final={score:.2f}")

    return score

def select_model(intent, complexity):
    candidates = []
    for pn, provider in PROVIDERS.items():
        if pn in DISABLED_PROVIDERS:
            continue
        if not provider.models or not provider_endpoint_reachable(provider):
            continue
        best = None
        for model in dedupe_keep_order(provider.models):
            scored = (score_provider_model(provider, model, intent, complexity), pn, model)
            if best is None or scored[0] > best[0]:
                best = scored
        if best:
            candidates.append(best)

    candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [(pn, model) for _, pn, model in candidates[:MAX_PROVIDER_ATTEMPTS]]

def call_ollama(base_url, model, messages, api_key=''):
    url = base_url.rstrip('/') + '/api/chat'
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        data = json.dumps(payload).encode()
        hdrs = {'Content-Type': 'application/json'}
        if api_key:
            hdrs['Authorization'] = f'Bearer {api_key}'
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
            return True, json.loads(resp.read()).get('message', {}).get('content', '')
    except Exception as e:
        logger.warning(f"Ollama {base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)

def call_openai_compat(base_url, model, messages, api_key='', provider_name=''):
    url = base_url.rstrip('/') + '/v1/chat/completions'
    payload = {"model": model, "messages": messages, "max_tokens": 8192}
    try:
        data = json.dumps(payload).encode()
        hdrs = {'Content-Type': 'application/json'}
        if api_key:
            hdrs['Authorization'] = f'Bearer {api_key}'
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            return True, json.loads(resp.read()).get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception as e:
        logger.warning(f"OpenAI-compat {provider_name or base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)


def call_openclaw_gateway(model, messages, provider_name='openai-codex'):
    if not os.path.exists(OPENCLAW_GATEWAY_HELPER):
        return False, f'Missing OpenClaw gateway helper: {OPENCLAW_GATEWAY_HELPER}'

    payload = {
        'agentId': OPENCLAW_GATEWAY_AGENT_ID,
        'provider': provider_name,
        'model': model,
        'message': build_openclaw_gateway_prompt(messages),
        'timeoutMs': OPENCLAW_GATEWAY_TIMEOUT_SECONDS * 1000,
    }

    try:
        proc = subprocess.run(
            ['node', OPENCLAW_GATEWAY_HELPER],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=OPENCLAW_GATEWAY_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(f'OpenClaw gateway {provider_name} {model}: timed out after {OPENCLAW_GATEWAY_TIMEOUT_SECONDS}s')
        return False, f'OpenClaw gateway timeout after {OPENCLAW_GATEWAY_TIMEOUT_SECONDS}s'
    except Exception as e:
        logger.warning(f'OpenClaw gateway {provider_name} {model}: {e}')
        return False, str(e)

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or '').strip()
        logger.warning(f'OpenClaw gateway {provider_name} {model}: {detail[:500]}')
        return False, detail or f'OpenClaw gateway exited with code {proc.returncode}'

    try:
        result = json.loads(proc.stdout or '{}')
    except Exception:
        return False, (proc.stdout or proc.stderr or 'Invalid OpenClaw gateway response').strip()

    text = result.get('text', '')
    if text:
        return True, text
    return False, json.dumps(result)

def call_anthropic(base_url, model, messages, api_key=''):
    url = base_url.rstrip('/') + '/v1/messages'
    system_text = ''
    api_msgs = []
    for msg in messages:
        r, c = msg.get('role', 'user'), msg.get('content', '')
        if r == 'system':
            system_text += c + '\n'
        elif r in ('user', 'assistant'):
            api_msgs.append({"role": r, "content": c})
        else:
            label = r.upper() if isinstance(r, str) else 'MESSAGE'
            wrapped = f'[{label}]\n{c}'.strip() if c else f'[{label}]'
            api_msgs.append({"role": "user", "content": wrapped})
    if api_msgs and api_msgs[0].get('role') != 'user':
        api_msgs.insert(0, {"role": "user", "content": "Hello"})
    if not api_msgs:
        api_msgs = [{"role": "user", "content": "Hello"}]
    payload = {"model": model, "max_tokens": 8192, "messages": api_msgs}
    if system_text.strip():
        payload["system"] = system_text.strip()
    try:
        data = json.dumps(payload).encode()
        hdrs = {'Content-Type': 'application/json', 'anthropic-version': '2023-06-01'}
        if api_key:
            hdrs['x-api-key'] = api_key
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=ANTHROPIC_TIMEOUT_SECONDS) as resp:
            blocks = json.loads(resp.read()).get('content', [])
            return True, ''.join(b.get('text', '') for b in blocks if isinstance(b, dict) and b.get('type') == 'text')
    except Exception as e:
        logger.warning(f"Anthropic {base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)


def call_google(base_url, model, messages, api_key=''):
    url = base_url.rstrip('/') + f'/models/{urllib.parse.quote(model, safe="")}:generateContent'
    system_text = ''
    contents = []
    for msg in messages:
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        if not content:
            continue
        if role in ('system', 'developer'):
            system_text += content + '\n'
            continue
        if role == 'assistant':
            gemini_role = 'model'
            text = content
        elif role == 'user':
            gemini_role = 'user'
            text = content
        else:
            label = role.upper() if isinstance(role, str) else 'MESSAGE'
            gemini_role = 'user'
            text = f'[{label}]\n{content}'.strip()
        part = {'text': text}
        if contents and contents[-1].get('role') == gemini_role:
            contents[-1].setdefault('parts', []).append(part)
        else:
            contents.append({'role': gemini_role, 'parts': [part]})

    if contents and contents[0].get('role') != 'user':
        contents.insert(0, {'role': 'user', 'parts': [{'text': 'Hello'}]})
    if not contents:
        contents = [{'role': 'user', 'parts': [{'text': 'Hello'}]}]

    payload = {
        'contents': contents,
        'generationConfig': {'maxOutputTokens': 8192},
    }
    if system_text.strip():
        payload['systemInstruction'] = {'parts': [{'text': system_text.strip()}]}

    try:
        data = json.dumps(payload).encode()
        hdrs = {'Content-Type': 'application/json'}
        if api_key:
            hdrs['x-goog-api-key'] = api_key
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=GOOGLE_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read())
        parts = result.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        text = ''.join(part.get('text', '') for part in parts if isinstance(part, dict))
        return (True, text) if text else (False, json.dumps(result)[:500])
    except Exception as e:
        logger.warning(f"Google {base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)

def latest_user_text(messages):
    for msg in reversed(messages or []):
        if msg.get('role') == 'user' and msg.get('content'):
            return msg.get('content', '')
    return messages[-1].get('content', '') if messages else ''


def route_request(messages, request_id='req-unknown'):
    normalized_messages = normalize_messages(messages)
    user_text = latest_user_text(normalized_messages)
    intent, _ = classify_intent(user_text)
    complexity = estimate_complexity(user_text)
    logger.info(f"[{request_id}] Intent: {intent.name}, Complexity: {complexity.name}")
    chain = select_model(intent, complexity)
    logger.info(f"[{request_id}] Chain: {chain}")
    overall_started = time.time()
    for pn, model in chain:
        if pn in DISABLED_PROVIDERS:
            continue
        if pn not in PROVIDERS:
            continue
        prov = PROVIDERS[pn]
        logger.info(f"[{request_id}] Trying {pn}/{model} (api={prov.api_type})")
        started = time.time()
        if prov.api_type == 'ollama':
            ok, text = call_ollama(prov.base_url, model, normalized_messages, prov.api_key)
        elif prov.api_type == 'openclaw-gateway':
            ok, text = call_openclaw_gateway(model, normalized_messages, pn)
        elif prov.api_type == 'anthropic-messages':
            ok, text = call_anthropic(prov.base_url, model, normalized_messages, prov.api_key)
        elif prov.api_type == 'google-generative-language':
            ok, text = call_google(prov.base_url, model, normalized_messages, prov.api_key)
        else:
            ok, text = call_openai_compat(prov.base_url, model, normalized_messages, prov.api_key, pn)
        elapsed = time.time() - started
        record_latency_outcome(intent.name, pn, model, elapsed, ok)
        if ok:
            total_elapsed = time.time() - overall_started
            logger.info(f"[{request_id}] OK: {pn}/{model} ({len(text)} chars, provider={elapsed:.2f}s, total={total_elapsed:.2f}s)")
            return {"id": f"chatcmpl-{int(time.time())}", "object": "chat.completion", "created": int(time.time()), "model": f"{pn}/{model}", "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
        logger.warning(f"[{request_id}] Failed {pn}/{model} after {elapsed:.2f}s")
    total_elapsed = time.time() - overall_started
    logger.error(f"[{request_id}] All providers failed after {total_elapsed:.2f}s")
    return {"error": "All providers failed", "choices": [{"message": {"content": "Error: No providers available"}}]}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        logger.info("%s - %s", self.address_string(), fmt % a)

    def write_json(self, status_code, payload):
        body = json.dumps(payload).encode()
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            logger.warning("Client disconnected before response could be written")

    def do_GET(self):
        if self.path == '/health':
            self.write_json(200, {
                "status": "ok",
                "providers": available_provider_names(),
                "configured": list(PROVIDERS.keys()),
                "disabled": sorted(DISABLED_PROVIDERS),
            })
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ['/v1/chat/completions', '/chat/completions']:
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            request_id = uuid.uuid4().hex[:8]
            started = time.time()
            try:
                payload = json.loads(body or b'{}')
                message_count = len(payload.get('messages', []) or [])
                logger.info(f"[{request_id}] Incoming {self.path} with {message_count} messages")
                result = route_request(payload.get('messages', []), request_id=request_id)
                self.write_json(200, result)
                logger.info(f"[{request_id}] Responded in {time.time() - started:.2f}s")
            except Exception as e:
                logger.exception(f"[{request_id}] Request handling failed")
                self.write_json(500, {"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8788); args = parser.parse_args()
    server = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    logger.info(f"Router on :{args.port} | configured={list(PROVIDERS.keys())} | disabled={sorted(DISABLED_PROVIDERS)}")
    server.serve_forever()
