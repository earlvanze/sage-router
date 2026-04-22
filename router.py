#!/usr/bin/env python3
"""Sage Router - Dynamic provider discovery and routing"""
import argparse, json, logging, math, os, shutil, socket, subprocess, threading, time, urllib.error, urllib.parse, urllib.request, uuid
from dataclasses import dataclass
from enum import Enum, auto
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("router")
OPENCLAW_CONFIG = os.path.expanduser("~/.openclaw/openclaw.json")
OPENCLAW_DOTENV = os.path.expanduser("~/.openclaw/.env")
PROVIDER_PROFILES_PATH = os.path.join(os.path.dirname(__file__), 'provider-profiles.json')
OPENCLAW_GATEWAY_HELPER = os.path.join(os.path.dirname(__file__), 'openclaw_gateway_agent.mjs')
SELF_PROVIDER_NAMES = {'smart-router', 'sage-router'}


def load_env_file(path):
    try:
        with open(path) as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                if not key or key in os.environ:
                    continue
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                    value = value[1:-1]
                os.environ[key] = value
    except FileNotFoundError:
        return
    except Exception as e:
        logger.debug(f'Failed to load env file {path}: {e}')


load_env_file(OPENCLAW_DOTENV)

# Backward compat: fall back to SMART_ROUTER_* env vars if SAGE_ROUTER_* not set
import re as _re
_env_compat_done = set()
for _key in list(os.environ):
    if _key.startswith('SMART_ROUTER_') and _key not in os.environ:
        pass  # can't happen, but guard
for _key in list(os.environ):
    if _key.startswith('SMART_ROUTER_'):
        _new_key = _key.replace('SMART_ROUTER_', 'SAGE_ROUTER_', 1)
        if _new_key not in os.environ:
            os.environ[_new_key] = os.environ[_key]
DARIO_PROVIDER_NAME = os.environ.get('SAGE_ROUTER_DARIO_PROVIDER_NAME', 'dario')
DARIO_LOCAL_BASE_URL = os.environ.get('SAGE_ROUTER_DARIO_BASE_URL', 'http://127.0.0.1:3456')
DARIO_LOCAL_API_KEY = os.environ.get('SAGE_ROUTER_DARIO_API_KEY', 'dario')
DARIO_SERVICE_NAME = os.environ.get('SAGE_ROUTER_DARIO_SERVICE', 'dario.service')
OPENCLAW_GATEWAY_BASE_URL = os.environ.get('SAGE_ROUTER_OPENCLAW_GATEWAY_URL', 'ws://127.0.0.1:18789')
# Auth-profile-based gateway providers: defined after DEFAULT constants below
DISABLED_PROVIDERS = {
    name.strip() for name in os.environ.get('SAGE_ROUTER_DISABLED_PROVIDERS', '').split(',')
    if name.strip()
}
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_OLLAMA_TIMEOUT_SECONDS', '120'))
OLLAMA_ALLOW_THINK_FALSE_RETRY = os.environ.get('SAGE_ROUTER_OLLAMA_ALLOW_THINK_FALSE_RETRY', '').strip().lower() in {'1', 'true', 'yes', 'on'}
OPENAI_COMPAT_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_OPENAI_TIMEOUT_SECONDS', '35'))
ANTHROPIC_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_ANTHROPIC_TIMEOUT_SECONDS', '35'))
GOOGLE_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_GOOGLE_TIMEOUT_SECONDS', '35'))
OPENCLAW_GATEWAY_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_OPENCLAW_TIMEOUT_SECONDS', '20'))
OPENCLAW_GATEWAY_CODE_TIMEOUT_SECONDS = int(os.environ.get('SAGE_ROUTER_OPENCLAW_CODE_TIMEOUT_SECONDS', '45'))
OPENCLAW_GATEWAY_AGENT_ID = os.environ.get('SAGE_ROUTER_OPENCLAW_AGENT_ID', 'main')
REACHABILITY_TIMEOUT_SECONDS = float(os.environ.get('SAGE_ROUTER_REACHABILITY_TIMEOUT_SECONDS', '0.5'))
REACHABILITY_TTL_SECONDS = int(os.environ.get('SAGE_ROUTER_REACHABILITY_TTL_SECONDS', '120'))
OLLAMA_MODEL_REFRESH_TTL_SECONDS = int(os.environ.get('SAGE_ROUTER_OLLAMA_MODEL_REFRESH_TTL_SECONDS', '300'))
HEALTH_SCORE_TTL_SECONDS = int(os.environ.get('SAGE_ROUTER_HEALTH_SCORE_TTL_SECONDS', '60'))
RATE_LIMIT_COOLDOWN_BASE_SECONDS = int(os.environ.get('SAGE_ROUTER_RATE_LIMIT_COOLDOWN_BASE_SECONDS', '120'))
FAILURE_COOLDOWN_BASE_SECONDS = int(os.environ.get('SAGE_ROUTER_FAILURE_COOLDOWN_BASE_SECONDS', '180'))
CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD = int(os.environ.get('SAGE_ROUTER_CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD', '2'))
MODEL_MISSING_COOLDOWN_SECONDS = int(os.environ.get('SAGE_ROUTER_MODEL_MISSING_COOLDOWN_SECONDS', '1800'))
EMPTY_OUTPUT_COOLDOWN_SECONDS = int(os.environ.get('SAGE_ROUTER_EMPTY_OUTPUT_COOLDOWN_SECONDS', '600'))
PROVIDER_HEALTH_CACHE = {}
LATENCY_STATS_PATH = os.path.expanduser(os.environ.get('SAGE_ROUTER_LATENCY_STATS_PATH', '~/.cache/sage-router/latency-stats.json'))
LATENCY_EWMA_ALPHA = float(os.environ.get('SAGE_ROUTER_LATENCY_EWMA_ALPHA', '0.35'))
GENERAL_EMPIRICAL_EXPLORATION_BONUS = float(os.environ.get('SAGE_ROUTER_GENERAL_EXPLORATION_BONUS', '20'))
GENERAL_EMPIRICAL_SUCCESS_EXPLORATION_CAP = float(os.environ.get('SAGE_ROUTER_GENERAL_SUCCESS_EXPLORATION_CAP', '8'))
GENERAL_EMPIRICAL_LATENCY_BONUS_CAP = float(os.environ.get('SAGE_ROUTER_GENERAL_LATENCY_BONUS_CAP', '18'))
GENERAL_EMPIRICAL_LATENCY_PIVOT_MS = float(os.environ.get('SAGE_ROUTER_GENERAL_LATENCY_PIVOT_MS', '2500'))
GENERAL_EMPIRICAL_FAILURE_PENALTY = float(os.environ.get('SAGE_ROUTER_GENERAL_FAILURE_PENALTY', '4'))
DEFAULT_OPENAI_CODEX_MODELS = ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.1']
DEFAULT_ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-opus-4-5', 'claude-opus-4-1', 'claude-opus-4-0', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4-0', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest']


def extract_http_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read().decode('utf-8', errors='replace').strip()
        except Exception:
            body = ''
        detail = f"HTTP {exc.code} {exc.reason}"
        return f"{detail} | {body[:300]}" if body else detail
    return str(exc)


# Auth-profile-based gateway providers: auto-created when matching profile exists
# Maps auth profile provider name -> (api_type, default_models, default_meta)
GATEWAY_PROVIDER_PROFILES = {
    'openai-codex': ('openclaw-gateway', DEFAULT_OPENAI_CODEX_MODELS, {'reasoning': True, 'contextWindow': 256000, 'maxTokens': 128000, 'input': ['text']}),
    'anthropic': ('anthropic-messages', DEFAULT_ANTHROPIC_MODELS, {'reasoning': True, 'contextWindow': 1000000, 'maxTokens': 64000, 'input': ['text']}),
    'openai': ('openai-completions', ['gpt-5.4', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini'], {'reasoning': False, 'contextWindow': 128000, 'maxTokens': 16384, 'input': ['text']}),
    'google': ('google-generative-language', ['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'], {'reasoning': False, 'contextWindow': 1000000, 'maxTokens': 65536, 'input': ['text', 'image']}),
    'xai': ('openai-completions', ['grok-3', 'grok-3-mini', 'grok-2'], {'reasoning': False, 'contextWindow': 128000, 'maxTokens': 16384, 'input': ['text']}),
    'zai': ('openai-completions', ['z1-ultra', 'z1-pro', 'z1-mini'], {'reasoning': True, 'contextWindow': 256000, 'maxTokens': 65536, 'input': ['text']}),
    'github-copilot': ('openclaw-gateway', ['gpt-5.4', 'gpt-5.4-mini', 'claude-sonnet-4-5', 'gemini-2.5-pro'], {'reasoning': True, 'contextWindow': 256000, 'maxTokens': 128000, 'input': ['text']}),
    'bedrock': ('openclaw-gateway', ['anthropic.claude-sonnet-4-5', 'anthropic.claude-haiku-4-5', 'amazon.nova-pro', 'amazon.nova-lite', 'meta.llama4-405b'], {'reasoning': True, 'contextWindow': 200000, 'maxTokens': 64000, 'input': ['text']}),
    'azure-openai': ('openclaw-gateway', ['gpt-5.4', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini'], {'reasoning': False, 'contextWindow': 128000, 'maxTokens': 16384, 'input': ['text']}),
}
MAX_PROVIDER_ATTEMPTS = int(os.environ.get('SAGE_ROUTER_MAX_PROVIDER_ATTEMPTS', '8'))
LATENCY_STATS_LOCK = threading.Lock()
OLLAMA_MODEL_CACHE = {}
MODEL_HEALTH_CACHE = {}
TEMP_MODEL_BLOCKS = {}
LAST_ROUTE_DEBUG = {
    'updated_at': None,
    'request_id': None,
    'intent': None,
    'complexity': None,
    'thinking': None,
    'routeMode': None,
    'requirements': {},
    'estimatedTokens': 0,
    'json': False,
    'chain': [],
    'scores': [],
    'rejections': [],
    'selected': None,
    'attempts': [],
    'streaming': None,
    'status': None,
    'error': None,
    'totalElapsedMs': None,
}
BACKGROUND_REFRESH_STARTED = False
def canonical_provider_env_key(name: str):
    return (name or '').strip().lower().replace('-', '_')


def load_ollama_manifest_bindings(kind: str):
    prefix = f'SAGE_ROUTER_OLLAMA_MANIFEST_{kind}__'
    bindings = {}
    for key, value in os.environ.items():
        if key.startswith(prefix) and value.strip():
            provider_name = canonical_provider_env_key(key[len(prefix):])
            if provider_name:
                bindings[provider_name] = value.strip()
    return bindings


OLLAMA_MANIFEST_URLS = load_ollama_manifest_bindings('URL')
OLLAMA_MANIFEST_FILES = load_ollama_manifest_bindings('FILE')

INTENT_API_SCORES = {
    'CODE': {'ollama': 60, 'openai-completions': 58, 'anthropic-messages': 48, 'google-generative-language': 44},
    'ANALYSIS': {'ollama': 66, 'anthropic-messages': 58, 'openai-completions': 54, 'google-generative-language': 52},
    'CREATIVE': {'anthropic-messages': 60, 'google-generative-language': 59, 'openai-completions': 55, 'ollama': 50},
    'REALTIME': {'google-generative-language': 60, 'openai-completions': 60, 'anthropic-messages': 54, 'ollama': 48},
    'GENERAL': {'anthropic-messages': 58, 'google-generative-language': 57, 'openai-completions': 56, 'ollama': 50},
}

INTENT_MODEL_HINTS = {
    'CODE': ['coder', 'opus', 'sonnet', 'codex', 'gpt-5', 'deepseek', 'qwen', 'kimi', 'glm', 'gptoss'],
    'ANALYSIS': ['opus', 'sonnet', 'gpt-5', 'o3', 'qwen', 'kimi', 'minimax', 'glm'],
    'CREATIVE': ['opus', 'sonnet', 'minimax', 'kimi', 'gpt-5', 'qwen'],
    'REALTIME': ['gpt-4o', 'gpt-5', 'sonnet', 'kimi', 'qwen', 'glm'],
    'GENERAL': ['sonnet', 'gpt-4o', 'gpt-5', 'kimi', 'minimax', 'qwen', 'glm', 'opus'],
}

COMPLEX_MODEL_HINTS = ['opus', 'sonnet', 'gpt-5', 'o3', 'glm', 'qwen', 'kimi', 'deepseek']
LIGHTWEIGHT_MODEL_HINTS = ['mini', 'small', 'haiku']
OLLAMA_FAMILY_HINTS = {
    'qwen': {'bonus': 9, 'intents': {'CODE', 'ANALYSIS', 'GENERAL'}},
    'kimi': {'bonus': 8, 'intents': {'CODE', 'GENERAL', 'CREATIVE', 'REALTIME'}},
    'kimi-k2': {'bonus': 9, 'intents': {'CODE', 'GENERAL', 'CREATIVE', 'REALTIME', 'ANALYSIS'}},
    'glm': {'bonus': 11, 'intents': {'CODE', 'ANALYSIS', 'GENERAL', 'REALTIME'}},
    'minimax': {'bonus': 6, 'intents': {'CREATIVE', 'GENERAL'}},
    'deepseek': {'bonus': 10, 'intents': {'CODE', 'ANALYSIS'}},
    'llama': {'bonus': 5, 'intents': {'GENERAL', 'CREATIVE'}},
    'gptoss': {'bonus': 7, 'intents': {'CODE', 'GENERAL', 'ANALYSIS'}},
    'qwen3moe': {'bonus': 8, 'intents': {'CODE', 'GENERAL'}},
    'qwen35moe': {'bonus': 9, 'intents': {'CODE', 'ANALYSIS', 'GENERAL'}},
}

# Known NON-chat families - dynamically extended from /api/tags.
# A family is non-chat if it matches these patterns or is explicitly listed.
NON_CHAT_FAMILY_PATTERNS = ['embed', 'bert', 'clip', 'vl', 'vision', 'ocr', 'asr', 'whisper', 'tts', 'sd', 'rerank']
NON_CHAT_MODEL_HINTS = [
    'embed', 'embedding', 'rerank', 'bge-', 'nomic-embed', 'whisper', 'tts', 'sdxl', 'stable-diffusion',
    '-vl', ':vl', 'vision', 'ocr', 'asr', 'transcribe'
]

# Ollama model families that are NOT text-chat capable.
# Seed list - dynamically extended by background_refresh_detect_families().
NON_CHAT_OLLAMA_FAMILIES = {
    'nomic-bert',   # embedding
    'glmocr',      # OCR vision
    'qwen3vl',     # vision-language
    'llava',       # vision-language
    'clip',        # image embedding
    'bakllava',    # vision-language
    'moondream',   # vision-language
    'minicpm-v',   # vision-language
    'llama-vision',# vision-language
}

class Intent(Enum):
    CODE = auto(); ANALYSIS = auto(); CREATIVE = auto(); REALTIME = auto(); GENERAL = auto()
class Complexity(Enum):
    SIMPLE = auto(); MEDIUM = auto(); COMPLEX = auto()
class ThinkingLevel(Enum):
    LOW = 'low'; MEDIUM = 'medium'; HIGH = 'high'

@dataclass
class Provider:
    name: str; api_type: str; base_url: str; api_key: str; models: List[str]; reasoning_models: set[str] | None = None; model_meta: dict[str, dict[str, Any]] | None = None


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
    merged_meta = dict(existing.model_meta or {})
    merged_meta.update(provider.model_meta or {})
    providers[provider.name] = Provider(
        provider.name,
        existing.api_type or provider.api_type,
        existing.base_url or provider.base_url,
        existing.api_key or provider.api_key,
        dedupe_keep_order((existing.models or []) + (provider.models or [])),
        set(existing.reasoning_models or set()) | set(provider.reasoning_models or set()),
        merged_meta,
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
        # Normalize google-generative-ai -> google-generative-language (OpenClaw schema enum)
        if api_type == 'google-generative-ai':
            return 'google-generative-language'
        return api_type
    host = (urllib.parse.urlparse(base_url or '').hostname or '').lower()
    if 'generativelanguage.googleapis.com' in host or name == 'google':
        return 'google-generative-language'
    if 'x.ai' in host or name == 'xai':
        return 'openai-completions'
    return 'openai-completions'


def discover_anthropic_models():
    """Discover available Anthropic models via the Dario proxy's /v1/models endpoint."""
    try:
        url = DARIO_LOCAL_BASE_URL.rstrip('/') + '/v1/models'
        hdrs = {'x-api-key': DARIO_LOCAL_API_KEY, 'anthropic-version': '2023-06-01'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read())
        models = [m.get('id', '') for m in payload.get('data', []) if m.get('id')]
        if models:
            logger.info(f'Discovered {len(models)} Anthropic models via Dario: {models}')
            return models
    except Exception as e:
        logger.debug(f'Dario model discovery failed: {extract_http_error(e)}')
    return None


def discover_google_models(base_url, api_key):
    if not base_url or not api_key:
        return []
    try:
        # Google API requires ?key= query param on /v1beta/models endpoint
        base = base_url.rstrip('/')
        if not base.endswith('/v1beta') and not base.endswith('/v1'):
            base += '/v1beta'
        url = f'{base}/models?key={api_key}'
        req = urllib.request.Request(url)
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
        if models:
            logger.info(f'Discovered {len(models)} Google models via API')
        return dedupe_keep_order(models)
    except Exception as e:
        logger.warning(f"Google model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_openai_models(base_url, api_key):
    """Discover available OpenAI models via /v1/models endpoint."""
    if not base_url or not api_key:
        return []
    try:
        url = base_url.rstrip('/') + '/v1/models'
        hdrs = {'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
        models = [m.get('id', '') for m in payload.get('data', []) if m.get('id')]
        # Filter to chat completion models only
        chat_models = [m for m in models if any(x in m.lower() for x in ['gpt', 'chat', 'o1', 'o3'])]
        if chat_models:
            logger.info(f'Discovered {len(chat_models)} OpenAI chat models via API')
        return dedupe_keep_order(chat_models)
    except Exception as e:
        logger.debug(f"OpenAI model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_github_copilot_models(base_url, api_key):
    """Discover available GitHub Copilot models via /v1/models endpoint."""
    if not base_url or not api_key:
        return []
    try:
        url = base_url.rstrip('/') + '/v1/models'
        hdrs = {'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
        models = [m.get('id', '') for m in payload.get('data', []) if m.get('id')]
        if models:
            logger.info(f'Discovered {len(models)} GitHub Copilot models via API')
        return dedupe_keep_order(models)
    except Exception as e:
        logger.debug(f"GitHub Copilot model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_openclaw_gateway_models(base_url, gateway_token=None):
    """Discover available OpenClaw Gateway models via /v1/models endpoint."""
    if not base_url:
        return []
    try:
        url = base_url.rstrip('/') + '/v1/models'
        req = urllib.request.Request(url)
        # Add auth if token available
        if gateway_token:
            req.add_header('Authorization', f'Bearer {gateway_token}')
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read())
        models = [m.get('id', '') for m in payload.get('data', []) if m.get('id')]
        if models:
            logger.info(f'Discovered {len(models)} OpenClaw Gateway models via API')
        return dedupe_keep_order(models)
    except Exception as e:
        logger.debug(f"OpenClaw Gateway model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_xai_models(base_url, api_key):
    """Discover available xAI Grok models via /v1/models endpoint (API-key mode)."""
    if not base_url or not api_key:
        return []
    try:
        url = base_url.rstrip('/') + '/v1/models'
        hdrs = {'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
        models = [m.get('id', '') for m in payload.get('data', []) if m.get('id')]
        if models:
            logger.info(f'Discovered {len(models)} xAI Grok models via API')
        return dedupe_keep_order(models)
    except Exception as e:
        logger.debug(f"xAI model discovery {base_url}: {extract_http_error(e)}")
        return []


def discover_hermes_core_providers():
    """Discover all providers from Hermes Agent core config (~/.hermes/config.yaml and auth.json)."""
    providers = {}
    try:
        config_path = os.path.expanduser("~/.hermes/config.yaml")
        auth_path = os.path.expanduser("~/.hermes/auth.json")
        
        # Read Hermes config
        if os.path.exists(config_path):
            import yaml
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            model_config = config.get('model', {})
            providers['hermes-active'] = {
                'default': model_config.get('default'),
                'provider': model_config.get('provider'),
                'baseUrl': model_config.get('base_url'),
                'source': 'hermes-config'
            }
        
        # Read Hermes auth providers
        if os.path.exists(auth_path):
            with open(auth_path, 'r') as f:
                auth = json.load(f)
            auth_providers = auth.get('providers', {})
            for provider_name, provider_data in auth_providers.items():
                providers[f'hermes-{provider_name}'] = {
                    'authMode': provider_data.get('auth_mode'),
                    'lastRefresh': provider_data.get('last_refresh'),
                    'hasIdToken': bool(provider_data.get('tokens', {}).get('id_token')),
                    'hasAccessToken': bool(provider_data.get('tokens', {}).get('access_token')),
                    'source': 'hermes-auth'
                }
        
        logger.info(f"Discovered {len(providers)} providers from Hermes core")
    except Exception as e:
        logger.debug(f"Hermes core provider discovery failed: {e}")
    return providers


def discover_openclaw_cli_providers(timeout_seconds=15):
    """Discover providers using 'openclaw models list --all' CLI with caching."""
    cache_key = 'openclaw_cli_providers'
    cache_ttl = 60  # Cache for 60 seconds
    
    # Check cache
    now = time.time()
    if hasattr(discover_openclaw_cli_providers, '_cache'):
        cached_data, cached_time = discover_openclaw_cli_providers._cache
        if now - cached_time < cache_ttl:
            return cached_data
    
    providers = {}
    try:
        result = subprocess.run(
            ['openclaw', 'models', 'list', '--all'],
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        if result.returncode == 0:
            # Parse the output - assume it's JSON or table format
            output = result.stdout.strip()
            if output.startswith('{'):
                # JSON output
                providers = json.loads(output)
            else:
                # Parse table/text output
                providers = {'raw': output[:5000]}  # Limit size
            logger.info(f"Discovered providers via openclaw CLI")
    except subprocess.TimeoutExpired:
        logger.warning("openclaw CLI timed out - using cached/config data")
    except Exception as e:
        logger.debug(f"openclaw CLI discovery failed: {e}")
    
    # Cache result even if empty (to avoid hammering)
    discover_openclaw_cli_providers._cache = (providers, now)
    return providers


def discover_hermes_cli_providers(timeout_seconds=10):
    """Discover providers using 'hermes' CLI with caching."""
    cache_key = 'hermes_cli_providers'
    cache_ttl = 60  # Cache for 60 seconds
    
    # Check cache
    now = time.time()
    if hasattr(discover_hermes_cli_providers, '_cache'):
        cached_data, cached_time = discover_hermes_cli_providers._cache
        if now - cached_time < cache_ttl:
            return cached_data
    
    providers = {}
    try:
        # Try hermes status --json if available
        result = subprocess.run(
            ['hermes', 'status', '--json'],
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        if result.returncode == 0 and result.stdout.strip():
            try:
                status = json.loads(result.stdout)
                providers['hermes-status'] = status
            except json.JSONDecodeError:
                providers['hermes-status'] = {'raw': result.stdout[:2000]}
        else:
            # Fallback: try hermes model --json
            result2 = subprocess.run(
                ['hermes', 'model', '--json'],
                capture_output=True,
                text=True,
                timeout=timeout_seconds
            )
            if result2.returncode == 0 and result2.stdout.strip():
                try:
                    model_info = json.loads(result2.stdout)
                    providers['hermes-model'] = model_info
                except json.JSONDecodeError:
                    providers['hermes-model'] = {'raw': result2.stdout[:2000]}
        logger.info(f"Discovered providers via Hermes CLI")
    except subprocess.TimeoutExpired:
        logger.warning("Hermes CLI timed out - using cached/config data")
    except Exception as e:
        logger.debug(f"Hermes CLI discovery failed: {e}")
    
    # Cache result even if empty
    discover_hermes_cli_providers._cache = (providers, now)
    return providers


def discover_openclaw_core_providers():
    """Discover all providers and models from OpenClaw core config (~/.openclaw/openclaw.json)."""
    providers = {}
    try:
        config_path = os.path.expanduser("~/.openclaw/openclaw.json")
        if not os.path.exists(config_path):
            return providers
        with open(config_path, 'r') as f:
            config = json.load(f)
        models_config = config.get('models', {})
        providers_config = models_config.get('providers', {})
        for provider_name, provider_cfg in providers_config.items():
            models = []
            raw_models = provider_cfg.get('models', [])
            if isinstance(raw_models, list):
                for m in raw_models:
                    if isinstance(m, dict) and m.get('id'):
                        models.append({
                            'id': m.get('id'),
                            'name': m.get('name', m.get('id')),
                            'reasoning': m.get('reasoning', False),
                            'contextWindow': m.get('contextWindow'),
                            'maxTokens': m.get('maxTokens'),
                            'input': m.get('input', ['text']),
                            'cost': m.get('cost', {})
                        })
            providers[provider_name] = {
                'baseUrl': provider_cfg.get('baseUrl'),
                'api': provider_cfg.get('api', 'openai-completions'),
                'models': models
            }
        logger.info(f"Discovered {len(providers)} providers from OpenClaw core config")
    except Exception as e:
        logger.debug(f"OpenClaw core provider discovery failed: {e}")
    return providers


def fetch_github_providers_manifest(repo_owner, repo_name, path_in_repo="providers.json", timeout_seconds=10):
    """Fetch provider manifest from GitHub repo source code."""
    try:
        url = f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/main/{path_in_repo}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.debug(f"GitHub fetch failed for {repo_owner}/{repo_name}: {e}")
        return None


def discover_openclaw_github_manifests():
    """Discover OpenClaw providers from GitHub source manifests."""
    manifests = {}
    
    # Try to fetch from OpenClaw GitHub repo
    manifest = fetch_github_providers_manifest("openclaw", "openclaw", "providers.json")
    if manifest:
        manifests['openclaw-github'] = manifest
    
    # Fallback: known OpenClaw provider patterns from source analysis
    manifests['openclaw-supported'] = {
        "source": "GitHub source analysis",
        "url": "https://github.com/openclaw/openclaw",
        "providers": [
            {"name": "anthropic", "api": "anthropic-messages", "models": ["claude-opus", "claude-sonnet", "claude-haiku"]},
            {"name": "openai", "api": "openai-completions", "models": ["gpt-5.4", "gpt-4o", "gpt-4o-mini"]},
            {"name": "google", "api": "google-generative-ai", "models": ["gemini-3-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-2.5-flash"]},
            {"name": "haimaker", "api": "openai-completions", "models": ["qwen3-coder", "llama-3.3-70b"]},
            {"name": "minimax", "api": "openai-completions", "models": ["minimax-m2.5", "minimax-m2.7"]},
            {"name": "moonshot", "api": "openai-completions", "models": ["kimi-k2", "kimi-k2.5", "kimi-k2.6"]},
            {"name": "ollama", "api": "ollama", "models": ["dynamic-local"]},
            {"name": "openrouter", "api": "openai-completions", "models": ["200+ models"]},
            {"name": "xiaomi", "api": "openai-completions", "models": ["mimo-v2-pro"]},
            {"name": "zai", "api": "openai-completions", "models": ["glm-5", "glm-5-turbo", "glm-5.1", "glm-5v-turbo"], "subscriptionPlans": {
                "lite": {"price": "$6/month", "quarterly": "$27/quarter"},
                "pro": {"price": "$30/month", "quarterly": "$81/quarter"},
                "max": {"price": "$72/month", "quarterly": "$216/quarter"}
            }, "apiPricing": {
                "glm-5": {"input": "$1.00/1M", "output": "$3.20/1M"},
                "glm-5-turbo": {"input": "$1.20/1M", "output": "$4.00/1M", "cacheRead": "$0.24/1M"}
            }},
            {"name": "alibaba-qwen", "api": "openai-completions", "models": ["qwen-max", "qwen-plus", "qwen-flash", "qwen-turbo", "qwen2.5-72b", "qwen2.5-coder", "qwen3-vl-flash"], "subscriptionPlans": {
                "codingLite": {"price": "$10/month", "requests": "18,000/month"},
                "codingPro": {"price": "$50/month", "requests": "90,000/month"},
                "freeTier": {"tokens": "1M", "valid": "90 days"}
            }, "apiPricing": {
                "qwen-max": {"input": "$1.60/1M", "output": "$6.40/1M"},
                "qwen-plus": {"input": "$0.40/1M", "output": "$1.20/1M"},
                "qwen-flash": {"input": "$0.022-0.173/1M", "output": "$0.216-1.721/1M"},
                "qwen-turbo": {"input": "$0.05/1M", "output": "$0.20-0.40/1M"}
            }},
            {"name": "bedrock", "api": "openai-completions", "models": ["claude", "nova", "llama"]},
            {"name": "deepseek", "api": "openai-completions", "models": ["deepseek-chat", "deepseek-reasoner"]},
            {"name": "github-copilot", "api": "openai-completions", "models": ["gpt-4o-copilot", "claude-sonnet-copilot"]},
            {"name": "groq", "api": "openai-completions", "models": ["llama", "mixtral"]},
            {"name": "together", "api": "openai-completions", "models": ["various open source"]},
            {"name": "fireworks", "api": "openai-completions", "models": ["various open source"]},
            {"name": "huggingface", "api": "openai-completions", "models": ["inference endpoints"]},
            {"name": "perplexity", "api": "openai-completions", "models": ["sonar"]},
            {"name": "mistral", "api": "openai-completions", "models": ["mistral-large", "mistral-medium"]},
            {"name": "nvidia", "api": "openai-completions", "models": ["nemotron"]},
        ],
        "notes": "OpenClaw supports any OpenAI-compatible endpoint. Dynamic model discovery via /v1/models where available."
    }
    
    return manifests


def discover_hermes_github_manifests():
    """Discover Hermes Agent providers from GitHub source manifests."""
    manifests = {}
    
    # Try to fetch from Hermes GitHub repo
    manifest = fetch_github_providers_manifest("NousResearch", "hermes-agent", "providers.json")
    if manifest:
        manifests['hermes-github'] = manifest
    
    # Fallback: known Hermes provider patterns from source analysis
    manifests['hermes-supported'] = {
        "source": "GitHub source analysis",
        "url": "https://github.com/NousResearch/hermes-agent",
        "providers": [
            {"name": "nous-portal", "api": "openai-completions"},
            {"name": "openrouter", "api": "openai-completions", "models": "200+"},
            {"name": "nvidia-nim", "api": "openai-completions", "models": ["nemotron"]},
            {"name": "xiaomi", "api": "openai-completions", "models": ["mimo-v2-pro"]},
            {"name": "zai", "api": "openai-completions", "models": ["glm-5"]},
            {"name": "kimi", "api": "openai-completions", "models": ["kimi-k2"]},
            {"name": "minimax", "api": "openai-completions", "models": ["minimax-m2"]},
            {"name": "huggingface", "api": "openai-completions"},
            {"name": "openai", "api": "openai-completions"},
            {"name": "anthropic", "api": "anthropic-messages"},
            {"name": "google", "api": "google-generative-ai"},
            {"name": "xai", "api": "openai-completions"},
            {"name": "openclaw-gateway", "api": "openclaw-gateway"},
        ],
        "notes": "Hermes supports any OpenAI-compatible endpoint. Uses hermes model command to switch."
    }
    
    return manifests


def discover_provider_models(name, cfg, base_url, api_key, api_type):
    raw_models = cfg.get('models', [])
    configured = [m.get('id') for m in raw_models if isinstance(m, dict) and m.get('id')] if isinstance(raw_models, list) else []
    # For providers with API discovery, merge configured + discovered
    discovered = []
    if api_type in ('google-generative-language', 'google-generative-ai'):
        discovered = discover_google_models(base_url, api_key)
    elif api_type == 'openai-completions':
        # Try OpenAI-style discovery for openai, github-copilot, xai, etc.
        if name == 'xai' or 'x.ai' in (base_url or '').lower():
            discovered = discover_xai_models(base_url, api_key)
        else:
            discovered = discover_openai_models(base_url, api_key)
    elif api_type == 'openclaw-gateway':
        # For OpenClaw Gateway, try to discover models
        discovered = discover_openclaw_gateway_models(base_url, api_key)
    if discovered:
        # Configured models first (stable), then any discovered models not already listed
        return dedupe_keep_order(configured + discovered)
    if configured:
        return dedupe_keep_order(configured)
    return []


def discover_reasoning_models(cfg):
    reasoning_models = set()
    raw_models = cfg.get('models', [])
    for model in raw_models if isinstance(raw_models, list) else []:
        model_id = model.get('id')
        if model_id and model.get('reasoning'):
            reasoning_models.add(model_id)
    return reasoning_models


def discover_model_meta(cfg):
    meta = {}
    raw_models = cfg.get('models', [])
    for model in raw_models if isinstance(raw_models, list) else []:
        model_id = model.get('id')
        if not model_id:
            continue
        entry = {
            'reasoning': bool(model.get('reasoning')),
            'contextWindow': model.get('contextWindow'),
            'maxTokens': model.get('maxTokens'),
            'input': model.get('input') or [],
        }
        for key in (
            'preferred', 'resident', 'family', 'families', 'servable', 'manifestReason',
            'supportsChat', 'supportsJson', 'supportsTools', 'supportsStreaming'
        ):
            if key in model:
                entry[key] = model.get(key)
        meta[model_id] = entry
    return meta


def grok_sso_proxy_health_url(base_url):
    parsed = urllib.parse.urlparse(base_url or '')
    if not parsed.scheme or not parsed.netloc:
        return ''
    path = parsed.path or ''
    if path.endswith('/v1'):
        path = path[:-3]
    elif path.endswith('/v1/'):
        path = path[:-4]
    path = path.rstrip('/')
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, (path or '') + '/health', '', '', ''))


def grok_sso_proxy_ready(base_url):
    health_url = grok_sso_proxy_health_url(base_url)
    if not health_url:
        return False, 'missing health URL'
    try:
        req = urllib.request.Request(health_url)
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            payload = json.load(resp)
        if payload.get('ready'):
            return True, None
        reason = payload.get('missingRequiredCookies') or payload.get('notes') or 'proxy not ready'
        return False, reason
    except Exception as e:
        return False, str(e)


def load_router_profile_overlays(existing_providers):
    providers = {}
    try:
        with open(PROVIDER_PROFILES_PATH) as f:
            profiles = json.load(f)
    except FileNotFoundError:
        return providers
    except Exception as e:
        logger.warning(f'Failed to load provider profile overlays: {e}')
        return providers

    requested = [item.strip() for item in os.environ.get('SAGE_ROUTER_PROFILE_OVERLAYS', 'grok-sso').split(',') if item.strip()]
    for name in requested:
        if name in existing_providers:
            continue
        cfg = profiles.get(name)
        if not isinstance(cfg, dict):
            continue
        base_url = resolve_config_value(cfg.get('baseUrl', '') or '')
        api_key = resolve_config_value(cfg.get('apiKey', '') or '')
        api_type = infer_api_type(name, cfg, base_url)
        models = discover_provider_models(name, cfg, base_url, api_key, api_type)
        if not models:
            continue
        if name == 'grok-sso' and not base_url:
            continue
        if name == 'grok-sso':
            ready, reason = grok_sso_proxy_ready(base_url)
            if not ready:
                logger.info(f'Skipped grok-sso overlay because local proxy is not ready: {reason}')
            continue
        reasoning_models = discover_reasoning_models(cfg)
        model_meta = discover_model_meta(cfg)
        providers[name] = Provider(name, api_type, base_url, api_key, models, reasoning_models, model_meta)
        logger.info(f'Loaded router profile overlay provider {name} ({api_type}) with {len(models)} models')
    return providers


def normalize_route_mode(raw):
    value = str(raw or 'balanced').strip().lower()
    return value if value in {'fast', 'balanced', 'best', 'local-first', 'realtime'} else 'balanced'


def normalize_requirements(payload):
    req = payload.get('requirements') if isinstance(payload, dict) else None
    if not isinstance(req, dict):
        req = {}
    return {
        'reasoning': bool(req.get('reasoning') or payload.get('requiresReasoning')),
        'json': bool(req.get('json') or payload.get('requiresJson')),
        'tools': bool(req.get('tools') or payload.get('requiresTools')),
        'longContext': bool(req.get('longContext') or payload.get('requiresLongContext')),
        'streaming': bool(req.get('streaming') or payload.get('requiresStreaming') or payload.get('stream')),
    }


def is_truthy(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on', 'debug', 'route'}


def normalize_debug_mode(payload):
    if not isinstance(payload, dict):
        return False
    debug = payload.get('debug')
    if isinstance(debug, dict):
        if is_truthy(debug.get('route')) or is_truthy(debug.get('routing')):
            return True
    return is_truthy(debug) or is_truthy(payload.get('routeDebug')) or is_truthy(payload.get('debugRoute'))


def estimate_prompt_tokens(messages):
    text = ' '.join((msg.get('content') or '') for msg in messages or [])
    return max(1, int(len(text) / 4))


def model_context_window(provider, model):
    meta = (provider.model_meta or {}).get(model, {})
    return int(meta.get('contextWindow') or 0)


def active_temp_model_block(provider_name, model):
    key = f'{provider_name}/{model}'
    blocked = TEMP_MODEL_BLOCKS.get(key)
    if not blocked:
        return None
    if float(blocked.get('until', 0) or 0) <= time.time():
        TEMP_MODEL_BLOCKS.pop(key, None)
        return None
    return blocked


def invalidate_model_health_cache(provider_name, model):
    suffix = f':{provider_name}/{model}'
    for key in list(MODEL_HEALTH_CACHE.keys()):
        if key.endswith(suffix):
            MODEL_HEALTH_CACHE.pop(key, None)



def set_temp_model_block(provider_name, model, seconds, reason):
    if seconds <= 0:
        return
    TEMP_MODEL_BLOCKS[f'{provider_name}/{model}'] = {
        'until': time.time() + seconds,
        'reason': reason,
    }
    invalidate_model_health_cache(provider_name, model)



def clear_temp_model_block(provider_name, model):
    TEMP_MODEL_BLOCKS.pop(f'{provider_name}/{model}', None)
    invalidate_model_health_cache(provider_name, model)



def model_is_servable(provider, model):
    if active_temp_model_block(provider.name, model):
        return False
    meta = (provider.model_meta or {}).get(model, {})
    return bool(meta.get('servable', True))


def is_chat_capable_model(provider, model):
    model_l = (model or '').lower()
    if provider.api_type == 'ollama':
        # 1) Static name-pattern check (fast, catches most cases)
        if any(hint in model_l for hint in NON_CHAT_MODEL_HINTS):
            return False
        # 2) Dynamic family check from discovered metadata
        meta = (provider.model_meta or {}).get(model, {})
        family = (meta.get('family') or '').lower()
        families = [f.lower() for f in (meta.get('families') or []) if f]
        all_families = set(families) | {family} - {''}
        if all_families & NON_CHAT_OLLAMA_FAMILIES:
            return False
    return True


def provider_supports_reasoning(provider, model):
    if provider.api_type == 'ollama':
        return False
    if provider.api_type == 'openclaw-gateway':
        return True
    if provider.api_type == 'anthropic-messages':
        return model.startswith('claude-') or model.startswith('claude')
    reasoning_models = provider.reasoning_models or set()
    return model in reasoning_models


def is_cloud_ollama_model(model: str):
    model_l = (model or '').strip().lower()
    return model_l.endswith(':cloud')


def sanitize_visible_output(text: str):
    raw = text or ''
    if not raw:
        return ''

    cleaned = _re.sub(r'<think>.*?</think>\s*', '', raw, flags=_re.IGNORECASE | _re.DOTALL)
    if cleaned == raw and '</think>' in raw.lower():
        cleaned = _re.split(r'</think>', raw, flags=_re.IGNORECASE)[-1]
    cleaned = _re.sub(r'</?think>', '', cleaned, flags=_re.IGNORECASE)
    cleaned = cleaned.strip()
    return cleaned or raw.strip()


def normalize_tool_calls(tool_calls):
    normalized = []
    logger.debug(f"normalize_tool_calls input: {tool_calls}")
    for idx, tool_call in enumerate(tool_calls or []):
        if not isinstance(tool_call, dict):
            logger.debug(f"Skipping non-dict tool_call: {tool_call}")
            continue
        function = tool_call.get('function') if isinstance(tool_call.get('function'), dict) else {}
        name = function.get('name') or tool_call.get('name') or f'tool_{idx + 1}'
        arguments = function.get('arguments') if 'arguments' in function else tool_call.get('arguments', {})
        # Ollama expects arguments as an object, not a JSON string
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except Exception as e:
                logger.debug(f"Failed to parse arguments JSON: {e}")
                arguments = {}
        normalized.append({
            'id': tool_call.get('id') or f'call_{uuid.uuid4().hex[:24]}',
            'type': 'function',
            'function': {
                'name': name,
                'arguments': arguments if isinstance(arguments, dict) else {},
            },
        })
        logger.debug(f"Normalized tool call: name={name}, arguments={arguments}")
    logger.debug(f"normalize_tool_calls output: {normalized}")
    return normalized


def build_router_metadata(provider_name, model, request_id=''):
    return {
        'provider': provider_name,
        'model': model,
        'request_id': request_id,
    }


def maybe_prefix_debug_text(content, metadata, debug_mode=False, allow_prefix=True):
    text = sanitize_visible_output(content or '')
    if debug_mode and allow_prefix and text:
        text = f"[sage-router {metadata.get('provider')}/{metadata.get('model')}]\n{text}"
    return text


def build_openai_completion(provider_name, model, request_id, content='', tool_calls=None, finish_reason=None, usage=None, debug_mode=False, allow_debug_prefix=True):
    metadata = build_router_metadata(provider_name, model, request_id)
    normalized_tool_calls = normalize_tool_calls(tool_calls)
    content_text = maybe_prefix_debug_text(content, metadata, debug_mode=debug_mode, allow_prefix=allow_debug_prefix and not normalized_tool_calls)
    message = {'role': 'assistant', 'content': content_text}
    if normalized_tool_calls:
        message['tool_calls'] = normalized_tool_calls
    resolved_finish_reason = finish_reason or ('tool_calls' if normalized_tool_calls else 'stop')
    response = {
        'id': f'chatcmpl-{int(time.time())}',
        'object': 'chat.completion',
        'created': int(time.time()),
        'model': f'{provider_name}/{model}',
        'choices': [{
            'index': 0,
            'message': message,
            'finish_reason': resolved_finish_reason,
        }],
        'usage': usage or {'prompt_tokens': 0, 'completion_tokens': 0},
    }
    if debug_mode:
        response['sage_router'] = metadata
    return response


def build_openai_proxy_payload(payload, model, stream=False, supports_reasoning=False, thinking=ThinkingLevel.MEDIUM):
    allowed_keys = [
        'messages', 'tools', 'tool_choice', 'parallel_tool_calls', 'response_format',
        'temperature', 'top_p', 'frequency_penalty', 'presence_penalty',
        'stop', 'n', 'user', 'seed', 'stream_options', 'max_tokens',
        'max_completion_tokens', 'modalities', 'audio', 'metadata'
    ]
    proxied = {'model': model, 'stream': bool(stream)}
    for key in allowed_keys:
        if key in payload:
            proxied[key] = payload.get(key)
    if supports_reasoning:
        proxied['reasoning'] = payload.get('reasoning') or {'effort': thinking.value}
    return proxied


def openai_messages_to_ollama(messages):
    converted = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        item = {
            'role': msg.get('role', 'user'),
            'content': normalize_content(msg.get('content', '')),
        }
        tool_calls = normalize_tool_calls(msg.get('tool_calls'))
        if tool_calls:
            item['tool_calls'] = tool_calls
        if msg.get('tool_call_id'):
            item['tool_call_id'] = msg.get('tool_call_id')
        converted.append(item)
    return converted


def build_ollama_payload(model, payload, thinking=ThinkingLevel.MEDIUM, stream=False):
    ollama_payload = {
        'model': model,
        'messages': openai_messages_to_ollama(payload.get('messages', [])),
        'stream': bool(stream),
    }
    if payload.get('tools'):
        ollama_payload['tools'] = payload.get('tools')
    if thinking == ThinkingLevel.LOW:
        ollama_payload['options'] = {'num_predict': 1024}
    elif thinking == ThinkingLevel.HIGH:
        ollama_payload['options'] = {'num_predict': 4096}
    return ollama_payload


def openai_tools_to_anthropic(tools):
    converted = []
    for tool in tools or []:
        if not isinstance(tool, dict) or tool.get('type') != 'function':
            continue
        fn = tool.get('function') or {}
        converted.append({
            'name': fn.get('name'),
            'description': fn.get('description', ''),
            'input_schema': fn.get('parameters') or {'type': 'object', 'properties': {}},
        })
    return [tool for tool in converted if tool.get('name')]


def openai_messages_to_anthropic(messages):
    system_text = []
    converted = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        role = msg.get('role', 'user')
        content = normalize_content(msg.get('content', ''))
        if role == 'system':
            if content:
                system_text.append(content)
            continue
        if role == 'tool':
            block = {'type': 'tool_result', 'tool_use_id': msg.get('tool_call_id') or f'toolu_{uuid.uuid4().hex[:16]}', 'content': content}
            converted.append({'role': 'user', 'content': [block]})
            continue
        blocks = []
        if content:
            blocks.append({'type': 'text', 'text': content})
        for tool_call in normalize_tool_calls(msg.get('tool_calls')):
            try:
                tool_input = json.loads(tool_call['function']['arguments']) if tool_call['function']['arguments'] else {}
            except Exception:
                tool_input = {'raw_arguments': tool_call['function']['arguments']}
            blocks.append({'type': 'tool_use', 'id': tool_call['id'], 'name': tool_call['function']['name'], 'input': tool_input})
        converted.append({'role': 'assistant' if role == 'assistant' else 'user', 'content': blocks or [{'type': 'text', 'text': ''}]})
    return '\n'.join(system_text).strip(), converted or [{'role': 'user', 'content': [{'type': 'text', 'text': 'Hello'}]}]


def parse_anthropic_response(body):
    content_blocks = body.get('content', []) or []
    text_parts = []
    tool_calls = []
    for block in content_blocks:
        if not isinstance(block, dict):
            continue
        if block.get('type') == 'text':
            text_parts.append(block.get('text', ''))
        elif block.get('type') == 'tool_use':
            tool_calls.append({
                'id': block.get('id') or f'call_{uuid.uuid4().hex[:24]}',
                'type': 'function',
                'function': {
                    'name': block.get('name') or 'tool',
                    'arguments': json.dumps(block.get('input') or {}, separators=(',', ':')),
                },
            })
    return sanitize_visible_output(''.join(text_parts)), normalize_tool_calls(tool_calls), body.get('stop_reason'), {
        'prompt_tokens': ((body.get('usage') or {}).get('input_tokens') or 0),
        'completion_tokens': ((body.get('usage') or {}).get('output_tokens') or 0),
    }


def model_capabilities(provider, model):
    meta = (provider.model_meta or {}).get(model, {})
    default_chat = is_chat_capable_model(provider, model)
    default_json = provider.api_type in {'openai-completions', 'openclaw-gateway', 'anthropic-messages', 'google-generative-language'}
    default_tools = provider.api_type in {'openai-completions', 'ollama', 'anthropic-messages'}
    default_streaming = provider.api_type in {'openai-completions', 'ollama', 'google-generative-language'}
    return {
        'chat': bool(meta.get('supportsChat', default_chat)),
        'servable': model_is_servable(provider, model),
        'preferred': bool(meta.get('preferred', False)),
        'resident': bool(meta.get('resident', False)),
        'reasoning': provider_supports_reasoning(provider, model),
        'json': bool(meta.get('supportsJson', default_json)),
        'tools': bool(meta.get('supportsTools', default_tools)),
        'streaming': bool(meta.get('supportsStreaming', default_streaming)),
        'longContext': model_context_window(provider, model),
        'manifestReason': meta.get('manifestReason'),
    }


def model_meets_requirements(provider, model, requirements, estimated_tokens):
    caps = model_capabilities(provider, model)
    if not caps['servable']:
        return False, 'not servable on host'
    if requirements.get('reasoning') and not caps['reasoning']:
        return False, 'requires reasoning'
    if requirements.get('longContext'):
        ctx = caps['longContext']
        if ctx and ctx < max(64000, estimated_tokens * 2):
            return False, f'context window too small ({ctx})'
    if requirements.get('json') and not caps['json']:
        return False, 'json unsupported'
    if requirements.get('tools') and not caps['tools']:
        return False, 'tools unsupported'
    if requirements.get('streaming') and not caps['streaming']:
        return False, 'streaming unsupported'
    return True, None

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
            reasoning_models = discover_reasoning_models(cfg)
            model_meta = discover_model_meta(cfg)

            if should_route_anthropic_to_dario(name, api_type, base_url):
                ensure_dario_proxy_ready()
                merge_provider(providers, Provider(
                    DARIO_PROVIDER_NAME,
                    'anthropic-messages',
                    DARIO_LOCAL_BASE_URL,
                    DARIO_LOCAL_API_KEY,
                    dedupe_keep_order(models or DEFAULT_ANTHROPIC_MODELS),
                    set(models or DEFAULT_ANTHROPIC_MODELS),
                    {m: {'reasoning': True, 'contextWindow': 1000000, 'maxTokens': 64000, 'input': ['text']} for m in dedupe_keep_order(models or DEFAULT_ANTHROPIC_MODELS)},
                ))
                logger.info(f'Normalized provider {name} -> {DARIO_PROVIDER_NAME} via local Dario proxy')
                continue

            merge_provider(providers, Provider(
                name,
                api_type,
                base_url,
                api_key,
                models,
                reasoning_models,
                model_meta,
            ))

        auth_profiles = config.get('auth', {}).get('profiles', {})
        agent_defaults = config.get('agents', {}).get('defaults', {})        
        # Auto-discover gateway-backed providers from auth profiles
        # For each auth profile that matches a known gateway provider, create a provider
        for profile_name, profile in auth_profiles.items():
            if not isinstance(profile, dict):
                continue
            provider_name = profile.get('provider', profile_name.split(':')[0])
            # Skip if already configured as a regular provider (e.g. ollama, anthropic via Dario)
            if provider_name in providers and provider_name not in GATEWAY_PROVIDER_PROFILES:
                continue
            # Skip ollama - it's always direct, not gateway-backed
            if provider_name == 'ollama':
                continue
            gw_spec = GATEWAY_PROVIDER_PROFILES.get(provider_name)
            if not gw_spec:
                continue
            api_type, default_models, default_meta = gw_spec
            # Don't add if already exists (e.g. anthropic already routed via Dario)
            if provider_name in providers:
                continue
            # Determine models and base URL based on provider type
            gw_models = list(default_models)
            if api_type == 'anthropic-messages':
                # Anthropic - route via Dario
                ensure_dario_proxy_ready()
                gw_models = discover_anthropic_models() or default_models
                merge_provider(providers, Provider(
                    provider_name,
                    'anthropic-messages',
                    DARIO_LOCAL_BASE_URL,
                    DARIO_LOCAL_API_KEY,
                    dedupe_keep_order(gw_models),
                    set(gw_models),
                    {m: dict(default_meta) for m in gw_models},
                ))
                logger.info(f'Auto-created gateway provider {provider_name} (anthropic-messages) with {len(gw_models)} models via Dario')
            elif api_type == 'google-generative-language':
                # Google - direct API if key available, otherwise gateway
                api_key = resolve_config_value(config.get('auth', {}).get('profiles', {}).get(f'{provider_name}:default', {}).get('apiKey', ''))
                if not api_key:
                    # Use gateway as fallback
                    merge_provider(providers, Provider(
                        provider_name,
                        'openclaw-gateway',
                        OPENCLAW_GATEWAY_BASE_URL,
                        '',
                        dedupe_keep_order(gw_models),
                        set(gw_models),
                        {m: dict(default_meta) for m in gw_models},
                    ))
                    logger.info(f'Auto-created gateway provider {provider_name} (google via gateway) with {len(gw_models)} models')
                # If key exists, it would have been loaded as a regular provider
            else:
                # Other providers (xai, zai, openai) - route via gateway
                merge_provider(providers, Provider(
                    provider_name,
                    'openclaw-gateway',
                    OPENCLAW_GATEWAY_BASE_URL,
                    '',
                    dedupe_keep_order(gw_models),
                    set(gw_models),
                    {m: dict(default_meta) for m in gw_models},
                ))
                logger.info(f'Auto-created gateway provider {provider_name} ({api_type}) with {len(gw_models)} models via gateway')

        for name, provider in load_router_profile_overlays(providers).items():
            merge_provider(providers, provider)

        logger.info(f"Loaded {len(providers)} configured providers: {list(providers.keys())}")
    except Exception as e:
        logger.error(f"Config load failed: {e}")
        providers['ollama'] = Provider('ollama', 'ollama', 'http://127.0.0.1:11434', '', ['qwen3.5:cloud', 'kimi-k2.5:cloud'], set(), {'qwen3.5:cloud': {'reasoning': False, 'contextWindow': 256000, 'maxTokens': 128000, 'input': ['text']}, 'kimi-k2.5:cloud': {'reasoning': False, 'contextWindow': 256000, 'maxTokens': 128000, 'input': ['text']}})
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


def get_health_stat(intent_name, provider_name, model):
    return get_latency_stat(intent_name, provider_name, model) or get_latency_stat('GENERAL', provider_name, model) or {}


def record_latency_outcome(intent_name, provider_name, model, elapsed_seconds, ok, error_text=''):
    elapsed_ms = max(1.0, float(elapsed_seconds) * 1000.0)
    now = int(time.time())
    error_meta = parse_error_meta(error_text)
    with LATENCY_STATS_LOCK:
        intents = LATENCY_STATS.setdefault('intents', {})
        intent_stats = intents.setdefault(intent_name, {})
        provider_stats = intent_stats.setdefault(provider_name, {})
        stat = provider_stats.setdefault(model, {
            'successes': 0,
            'failures': 0,
            'consecutive_failures': 0,
            'rate_limit_hits': 0,
            'timeout_hits': 0,
            'empty_output_hits': 0,
            'cooldown_until': 0,
            'latency_ewma_ms': elapsed_ms,
            'last_latency_ms': elapsed_ms,
            'updated_at': now,
        })

        stat['last_latency_ms'] = elapsed_ms
        stat['updated_at'] = now
        if ok:
            stat['successes'] = int(stat.get('successes', 0)) + 1
            stat['consecutive_failures'] = 0
            stat['cooldown_until'] = 0
            stat['timeout_hits'] = 0
            stat['empty_output_hits'] = 0
            stat['last_success_at'] = now
            previous = float(stat.get('latency_ewma_ms', elapsed_ms) or elapsed_ms)
            stat['latency_ewma_ms'] = round((LATENCY_EWMA_ALPHA * elapsed_ms) + ((1.0 - LATENCY_EWMA_ALPHA) * previous), 2)
            clear_temp_model_block(provider_name, model)
        else:
            stat['failures'] = int(stat.get('failures', 0)) + 1
            stat['consecutive_failures'] = int(stat.get('consecutive_failures', 0)) + 1
            cooldown_until = float(stat.get('cooldown_until', 0) or 0)
            if error_meta['rate_limited']:
                stat['rate_limit_hits'] = int(stat.get('rate_limit_hits', 0)) + 1
                cooldown_until = max(cooldown_until, now + min(1800, RATE_LIMIT_COOLDOWN_BASE_SECONDS * (2 ** max(0, stat['rate_limit_hits'] - 1))))
            if error_meta['timeout']:
                stat['timeout_hits'] = int(stat.get('timeout_hits', 0)) + 1
                if stat['consecutive_failures'] >= CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD:
                    timeout_backoff = min(1800, FAILURE_COOLDOWN_BASE_SECONDS * (2 ** max(0, stat['timeout_hits'] - 1)))
                    cooldown_until = max(cooldown_until, now + timeout_backoff)
                    set_temp_model_block(provider_name, model, timeout_backoff, 'timeout')
            if error_meta['empty_output']:
                stat['empty_output_hits'] = int(stat.get('empty_output_hits', 0)) + 1
                empty_backoff = min(1800, EMPTY_OUTPUT_COOLDOWN_SECONDS * max(1, stat['empty_output_hits']))
                cooldown_until = max(cooldown_until, now + empty_backoff)
                set_temp_model_block(provider_name, model, empty_backoff, 'empty_output')
            if error_meta['model_missing']:
                cooldown_until = max(cooldown_until, now + MODEL_MISSING_COOLDOWN_SECONDS)
                set_temp_model_block(provider_name, model, MODEL_MISSING_COOLDOWN_SECONDS, 'model_missing')
            if stat['consecutive_failures'] >= CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD and cooldown_until <= now:
                generic_backoff = min(1800, FAILURE_COOLDOWN_BASE_SECONDS * max(1, stat['consecutive_failures'] - CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD + 1))
                cooldown_until = now + generic_backoff
                set_temp_model_block(provider_name, model, generic_backoff, 'repeated_failures')
            stat['cooldown_until'] = cooldown_until

        save_latency_stats()
        invalidate_model_health_cache(provider_name, model)


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



def route_latency_target_ms(route_mode: str, complexity: Complexity, thinking: ThinkingLevel):
    base = {
        'fast': 9000,
        'balanced': 14000,
        'best': 24000,
        'local-first': 11000,
        'realtime': 5000,
    }.get(route_mode, 14000)
    if complexity == Complexity.SIMPLE:
        base -= 2000
    elif complexity == Complexity.COMPLEX:
        base += 6000
    if thinking == ThinkingLevel.HIGH:
        base += 4000
    elif thinking == ThinkingLevel.LOW:
        base -= 1500
    return max(6000, min(45000, base))



def empirical_route_adjustment(provider, model, intent_name: str, route_mode: str, complexity: Complexity, thinking: ThinkingLevel):
    stat = get_health_stat(intent_name, provider.name, model)
    provider_stats = get_intent_provider_stats(intent_name, provider.name) or get_intent_provider_stats('GENERAL', provider.name)
    successes = int(stat.get('successes', 0))
    failures = int(stat.get('failures', 0))
    samples = successes + failures

    if samples <= 0:
        if route_mode == 'best':
            return 0.0, 'cold:best-mode'
        if provider.api_type == 'ollama':
            penalty = 6.0 if route_mode == 'balanced' else 4.0
        elif provider.api_type == 'google-generative-language':
            penalty = 10.0 if route_mode == 'balanced' else 12.0
        else:
            penalty = 18.0 if route_mode == 'balanced' else 22.0
        if provider_stats:
            penalty -= 2.0
        return -penalty, f'cold:penalty={penalty:.1f}'

    if successes <= 0:
        penalty = min(30.0, 12.0 + (failures * 3.5))
        if provider.api_type != 'ollama' and route_mode != 'best':
            penalty += 4.0
        if route_mode == 'best':
            penalty *= 0.7
        return -penalty, f'no-success:failures={failures}'

    target_ms = route_latency_target_ms(route_mode, complexity, thinking)
    ewma_ms = float(stat.get('latency_ewma_ms', target_ms) or target_ms)
    delta_seconds = (target_ms - ewma_ms) / 1000.0
    if delta_seconds >= 0:
        latency_adjustment = min(14.0, delta_seconds * 0.9)
    else:
        multiplier = 1.6 if route_mode in {'fast', 'local-first', 'realtime'} else 1.15 if route_mode == 'balanced' else 0.65
        latency_adjustment = -min(30.0, abs(delta_seconds) * multiplier)

    confidence_bonus = min(8.0, math.log2(successes + 1) * 2.0)
    failure_penalty = min(12.0, failures * 0.45)
    total = latency_adjustment + confidence_bonus - failure_penalty
    return total, f'ewma_ms={ewma_ms:.0f},target_ms={target_ms},succ={successes},fail={failures}'



def ollama_family_bonus(model: str, intent: Intent):
    model_l = (model or '').lower()
    best = 0
    for family, meta in OLLAMA_FAMILY_HINTS.items():
        if family in model_l and intent.name in meta['intents']:
            best = max(best, int(meta['bonus']))
    return best


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


def fetch_ollama_manifest(provider: Provider):
    manifest_file = OLLAMA_MANIFEST_FILES.get(canonical_provider_env_key(provider.name), '')
    if manifest_file:
        try:
            with open(os.path.expanduser(manifest_file)) as f:
                payload = json.load(f)
            if isinstance(payload, dict) and isinstance(payload.get('models'), list):
                return payload, 'file'
        except Exception as e:
            logger.warning(f"Ollama manifest file {provider.name}: {e}")

    manifest_url = OLLAMA_MANIFEST_URLS.get(canonical_provider_env_key(provider.name), '')
    if manifest_url:
        try:
            req = urllib.request.Request(manifest_url, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
                payload = json.loads(resp.read())
            if isinstance(payload, dict) and isinstance(payload.get('models'), list):
                return payload, 'url'
        except Exception as e:
            logger.warning(f"Ollama manifest fetch {provider.name}: {extract_http_error(e)}")
    return None, None


def apply_ollama_manifest(provider: Provider, manifest):
    models = []
    meta = dict(provider.model_meta or {})
    servable_only = []
    for entry in manifest.get('models', []) or []:
        if not isinstance(entry, dict):
            continue
        model_id = entry.get('id') or entry.get('model')
        if not model_id:
            continue
        servable = bool(entry.get('servable', True))
        models.append(model_id)
        meta[model_id] = {
            'reasoning': bool(entry.get('reasoning', False)),
            'contextWindow': entry.get('contextWindow'),
            'maxTokens': entry.get('maxTokens'),
            'input': entry.get('input') or ['text'],
            'servable': servable,
            'preferred': bool(entry.get('preferred', False)),
            'resident': bool(entry.get('resident', False)),
            'manifestReason': entry.get('reason'),
        }
        if servable:
            servable_only.append(model_id)
    provider.model_meta = meta
    provider.models = dedupe_keep_order(servable_only or models or provider.models or [])
    return provider.models


def fetch_ollama_models(provider: Provider):
    now = time.time()
    cached = OLLAMA_MODEL_CACHE.get(provider.name)
    if cached and now - cached['checked_at'] < OLLAMA_MODEL_REFRESH_TTL_SECONDS:
        return cached['models']

    manifest, manifest_source = fetch_ollama_manifest(provider)
    if manifest:
        models = apply_ollama_manifest(provider, manifest)
        OLLAMA_MODEL_CACHE[provider.name] = {'checked_at': now, 'models': models, 'source': f'manifest:{manifest_source}'}
        return models

    models = []
    try:
        url = provider.base_url.rstrip('/') + '/api/tags'
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})
        if provider.api_key:
            req.add_header('Authorization', f'Bearer {provider.api_key}')
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
        for model in payload.get('models', []) or []:
            model_name = model.get('name') or model.get('model')
            if model_name:
                models.append(model_name)
                meta = dict(provider.model_meta or {})
                details = model.get('details', {}) if isinstance(model.get('details'), dict) else {}
                meta.setdefault(model_name, {
                    'reasoning': False,
                    'contextWindow': details.get('context_length'),
                    'maxTokens': None,
                    'input': ['text'],
                    'servable': True,
                    'preferred': False,
                    'resident': False,
                    'manifestReason': None,
                    'family': details.get('family', ''),
                    'families': details.get('families') or [],
                })
                provider.model_meta = meta
    except Exception as e:
        logger.warning(f"Ollama model discovery {provider.name}: {extract_http_error(e)}")
    models = dedupe_keep_order(models)
    OLLAMA_MODEL_CACHE[provider.name] = {'checked_at': now, 'models': models, 'source': 'tags'}
    if models:
        provider.models = dedupe_keep_order((provider.models or []) + models)
    return models


def parse_error_meta(error_text: str):
    raw = (error_text or '').lower()
    return {
        'rate_limited': 'http 429' in raw or 'rate limit' in raw or 'too many requests' in raw,
        'timeout': 'timed out' in raw or 'timeout' in raw,
        'model_missing': ('model' in raw and 'not found' in raw) or 'no such model' in raw,
        'empty_output': 'empty content' in raw or 'thinking-only output' in raw or 'empty visible content' in raw,
    }


def model_health_snapshot(provider: Provider, model: str, intent_name: str = 'GENERAL'):
    now = time.time()
    cache_key = f'{intent_name}:{provider.name}/{model}'
    cached = MODEL_HEALTH_CACHE.get(cache_key)
    if cached and now - cached['checked_at'] < HEALTH_SCORE_TTL_SECONDS:
        return cached
    stat = get_health_stat(intent_name, provider.name, model)
    successes = int(stat.get('successes', 0))
    failures = int(stat.get('failures', 0))
    consecutive_failures = int(stat.get('consecutive_failures', 0))
    rate_limit_hits = int(stat.get('rate_limit_hits', 0))
    timeout_hits = int(stat.get('timeout_hits', 0))
    empty_output_hits = int(stat.get('empty_output_hits', 0))
    cooldown_until = float(stat.get('cooldown_until', 0) or 0)
    last_success_at = stat.get('last_success_at')
    reachable = provider_endpoint_reachable(provider)
    temp_block = active_temp_model_block(provider.name, model)
    models_present = True
    if provider.api_type == 'ollama':
        live_models = fetch_ollama_models(provider)
        models_present = (model in live_models) if live_models else (model in (provider.models or []))
    if temp_block:
        models_present = False
        cooldown_until = max(cooldown_until, float(temp_block.get('until', 0) or 0))
    latency_ewma_ms = float(stat.get('latency_ewma_ms', GENERAL_EMPIRICAL_LATENCY_PIVOT_MS) or GENERAL_EMPIRICAL_LATENCY_PIVOT_MS)
    score = 100.0
    if not reachable:
        score -= 60
    if not models_present:
        score -= 45
    score -= min(35, consecutive_failures * 8)
    score -= min(30, failures * 2)
    score -= min(30, rate_limit_hits * 10)
    score -= min(20, timeout_hits * 6)
    score -= min(15, empty_output_hits * 5)
    score += max(-20, min(20, (GENERAL_EMPIRICAL_LATENCY_PIVOT_MS - latency_ewma_ms) / 200.0))
    if cooldown_until > now:
        score -= 50
    if provider.api_type == 'ollama':
        score += 8
    meta = (provider.model_meta or {}).get(model, {})
    if meta.get('preferred'):
        score += 8
    if meta.get('resident'):
        score += 6
    health = {
        'checked_at': now,
        'reachable': reachable,
        'models_present': models_present,
        'temporarily_blocked': bool(temp_block),
        'temporary_block_reason': (temp_block or {}).get('reason'),
        'latency_ewma_ms': latency_ewma_ms,
        'successes': successes,
        'failures': failures,
        'consecutive_failures': consecutive_failures,
        'rate_limit_hits': rate_limit_hits,
        'timeout_hits': timeout_hits,
        'empty_output_hits': empty_output_hits,
        'cooldown_until': cooldown_until,
        'last_success_at': last_success_at,
        'score': round(score, 2),
    }
    MODEL_HEALTH_CACHE[cache_key] = health
    return health


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


# Patterns of models to auto-pull when discovered on any Ollama instance.
# Set via env: SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS=comma,separated,patterns
OLLAMA_AUTO_PULL_PATTERNS = [
    p.strip() for p in os.environ.get('SAGE_ROUTER_OLLAMA_AUTO_PULL_PATTERNS', ':cloud').split(',')
    if p.strip()
]
# How often to check for new models to pull (seconds)
OLLAMA_AUTO_PULL_INTERVAL_SECONDS = int(os.environ.get('SAGE_ROUTER_OLLAMA_AUTO_PULL_INTERVAL_SECONDS', '3600'))


def ollama_auto_pull_new_models():
    """Check all Ollama providers for models matching auto-pull patterns that
    aren't yet available locally. Pull them in the background.
    Only runs every OLLAMA_AUTO_PULL_INTERVAL_SECONDS to avoid excessive pulls."""
    now = time.time()
    last_pull_check_key = '_last_auto_pull_check'
    if now - OLLAMA_MODEL_CACHE.get(last_pull_check_key, 0) < OLLAMA_AUTO_PULL_INTERVAL_SECONDS:
        return
    OLLAMA_MODEL_CACHE[last_pull_check_key] = now

    if not OLLAMA_AUTO_PULL_PATTERNS:
        return

    for provider in PROVIDERS.values():
        if provider.api_type != 'ollama':
            continue
        # Get manifest models (cloud-only models that may not be in /api/tags yet)
        manifest, _ = fetch_ollama_manifest(provider)
        manifest_models = []
        if manifest:
            manifest_models = [m.get('name', '') for m in manifest.get('models', []) if m.get('name')]

        # Combine discovered + manifest models
        all_known = set(dedupe_keep_order((provider.models or []) + manifest_models))

        # Check which patterns have no matching model
        for pattern in OLLAMA_AUTO_PULL_PATTERNS:
            matching = [m for m in all_known if pattern in m]
            if not matching:
                # Pattern has no match yet - nothing to pull
                continue
            # Check if models matching pattern are actually available (not just known)
            available = set(fetch_ollama_models(provider))
            for model in matching:
                if model not in available:
                    logger.info(f'Auto-pulling new model: {model} (pattern: {pattern}, provider: {provider.name})')
                    try:
                        pull_url = provider.base_url.rstrip('/') + '/api/pull'
                        data = json.dumps({'name': model, 'stream': False}).encode()
                        req = urllib.request.Request(pull_url, data=data, headers={'Content-Type': 'application/json'})
                        if provider.api_key:
                            req.add_header('Authorization', f'Bearer {provider.api_key}')
                        with urllib.request.urlopen(req, timeout=600) as resp:
                            result = json.loads(resp.read())
                        logger.info(f'Auto-pull complete: {model} -> {result.get("status", "ok")}')
                        # Refresh model list after pull
                        OLLAMA_MODEL_CACHE.pop(provider.name, None)
                        fetch_ollama_models(provider)
                    except Exception as e:
                        logger.warning(f'Auto-pull failed for {model}: {extract_http_error(e)}')


def background_refresh_detect_families():
    """Scan all Ollama providers' /api/tags for new model families.
    - Auto-register chat families into OLLAMA_FAMILY_HINTS with a default bonus.
    - Auto-register non-chat families into NON_CHAT_OLLAMA_FAMILIES.
    - Log newly discovered families for visibility.
    """
    new_chat = []
    new_nonchat = []
    for provider in PROVIDERS.values():
        if provider.api_type != 'ollama':
            continue
        meta = provider.model_meta or {}
        for model_name, info in meta.items():
            family = (info.get('family') or '').strip().lower()
            families = info.get('families') or []
            all_families = set()
            if family:
                all_families.add(family)
            for f in (families if isinstance(families, list) else []):
                if f and isinstance(f, str):
                    all_families.add(f.strip().lower())
            for fam in all_families:
                # Check if non-chat
                is_nonchat = any(pat in fam for pat in NON_CHAT_FAMILY_PATTERNS) or fam in NON_CHAT_OLLAMA_FAMILIES
                if is_nonchat:
                    if fam not in NON_CHAT_OLLAMA_FAMILIES:
                        NON_CHAT_OLLAMA_FAMILIES.add(fam)
                        new_nonchat.append(fam)
                else:
                    # Check if chat family is known
                    known = False
                    for hint_key in OLLAMA_FAMILY_HINTS:
                        if fam.startswith(hint_key) or hint_key.startswith(fam):
                            known = True
                            break
                    if not known and fam not in OLLAMA_FAMILY_HINTS:
                        # Auto-register new chat family with conservative defaults
                        OLLAMA_FAMILY_HINTS[fam] = {'bonus': 5, 'intents': {'GENERAL', 'CODE'}}
                        new_chat.append(fam)
    if new_chat:
        logger.info(f'Auto-registered new chat families: {new_chat}')
    if new_nonchat:
        logger.info(f'Auto-registered new non-chat families: {new_nonchat}')


def background_refresh_loop():
    while True:
        try:
            for provider in PROVIDERS.values():
                if provider.api_type == 'ollama':
                    fetch_ollama_models(provider)
                for model in dedupe_keep_order(provider.models or []):
                    model_health_snapshot(provider, model, 'GENERAL')
            background_refresh_detect_families()
            ollama_auto_pull_new_models()
        except Exception as e:
            logger.warning(f'Background refresh failed: {e}')
        time.sleep(max(30, min(OLLAMA_MODEL_REFRESH_TTL_SECONDS, HEALTH_SCORE_TTL_SECONDS)))


def ensure_background_refresh_started():
    global BACKGROUND_REFRESH_STARTED
    if BACKGROUND_REFRESH_STARTED:
        return
    thread = threading.Thread(target=background_refresh_loop, name='sage-router-refresh', daemon=True)
    thread.start()
    BACKGROUND_REFRESH_STARTED = True


def reasoning_capabilities_summary():
    summary = {}
    for name, provider in PROVIDERS.items():
        if name in DISABLED_PROVIDERS:
            continue
        summary[name] = {
            'api': provider.api_type,
            'reachable': provider_endpoint_reachable(provider),
            'models': [
                {
                    'id': model,
                    'capabilities': model_capabilities(provider, model),
                    'health': model_health_snapshot(provider, model, 'GENERAL'),
                }
                for model in dedupe_keep_order(provider.models or [])
            ],
        }
    return summary


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


def normalize_thinking(raw):
    if isinstance(raw, dict):
        raw = raw.get('effort') or raw.get('level') or raw.get('thinking')
    if raw is None:
        return ThinkingLevel.MEDIUM
    value = str(raw).strip().lower()
    if value in {'low', 'minimal'}:
        return ThinkingLevel.LOW
    if value in {'high', 'max', 'deep'}:
        return ThinkingLevel.HIGH
    return ThinkingLevel.MEDIUM


def thinking_max_tokens(level: ThinkingLevel):
    if level == ThinkingLevel.LOW:
        return 4096
    if level == ThinkingLevel.HIGH:
        return 12288
    return 8192


def score_provider_model(provider, model, intent, complexity, thinking=ThinkingLevel.MEDIUM, route_mode='balanced', estimated_tokens=0, debug_scores=None):
    intent_key = intent.name
    api_score = INTENT_API_SCORES.get(intent_key, {}).get(provider.api_type, 40)
    model_l = model.lower()
    provider_l = provider.name.lower()
    score = api_score
    contributions = [('api_base', round(api_score, 2))]

    for idx, hint in enumerate(INTENT_MODEL_HINTS.get(intent_key, [])):
        if hint in model_l:
            bonus = max(1, 12 - idx)
            score += bonus
            contributions.append((f'intent_hint:{hint}', round(bonus, 2)))

    ctx_window = model_context_window(provider, model)
    if estimated_tokens and ctx_window and ctx_window < estimated_tokens * 1.2:
        score -= 20
        contributions.append(('context_window_penalty', -20))
    elif estimated_tokens and ctx_window and ctx_window >= max(64000, estimated_tokens * 2):
        score += 6
        contributions.append(('long_context_bonus', 6))

    if provider.api_type == 'anthropic-messages' and intent in (Intent.CODE, Intent.ANALYSIS, Intent.GENERAL):
        score += 4
        contributions.append(('anthropic_reasoning_bias', 4))
    # openclaw-gateway is recursive (routes through this router), so it gets
    # a fixed low base score - only used as a fallback, never preferred.
    if provider.api_type == 'openclaw-gateway':
        score = min(score, 40)
        contributions.append(('openclaw_gateway_recursive_cap', min(0, 40 - score)))
    # OpenAI-compat / non-recursive external APIs keep their score as-is.
    # The openclaw-gateway penalty below handles the rest.
    if provider.api_type == 'openclaw-gateway':
        score -= 4
        contributions.append(('openclaw_gateway_penalty', -4))

    if intent == Intent.CODE:
        if provider.name == 'openai-codex' or model_l.startswith('gpt-') or 'codex' in model_l:
            score += 14
            contributions.append(('user_pref_code_gpt', 14))
            if complexity == Complexity.COMPLEX:
                score += 8
                contributions.append(('complex_code_gpt_bonus', 8))
        elif provider.api_type == 'anthropic-messages':
            score -= 10
            contributions.append(('user_pref_code_non_gpt_penalty', -10))
            if complexity == Complexity.COMPLEX and 'opus' in model_l:
                score += 18
                contributions.append(('complex_code_dario_opus_bonus', 18))
            elif complexity != Complexity.COMPLEX and 'sonnet' in model_l:
                score += 14
                contributions.append(('simple_code_dario_sonnet_bonus', 14))
            elif 'haiku' in model_l:
                score -= 8
                contributions.append(('code_dario_haiku_penalty', -8))
        elif provider.api_type == 'ollama':
            if 'glm-5.1' in model_l or model_l.startswith('glm-5:') or model_l == 'glm-5' or 'glm-5:cloud' in model_l:
                score += 18
                contributions.append(('user_pref_code_glm_bonus', 18))
                if complexity == Complexity.COMPLEX:
                    score += 8
                    contributions.append(('complex_code_glm_bonus', 8))
            elif 'kimi' in model_l:
                score += 6
                contributions.append(('user_pref_code_kimi_fallback', 6))
                if complexity == Complexity.COMPLEX:
                    score -= 4
                    contributions.append(('complex_code_kimi_penalty', -4))
            else:
                score -= 8
                contributions.append(('user_pref_code_other_ollama_penalty', -8))

    if intent == Intent.ANALYSIS:
        if provider.api_type == 'ollama':
            score += 18
            contributions.append(('user_pref_analysis_ollama', 18))
        elif provider.name == 'openai-codex' or provider.api_type == 'openclaw-gateway':
            score -= 10
            contributions.append(('user_pref_analysis_not_gpt', -10))
    if complexity == Complexity.COMPLEX and any(hint in model_l for hint in COMPLEX_MODEL_HINTS):
        score += 5
        contributions.append(('complex_model_bonus', 5))
    if complexity == Complexity.COMPLEX and any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
        score -= 8
        contributions.append(('lightweight_complex_penalty', -8))
    if complexity == Complexity.SIMPLE and any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
        score += 2
        contributions.append(('lightweight_simple_bonus', 2))
    if intent == Intent.GENERAL and provider.api_type == 'ollama':
        score -= 1
        contributions.append(('general_ollama_penalty', -1))
    if intent == Intent.GENERAL and provider.api_type == 'anthropic-messages':
        if 'haiku' in model_l:
            score += 34
            contributions.append(('general_dario_haiku_bonus', 34))
        elif 'sonnet' in model_l or 'opus' in model_l:
            score -= 6
            contributions.append(('general_dario_non_haiku_penalty', -6))
    if provider.api_type == 'ollama':
        family_bonus = ollama_family_bonus(model, intent)
        if family_bonus:
            score += family_bonus
            contributions.append(('ollama_family_bonus', family_bonus))
        if intent == Intent.CODE and ('glm-5.1' in model_l or model_l.startswith('glm-5:') or model_l == 'glm-5' or 'glm-5:cloud' in model_l):
            score += 8
            contributions.append(('glm5_code_preference', 8))
        elif intent == Intent.CODE and 'kimi' in model_l:
            score += 3
            contributions.append(('kimi_code_fallback_bonus', 3))
        elif intent == Intent.CODE and ('qwen' in model_l or 'deepseek' in model_l):
            score -= 4
            contributions.append(('glm_beats_qwen_deepseek_for_code', -4))

    if route_mode == 'fast':
        if provider.api_type == 'ollama':
            score += 6
            contributions.append(('route_mode_fast_ollama_bonus', 6))
        if provider.api_type in {'anthropic-messages', 'openclaw-gateway'}:
            score -= 3
            contributions.append(('route_mode_fast_remote_penalty', -3))
    elif route_mode == 'realtime':
        # Realtime: prioritize speed above all else, minimal latency
        if provider.api_type == 'ollama':
            score += 15
            contributions.append(('route_mode_realtime_ollama_bonus', 15))
        if 'flash' in model_l or 'turbo' in model_l or 'mini' in model_l:
            score += 8
            contributions.append(('route_mode_realtime_speed_hint', 8))
        if provider.api_type in {'anthropic-messages', 'openclaw-gateway'}:
            score -= 8
            contributions.append(('route_mode_realtime_remote_penalty', -8))
    elif route_mode == 'best':
        if provider.api_type in {'anthropic-messages', 'openclaw-gateway'}:
            score += 5
            contributions.append(('route_mode_best_frontier_bonus', 5))
    elif route_mode == 'local-first':
        if provider.api_type == 'ollama':
            score += 12
            contributions.append(('route_mode_local_first_ollama_bonus', 12))
        else:
            score -= 4
            contributions.append(('route_mode_local_first_remote_penalty', -4))

    if thinking == ThinkingLevel.HIGH:
        if any(hint in model_l for hint in COMPLEX_MODEL_HINTS):
            score += 6
            contributions.append(('thinking_high_complex_bonus', 6))
        if any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
            score -= 10
            contributions.append(('thinking_high_light_penalty', -10))
        if provider.api_type in {'anthropic-messages', 'openai-completions', 'openclaw-gateway'}:
            score += 3
            contributions.append(('thinking_high_reasoning_bias', 3))
    elif thinking == ThinkingLevel.LOW:
        if any(hint in model_l for hint in LIGHTWEIGHT_MODEL_HINTS):
            score += 6
            contributions.append(('thinking_low_light_bonus', 6))
        if any(hint in model_l for hint in COMPLEX_MODEL_HINTS):
            score -= 4
            contributions.append(('thinking_low_complex_penalty', -4))
        if provider.api_type == 'openclaw-gateway':
            score -= 6
            contributions.append(('thinking_low_gateway_penalty', -6))
        if provider.api_type == 'ollama':
            score += 2
            contributions.append(('thinking_low_ollama_bonus', 2))

    health = model_health_snapshot(provider, model, intent.name)
    health_delta = max(-60, min(40, (health.get('score', 0) - 50) * 0.6))
    score += health_delta
    contributions.append(('health_score_delta', round(health_delta, 2)))
    if provider.api_type == 'ollama' and health.get('models_present'):
        score += 5
        contributions.append(('ollama_present_bonus', 5))
    if health.get('cooldown_until', 0) > time.time():
        score -= 100
        contributions.append(('cooldown_penalty', -100))

    empirical_bonus, empirical_note = empirical_route_adjustment(provider, model, intent.name, route_mode, complexity, thinking)
    score += empirical_bonus
    contributions.append((f'route_empirical:{empirical_note}', round(empirical_bonus, 2)))

    if intent == Intent.GENERAL:
        score = 50 + ((score - 50) * 0.35)
        contributions.append(('general_blend', 'applied'))
        general_bonus, general_note = general_empirical_adjustment(provider, model)
        score += general_bonus
        contributions.append((f'empirical:{general_note}', round(general_bonus, 2)))
        logger.debug(f"[scoring] GENERAL {provider.name}/{model}: route_empirical={empirical_bonus:.2f} ({empirical_note}), empirical={general_bonus:.2f} ({general_note}), health={health.get('score', 0):.2f}, final={score:.2f}")

    final_score = round(score, 2)
    if debug_scores is not None:
        debug_scores.append({'provider': provider.name, 'model': model, 'score': final_score, 'health': health, 'contributions': contributions})
    return final_score

def select_model(intent, complexity, thinking=ThinkingLevel.MEDIUM, route_mode='balanced', requirements=None, estimated_tokens=0):
    """Score ALL models across ALL providers globally, then rank.

    Previous behavior picked the best model per provider first, then
    merged. This v3.1 approach scores every (provider, model) pair
    independently and takes the top N globally, which gives small but
    high-quality providers a fair shot against large model pools."""
    all_candidates = []
    debug_scores = []
    rejections = []
    requirements = requirements or {}
    for pn, provider in PROVIDERS.items():
        if pn in DISABLED_PROVIDERS:
            continue
        if provider.api_type == 'ollama':
            fetch_ollama_models(provider)
        if not provider.models or not provider_endpoint_reachable(provider):
            continue
        for model in dedupe_keep_order(provider.models):
            if route_mode == 'local-first' and provider.api_type == 'ollama' and is_cloud_ollama_model(model):
                rejections.append({'provider': pn, 'model': model, 'reason': 'excluded by local-first (:cloud model)'})
                continue
            if not is_chat_capable_model(provider, model):
                rejections.append({'provider': pn, 'model': model, 'reason': 'not chat-capable'})
                continue
            ok_req, reason = model_meets_requirements(provider, model, requirements, estimated_tokens)
            if not ok_req:
                rejections.append({'provider': pn, 'model': model, 'reason': reason})
                continue
            scored = (score_provider_model(provider, model, intent, complexity, thinking, route_mode, estimated_tokens, debug_scores), pn, model)
            all_candidates.append(scored)

    all_candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [(pn, model) for _, pn, model in all_candidates[:MAX_PROVIDER_ATTEMPTS]], sorted(debug_scores, key=lambda item: item['score'], reverse=True), rejections

def call_ollama(base_url, model, messages, api_key='', thinking=ThinkingLevel.MEDIUM):
    url = base_url.rstrip('/') + '/api/chat'
    payload = {"model": model, "messages": messages, "stream": False}
    if thinking == ThinkingLevel.LOW:
        payload["options"] = {"num_predict": 1024}
    elif thinking == ThinkingLevel.HIGH:
        payload["options"] = {"num_predict": 4096}

    hdrs = {'Content-Type': 'application/json'}
    if api_key:
        hdrs['Authorization'] = f'Bearer {api_key}'

    def _post_chat(chat_payload):
        data = json.dumps(chat_payload).encode()
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read())

    try:
        body = _post_chat(payload)
        message = body.get('message', {}) or {}
        content = message.get('content', '') or ''
        thinking_text = message.get('thinking', '') or ''
        content = sanitize_visible_output(content)
        if content:
            return True, content
        # Some Ollama thinking-capable models can spend the whole budget in
        # message.thinking and return empty content with done_reason=length.
        # Do not silently disable thinking by default. If the operator wants
        # the old recovery behavior, allow it explicitly via env.
        if thinking_text and OLLAMA_ALLOW_THINK_FALSE_RETRY:
            retry_payload = dict(payload)
            retry_payload['think'] = False
            retry_body = _post_chat(retry_payload)
            retry_message = retry_body.get('message', {}) or {}
            retry_content = sanitize_visible_output(retry_message.get('content', '') or '')
            if retry_content:
                logger.info(f"Ollama {base_url} {model}: recovered empty-content thinking response with opt-in think=false retry")
                return True, retry_content
        if thinking_text:
            err = 'Ollama returned thinking-only output with empty visible content'
            logger.warning(f"Ollama {base_url} {model}: {err}")
            return False, err
        err = 'Ollama returned empty content'
        logger.warning(f"Ollama {base_url} {model}: {err}")
        return False, err
    except Exception as e:
        err = extract_http_error(e)
        if 'timed out' in err.lower() and OLLAMA_ALLOW_THINK_FALSE_RETRY:
            try:
                retry_payload = dict(payload)
                retry_payload['think'] = False
                retry_body = _post_chat(retry_payload)
                retry_message = retry_body.get('message', {}) or {}
                retry_content = sanitize_visible_output(retry_message.get('content', '') or '')
                if retry_content:
                    logger.info(f"Ollama {base_url} {model}: recovered timed-out response with opt-in think=false retry")
                    return True, retry_content
            except Exception as retry_err:
                err = extract_http_error(retry_err)
        logger.warning(f"Ollama {base_url} {model}: {err}")
        return False, err

def call_openai_compat(base_url, model, messages, api_key='', provider_name='', thinking=ThinkingLevel.MEDIUM, supports_reasoning=False, want_json=False):
    url = base_url.rstrip('/') + '/v1/chat/completions'
    payload = {"model": model, "messages": messages, "max_tokens": thinking_max_tokens(thinking)}
    if supports_reasoning:
        payload["reasoning"] = {"effort": thinking.value}
    if want_json:
        payload["response_format"] = {"type": "json_object"}
    try:
        data = json.dumps(payload).encode()
        hdrs = {'Content-Type': 'application/json'}
        if api_key:
            hdrs['Authorization'] = f'Bearer {api_key}'
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
        text = sanitize_visible_output(body.get('choices', [{}])[0].get('message', {}).get('content', '') or '')
        if text:
            return True, text
        err = 'OpenAI-compatible provider returned empty content'
        logger.warning(f"OpenAI-compat {provider_name or base_url} {model}: {err}")
        return False, err
    except Exception as e:
        logger.warning(f"OpenAI-compat {provider_name or base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)


def call_openclaw_gateway(model, messages, provider_name='openai-codex', thinking=ThinkingLevel.MEDIUM, want_json=False, timeout_seconds=None):
    if not os.path.exists(OPENCLAW_GATEWAY_HELPER):
        return False, f'Missing OpenClaw gateway helper: {OPENCLAW_GATEWAY_HELPER}'

    effective_timeout = int(timeout_seconds or OPENCLAW_GATEWAY_TIMEOUT_SECONDS)
    payload = {
        'agentId': OPENCLAW_GATEWAY_AGENT_ID,
        'provider': provider_name,
        'model': model,
        'message': build_openclaw_gateway_prompt(messages),
        'timeoutMs': effective_timeout * 1000,
        'thinking': thinking.value,
        'responseFormat': 'json' if want_json else 'text',
    }

    try:
        proc = subprocess.run(
            ['node', OPENCLAW_GATEWAY_HELPER],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=effective_timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(f'OpenClaw gateway {provider_name} {model}: timed out after {effective_timeout}s')
        return False, f'OpenClaw gateway timeout after {effective_timeout}s'
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

    text = sanitize_visible_output(result.get('text', ''))
    if text:
        return True, text
    return False, json.dumps(result)

def call_anthropic(base_url, model, messages, api_key='', thinking=ThinkingLevel.MEDIUM, supports_reasoning=False, want_json=False):
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
    payload = {"model": model, "max_tokens": thinking_max_tokens(thinking), "messages": api_msgs}
    if supports_reasoning and thinking == ThinkingLevel.HIGH:
        payload["thinking"] = {"type": "enabled", "budget_tokens": 4096}
    if want_json:
        api_msgs.append({"role": "user", "content": "Return valid JSON only."})
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
        text = sanitize_visible_output(''.join(b.get('text', '') for b in blocks if isinstance(b, dict) and b.get('type') == 'text'))
        if text:
            return True, text
        err = 'Anthropic returned empty content'
        logger.warning(f"Anthropic {base_url} {model}: {err}")
        return False, err
    except Exception as e:
        logger.warning(f"Anthropic {base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)


def call_google(base_url, model, messages, api_key='', thinking=ThinkingLevel.MEDIUM, want_json=False):
    # Ensure base_url has /v1beta for Google API
    if 'generativelanguage.googleapis.com' in base_url and '/v1beta' not in base_url:
        base_url = base_url.rstrip('/') + '/v1beta'
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
        'generationConfig': {'maxOutputTokens': thinking_max_tokens(thinking)},
    }
    if want_json:
        payload['generationConfig']['responseMimeType'] = 'application/json'
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
        text = sanitize_visible_output(''.join(part.get('text', '') for part in parts if isinstance(part, dict)))
        return (True, text) if text else (False, json.dumps(result)[:500])
    except Exception as e:
        logger.warning(f"Google {base_url} {model}: {extract_http_error(e)}")
        return False, extract_http_error(e)


def call_openai_compat_completion(base_url, model, payload, api_key='', provider_name='', thinking=ThinkingLevel.MEDIUM, supports_reasoning=False, debug_mode=False, request_id=''):
    url = base_url.rstrip('/') + '/v1/chat/completions'
    proxied = build_openai_proxy_payload(payload, model, stream=False, supports_reasoning=supports_reasoning, thinking=thinking)
    logger.info(f"[openai-compat] Sending to {provider_name} with tools: {bool(proxied.get('tools'))}")
    try:
        data = json.dumps(proxied).encode()
        hdrs = {'Content-Type': 'application/json'}
        if api_key:
            hdrs['Authorization'] = f'Bearer {api_key}'
        req = urllib.request.Request(url, data=data, headers=hdrs)
        with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
        choice = (body.get('choices') or [{}])[0]
        message = choice.get('message') or {}
        text = sanitize_visible_output(message.get('content', '') or '')
        raw_tool_calls = message.get('tool_calls')
        logger.info(f"[openai-compat] Response tool_calls: {raw_tool_calls}")
        tool_calls = normalize_tool_calls(raw_tool_calls)
        finish_reason = choice.get('finish_reason') or ('tool_calls' if tool_calls else 'stop')
        return True, build_openai_completion(provider_name, model, request_id, text, tool_calls, finish_reason, body.get('usage'), debug_mode=debug_mode, allow_debug_prefix=payload.get('response_format', {}).get('type') != 'json_object')
    except Exception as e:
        err = extract_http_error(e)
        logger.warning(f"OpenAI-compat {provider_name or base_url} {model}: {err}")
        return False, err


def call_ollama_completion(base_url, model, payload, api_key='', thinking=ThinkingLevel.MEDIUM, provider_name='ollama', debug_mode=False, request_id=''):
    url = base_url.rstrip('/') + '/api/chat'
    hdrs = {'Content-Type': 'application/json'}
    if api_key:
        hdrs['Authorization'] = f'Bearer {api_key}'
    try:
        body_payload = build_ollama_payload(model, payload, thinking=thinking, stream=False)
        logger.info(f"[ollama] Sending request to {url} with {len(body_payload.get('tools', []))} tools")
        req = urllib.request.Request(url, data=json.dumps(body_payload).encode(), headers=hdrs)
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
        message = body.get('message', {}) or {}
        text = sanitize_visible_output(message.get('content', '') or '')
        raw_tool_calls = message.get('tool_calls')
        logger.info(f"[ollama] Response tool_calls: {raw_tool_calls}")
        tool_calls = normalize_tool_calls(raw_tool_calls)
        finish_reason = 'tool_calls' if tool_calls else (body.get('done_reason') or 'stop')
        return True, build_openai_completion(provider_name, model, request_id, text, tool_calls, finish_reason, {'prompt_tokens': 0, 'completion_tokens': 0}, debug_mode=debug_mode, allow_debug_prefix=payload.get('response_format', {}).get('type') != 'json_object')
    except Exception as e:
        err = extract_http_error(e)
        logger.warning(f"Ollama {base_url} {model}: {err}")
        return False, err


def call_anthropic_completion(base_url, model, payload, api_key='', thinking=ThinkingLevel.MEDIUM, supports_reasoning=False, debug_mode=False, request_id='', provider_name='anthropic'):
    url = base_url.rstrip('/') + '/v1/messages'
    system_text, api_msgs = openai_messages_to_anthropic(payload.get('messages', []))
    request_payload = {'model': model, 'max_tokens': thinking_max_tokens(thinking), 'messages': api_msgs}
    tools = openai_tools_to_anthropic(payload.get('tools'))
    if tools:
        request_payload['tools'] = tools
        tool_choice = payload.get('tool_choice')
        if isinstance(tool_choice, dict) and tool_choice.get('type') == 'function':
            request_payload['tool_choice'] = {'type': 'tool', 'name': ((tool_choice.get('function') or {}).get('name'))}
        elif tool_choice == 'required':
            request_payload['tool_choice'] = {'type': 'any'}
    if supports_reasoning and thinking == ThinkingLevel.HIGH:
        request_payload['thinking'] = {'type': 'enabled', 'budget_tokens': 4096}
    if payload.get('response_format', {}).get('type') == 'json_object':
        api_msgs.append({'role': 'user', 'content': [{'type': 'text', 'text': 'Return valid JSON only.'}]})
    if system_text:
        request_payload['system'] = system_text
    try:
        hdrs = {'Content-Type': 'application/json', 'anthropic-version': '2023-06-01'}
        if api_key:
            hdrs['x-api-key'] = api_key
        req = urllib.request.Request(url, data=json.dumps(request_payload).encode(), headers=hdrs)
        with urllib.request.urlopen(req, timeout=ANTHROPIC_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
        text, tool_calls, stop_reason, usage = parse_anthropic_response(body)
        finish_reason = 'tool_calls' if tool_calls or stop_reason == 'tool_use' else 'stop'
        return True, build_openai_completion(provider_name, model, request_id, text, tool_calls, finish_reason, usage, debug_mode=debug_mode, allow_debug_prefix=payload.get('response_format', {}).get('type') != 'json_object')
    except Exception as e:
        err = extract_http_error(e)
        logger.warning(f"Anthropic {base_url} {model}: {err}")
        return False, err


def call_google_completion(base_url, model, payload, api_key='', thinking=ThinkingLevel.MEDIUM, debug_mode=False, request_id=''):
    ok, text = call_google(base_url, model, payload.get('messages', []), api_key=api_key, thinking=thinking, want_json=payload.get('response_format', {}).get('type') == 'json_object')
    if not ok:
        return False, text
    return True, build_openai_completion('google', model, request_id, text, [], 'stop', {'prompt_tokens': 0, 'completion_tokens': 0}, debug_mode=debug_mode, allow_debug_prefix=payload.get('response_format', {}).get('type') != 'json_object')


def stream_openai_compat_to_client(self, provider, model, payload, request_id, thinking=ThinkingLevel.MEDIUM, supports_reasoning=False, debug_mode=False):
    url = provider.base_url.rstrip('/') + '/v1/chat/completions'
    proxied = build_openai_proxy_payload(payload, model, stream=True, supports_reasoning=supports_reasoning, thinking=thinking)
    hdrs = {'Content-Type': 'application/json'}
    if provider.api_key:
        hdrs['Authorization'] = f'Bearer {provider.api_key}'
    req = urllib.request.Request(url, data=json.dumps(proxied).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=OPENAI_COMPAT_TIMEOUT_SECONDS) as resp:
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        for key, value in self.routing_headers({'model': f'{provider.name}/{model}'}, request_id).items():
            if value:
                self.send_header(key, str(value))
        self.end_headers()
        if debug_mode and not payload.get('tools') and payload.get('response_format', {}).get('type') != 'json_object':
            debug_chunk = json.dumps({
                'id': f'chatcmpl-{int(time.time())}',
                'object': 'chat.completion.chunk',
                'created': int(time.time()),
                'model': f'{provider.name}/{model}',
                'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': f'[sage-router {provider.name}/{model}]\n'}, 'finish_reason': None}],
            })
            self.wfile.write(f'data: {debug_chunk}\n\n'.encode())
            self.wfile.flush()
        while True:
            line = resp.readline()
            if not line:
                break
            self.wfile.write(line)
            self.wfile.flush()
    return True


def stream_ollama_to_client(self, provider, model, payload, request_id, thinking=ThinkingLevel.MEDIUM, debug_mode=False):
    url = provider.base_url.rstrip('/') + '/api/chat'
    hdrs = {'Content-Type': 'application/json'}
    if provider.api_key:
        hdrs['Authorization'] = f'Bearer {provider.api_key}'
    req = urllib.request.Request(url, data=json.dumps(build_ollama_payload(model, payload, thinking=thinking, stream=True)).encode(), headers=hdrs)
    chat_id = f'chatcmpl-{int(time.time())}'
    router_model = f'{provider.name}/{model}'
    sent_role = False
    with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        for key, value in self.routing_headers({'model': router_model}, request_id).items():
            if value:
                self.send_header(key, str(value))
        self.end_headers()
        if debug_mode and not payload.get('tools') and payload.get('response_format', {}).get('type') != 'json_object':
            debug_chunk = json.dumps({'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': router_model, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': f'[sage-router {provider.name}/{model}]\n'}, 'finish_reason': None}]})
            self.wfile.write(f'data: {debug_chunk}\n\n'.encode())
            self.wfile.flush()
            sent_role = True
        while True:
            raw = resp.readline()
            if not raw:
                break
            line = raw.decode('utf-8', errors='replace').strip()
            if not line:
                continue
            body = json.loads(line)
            message = body.get('message', {}) or {}
            content = sanitize_visible_output(message.get('content', '') or '')
            tool_calls = normalize_tool_calls(message.get('tool_calls'))
            if content:
                delta = {'content': content}
                if not sent_role:
                    delta['role'] = 'assistant'
                    sent_role = True
                chunk = json.dumps({'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': router_model, 'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]})
                self.wfile.write(f'data: {chunk}\n\n'.encode())
                self.wfile.flush()
            if tool_calls:
                delta = {'tool_calls': tool_calls}
                if not sent_role:
                    delta['role'] = 'assistant'
                    sent_role = True
                chunk = json.dumps({'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': router_model, 'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]})
                self.wfile.write(f'data: {chunk}\n\n'.encode())
                self.wfile.flush()
            if body.get('done'):
                finish_reason = 'tool_calls' if tool_calls else (body.get('done_reason') or 'stop')
                done_chunk = json.dumps({'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()), 'model': router_model, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish_reason}]})
                self.wfile.write(f'data: {done_chunk}\n\n'.encode())
                self.wfile.write(b'data: [DONE]\n\n')
                self.wfile.flush()
                break
    return True


def stream_google_to_client(self, provider, model, payload, request_id, thinking=ThinkingLevel.MEDIUM, debug_mode=False):
    """Stream Google Generative AI responses via SSE."""
    base_url = provider.base_url
    # Ensure base_url has /v1beta for Google API
    if 'generativelanguage.googleapis.com' in base_url and '/v1beta' not in base_url:
        base_url = base_url.rstrip('/') + '/v1beta'
    
    # Build URL with API key as query param (required for streaming)
    api_key_param = f"?key={urllib.parse.quote(provider.api_key)}" if provider.api_key else ""
    url = base_url.rstrip('/') + f'/models/{urllib.parse.quote(model, safe="")}:streamGenerateContent' + api_key_param
    
    # Build Google payload from OpenAI messages
    system_text = ''
    contents = []
    for msg in payload.get('messages', []):
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        if not content:
            continue
        if role in ('system', 'developer'):
            system_text += content + '\n'
            continue
        if role == 'assistant':
            gemini_role = 'model'
        else:
            gemini_role = 'user'
        part = {'text': content}
        if contents and contents[-1].get('role') == gemini_role:
            contents[-1].setdefault('parts', []).append(part)
        else:
            contents.append({'role': gemini_role, 'parts': [part]})
    
    if contents and contents[0].get('role') != 'user':
        contents.insert(0, {'role': 'user', 'parts': [{'text': 'Hello'}]})
    if not contents:
        contents = [{'role': 'user', 'parts': [{'text': 'Hello'}]}]
    
    google_payload = {
        'contents': contents,
        'generationConfig': {'maxOutputTokens': thinking_max_tokens(thinking)},
    }
    if system_text.strip():
        google_payload['systemInstruction'] = {'parts': [{'text': system_text.strip()}]}
    
    # API key is in URL query param for streaming
    req = urllib.request.Request(url, data=json.dumps(google_payload).encode(), headers={'Content-Type': 'application/json'})
    chat_id = f'chatcmpl-{int(time.time())}'
    router_model = f'{provider.name}/{model}'
    
    with urllib.request.urlopen(req, timeout=GOOGLE_TIMEOUT_SECONDS) as resp:
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        for key, value in self.routing_headers({'model': router_model}, request_id).items():
            if value:
                self.send_header(key, str(value))
        self.end_headers()
        
        if debug_mode:
            debug_chunk = json.dumps({
                'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()),
                'model': router_model,
                'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': f'[sage-router {provider.name}/{model}]\n'}, 'finish_reason': None}],
            })
            self.wfile.write(f'data: {debug_chunk}\n\n'.encode())
            self.wfile.flush()
        
        sent_role = False
        for line in resp:
            if not line:
                continue
            line_str = line.decode('utf-8', errors='replace').strip()
            if not line_str:
                continue
            try:
                chunk = json.loads(line_str)
                candidates = chunk.get('candidates', [])
                if candidates:
                    content_parts = candidates[0].get('content', {}).get('parts', [])
                    text = ''.join(p.get('text', '') for p in content_parts if p.get('text'))
                    if text:
                        delta = {'content': text}
                        if not sent_role:
                            delta['role'] = 'assistant'
                            sent_role = True
                        sse_chunk = json.dumps({
                            'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()),
                            'model': router_model,
                            'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}],
                        })
                        self.wfile.write(f'data: {sse_chunk}\n\n'.encode())
                        self.wfile.flush()
                    
                    finish_reason_str = candidates[0].get('finishReason')
                    if finish_reason_str:
                        done_chunk = json.dumps({
                            'id': chat_id, 'object': 'chat.completion.chunk', 'created': int(time.time()),
                            'model': router_model,
                            'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}],
                        })
                        self.wfile.write(f'data: {done_chunk}\n\n'.encode())
                        self.wfile.write(b'data: [DONE]\n\n')
                        self.wfile.flush()
                        break
            except json.JSONDecodeError:
                continue
    return True


def handle_openai_chat_completions(self, payload, request_id, started, force_realtime=False):
    message_count = len(payload.get('messages', []) or [])
    thinking = normalize_thinking(payload.get('thinking') or payload.get('reasoning'))
    route_mode = normalize_route_mode(payload.get('route'))
    if force_realtime:
        route_mode = 'realtime'
        thinking = ThinkingLevel.LOW  # Force low thinking for speed
    requirements = normalize_requirements(payload)
    want_json = str(payload.get('responseFormat') or '').lower() == 'json' or payload.get('response_format', {}).get('type') == 'json_object'
    want_stream = bool(payload.get('stream', False))
    debug_mode = normalize_debug_mode(payload)
    logger.info(f"[{request_id}] Incoming /v1/chat/completions with {message_count} messages, thinking={thinking.value}, route={route_mode}, json={want_json}, requirements={requirements}, debug={debug_mode}")
    _, intent, _, _, chain = prepare_route(
        payload.get('messages', []),
        request_id=request_id,
        thinking=thinking,
        route_mode=route_mode,
        requirements=requirements,
        want_json=want_json,
        streaming_mode='native-pass-through' if want_stream else 'disabled',
        force_provider=payload.get('provider'),
        requested_model=payload.get('model'),
    )

    attempts = []
    overall_started = time.time()
    for pn, model in chain:
        if pn in DISABLED_PROVIDERS or pn not in PROVIDERS:
            continue
        prov = PROVIDERS[pn]
        supports_reasoning = provider_supports_reasoning(prov, model)
        logger.info(f"[{request_id}] Trying {pn}/{model} (api={prov.api_type}, reasoning={supports_reasoning}, stream={want_stream}, tools={bool(payload.get('tools'))})")
        started_attempt = time.time()
        ok = False
        result = None
        error_detail = None
        try:
            if prov.api_type == 'openai-completions':
                if want_stream:
                    stream_openai_compat_to_client(self, prov, model, payload, request_id, thinking=thinking, supports_reasoning=supports_reasoning, debug_mode=debug_mode)
                    ok = True
                else:
                    ok, result = call_openai_compat_completion(prov.base_url, model, payload, api_key=prov.api_key, provider_name=pn, thinking=thinking, supports_reasoning=supports_reasoning, debug_mode=debug_mode, request_id=request_id)
                    if not ok:
                        error_detail = result
            elif prov.api_type == 'ollama':
                if want_stream:
                    stream_ollama_to_client(self, prov, model, payload, request_id, thinking=thinking, debug_mode=debug_mode)
                    ok = True
                else:
                    ok, result = call_ollama_completion(prov.base_url, model, payload, api_key=prov.api_key, thinking=thinking, provider_name=pn, debug_mode=debug_mode, request_id=request_id)
                    if not ok:
                        error_detail = result
            elif prov.api_type == 'anthropic-messages':
                if want_stream:
                    error_detail = 'streaming passthrough not implemented for anthropic bridge'
                else:
                    ok, result = call_anthropic_completion(prov.base_url, model, payload, api_key=prov.api_key, thinking=thinking, supports_reasoning=supports_reasoning, debug_mode=debug_mode, request_id=request_id, provider_name=pn)
                    if not ok:
                        error_detail = result
            elif prov.api_type == 'google-generative-language':
                if want_stream:
                    stream_google_to_client(self, prov, model, payload, request_id, thinking=thinking, debug_mode=debug_mode)
                    ok = True
                else:
                    ok, result = call_google_completion(prov.base_url, model, payload, api_key=prov.api_key, thinking=thinking, debug_mode=debug_mode, request_id=request_id)
                    if not ok:
                        error_detail = result
            elif prov.api_type == 'openclaw-gateway':
                if want_stream or payload.get('tools'):
                    error_detail = 'streaming/tool passthrough unsupported for openclaw gateway bridge'
                else:
                    ok_text, text = call_openclaw_gateway(model, payload.get('messages', []), pn, thinking, want_json)
                    ok = ok_text
                    if ok:
                        result = build_openai_completion(pn, model, request_id, text, [], 'stop', {'prompt_tokens': 0, 'completion_tokens': 0}, debug_mode=debug_mode, allow_debug_prefix=not want_json)
                    else:
                        error_detail = text
            else:
                if want_stream:
                    error_detail = f'streaming passthrough unsupported for {prov.api_type}'
                else:
                    ok, result = call_openai_compat_completion(prov.base_url, model, payload, api_key=prov.api_key, provider_name=pn, thinking=thinking, supports_reasoning=supports_reasoning, debug_mode=debug_mode, request_id=request_id)
                    if not ok:
                        error_detail = result
        except Exception as e:
            error_detail = extract_http_error(e)
            logger.warning(f"[{request_id}] Streaming/advanced call failed for {pn}/{model}: {error_detail}")
            ok = False

        elapsed = time.time() - started_attempt
        record_latency_outcome(intent.name, pn, model, elapsed, ok, '' if ok else error_detail or '')
        attempts.append({'provider': pn, 'model': model, 'ok': ok, 'elapsedMs': round(elapsed * 1000.0, 2), 'detail': '' if ok else str(error_detail or '')[:240]})
        LAST_ROUTE_DEBUG['attempts'] = attempts[-12:]
        if ok:
            total_elapsed = time.time() - overall_started
            LAST_ROUTE_DEBUG.update({'selected': {'provider': pn, 'model': model}, 'status': 'ok', 'error': None, 'totalElapsedMs': round(total_elapsed * 1000.0, 2)})
            logger.info(f"[{request_id}] OK: {pn}/{model} (provider={elapsed:.2f}s, total={total_elapsed:.2f}s, stream={want_stream})")
            if want_stream:
                return
            self.write_json(200, result, extra_headers=self.routing_headers(result, request_id))
            logger.info(f"[{request_id}] Responded in {time.time() - started:.2f}s")
            return
        logger.warning(f"[{request_id}] Failed {pn}/{model} after {elapsed:.2f}s")

    total_elapsed = time.time() - overall_started
    LAST_ROUTE_DEBUG.update({'selected': None, 'attempts': attempts[-12:], 'status': 'failed', 'error': 'All providers failed', 'totalElapsedMs': round(total_elapsed * 1000.0, 2)})
    self.write_json(503, {'error': 'All providers failed', 'request_id': request_id, 'attempts': attempts, 'choices': [{'message': {'content': 'Error: No providers available'}}]}, extra_headers={'X-Sage-Router-Request-Id': request_id})

def google_to_openai_messages(payload):
    """Convert Google Generative AI request format to OpenAI messages format."""
    messages = []
    system_instruction = payload.get('systemInstruction', {})
    if system_instruction:
        sys_parts = system_instruction.get('parts', [])
        sys_text = ' '.join(p.get('text', '') for p in sys_parts if isinstance(p, dict))
        if sys_text.strip():
            messages.append({'role': 'system', 'content': sys_text.strip()})
    for content in payload.get('contents', []):
        role = content.get('role', 'user')
        parts = content.get('parts', [])
        text_parts = [p.get('text', '') for p in parts if isinstance(p, dict) and p.get('text')]
        combined = '\n'.join(text_parts)
        if combined.strip():
            oai_role = 'assistant' if role == 'model' else 'user'
            messages.append({'role': oai_role, 'content': combined})
    return messages or [{'role': 'user', 'content': 'Hello'}]


def openai_to_google_response(result, request_model):
    """Convert OpenAI chat completion response to Google Generative AI format."""
    content = result.get('choices', [{}])[0].get('message', {}).get('content', '') or ''
    model = result.get('model', request_model or 'sage-router/auto')
    usage = result.get('usage', {})
    return {
        'candidates': [{
            'content': {
                'parts': [{'text': content}],
                'role': 'model'
            },
            'finishReason': 'STOP',
            'index': 0
        }],
        'modelVersion': model,
        'usageMetadata': {
            'promptTokenCount': usage.get('prompt_tokens', 0),
            'candidatesTokenCount': usage.get('completion_tokens', 0),
            'totalTokenCount': usage.get('prompt_tokens', 0) + usage.get('completion_tokens', 0)
        }
    }


def prepare_route(messages, request_id='req-unknown', thinking=ThinkingLevel.MEDIUM, route_mode='balanced', requirements=None, want_json=False, streaming_mode=None, force_provider=None, requested_model=None):
    normalized_messages = normalize_messages(messages)
    estimated_tokens = estimate_prompt_tokens(normalized_messages)
    user_text = latest_user_text(normalized_messages)
    intent, _ = classify_intent(user_text)
    complexity = estimate_complexity(user_text)
    requirements = requirements or {}
    logger.info(f"[{request_id}] Intent: {intent.name}, Complexity: {complexity.name}, Thinking: {thinking.value}, Route: {route_mode}, JSON: {want_json}, EstTokens: {estimated_tokens}, ForceProvider: {force_provider or 'none'}")
    
    # If provider forced, build chain with only that provider's models
    if force_provider and force_provider in PROVIDERS and force_provider not in DISABLED_PROVIDERS:
        prov = PROVIDERS[force_provider]
        if prov.api_type == 'ollama':
            fetch_ollama_models(prov)
        if prov.models and provider_endpoint_reachable(prov):
            # Build chain, prioritizing the requested model if specified
            all_models = dedupe_keep_order(prov.models)
            if requested_model and requested_model not in all_models:
                # For Google and other API providers, allow any model name (passthrough)
                if prov.api_type in ('google-generative-language', 'google-generative-ai'):
                    chain = [(force_provider, requested_model)]
                    logger.info(f"[{request_id}] Chain (Google passthrough): {chain}")
                    LAST_ROUTE_DEBUG.update({'updated_at': int(time.time()), 'request_id': request_id, 'intent': intent.name, 'complexity': complexity.name, 'thinking': thinking.value, 'routeMode': route_mode, 'requirements': requirements, 'estimatedTokens': estimated_tokens, 'json': want_json, 'chain': chain, 'scores': [{'provider': force_provider, 'model': requested_model, 'score': 100}], 'rejections': [], 'selected': None, 'attempts': [], 'streaming': streaming_mode or ('buffered-wrapper' if requirements.get('streaming') else 'disabled'), 'status': 'routing', 'error': None, 'totalElapsedMs': None, 'forcedProvider': force_provider, 'passthrough': True})
                    return normalized_messages, intent, complexity, estimated_tokens, chain
                # Otherwise prepend requested model if not in list
                all_models = [requested_model] + all_models
            elif requested_model and requested_model in all_models:
                # Move requested model to front if it exists
                all_models = [requested_model] + [m for m in all_models if m != requested_model]
            chain = [(force_provider, model) for model in all_models[:MAX_PROVIDER_ATTEMPTS]]
            score_debug = [{'provider': force_provider, 'model': model, 'score': 100} for _, model in chain]
            rejections = []
            logger.info(f"[{request_id}] Chain (forced): {chain}")
            LAST_ROUTE_DEBUG.update({'updated_at': int(time.time()), 'request_id': request_id, 'intent': intent.name, 'complexity': complexity.name, 'thinking': thinking.value, 'routeMode': route_mode, 'requirements': requirements, 'estimatedTokens': estimated_tokens, 'json': want_json, 'chain': chain, 'scores': score_debug, 'rejections': [], 'selected': None, 'attempts': [], 'streaming': streaming_mode or ('buffered-wrapper' if requirements.get('streaming') else 'disabled'), 'status': 'routing', 'error': None, 'totalElapsedMs': None, 'forcedProvider': force_provider})
            return normalized_messages, intent, complexity, estimated_tokens, chain
    
    chain, score_debug, rejections = select_model(intent, complexity, thinking, route_mode, requirements, estimated_tokens)
    LAST_ROUTE_DEBUG.update({'updated_at': int(time.time()), 'request_id': request_id, 'intent': intent.name, 'complexity': complexity.name, 'thinking': thinking.value, 'routeMode': route_mode, 'requirements': requirements, 'estimatedTokens': estimated_tokens, 'json': want_json, 'chain': chain, 'scores': score_debug[:12], 'rejections': rejections[:30], 'selected': None, 'attempts': [], 'streaming': streaming_mode or ('buffered-wrapper' if requirements.get('streaming') else 'disabled'), 'status': 'routing', 'error': None, 'totalElapsedMs': None})
    logger.info(f"[{request_id}] Chain: {chain} (no mid-stream switching; each candidate tried sequentially until one succeeds)")
    return normalized_messages, intent, complexity, estimated_tokens, chain


def handle_google_generate(self, body, request_id, started, model_name, want_stream=False):
    """Handle Google Generative AI /v1beta/models/{model}:generateContent requests."""
    try:
        payload = json.loads(body or b'{}')
        messages = google_to_openai_messages(payload)
        gen_config = payload.get('generationConfig', {})
        want_json = gen_config.get('responseMimeType') == 'application/json'
        thinking = normalize_thinking(payload.get('thinking'))
        route_mode = normalize_route_mode(payload.get('route'))
        requirements = normalize_requirements(payload)

        logger.info(f'[{request_id}] Google compat {model_name} with {len(messages)} messages, stream={want_stream}')
        result = route_request(messages, request_id=request_id, thinking=thinking, route_mode=route_mode, requirements=requirements, want_json=want_json)

        is_error = isinstance(result, dict) and result.get('error')
        if is_error:
            self.write_json(503, {
                'error': {
                    'code': 503,
                    'message': result.get('error', 'Internal error'),
                    'status': 'UNAVAILABLE'
                }
            }, extra_headers=self.routing_headers(result, request_id))
        elif want_stream:
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            model = result.get('model', model_name or 'sage-router/auto')
            # Google streaming format - SSE with chunked candidates
            sse_body = ''
            # Initial chunk with metadata
            chunk = json.dumps({'candidates': [{'content': {'parts': [{'text': content}], 'role': 'model'}, 'finishReason': 'STOP', 'index': 0}], 'modelVersion': model})
            sse_body += f'data: {chunk}\n\n'
            sse_body += 'data: [DONE]\n\n'
            sse_bytes = sse_body.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Length', str(len(sse_bytes)))
            for key, value in self.routing_headers(result, request_id).items():
                if value:
                    self.send_header(key, str(value))
            self.end_headers()
            self.wfile.write(sse_bytes)
            self.wfile.flush()
        else:
            google_resp = openai_to_google_response(result, model_name)
            self.write_json(200, google_resp, extra_headers=self.routing_headers(result, request_id))
        logger.info(f'[{request_id}] Google compat responded in {time.time() - started:.2f}s')
    except Exception as e:
        logger.exception(f'[{request_id}] Google compat request failed')
        self.write_json(500, {
            'error': {'code': 500, 'message': str(e), 'status': 'INTERNAL'}
        }, extra_headers={'X-Sage-Router-Request-Id': request_id})


    for msg in reversed(messages or []):
        if msg.get('role') == 'user' and msg.get('content'):
            return msg.get('content', '')
    return messages[-1].get('content', '') if messages else ''


def latest_user_text(messages):
    for msg in reversed(messages or []):
        if msg.get('role') == 'user' and msg.get('content'):
            return msg.get('content', '')
    return messages[-1].get('content', '') if messages else ''


def route_request(messages, request_id='req-unknown', thinking=ThinkingLevel.MEDIUM, route_mode='balanced', requirements=None, want_json=False):
    requirements = requirements or {}
    normalized_messages, intent, complexity, estimated_tokens, chain = prepare_route(
        messages,
        request_id=request_id,
        thinking=thinking,
        route_mode=route_mode,
        requirements=requirements,
        want_json=want_json,
        streaming_mode='buffered-wrapper' if requirements.get('streaming') else 'disabled',
    )
    overall_started = time.time()
    attempts = []
    for pn, model in chain:
        if pn in DISABLED_PROVIDERS:
            continue
        if pn not in PROVIDERS:
            continue
        prov = PROVIDERS[pn]
        supports_reasoning = provider_supports_reasoning(prov, model)
        logger.info(f"[{request_id}] Trying {pn}/{model} (api={prov.api_type}, reasoning={supports_reasoning})")
        started = time.time()
        if prov.api_type == 'ollama':
            ok, text = call_ollama(prov.base_url, model, normalized_messages, prov.api_key, thinking)
        elif prov.api_type == 'openclaw-gateway':
            gateway_timeout = OPENCLAW_GATEWAY_CODE_TIMEOUT_SECONDS if intent == Intent.CODE else OPENCLAW_GATEWAY_TIMEOUT_SECONDS
            ok, text = call_openclaw_gateway(model, normalized_messages, pn, thinking, want_json, gateway_timeout)
        elif prov.api_type == 'anthropic-messages':
            ok, text = call_anthropic(prov.base_url, model, normalized_messages, prov.api_key, thinking, supports_reasoning, want_json)
        elif prov.api_type == 'google-generative-language':
            ok, text = call_google(prov.base_url, model, normalized_messages, prov.api_key, thinking, want_json)
        else:
            ok, text = call_openai_compat(prov.base_url, model, normalized_messages, prov.api_key, pn, thinking, supports_reasoning, want_json)
        elapsed = time.time() - started
        record_latency_outcome(intent.name, pn, model, elapsed, ok, '' if ok else text)
        attempts.append({'provider': pn, 'model': model, 'ok': ok, 'elapsedMs': round(elapsed * 1000.0, 2), 'detail': '' if ok else str(text)[:240]})
        LAST_ROUTE_DEBUG['attempts'] = attempts[-12:]
        if ok:
            total_elapsed = time.time() - overall_started
            logger.info(f"[{request_id}] OK: {pn}/{model} ({len(text)} chars, provider={elapsed:.2f}s, total={total_elapsed:.2f}s)")
            LAST_ROUTE_DEBUG.update({'selected': {'provider': pn, 'model': model}, 'status': 'ok', 'error': None, 'totalElapsedMs': round(total_elapsed * 1000.0, 2)})
            return {"id": f"chatcmpl-{int(time.time())}", "object": "chat.completion", "created": int(time.time()), "model": f"{pn}/{model}", "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
        logger.warning(f"[{request_id}] Failed {pn}/{model} after {elapsed:.2f}s")
    total_elapsed = time.time() - overall_started
    logger.error(f"[{request_id}] All providers failed after {total_elapsed:.2f}s")
    LAST_ROUTE_DEBUG.update({'selected': None, 'attempts': attempts[-12:], 'status': 'failed', 'error': 'All providers failed', 'totalElapsedMs': round(total_elapsed * 1000.0, 2)})
    return {"error": "All providers failed", "request_id": request_id, "attempts": attempts, "choices": [{"message": {"content": "Error: No providers available"}}]}

def openai_to_anthropic_response(openai_resp, request_model=None):
    """Translate an OpenAI chat completion response to Anthropic Messages API format."""
    choice = (openai_resp.get('choices') or [{}])[0]
    content_text = choice.get('message', {}).get('content', '') or ''
    finish_reason = choice.get('finish_reason', 'stop')
    model = openai_resp.get('model', request_model or 'sage-router/auto')
    usage = openai_resp.get('usage', {})
    return {
        'id': f'msg_{uuid.uuid4().hex[:24]}',
        'type': 'message',
        'role': 'assistant',
        'content': [{'type': 'text', 'text': content_text}],
        'model': model,
        'stop_reason': 'end_turn' if finish_reason == 'stop' else finish_reason,
        'stop_sequence': None,
        'usage': {
            'input_tokens': usage.get('prompt_tokens', 0),
            'output_tokens': usage.get('completion_tokens', 0),
        },
    }


def anthropic_to_openai_request(anthropic_payload):
    """Translate an Anthropic Messages API request to OpenAI chat completions format."""
    messages = []
    # Anthropic system is a top-level field, not a message
    system_text = anthropic_payload.get('system', '')
    if isinstance(system_text, list):
        # Anthropic system can be a list of content blocks
        system_text = ' '.join(b.get('text', '') for b in system_text if isinstance(b, dict) and b.get('type') == 'text')
    if system_text:
        messages.append({'role': 'system', 'content': system_text})
    for msg in (anthropic_payload.get('messages') or []):
        role = msg.get('role', 'user')
        content = msg.get('content', '')
        # Anthropic content can be a list of content blocks
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get('type') == 'text':
                        parts.append(block.get('text', ''))
                    elif block.get('type') == 'tool_use':
                        parts.append(f'[Tool Use: {block.get("name", "unknown")}] {json.dumps(block.get("input", {}))}')
                    elif block.get('type') == 'tool_result':
                        result_content = block.get('content', '')
                        if isinstance(result_content, list):
                            result_content = ' '.join(b.get('text', '') for b in result_content if isinstance(b, dict) and b.get('type') == 'text')
                        parts.append(f'[Tool Result: {block.get("tool_use_id", "?")}] {result_content}')
                    elif block.get('type') == 'image' and block.get('source', {}).get('type') == 'base64':
                        parts.append('[Image attached]')
                elif isinstance(block, str):
                    parts.append(block)
            content = '\n'.join(parts)
        if role in ('user', 'assistant', 'system'):
            messages.append({'role': role, 'content': content})
        else:
            messages.append({'role': 'user', 'content': f'[{role.upper()}] {content}'})
    # Ensure first message is user or system
    if messages and messages[0]['role'] not in ('system', 'user'):
        messages.insert(0, {'role': 'user', 'content': 'Hello'})
    if not messages:
        messages = [{'role': 'user', 'content': 'Hello'}]
    return {
        'model': anthropic_payload.get('model', 'sage-router/auto'),
        'messages': messages,
        'max_tokens': anthropic_payload.get('max_tokens', 4096),
        'stream': False,
        'temperature': anthropic_payload.get('temperature', 1.0),
    }


def handle_anthropic_messages(self, body, request_id, started):
    """Handle POST /v1/messages - Anthropic Messages API compatibility.
    Translates request to OpenAI format, routes, translates response back."""
    try:
        anthropic_payload = json.loads(body or b'{}')
        request_model = anthropic_payload.get('model', 'sage-router/auto')
        want_stream = anthropic_payload.get('stream', False)
        openai_payload = anthropic_to_openai_request(anthropic_payload)
        message_count = len(openai_payload.get('messages', []))
        thinking = normalize_thinking(openai_payload.get('thinking') or openai_payload.get('reasoning'))
        route_mode = normalize_route_mode(openai_payload.get('route'))
        requirements = normalize_requirements(openai_payload)
        want_json = False
        logger.info(f"[{request_id}] Incoming /v1/messages (Anthropic compat) with {message_count} messages, model={request_model}, thinking={thinking.value}, route={route_mode}, stream={want_stream}")
        result = route_request(openai_payload.get('messages', []), request_id=request_id, thinking=thinking, route_mode=route_mode, requirements=requirements, want_json=want_json)
        if isinstance(result, dict) and result.get('error'):
            # Error response - translate to Anthropic error format
            self.write_json(503, {
                'type': 'error',
                'error': {'type': 'api_error', 'message': result.get('error', 'Internal error')}
            }, extra_headers=self.routing_headers(result, request_id))
        elif want_stream:
            # Anthropic SSE streaming format
            content_text = result.get('choices', [{}])[0].get('message', {}).get('content', '') or ''
            model = result.get('model', request_model or 'sage-router/auto')
            msg_id = f'msg_{uuid.uuid4().hex[:24]}'
            usage = result.get('usage', {})
            sse_events = []
            # message_start
            sse_events.append(f'event: message_start\ndata: {json.dumps({"type":"message_start","message":{"id":msg_id,"type":"message","role":"assistant","content":[],"model":model,"stop_reason":None,"stop_sequence":None,"usage":{"input_tokens":usage.get("prompt_tokens",0),"output_tokens":0}}})}')
            # content_block_start
            sse_events.append(f'event: content_block_start\ndata: {json.dumps({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}})}')
            # content_block_delta (send full text as one chunk for simplicity)
            sse_events.append(f'event: content_block_delta\ndata: {json.dumps({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":content_text}})}')
            # content_block_stop
            sse_events.append(f'event: content_block_stop\ndata: {json.dumps({"type":"content_block_stop","index":0})}')
            # message_delta
            sse_events.append(f'event: message_delta\ndata: {json.dumps({"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":None},"usage":{"output_tokens":usage.get("completion_tokens",len(content_text)//4)}})}')
            # message_stop
            sse_events.append(f'event: message_stop\ndata: {json.dumps({"type":"message_stop"})}')
            sse_body = '\n\n'.join(sse_events) + '\n\n'
            sse_bytes = sse_body.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Length', str(len(sse_bytes)))
            for key, value in self.routing_headers(result, request_id).items():
                if value:
                    self.send_header(key, str(value))
            self.end_headers()
            self.wfile.write(sse_bytes)
            self.wfile.flush()
        else:
            # Non-streaming - translate to Anthropic response format
            anthropic_resp = openai_to_anthropic_response(result, request_model)
            self.write_json(200, anthropic_resp, extra_headers=self.routing_headers(result, request_id))
        logger.info(f'[{request_id}] Anthropic compat responded in {time.time() - started:.2f}s')
    except Exception as e:
        logger.exception(f'[{request_id}] Anthropic compat request failed')
        self.write_json(500, {
            'type': 'error',
            'error': {'type': 'api_error', 'message': str(e)}
        }, extra_headers={'X-Sage-Router-Request-Id': request_id})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        logger.info("%s - %s", self.address_string(), fmt % a)

    def routing_headers(self, payload=None, request_id=''):
        payload = payload or {}
        headers = {}
        model = payload.get('model') or ''
        if model:
            headers['X-Sage-Router-Model'] = model
            if '/' in model:
                provider, model_name = model.split('/', 1)
                headers['X-Sage-Router-Provider'] = provider
                headers['X-Sage-Router-Model-Name'] = model_name
        if request_id:
            headers['X-Sage-Router-Request-Id'] = request_id
        if LAST_ROUTE_DEBUG.get('intent'):
            headers['X-Sage-Router-Intent'] = LAST_ROUTE_DEBUG.get('intent')
        if LAST_ROUTE_DEBUG.get('routeMode'):
            headers['X-Sage-Router-Route-Mode'] = LAST_ROUTE_DEBUG.get('routeMode')
        return headers

    def write_json(self, status_code, payload, extra_headers=None):
        body = json.dumps(payload).encode()
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            for key, value in (extra_headers or {}).items():
                if value:
                    self.send_header(key, str(value))
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
                "thinking": {
                    "default": ThinkingLevel.MEDIUM.value,
                    "accepted": [level.value for level in ThinkingLevel],
                    "routeModes": ["fast", "balanced", "best", "local-first", "realtime"],
                },
                "requirements": {
                    "supportedKeys": ["reasoning", "json", "tools", "longContext", "streaming"]
                },
                "manifests": {
                    name: {
                        "url": OLLAMA_MANIFEST_URLS.get(canonical_provider_env_key(name), ''),
                        "file": OLLAMA_MANIFEST_FILES.get(canonical_provider_env_key(name), ''),
                        "cache": OLLAMA_MODEL_CACHE.get(name, {})
                    }
                    for name, provider in PROVIDERS.items()
                    if provider.api_type == 'ollama'
                },
                "reasoningCapabilities": reasoning_capabilities_summary(),
                "lastRoute": LAST_ROUTE_DEBUG,
                "blocks": {key: {"until": info["until"], "reason": info["reason"]} for key, info in TEMP_MODEL_BLOCKS.items()},
            })
        elif self.path == '/admin/clear-blocks':
            count = len(TEMP_MODEL_BLOCKS)
            TEMP_MODEL_BLOCKS.clear()
            MODEL_HEALTH_CACHE.clear()
            self.write_json(200, {"cleared": count, "status": "ok"})
        elif self.path == '/admin/blocks':
            self.write_json(200, {
                "blocks": {key: {"until": info["until"], "reason": info["reason"], "expiresInSeconds": max(0, info["until"] - time.time())} for key, info in TEMP_MODEL_BLOCKS.items()},
                "count": len(TEMP_MODEL_BLOCKS)
            })
        elif self.path == '/discovery':
            # Return discovered providers from GitHub manifests, CLI, and fallbacks
            openclaw_github = discover_openclaw_github_manifests()
            hermes_github = discover_hermes_github_manifests()
            openclaw_cli = discover_openclaw_cli_providers(timeout_seconds=12)
            hermes_cli = discover_hermes_cli_providers(timeout_seconds=8)
            openclaw_file = discover_openclaw_core_providers()
            hermes_file = discover_hermes_core_providers()
            self.write_json(200, {
                "openclaw": {
                    "github": {
                        "source": "openclaw/openclaw repo",
                        "manifests": openclaw_github,
                        "count": len(openclaw_github)
                    },
                    "cli": {
                        "command": "openclaw models list --all",
                        "providers": openclaw_cli,
                        "count": len(openclaw_cli) if isinstance(openclaw_cli, dict) else 0
                    },
                    "config": {
                        "source": "~/.openclaw/openclaw.json",
                        "providers": openclaw_file,
                        "count": len(openclaw_file)
                    }
                },
                "hermes": {
                    "github": {
                        "source": "NousResearch/hermes-agent repo",
                        "manifests": hermes_github,
                        "count": len(hermes_github)
                    },
                    "cli": {
                        "command": "hermes status --json",
                        "providers": hermes_cli,
                        "count": len(hermes_cli) if isinstance(hermes_cli, dict) else 0
                    },
                    "config": {
                        "source": "~/.hermes/config.yaml + auth.json",
                        "providers": hermes_file,
                        "count": len(hermes_file)
                    }
                },
                "totalProviders": len(openclaw_file) + len(hermes_file)
            })
        elif self.path.startswith('/v1beta/models') or self.path.startswith('/v1/models'):
            # Google Generative AI models listing endpoint
            models_data = []
            for name, prov in PROVIDERS.items():
                for m in prov.models:
                    models_data.append({
                        'name': f'models/{m}',
                        'displayName': m,
                        'supportedGenerationMethods': ['generateContent', 'streamGenerateContent'],
                    })
            self.write_json(200, {'models': models_data})
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
                handle_openai_chat_completions(self, payload, request_id, started)
            except Exception as e:
                logger.exception(f"[{request_id}] Request handling failed")
                self.write_json(500, {"error": str(e)}, extra_headers={'X-Sage-Router-Request-Id': request_id})
        elif self.path in ['/v1/messages', '/messages']:
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            request_id = uuid.uuid4().hex[:8]
            started = time.time()
            handle_anthropic_messages(self, body, request_id, started)
        elif self.path in ['/v1/realtime', '/realtime']:
            # Ultra-low-latency realtime endpoint with aggressive streaming
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            request_id = uuid.uuid4().hex[:8]
            started = time.time()
            try:
                payload = json.loads(body or b'{}')
                # Force realtime route mode and streaming
                payload['route'] = 'realtime'
                payload['stream'] = True
                handle_openai_chat_completions(self, payload, request_id, started, force_realtime=True)
            except Exception as e:
                logger.exception(f"[{request_id}] Realtime request failed")
                self.write_json(500, {"error": str(e)}, extra_headers={'X-Sage-Router-Request-Id': request_id})
        elif ':generateContent' in self.path or ':streamGenerateContent' in self.path:
            # Google Generative AI compat: /v1beta/models/{model}:generateContent
            import re
            match = re.match(r'.*/models/([^:]+):(generateContent|streamGenerateContent)', self.path)
            if match:
                body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
                request_id = uuid.uuid4().hex[:8]
                started = time.time()
                model_name = match.group(1)
                want_stream = match.group(2) == 'streamGenerateContent'
                handle_google_generate(self, body, request_id, started, model_name, want_stream)
            else:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8788); args = parser.parse_args()
    ensure_background_refresh_started()
    server = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    logger.info(f"Router on :{args.port} | configured={list(PROVIDERS.keys())} | disabled={sorted(DISABLED_PROVIDERS)}")
    server.serve_forever()
