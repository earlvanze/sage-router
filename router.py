#!/usr/bin/env python3
"""
Smart Router V3 - Dynamic provider discovery and routing
Reads available providers from OpenClaw config and routes intelligently.
"""

import json
import logging
import os
import time
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from enum import Enum, auto
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("router")

OPENCLAW_CONFIG = os.path.expanduser("~/.openclaw/openclaw.json")

class Intent(Enum):
    CODE = auto()
    ANALYSIS = auto()
    CREATIVE = auto()
    REALTIME = auto()
    GENERAL = auto()

class Complexity(Enum):
    SIMPLE = auto()
    MEDIUM = auto()
    COMPLEX = auto()

@dataclass
class Provider:
    name: str
    api_type: str
    base_url: str
    models: List[str]
    
def load_openclaw_providers() -> Dict[str, Provider]:
    """Dynamically load all providers from OpenClaw config."""
    providers = {}
    try:
        with open(OPENCLAW_CONFIG, 'r') as f:
            config = json.load(f)
        
        for name, cfg in config.get('models', {}).get('providers', {}).items():
            if name == 'smart-router':
                continue
            providers[name] = Provider(
                name=name,
                api_type=cfg.get('api', 'openai-completions'),
                base_url=cfg.get('baseUrl', ''),
                models=[m.get('id') for m in cfg.get('models', [])]
            )
        logger.info(f"Discovered {len(providers)} providers: {list(providers.keys())}")
    except Exception as e:
        logger.error(f"Failed to load OpenClaw config: {e}")
        providers['ollama'] = Provider('ollama', 'ollama', 'http://127.0.0.1:11434/api/chat', ['kimi-k2.5:cloud'])
    
    return providers

PROVIDERS = load_openclaw_providers()

API_ENDPOINTS = {
    'ollama': '/api/chat',
    'openai-completions': '/v1/chat/completions',
    'anthropic-messages': '/v1/messages',
}

def classify_intent(text: str) -> Tuple[Intent, dict]:
    text_lower = text.lower()
    scores = {intent: 0 for intent in Intent}
    
    for kw in ['write', 'code', 'debug', 'fix', 'refactor', 'implement', 'function', 'bug', 'test', '.py', '.js']:
        if kw in text_lower:
            scores[Intent.CODE] += 1
    if '```' in text:
        scores[Intent.CODE] += 3
    
    for kw in ['analyze', 'explain', 'compare', 'research', 'why', 'how does', 'review']:
        if kw in text_lower:
            scores[Intent.ANALYSIS] += 1
    
    for kw in ['create', 'brainstorm', 'imagine', 'design', 'story']:
        if kw in text_lower:
            scores[Intent.CREATIVE] += 2
    
    for kw in ['now', 'today', 'current', 'latest', 'price', 'weather']:
        if kw in text_lower:
            scores[Intent.REALTIME] += 2
    
    max_intent = max(scores, key=scores.get)
    if scores[max_intent] == 0:
        max_intent = Intent.GENERAL
    return max_intent, scores

def estimate_complexity(text: str) -> Complexity:
    words = len(text.split())
    if words < 30:
        return Complexity.SIMPLE
    if words > 200:
        return Complexity.COMPLEX
    return Complexity.MEDIUM

def select_model(intent: Intent) -> List[Tuple[str, str]]:
    if intent == Intent.CODE:
        priority = ['claude-cli', 'ollama', 'ollama-cyber']
    elif intent == Intent.ANALYSIS:
        priority = ['claude-cli', 'ollama', 'ollama-cyber']
    else:
        priority = ['ollama', 'claude-cli', 'ollama-cyber']
    
    chain = []
    for prov_name in priority:
        if prov_name in PROVIDERS:
            prov = PROVIDERS[prov_name]
            if prov.models:
                model = prov.models[0]
                for m in prov.models:
                    if any(x in m for x in ['kimi', 'sonnet', 'qwen']):
                        model = m
                        break
                chain.append((prov_name, model))
    return chain

def call_ollama(base_url: str, model: str, messages: list) -> Tuple[bool, str]:
    url = base_url.rstrip('/') + '/api/chat'
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            text = result.get('message', {}).get('content', '')
            return True, text
    except Exception as e:
        logger.warning(f"Ollama call failed: {e}")
        return False, str(e)

def call_openai_compat(base_url: str, model: str, messages: list) -> Tuple[bool, str]:
    url = base_url.rstrip('/') + '/v1/chat/completions'
    payload = {"model": model, "messages": messages, "max_tokens": 4096}
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            text = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            return True, text
    except Exception as e:
        logger.warning(f"OpenAI compat call failed: {e}")
        return False, str(e)

def route_request(messages: list) -> dict:
    user_text = messages[-1].get('content', '') if messages else ''
    intent, _ = classify_intent(user_text)
    complexity = estimate_complexity(user_text)
    
    logger.info(f"Intent: {intent.name}, Complexity: {complexity.name}")
    
    model_chain = select_model(intent)
    logger.info(f"Model chain: {model_chain}")
    
    for prov_name, model in model_chain:
        if prov_name not in PROVIDERS:
            continue
        provider = PROVIDERS[prov_name]
        
        if provider.api_type == 'ollama':
            success, text = call_ollama(provider.base_url, model, messages)
        else:
            success, text = call_openai_compat(provider.base_url, model, messages)
        
        if success:
            return {
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": f"{prov_name}/{model}",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0}
            }
    
    return {"error": "All providers failed", "choices": [{"message": {"content": "Error: No providers available"}}]}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info("%s - %s", self.address_string(), format % args)
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "providers": list(PROVIDERS.keys())}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path in ['/v1/chat/completions', '/chat/completions']:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                messages = data.get('messages', [])
                result = route_request(messages)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port: int = 8788):
    server = HTTPServer(('127.0.0.1', port), Handler)
    logger.info(f"Router listening on http://127.0.0.1:{port}")
    logger.info(f"Available providers: {list(PROVIDERS.keys())}")
    server.serve_forever()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8788)
    args = parser.parse_args()
    run_server(args.port)
