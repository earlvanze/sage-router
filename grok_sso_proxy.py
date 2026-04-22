#!/usr/bin/env python3
"""Local OpenAI-compatible Grok SSO proxy for Sage Router.

This is a replacement for the now-missing xai-grok-auth plugin path.
It speaks a tiny subset of the OpenAI chat-completions API and forwards
requests into Grok's web conversation endpoint using browser/session cookies.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
except Exception:  # pragma: no cover
    Cipher = None
    algorithms = None
    modes = None
    default_backend = None


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("grok-sso-proxy")

DEFAULT_HOST = os.environ.get("GROK_SSO_PROXY_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("GROK_SSO_PROXY_PORT", "18923"))
DEFAULT_MODEL = os.environ.get("GROK_SSO_PROXY_MODEL", "grok-3")
UPSTREAM_BASE_URL = os.environ.get("GROK_SSO_PROXY_UPSTREAM_BASE_URL", "https://grok.com/rest/app-chat").rstrip("/")
UPSTREAM_TIMEOUT_SECONDS = int(os.environ.get("GROK_SSO_PROXY_TIMEOUT_SECONDS", "90"))
COOKIE_HEADER = os.environ.get("GROK_SSO_PROXY_COOKIE_HEADER", "").strip()
COOKIE_JSON_PATH = os.path.expanduser(os.environ.get("GROK_SSO_PROXY_COOKIE_JSON", "").strip())
BROWSER_PROFILE_DIR = os.path.expanduser(
    os.environ.get("GROK_SSO_PROXY_BROWSER_PROFILE_DIR", "~/.config/BraveSoftware/Brave-Browser/Default").strip()
)
BROWSER_COOKIE_DB = os.path.expanduser(
    os.environ.get("GROK_SSO_PROXY_BROWSER_COOKIE_DB", os.path.join(BROWSER_PROFILE_DIR, "Cookies")).strip()
)
TEMPORARY_MODE = str(os.environ.get("GROK_SSO_PROXY_TEMPORARY", "true")).strip().lower() in {"1", "true", "yes", "on"}
DISABLE_SEARCH = str(os.environ.get("GROK_SSO_PROXY_DISABLE_SEARCH", "false")).strip().lower() in {"1", "true", "yes", "on"}
DEBUG_MODE = str(os.environ.get("GROK_SSO_PROXY_DEBUG", "false")).strip().lower() in {"1", "true", "yes", "on"}
REQUIRED_COOKIE_NAMES = [
    item.strip()
    for item in os.environ.get("GROK_SSO_PROXY_REQUIRED_COOKIES", "sso").split(",")
    if item.strip()
]
RECOMMENDED_COOKIE_NAMES = ["sso", "sso-rw", "x-anonuserid", "x-challenge", "x-signature"]
SUPPORTED_MODELS = ["grok-3", "grok-3-mini"]
BASE_HEADERS = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "origin": "https://grok.com",
    "priority": "u=1, i",
    "referer": "https://grok.com/",
    "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Safari";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}


def approx_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)


def openai_error(message: str, code: str, err_type: str = "invalid_request_error", param: str | None = None) -> dict[str, Any]:
    return {
        "error": {
            "message": message,
            "type": err_type,
            "param": param,
            "code": code,
        }
    }


def parse_cookie_header(value: str) -> dict[str, str]:
    cookie = SimpleCookie()
    cookie.load(value)
    parsed = {k: morsel.value for k, morsel in cookie.items() if morsel.value}
    if parsed:
        return parsed
    # Fallback for loose header strings that SimpleCookie rejected.
    result = {}
    for chunk in value.split(";"):
        if "=" not in chunk:
            continue
        key, raw = chunk.split("=", 1)
        key = key.strip()
        raw = raw.strip()
        if key and raw:
            result[key] = raw
    return result


# Security hardening configuration
BITWARDEN_ENABLED = str(os.environ.get("GROK_SSO_BITWARDEN_ENABLED", "true")).strip().lower() in {"1", "true", "yes", "on"}
BITWARDEN_ITEM_NAME = os.environ.get("GROK_SSO_BITWARDEN_ITEM", "X.com Grok SSO").strip()
BITWARDEN_SESSION_TIMEOUT = int(os.environ.get("GROK_SSO_BITWARDEN_SESSION_TIMEOUT", "3600"))  # 1 hour
ENCRYPTED_COOKIE_PATH = os.path.expanduser(os.environ.get("GROK_SSO_ENCRYPTED_COOKIE_PATH", "~/.config/sage-router/grok-cookies.enc").strip())
COOKIE_ENCRYPTION_KEY_PATH = os.path.expanduser(os.environ.get("GROK_SSO_COOKIE_KEY_PATH", "~/.config/sage-router/grok-cookies.key").strip())
RATE_LIMIT_REQUESTS = int(os.environ.get("GROK_SSO_RATE_LIMIT_REQUESTS", "60"))  # per minute
RATE_LIMIT_WINDOW = int(os.environ.get("GROK_SSO_RATE_LIMIT_WINDOW", "60"))  # seconds
REQUIRE_HTTPS = str(os.environ.get("GROK_SSO_REQUIRE_HTTPS", "false")).strip().lower() in {"1", "true", "yes", "on"}
IP_ALLOWLIST = [ip.strip() for ip in os.environ.get("GROK_SSO_IP_ALLOWLIST", "127.0.0.1,::1,100.64.0.0/10,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16").split(",") if ip.strip()]

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
    CRYPTO_AVAILABLE = True
except Exception:
    CRYPTO_AVAILABLE = False
    Fernet = None
    hashes = None
    PBKDF2 = None


    PBKDF2 = None


# Security hardening globals
_request_tracker: dict[str, list[float]] = {}
_bw_session_cached: tuple[str, float] | None = None


def get_encryption_key() -> bytes:
    """Get or create encryption key for cookie storage."""
    key_path = Path(COOKIE_ENCRYPTION_KEY_PATH)
    if key_path.exists():
        return key_path.read_bytes()
    
    if not CRYPTO_AVAILABLE:
        raise RuntimeError("cryptography library required for secure cookie storage")
    
    key = Fernet.generate_key()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.chmod(0o600)
    key_path.write_bytes(key)
    return key


def encrypt_cookies(cookies: dict[str, str]) -> bytes:
    """Encrypt cookies for secure storage."""
    if not CRYPTO_AVAILABLE:
        raise RuntimeError("cryptography library required")
    key = get_encryption_key()
    f = Fernet(key)
    return f.encrypt(json.dumps(cookies).encode())


def decrypt_cookies(encrypted: bytes) -> dict[str, str]:
    """Decrypt stored cookies."""
    if not CRYPTO_AVAILABLE:
        raise RuntimeError("cryptography library required")
    key = get_encryption_key()
    f = Fernet(key)
    return json.loads(f.decrypt(encrypted).decode())


def is_ip_allowed(client_ip: str) -> bool:
    """Check if client IP is in allowlist."""
    import ipaddress
    try:
        client = ipaddress.ip_address(client_ip)
        for allowed in IP_ALLOWLIST:
            if "/" in allowed:
                if client in ipaddress.ip_network(allowed, strict=False):
                    return True
            elif client == ipaddress.ip_address(allowed):
                return True
        return False
    except Exception:
        return False


def check_rate_limit(client_ip: str) -> bool:
    """Check if request is within rate limit."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    
    if client_ip not in _request_tracker:
        _request_tracker[client_ip] = []
    
    _request_tracker[client_ip] = [t for t in _request_tracker[client_ip] if t > window_start]
    
    if len(_request_tracker[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False
    
    _request_tracker[client_ip].append(now)
    return True


def get_bitwarden_session() -> str | None:
    """Get cached Bitwarden session or unlock."""
    global _bw_session_cached
    
    if _bw_session_cached:
        session, timestamp = _bw_session_cached
        if time.time() - timestamp < BITWARDEN_SESSION_TIMEOUT:
            return session
    
    session = os.environ.get("BW_SESSION", "").strip()
    if session:
        _bw_session_cached = (session, time.time())
        return session
    
    password = os.environ.get("BW_PASSWORD", "").strip()
    if not password:
        logger.warning("BW_PASSWORD not set, cannot unlock Bitwarden")
        return None
    
    try:
        result = subprocess.run(
            ["bw", "unlock", password, "--raw"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            session = result.stdout.strip()
            _bw_session_cached = (session, time.time())
            os.environ["BW_SESSION"] = session
            logger.info("Bitwarden unlocked successfully")
            return session
    except Exception as e:
        logger.warning(f"Failed to unlock Bitwarden: {e}")
    
    return None


def get_x_credentials_from_bitwarden() -> dict[str, str] | None:
    """Retrieve X.com credentials from Bitwarden."""
    if not BITWARDEN_ENABLED:
        return None
    
    session = get_bitwarden_session()
    if not session:
        return None
    
    try:
        result = subprocess.run(
            ["bw", "get", "item", BITWARDEN_ITEM_NAME, "--session", session],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.warning(f"Bitwarden item '{BITWARDEN_ITEM_NAME}' not found")
            return None
        
        item = json.loads(result.stdout)
        credentials = {}
        
        if "login" in item:
            login = item["login"]
            if "username" in login:
                credentials["username"] = login["username"]
            if "password" in login:
                credentials["password"] = login["password"]
        
        if "fields" in item:
            for field in item["fields"]:
                name = field.get("name", "").lower()
                value = field.get("value", "")
                if name and value:
                    credentials[name] = value
        
        if credentials:
            logger.info(f"Retrieved credentials from Bitwarden")
            return credentials
        
    except Exception as e:
        logger.warning(f"Failed to get credentials from Bitwarden: {e}")
    
    return None


def save_cookies_secure(cookies: dict[str, str]) -> None:
    """Save cookies to encrypted storage."""
    try:
        encrypted = encrypt_cookies(cookies)
        Path(ENCRYPTED_COOKIE_PATH).parent.mkdir(parents=True, exist_ok=True)
        Path(ENCRYPTED_COOKIE_PATH).write_bytes(encrypted)
        Path(ENCRYPTED_COOKIE_PATH).chmod(0o600)
        logger.info("Cookies saved to encrypted storage")
    except Exception as e:
        logger.warning(f"Failed to save cookies securely: {e}")


def load_cookies_secure() -> dict[str, str] | None:
    """Load cookies from encrypted storage."""
    try:
        path = Path(ENCRYPTED_COOKIE_PATH)
        if not path.exists():
            return None
        encrypted = path.read_bytes()
        return decrypt_cookies(encrypted)
    except Exception as e:
        logger.debug(f"No encrypted cookies found: {e}")
        return None


def load_cookie_json(path: str) -> dict[str, str]:
    with open(path) as fh:
        payload = json.load(fh)
    if isinstance(payload, dict):
        if isinstance(payload.get("cookies"), dict):
            payload = payload["cookies"]
        return {str(k): str(v) for k, v in payload.items() if v is not None and str(v)}
    raise ValueError(f"Unsupported cookie JSON structure in {path}")


def linux_chromium_v10_key() -> bytes:
    return hashlib.pbkdf2_hmac("sha1", b"peanuts", b"saltysalt", 1, 16)


def decrypt_chromium_cookie(blob: bytes) -> str:
    if not blob:
        return ""
    if not blob.startswith(b"v10"):
        return blob.decode("utf-8", "replace")
    if Cipher is None:
        raise RuntimeError("cryptography is unavailable for Chromium cookie decryption")
    cipher = Cipher(algorithms.AES(linux_chromium_v10_key()), modes.CBC(b" " * 16), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(blob[3:]) + decryptor.finalize()
    pad = decrypted[-1]
    if isinstance(pad, str):
        pad = ord(pad)
    if not 1 <= pad <= 16:
        return decrypted.decode("utf-8", "replace")
    return decrypted[:-pad].decode("utf-8", "replace")


def load_browser_cookies(cookie_db_path: str) -> tuple[dict[str, str], list[str]]:
    notes: list[str] = []
    path = Path(cookie_db_path)
    if not path.exists():
        notes.append(f"browser cookie DB not found: {cookie_db_path}")
        return {}, notes
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    try:
        shutil.copy2(path, tmp.name)
        conn = sqlite3.connect(tmp.name)
        cur = conn.cursor()
        rows = cur.execute(
            """
            select host_key, name, value, encrypted_value
            from cookies
            where host_key like '%grok.com%' or host_key like '%x.ai%'
            order by host_key, name
            """
        ).fetchall()
        conn.close()
    finally:
        try:
            os.unlink(tmp.name)
        except FileNotFoundError:
            pass
    cookies: dict[str, str] = {}
    for host_key, name, value, encrypted_value in rows:
        if value:
            cookies[name] = value
            continue
        if encrypted_value:
            try:
                decrypted = decrypt_chromium_cookie(encrypted_value)
                if decrypted:
                    cookies[name] = decrypted
            except Exception as exc:
                notes.append(f"could not decrypt {name} from {host_key}: {exc}")
    if not cookies:
        notes.append("no grok.com or x.ai cookies found in browser profile")
    return cookies, notes


def load_cookie_bundle() -> tuple[dict[str, str], str, list[str]]:
    notes: list[str] = []
    if COOKIE_HEADER:
        cookies = parse_cookie_header(COOKIE_HEADER)
        return cookies, "env:COOKIE_HEADER", notes
    if COOKIE_JSON_PATH:
        try:
            cookies = load_cookie_json(COOKIE_JSON_PATH)
            return cookies, f"file:{COOKIE_JSON_PATH}", notes
        except Exception as exc:
            notes.append(f"failed to load cookie JSON {COOKIE_JSON_PATH}: {exc}")
    cookies, browser_notes = load_browser_cookies(BROWSER_COOKIE_DB)
    notes.extend(browser_notes)
    return cookies, f"browser:{BROWSER_COOKIE_DB}", notes


def health_state() -> dict[str, Any]:
    cookies, source, notes = load_cookie_bundle()
    missing_required = [name for name in REQUIRED_COOKIE_NAMES if not cookies.get(name)]
    missing_recommended = [name for name in RECOMMENDED_COOKIE_NAMES if not cookies.get(name)]
    return {
        "status": "ok",
        "ready": not missing_required,
        "cookieSource": source,
        "cookieNames": sorted(cookies.keys()),
        "missingRequiredCookies": missing_required,
        "missingRecommendedCookies": missing_recommended,
        "browserCookieDb": BROWSER_COOKIE_DB,
        "browserProfileDir": BROWSER_PROFILE_DIR,
        "upstreamBaseUrl": UPSTREAM_BASE_URL,
        "models": SUPPORTED_MODELS,
        "notes": notes,
    }


def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                if item.strip():
                    chunks.append(item.strip())
                continue
            if not isinstance(item, dict):
                continue
            if item.get("type") in {"text", "input_text", "output_text"}:
                text = item.get("text") or item.get("content") or item.get("value")
                if isinstance(text, str) and text.strip():
                    chunks.append(text.strip())
        return "\n".join(chunks).strip()
    return ""


def build_prompt(messages: list[dict[str, Any]]) -> tuple[str, str]:
    system_parts: list[str] = []
    convo_parts: list[str] = []
    last_user = ""
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role") or "user").strip().lower()
        text = extract_text_content(msg.get("content"))
        if not text:
            continue
        if role == "system":
            system_parts.append(text)
            continue
        if role == "user":
            last_user = text
        convo_parts.append(f"{role.upper()}: {text}")
    system_text = "\n\n".join(system_parts).strip()
    if len(convo_parts) <= 1 and last_user:
        return last_user, system_text
    transcript = "\n\n".join(convo_parts).strip()
    if not transcript:
        transcript = last_user or ""
    prompt = (
        "Continue this conversation naturally. Answer the latest user request.\n\n"
        f"{transcript}\n\nASSISTANT:"
    ).strip()
    return prompt, system_text


def ndjson_lines(raw: bytes) -> list[dict[str, Any]]:
    decoded = raw.decode("utf-8", "replace")
    result: list[dict[str, Any]] = []
    for line in decoded.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            result.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return result


def extract_completion_from_ndjson(raw: bytes) -> dict[str, Any]:
    tokens: list[str] = []
    candidates: list[str] = []
    conversation_id = ""
    response_id = ""
    soft_stop = False
    lines = ndjson_lines(raw)
    for line in lines:
        result = line.get("result") if isinstance(line, dict) else None
        if not isinstance(result, dict):
            continue
        conversation = result.get("conversation")
        if isinstance(conversation, dict) and conversation.get("conversationId"):
            conversation_id = str(conversation.get("conversationId"))
        response = result.get("response")
        if isinstance(response, dict):
            if response.get("responseId"):
                response_id = str(response.get("responseId"))
            token = response.get("token")
            if isinstance(token, str) and token:
                tokens.append(token)
            model_response = response.get("modelResponse")
            if isinstance(model_response, dict):
                message = model_response.get("message")
                if isinstance(message, str) and message.strip():
                    candidates.append(message.strip())
            if response.get("isSoftStop"):
                soft_stop = True
        if result.get("isSoftStop"):
            soft_stop = True
        token = result.get("token")
        if isinstance(token, str) and token:
            tokens.append(token)
        model_response = result.get("modelResponse")
        if isinstance(model_response, dict):
            message = model_response.get("message")
            if isinstance(message, str) and message.strip():
                candidates.append(message.strip())
            if model_response.get("responseId") and not response_id:
                response_id = str(model_response.get("responseId"))
        user_response = result.get("userResponse")
        if isinstance(user_response, dict) and user_response.get("responseId") and not response_id:
            response_id = str(user_response.get("responseId"))
    joined = "".join(tokens).strip()
    final_message = joined
    if candidates:
        best = max(candidates, key=len)
        if len(best) >= len(final_message):
            final_message = best
    return {
        "message": final_message,
        "conversationId": conversation_id,
        "responseId": response_id,
        "isSoftStop": soft_stop,
        "rawLineCount": len(lines),
    }


def build_upstream_payload(body: dict[str, Any]) -> tuple[dict[str, Any], str]:
    messages = body.get("messages") or []
    prompt, system_text = build_prompt(messages if isinstance(messages, list) else [])
    if not prompt:
        raise ValueError("No prompt text found in messages")
    requested_model = str(body.get("model") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    if requested_model not in SUPPORTED_MODELS:
        requested_model = DEFAULT_MODEL
    thinking = str(body.get("thinking") or body.get("reasoning") or "").strip().lower()
    temperature = body.get("temperature")
    enable_reasoning = thinking in {"medium", "high", "true", "on"}
    if isinstance(temperature, (int, float)) and temperature <= 0.35:
        enable_reasoning = True
    payload = {
        "temporary": TEMPORARY_MODE,
        "modelName": requested_model,
        "message": prompt,
        "fileAttachments": [],
        "imageAttachments": [],
        "disableSearch": DISABLE_SEARCH,
        "enableImageGeneration": False,
        "returnImageBytes": False,
        "returnRawGrokInXaiRequest": False,
        "enableImageStreaming": False,
        "imageGenerationCount": 1,
        "forceConcise": False,
        "toolOverrides": {},
        "enableSideBySide": True,
        "isPreset": False,
        "sendFinalMetadata": True,
        "customPersonality": system_text,
        "deepsearchPreset": "",
        "isReasoning": enable_reasoning,
    }
    return payload, requested_model


def call_upstream_completion(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    cookies, source, notes = load_cookie_bundle()
    missing_required = [name for name in REQUIRED_COOKIE_NAMES if not cookies.get(name)]
    if missing_required:
        return 503, openai_error(
            f"Grok SSO proxy is not ready. Missing required cookies: {', '.join(missing_required)}",
            "grok_sso_not_ready",
            err_type="service_unavailable_error",
        )
    try:
        payload, requested_model = build_upstream_payload(body)
    except ValueError as exc:
        return 400, openai_error(str(exc), "invalid_messages", param="messages")

    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(f"{UPSTREAM_BASE_URL}/conversations/new", data=data, method="POST")
    for key, value in BASE_HEADERS.items():
        request.add_header(key, value)
    request.add_header("cookie", "; ".join(f"{name}={value}" for name, value in cookies.items() if value))

    if DEBUG_MODE:
        logger.info("Forwarding Grok request with cookies from %s and model %s", source, requested_model)
        logger.info("Upstream payload: %s", json.dumps(payload)[:4000])
        if notes:
            logger.info("Cookie notes: %s", notes)

    try:
        with urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", "replace")[:4000]
        logger.warning("Upstream Grok HTTP %s: %s", exc.code, body_text)
        return exc.code, openai_error(
            f"Upstream Grok request failed with HTTP {exc.code}: {body_text or exc.reason}",
            "grok_upstream_http_error",
            err_type="api_error",
        )
    except Exception as exc:
        logger.warning("Upstream Grok request failed: %s", exc)
        return 502, openai_error(str(exc), "grok_upstream_request_failed", err_type="api_error")

    parsed = extract_completion_from_ndjson(raw)
    message = parsed.get("message") or ""
    if not message:
        return 502, openai_error("Upstream Grok response did not contain assistant text", "empty_grok_response", err_type="api_error")
    prompt_text = extract_text_content((body.get("messages") or [{}])[-1].get("content") if body.get("messages") else "")
    usage_prompt = approx_tokens(prompt_text)
    usage_completion = approx_tokens(message)
    response_payload = {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": requested_model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": message},
                "finish_reason": "stop" if not parsed.get("isSoftStop") else "length",
            }
        ],
        "usage": {
            "prompt_tokens": usage_prompt,
            "completion_tokens": usage_completion,
            "total_tokens": usage_prompt + usage_completion,
        },
        "grok": {
            "conversationId": parsed.get("conversationId"),
            "responseId": parsed.get("responseId"),
            "cookieSource": source,
            "rawLineCount": parsed.get("rawLineCount"),
        },
    }
    return 200, response_payload


class Handler(BaseHTTPRequestHandler):
    server_version = "GrokSSOProxy/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        logger.info("%s - %s", self.address_string(), fmt % args)

    def read_json(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = 0
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def write_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.write_json(200, health_state())
            return
        if self.path in {"/v1/models", "/models"}:
            self.write_json(
                200,
                {
                    "object": "list",
                    "data": [
                        {"id": model, "object": "model", "owned_by": "grok-sso"}
                        for model in SUPPORTED_MODELS
                    ],
                },
            )
            return
        self.write_json(404, openai_error("Not found", "not_found", err_type="invalid_request_error"))

    def do_POST(self) -> None:
        if self.path not in {"/v1/chat/completions", "/chat/completions"}:
            self.write_json(404, openai_error("Not found", "not_found", err_type="invalid_request_error"))
            return
        body = self.read_json()
        if not isinstance(body, dict):
            self.write_json(400, openai_error("Invalid JSON body", "invalid_json", param="body"))
            return
        if body.get("stream"):
            self.write_json(400, openai_error("Streaming is not supported by grok-sso proxy", "stream_unsupported", param="stream"))
            return
        tools = body.get("tools")
        if isinstance(tools, list) and tools:
            self.write_json(400, openai_error("Tool calling is not supported by grok-sso proxy", "tools_unsupported", param="tools"))
            return
        status, payload = call_upstream_completion(body)
        self.write_json(status, payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local OpenAI-compatible Grok SSO proxy")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    logger.info("Grok SSO proxy listening on http://%s:%s (upstream: %s)", args.host, args.port, UPSTREAM_BASE_URL)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
