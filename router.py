#!/usr/bin/env python3
"""Smart Router V3 - Dynamic provider discovery and routing"""
import argparse, json, logging, os, socket, subprocess, time, urllib.error, urllib.parse, urllib.request
from dataclasses import dataclass
from enum import Enum, auto
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("router")
OPENCLAW_CONFIG = os.path.expanduser("~/.openclaw/openclaw.json")
OPENCLAW_GATEWAY_HELPER = os.path.join(os.path.dirname(__file__), 'openclaw_gateway_agent.mjs')
ALLOWED_PROVIDERS = ['openai-codex', 'dario', 'ollama', 'ollama-cyber']
# openai-codex gateway bridge hangs (90s timeout every request)
# Remove from active routing until the gateway RPC path works.
DISABLED_PROVIDERS = {'openai-codex'}
OLLAMA_TIMEOUT_SECONDS = 45
OPENAI_COMPAT_TIMEOUT_SECONDS = 60
ANTHROPIC_TIMEOUT_SECONDS = 60
OPENCLAW_GATEWAY_TIMEOUT_SECONDS = 90
OPENCLAW_GATEWAY_AGENT_ID = os.environ.get('SMART_ROUTER_OPENCLAW_AGENT_ID', 'main')
REACHABILITY_TIMEOUT_SECONDS = 1.5
REACHABILITY_TTL_SECONDS = 30
PROVIDER_HEALTH_CACHE = {}
DEFAULT_OPENAI_CODEX_MODELS = ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.1']

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

def load_openclaw_providers():
    providers = {}
    try:
        with open(OPENCLAW_CONFIG) as f:
            config = json.load(f)
        for name, cfg in config.get('models', {}).get('providers', {}).items():
            if name not in ALLOWED_PROVIDERS:
                continue
            api_key = cfg.get('apiKey', '')
            if api_key.startswith('${') and api_key.endswith('}'):
                api_key = os.environ.get(api_key[2:-1], '')
            providers[name] = Provider(
                name,
                cfg.get('api', 'openai-completions'),
                cfg.get('baseUrl', ''),
                api_key,
                [m.get('id') for m in cfg.get('models', []) if m.get('id')],
            )

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
            providers['openai-codex'] = Provider(
                'openai-codex',
                'openclaw-gateway',
                'ws://127.0.0.1:18789',
                '',
                codex_models,
            )

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
    return [name for name, provider in PROVIDERS.items() if provider_endpoint_reachable(provider)]


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

def select_model(intent, complexity):
    if intent == Intent.CODE:
        pri = [('dario', ['opus-4-6', 'opus-4-5', 'sonnet-4-6']), ('ollama', ['kimi', 'qwen', 'glm']), ('ollama-cyber', [])]
    elif intent == Intent.ANALYSIS:
        pri = [('dario', ['opus-4-6', 'opus-4-5', 'sonnet-4-6']), ('ollama', ['kimi', 'qwen', 'minimax']), ('ollama-cyber', [])]
    elif intent == Intent.CREATIVE:
        pri = [('dario', ['opus-4-6', 'opus-4-5', 'sonnet-4-6']), ('ollama', ['kimi', 'minimax', 'qwen']), ('ollama-cyber', [])]
    else:
        pri = [('ollama', ['kimi', 'qwen', 'minimax', 'glm']), ('dario', ['sonnet-4-6', 'sonnet-4-5', 'opus-4-6']), ('ollama-cyber', [])]
    if complexity == Complexity.COMPLEX:
        pri = [('dario', ['opus-4-6', 'opus-4-5']), ('ollama', ['kimi', 'qwen']), ('ollama-cyber', [])]
    chain = []
    for pn, pk in pri:
        if pn not in PROVIDERS:
            continue
        p = PROVIDERS[pn]
        if not p.models or not provider_endpoint_reachable(p):
            continue
        m = pick_model(p, pk) if pk else p.models[0]
        if m:
            chain.append((pn, m))
    return chain

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

def latest_user_text(messages):
    for msg in reversed(messages or []):
        if msg.get('role') == 'user' and msg.get('content'):
            return msg.get('content', '')
    return messages[-1].get('content', '') if messages else ''


def route_request(messages):
    normalized_messages = normalize_messages(messages)
    user_text = latest_user_text(normalized_messages)
    intent, _ = classify_intent(user_text)
    complexity = estimate_complexity(user_text)
    logger.info(f"Intent: {intent.name}, Complexity: {complexity.name}")
    chain = select_model(intent, complexity)
    logger.info(f"Chain: {chain}")
    for pn, model in chain:
        if pn in DISABLED_PROVIDERS:
            continue
        if pn not in PROVIDERS:
            continue
        prov = PROVIDERS[pn]
        logger.info(f"Trying {pn}/{model} (api={prov.api_type})")
        started = time.time()
        if prov.api_type == 'ollama':
            ok, text = call_ollama(prov.base_url, model, normalized_messages, prov.api_key)
        elif prov.api_type == 'openclaw-gateway':
            ok, text = call_openclaw_gateway(model, normalized_messages, pn)
        elif prov.api_type == 'anthropic-messages':
            ok, text = call_anthropic(prov.base_url, model, normalized_messages, prov.api_key)
        else:
            ok, text = call_openai_compat(prov.base_url, model, normalized_messages, prov.api_key, pn)
        elapsed = time.time() - started
        if ok:
            logger.info(f"OK: {pn}/{model} ({len(text)} chars, {elapsed:.2f}s)")
            return {"id": f"chatcmpl-{int(time.time())}", "object": "chat.completion", "created": int(time.time()), "model": f"{pn}/{model}", "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
        logger.warning(f"Failed {pn}/{model} after {elapsed:.2f}s")
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
            self.write_json(200, {"status": "ok", "providers": available_provider_names(), "configured": list(PROVIDERS.keys()), "allowed": ALLOWED_PROVIDERS})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ['/v1/chat/completions', '/chat/completions']:
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            try:
                payload = json.loads(body or b'{}')
                result = route_request(payload.get('messages', []))
                self.write_json(200, result)
            except Exception as e:
                logger.exception("Request handling failed")
                self.write_json(500, {"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8788); args = parser.parse_args()
    server = ThreadingHTTPServer(('0.0.0.0', args.port), Handler)
    logger.info(f"Router on :{args.port} | allowed={ALLOWED_PROVIDERS} | active={list(PROVIDERS.keys())}")
    server.serve_forever()
