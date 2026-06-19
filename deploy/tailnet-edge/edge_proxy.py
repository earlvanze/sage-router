#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import ssl
import threading
import time
import urllib.parse
import urllib.request
from http.client import HTTPConnection, HTTPSConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


EDGE_PORT = int(os.environ.get("SAGE_ROUTER_EDGE_PORT", "8790"))
UPSTREAMS_RAW = os.environ.get("SAGE_ROUTER_UPSTREAMS", "")
CONTROL_PLANE_UPSTREAM_RAW = os.environ.get("SAGE_ROUTER_CONTROL_PLANE_UPSTREAM", "").strip()
EDGE_TOKEN = os.environ.get("SAGE_ROUTER_EDGE_TOKEN", "")
BACKEND_TOKEN = os.environ.get("SAGE_ROUTER_BACKEND_TOKEN", "local")
CONTROL_PLANE_TOKEN = os.environ.get("SAGE_ROUTER_CONTROL_PLANE_TOKEN", "").strip()
EDGE_AUTH_MODE = os.environ.get("SAGE_ROUTER_EDGE_AUTH_MODE", "shared-token").strip().lower()
HEALTH_PATH = os.environ.get("SAGE_ROUTER_HEALTH_PATH", "/health")
HEALTH_INTERVAL = float(os.environ.get("SAGE_ROUTER_HEALTH_INTERVAL_SECONDS", os.environ.get("SAGE_ROUTER_HEALTH_INTERVAL", "10").rstrip("s")))
HEALTH_TIMEOUT = float(os.environ.get("SAGE_ROUTER_HEALTH_TIMEOUT_SECONDS", os.environ.get("SAGE_ROUTER_HEALTH_TIMEOUT", "3").rstrip("s")))
REQUEST_TIMEOUT = float(os.environ.get(
    "SAGE_ROUTER_REQUEST_TIMEOUT_SECONDS",
    os.environ.get("SAGE_ROUTER_REQUEST_CONNECT_TIMEOUT_SECONDS", "120"),
))
READ_CHUNK_SIZE = int(os.environ.get("SAGE_ROUTER_EDGE_READ_CHUNK_SIZE", "65536"))
RETRY_STATUSES = {401, 429, 502, 503, 504}
SUPABASE_URL = (os.environ.get("SAGE_ROUTER_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_ANON_KEY = (
    os.environ.get("SAGE_ROUTER_SUPABASE_ANON_KEY")
    or os.environ.get("AOPS_SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
    or ""
)
SUPABASE_SERVICE_ROLE_KEY = (
    os.environ.get("SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or ""
)
SUPABASE_CUSTOMERS_TABLE = os.environ.get("SAGE_ROUTER_SUPABASE_CUSTOMERS_TABLE", "sage_router_customers")
SUPABASE_API_KEYS_TABLE = os.environ.get("SAGE_ROUTER_SUPABASE_API_KEYS_TABLE", "sage_router_api_keys")
SUPABASE_USAGE_RPC = os.environ.get("SAGE_ROUTER_SUPABASE_USAGE_RPC", "sage_router_increment_usage")
API_KEY_PREFIX = os.environ.get("SAGE_ROUTER_API_KEY_PREFIX", "sk_sage_")
API_KEY_HASH_PEPPER = os.environ.get("SAGE_ROUTER_API_KEY_HASH_PEPPER") or os.environ.get("SAGE_ROUTER_SIGNING_SECRET") or ""
AUTH_CACHE_TTL_SECONDS = float(os.environ.get("SAGE_ROUTER_EDGE_AUTH_CACHE_SECONDS", "30"))
API_KEY_AUTH_CACHE_TTL_SECONDS = float(os.environ.get("SAGE_ROUTER_EDGE_API_KEY_AUTH_CACHE_SECONDS", "0"))
CORS_ORIGIN = os.environ.get("SAGE_ROUTER_CORS_ORIGIN", "https://app.sagerouter.dev,https://sagerouter.dev,https://www.sagerouter.dev")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGIN.split(",") if origin.strip()]
ACCOUNT_URL = os.environ.get("SAGE_ROUTER_ACCOUNT_URL", "https://app.sagerouter.dev/account.html")
LOGIN_URL = os.environ.get("SAGE_ROUTER_LOGIN_URL", "https://app.sagerouter.dev/login.html")
PRICING_URL = os.environ.get("SAGE_ROUTER_PRICING_URL", "https://sagerouter.dev/pricing")
STATUS_URL = os.environ.get("SAGE_ROUTER_STATUS_URL", "https://app.sagerouter.dev/status")
API_BASE_URL = os.environ.get("SAGE_ROUTER_PUBLIC_API_BASE_URL", "https://api.sagerouter.dev")
RATE_LIMIT_ENABLED = os.environ.get("SAGE_ROUTER_EDGE_RATE_LIMIT_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("SAGE_ROUTER_EDGE_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMITS_RAW = os.environ.get(
    "SAGE_ROUTER_EDGE_RATE_LIMITS",
    "trial=30,lite=60,pro=180,max=600,manual=600,paid=180,active=180,default=60",
)
QUOTA_ENABLED = os.environ.get("SAGE_ROUTER_EDGE_QUOTA_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}
MONTHLY_QUOTAS_RAW = os.environ.get(
    "SAGE_ROUTER_EDGE_MONTHLY_QUOTAS",
    "trial=1000,lite=10000,pro=50000,max=200000,paid=50000,active=50000,default=0",
)

PUBLIC_PATHS = {"/edge/health"}
PUBLIC_CONTROL_PLANE_PATHS = {
    "/pricing",
    "/plans",
    "/model-catalog",
    "/features/agent-native",
}
USER_JWT_PREFIXES = (
    "/account",
    "/billing/stripe/checkout",
    "/billing/crypto/intent",
    "/billing/crypto/status",
)
GENERATED_API_KEY_PREFIXES = (
    "/v1",
    "/v1beta",
)
OPERATOR_CONTROL_PLANE_PREFIXES = (
    "/analytics",
    "/admin",
)
PUBLIC_SIGNED_BACKEND_PREFIXES = (
    "/billing/stripe/webhook",
)

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
EDGE_OWNED_RESPONSE_HEADERS = {
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-max-age",
    "access-control-allow-credentials",
}

AUTH_CACHE = {}
AUTH_CACHE_LOCK = threading.Lock()
RATE_LIMIT_BUCKETS = {}
RATE_LIMIT_LOCK = threading.Lock()


class Upstream:
    def __init__(self, raw_url):
        raw_url = raw_url.rstrip("/")
        parsed = urlsplit(raw_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(f"invalid upstream {raw_url!r}: use http:// or https://")
        self.raw_url = raw_url
        self.scheme = parsed.scheme
        self.host = parsed.hostname
        self.port = parsed.port or (443 if parsed.scheme == "https" else 80)
        self.path_prefix = parsed.path.rstrip("/")
        self.healthy = False
        self.latency_ms = None
        self.last_checked = 0.0
        self.last_error = "not checked"
        self.lock = threading.Lock()

    @property
    def hostport(self):
        return f"{self.host}:{self.port}"

    def connection(self, timeout):
        if self.scheme == "https":
            return HTTPSConnection(self.host, self.port, timeout=timeout, context=ssl.create_default_context())
        return HTTPConnection(self.host, self.port, timeout=timeout)

    def target_path(self, request_path):
        if not self.path_prefix:
            return request_path
        if request_path.startswith("/"):
            return f"{self.path_prefix}{request_path}"
        return f"{self.path_prefix}/{request_path}"

    def snapshot(self):
        with self.lock:
            return {
                "url": self.raw_url,
                "healthy": self.healthy,
                "latency_ms": self.latency_ms,
                "last_checked": self.last_checked,
                "last_error": self.last_error,
            }

    def set_health(self, healthy, latency_ms=None, error=""):
        with self.lock:
            self.healthy = healthy
            self.latency_ms = latency_ms
            self.last_checked = time.time()
            self.last_error = error


def parse_upstreams(raw):
    upstreams = []
    for item in raw.replace(" ", ",").split(","):
        item = item.strip()
        if item:
            upstreams.append(Upstream(item))
    if not upstreams:
        raise SystemExit("SAGE_ROUTER_UPSTREAMS is required, for example: http://cyber.tailnet.ts.net:8790,http://umbrel.tailnet.ts.net:8790")
    return upstreams


UPSTREAMS = parse_upstreams(UPSTREAMS_RAW)
CONTROL_PLANE_UPSTREAM = Upstream(CONTROL_PLANE_UPSTREAM_RAW) if CONTROL_PLANE_UPSTREAM_RAW else None


def bearer_token(headers):
    auth = headers.get("Authorization", "") or ""
    return auth[7:].strip() if auth.lower().startswith("bearer ") else ""


def token_matches(token, allowed):
    return bool(token and allowed and hmac.compare_digest(token, allowed))


def api_key_hash(raw_key):
    return hashlib.sha256((API_KEY_HASH_PEPPER + raw_key).encode("utf-8")).hexdigest()


def customer_is_active(customer):
    status = str((customer or {}).get("status") or "").lower()
    plan = str((customer or {}).get("plan") or "").lower()
    return status in {"active", "trialing", "manual", "paid"} and plan not in {"", "free", "inactive"}


def parse_rate_limits(raw):
    limits = {}
    for item in (raw or "").replace(" ", ",").split(","):
        item = item.strip()
        if not item:
            continue
        if "=" in item:
            key, value = item.split("=", 1)
        elif ":" in item:
            key, value = item.split(":", 1)
        else:
            continue
        key = key.strip().lower()
        try:
            limit = int(value.strip())
        except ValueError:
            continue
        if key and limit >= 0:
            limits[key] = limit
    limits.setdefault("default", 60)
    return limits


RATE_LIMITS_BY_PLAN = parse_rate_limits(RATE_LIMITS_RAW)
MONTHLY_QUOTAS_BY_PLAN = parse_rate_limits(MONTHLY_QUOTAS_RAW)


def rate_limit_plan(auth_context):
    plan = str((auth_context or {}).get("plan") or "").strip().lower()
    status = str((auth_context or {}).get("customer_status") or "").strip().lower()
    if plan and plan in RATE_LIMITS_BY_PLAN:
        return plan
    if status and status in RATE_LIMITS_BY_PLAN:
        return status
    return "default"


def plan_limit(auth_context, limits):
    plan = str((auth_context or {}).get("plan") or "").strip().lower()
    status = str((auth_context or {}).get("customer_status") or "").strip().lower()
    if plan and plan in limits:
        return plan, limits[plan]
    if status and status in limits:
        return status, limits[status]
    return "default", limits.get("default", 0)


def rate_limit_identity(auth_context):
    auth_type = str((auth_context or {}).get("type") or "")
    if auth_type in {"edge_token", "public", "public_control_plane", "public_signed_backend", "disabled"}:
        return None
    if auth_type == "generated_key":
        key_id = (auth_context or {}).get("key_id")
        customer_id = (auth_context or {}).get("customer_id")
        user_id = (auth_context or {}).get("user_id")
        return f"api-key:{key_id or customer_id or user_id or 'unknown'}"
    if auth_type == "supabase_user":
        return f"user:{(auth_context or {}).get('user_id') or 'unknown'}"
    return None


def check_rate_limit(auth_context, path):
    if not RATE_LIMIT_ENABLED:
        return True, None
    if RATE_LIMIT_WINDOW_SECONDS <= 0:
        return True, None
    identity = rate_limit_identity(auth_context)
    if not identity:
        return True, None
    plan = rate_limit_plan(auth_context)
    limit = RATE_LIMITS_BY_PLAN.get(plan, RATE_LIMITS_BY_PLAN.get("default", 60))
    now = time.time()
    window = int(now // RATE_LIMIT_WINDOW_SECONDS)
    bucket_key = (identity, plan, urlsplit(path).path.split("/", 2)[1] if urlsplit(path).path.startswith("/") else "")
    reset_at = (window + 1) * RATE_LIMIT_WINDOW_SECONDS
    with RATE_LIMIT_LOCK:
        if len(RATE_LIMIT_BUCKETS) > 20000:
            stale_before = window - 2
            for key, value in list(RATE_LIMIT_BUCKETS.items()):
                if value[0] <= stale_before:
                    RATE_LIMIT_BUCKETS.pop(key, None)
        current_window, count = RATE_LIMIT_BUCKETS.get(bucket_key, (window, 0))
        if current_window != window:
            count = 0
            current_window = window
        if limit <= 0 or count >= limit:
            RATE_LIMIT_BUCKETS[bucket_key] = (current_window, count)
            return False, {
                "limit": limit,
                "remaining": 0,
                "reset": int(reset_at),
                "retry_after": max(1, int(reset_at - now)),
            }
        count += 1
        RATE_LIMIT_BUCKETS[bucket_key] = (current_window, count)
        return True, {
            "limit": limit,
            "remaining": max(0, limit - count),
            "reset": int(reset_at),
            "retry_after": max(1, int(reset_at - now)),
        }


def current_usage_period(now=None):
    return time.strftime("%Y-%m", time.gmtime(now or time.time()))


def should_count_quota(auth_context, path):
    if not QUOTA_ENABLED:
        return False
    if str((auth_context or {}).get("type") or "") != "generated_key":
        return False
    clean_path = urlsplit(path).path
    return clean_path == "/v1" or clean_path.startswith("/v1/")


def quota_headers(state):
    if not state:
        return {}
    headers = {
        "X-Quota-Period": state.get("period", ""),
        "X-Quota-Limit": state.get("quota", ""),
        "X-Quota-Used": state.get("requests", ""),
        "X-Quota-Remaining": state.get("remaining", ""),
    }
    return {key: value for key, value in headers.items() if value != ""}


def check_usage_quota(auth_context, path):
    if not should_count_quota(auth_context, path):
        return True, None
    _plan, quota = plan_limit(auth_context, MONTHLY_QUOTAS_BY_PLAN)
    if quota <= 0:
        return True, None
    if not supabase_auth_configured(require_service=True):
        return False, {
            "error": "edge_quota_not_configured",
            "quota": quota,
            "remaining": 0,
            "period": current_usage_period(),
        }

    payload = {
        "p_customer_id": str(auth_context.get("customer_id") or ""),
        "p_user_id": str(auth_context.get("user_id") or ""),
        "p_plan": str(auth_context.get("plan") or ""),
        "p_period": current_usage_period(),
        "p_increment": 1,
        "p_quota": quota,
    }
    if not payload["p_customer_id"]:
        return False, {
            "error": "edge_quota_missing_customer",
            "quota": quota,
            "remaining": 0,
            "period": payload["p_period"],
        }
    try:
        result = supabase_post_json(f"/rest/v1/rpc/{SUPABASE_USAGE_RPC}", payload, timeout=6)
        row = result[0] if isinstance(result, list) and result else result
        if not isinstance(row, dict):
            raise ValueError("usage RPC returned no row")
        state = {
            "customer_id": row.get("customer_id") or payload["p_customer_id"],
            "period": row.get("period") or payload["p_period"],
            "requests": int(row.get("requests") or 0),
            "quota": int(row.get("quota") or quota),
            "remaining": max(0, int(row.get("remaining") or 0)),
            "allowed": bool(row.get("allowed")),
        }
        return state["allowed"], state
    except Exception as exc:
        print(f"supabase usage quota check failed: {exc}", flush=True)
        return False, {
            "error": "edge_quota_unavailable",
            "quota": quota,
            "remaining": 0,
            "period": payload["p_period"],
        }


def supabase_headers(service=False, token=None):
    key = SUPABASE_SERVICE_ROLE_KEY if service else SUPABASE_ANON_KEY
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {token or key}",
        "Accept": "application/json",
    }
    return headers


def supabase_get_json(path, service=False, token=None, timeout=6):
    req = urllib.request.Request(SUPABASE_URL.rstrip("/") + path, headers=supabase_headers(service=service, token=token))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def supabase_patch_json(path, payload, timeout=4):
    data = json.dumps(payload).encode("utf-8")
    headers = supabase_headers(service=True)
    headers["Content-Type"] = "application/json"
    req = urllib.request.Request(SUPABASE_URL.rstrip("/") + path, data=data, method="PATCH", headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read(4096)


def supabase_post_json(path, payload, timeout=6):
    data = json.dumps(payload).encode("utf-8")
    headers = supabase_headers(service=True)
    headers["Content-Type"] = "application/json"
    req = urllib.request.Request(SUPABASE_URL.rstrip("/") + path, data=data, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def cache_get(key):
    now = time.time()
    with AUTH_CACHE_LOCK:
        item = AUTH_CACHE.get(key)
        if item and item[0] > now:
            return item[1]
        if item:
            AUTH_CACHE.pop(key, None)
    return None


def cache_set(key, value, ttl_seconds=None):
    ttl_seconds = AUTH_CACHE_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    if ttl_seconds <= 0:
        return value
    with AUTH_CACHE_LOCK:
        AUTH_CACHE[key] = (time.time() + ttl_seconds, value)
    return value


def cache_api_key_auth(cache_key, value):
    return cache_set(cache_key, value, API_KEY_AUTH_CACHE_TTL_SECONDS)


def supabase_auth_configured(require_service=False):
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        return False
    return bool(SUPABASE_SERVICE_ROLE_KEY) if require_service else True


def verify_supabase_user_jwt(token):
    if not token or not supabase_auth_configured():
        return None
    cache_key = f"user:{hashlib.sha256(token.encode('utf-8')).hexdigest()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        user = supabase_get_json("/auth/v1/user", service=False, token=token)
        if isinstance(user, dict) and user.get("id"):
            return cache_set(cache_key, {"type": "supabase_user", "user_id": user.get("id"), "preserve_authorization": True})
    except Exception as exc:
        print(f"supabase user auth failed: {exc}", flush=True)
    return cache_set(cache_key, False)


def verify_supabase_generated_key(token):
    if not token or not token.startswith(API_KEY_PREFIX) or not supabase_auth_configured(require_service=True):
        return None
    digest = api_key_hash(token)
    cache_key = f"api-key:{digest}"
    if API_KEY_AUTH_CACHE_TTL_SECONDS > 0:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
    try:
        quoted_digest = urllib.parse.quote(digest, safe="")
        key_rows = supabase_get_json(
            f"/rest/v1/{SUPABASE_API_KEYS_TABLE}?select=*&api_key_hash=eq.{quoted_digest}&status=eq.active&limit=1",
            service=True,
        )
        if not key_rows:
            return cache_api_key_auth(cache_key, False)
        key = key_rows[0]
        quoted_customer_id = urllib.parse.quote(str(key.get("customer_id") or ""), safe="")
        customer_rows = supabase_get_json(
            f"/rest/v1/{SUPABASE_CUSTOMERS_TABLE}?select=*&id=eq.{quoted_customer_id}&limit=1",
            service=True,
        )
        customer = customer_rows[0] if customer_rows else None
        if not customer_is_active(customer):
            return cache_api_key_auth(cache_key, False)
        key_id = urllib.parse.quote(str(key.get("id") or ""), safe="")
        if key_id:
            try:
                supabase_patch_json(f"/rest/v1/{SUPABASE_API_KEYS_TABLE}?id=eq.{key_id}", {"last_used_at_epoch": int(time.time())})
            except Exception as exc:
                print(f"supabase last-used update failed: {exc}", flush=True)
        return cache_api_key_auth(cache_key, {
            "type": "generated_key",
            "key_id": key.get("id"),
            "customer_id": customer.get("id"),
            "user_id": customer.get("user_id"),
            "plan": customer.get("plan"),
            "customer_status": customer.get("status"),
            "preserve_authorization": False,
        })
    except Exception as exc:
        print(f"supabase api key auth failed: {exc}", flush=True)
        return cache_api_key_auth(cache_key, False)


def is_user_jwt_path(path):
    clean_path = urlsplit(path).path
    return any(clean_path == prefix or clean_path.startswith(prefix + "/") for prefix in USER_JWT_PREFIXES)


def is_generated_api_key_path(path):
    clean_path = urlsplit(path).path
    return any(clean_path == prefix or clean_path.startswith(prefix + "/") for prefix in GENERATED_API_KEY_PREFIXES)


def is_public_control_plane_path(path):
    return urlsplit(path).path in PUBLIC_CONTROL_PLANE_PATHS


def is_operator_control_plane_path(path):
    clean_path = urlsplit(path).path
    return any(clean_path == prefix or clean_path.startswith(prefix + "/") for prefix in OPERATOR_CONTROL_PLANE_PREFIXES)


def is_public_signed_backend_path(path):
    clean_path = urlsplit(path).path
    return any(clean_path == prefix or clean_path.startswith(prefix + "/") for prefix in PUBLIC_SIGNED_BACKEND_PREFIXES)


def is_public_api_browser_path(path):
    clean_path = urlsplit(path).path or "/"
    return clean_path in {"/", "/dashboard"} or clean_path.startswith("/dashboard/")


def should_use_control_plane(path):
    return (
        is_user_jwt_path(path)
        or is_public_control_plane_path(path)
        or is_operator_control_plane_path(path)
        or is_public_signed_backend_path(path)
    )


def outbound_bearer_token(path, auth_context):
    if auth_context.get("preserve_authorization"):
        return None
    if should_use_control_plane(path) and CONTROL_PLANE_TOKEN:
        return CONTROL_PLANE_TOKEN
    return BACKEND_TOKEN


def edge_error_payload(error, path, message=None, **extra):
    payload = {"error": error}
    if message:
        payload["message"] = message
    if is_generated_api_key_path(path):
        payload["accountUrl"] = ACCOUNT_URL
        payload["pricingUrl"] = PRICING_URL
        payload["statusUrl"] = STATUS_URL
        payload["openaiBaseUrl"] = API_BASE_URL.rstrip("/") + "/v1"
        payload["apiKeyPrefix"] = API_KEY_PREFIX
    elif is_user_jwt_path(path):
        payload["loginUrl"] = LOGIN_URL
        payload["accountUrl"] = ACCOUNT_URL
    elif error == "unauthorized" and is_public_api_browser_path(path):
        payload["apiOnly"] = True
        payload["loginUrl"] = LOGIN_URL
        payload["accountUrl"] = ACCOUNT_URL
        payload["statusUrl"] = STATUS_URL
        payload["openaiBaseUrl"] = API_BASE_URL.rstrip("/") + "/v1"
    if extra:
        payload.update({key: value for key, value in extra.items() if value is not None})
    return payload


def edge_error_headers(error, path):
    headers = {}
    if is_generated_api_key_path(path) or is_public_api_browser_path(path):
        headers["Link"] = (
            f'<{ACCOUNT_URL}>; rel="account", '
            f'<{PRICING_URL}>; rel="pricing", '
            f'<{STATUS_URL}>; rel="status"'
        )
    if error == "unauthorized" and is_generated_api_key_path(path):
        headers["WWW-Authenticate"] = (
            'Bearer realm="Sage Router", error="invalid_token", '
            'error_description="Use an active Sage Router API key from app.sagerouter.dev/account.html"'
        )
    return headers


def check_upstream(upstream):
    started = time.perf_counter()
    conn = None
    try:
        conn = upstream.connection(timeout=HEALTH_TIMEOUT)
        headers = {"User-Agent": "sage-router-tailnet-edge/1.0"}
        if BACKEND_TOKEN:
            headers["Authorization"] = f"Bearer {BACKEND_TOKEN}"
        conn.request("GET", upstream.target_path(HEALTH_PATH), headers=headers)
        resp = conn.getresponse()
        resp.read(4096)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        if 200 <= resp.status < 500:
            upstream.set_health(True, elapsed_ms, "")
        else:
            upstream.set_health(False, elapsed_ms, f"HTTP {resp.status}")
    except Exception as exc:
        upstream.set_health(False, None, str(exc))
    finally:
        if conn:
            conn.close()


def health_loop():
    while True:
        threads = []
        for upstream in UPSTREAMS + ([CONTROL_PLANE_UPSTREAM] if CONTROL_PLANE_UPSTREAM else []):
            thread = threading.Thread(target=check_upstream, args=(upstream,), daemon=True)
            thread.start()
            threads.append(thread)
        for thread in threads:
            thread.join(timeout=HEALTH_TIMEOUT + 1)
        time.sleep(max(1.0, HEALTH_INTERVAL))


def choose_upstream():
    upstreams = healthy_upstreams()
    return upstreams[0] if upstreams else None


def healthy_upstreams():
    snapshots = []
    for upstream in UPSTREAMS:
        snap = upstream.snapshot()
        if snap["healthy"]:
            snapshots.append((snap["latency_ms"] if snap["latency_ms"] is not None else 999999, upstream))
    if snapshots:
        snapshots.sort(key=lambda item: item[0])
        return [upstream for _, upstream in snapshots]
    return []


def control_plane_upstreams():
    if not CONTROL_PLANE_UPSTREAM:
        return None
    snap = CONTROL_PLANE_UPSTREAM.snapshot()
    return [CONTROL_PLANE_UPSTREAM] if snap["healthy"] else []


def edge_enforcement_state():
    return {
        "rateLimitEnabled": RATE_LIMIT_ENABLED,
        "rateLimitWindowSeconds": RATE_LIMIT_WINDOW_SECONDS,
        "quotaEnabled": QUOTA_ENABLED,
        "apiKeyAuthCacheSeconds": API_KEY_AUTH_CACHE_TTL_SECONDS,
        "apiKeyPrefix": API_KEY_PREFIX,
    }


class EdgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "sage-router-tailnet-edge"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}", flush=True)

    def _json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8") + b"\n"
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, str(value))
        self._cors_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _cors_headers(self):
        origin = self.headers.get("Origin") or ""
        if "*" in CORS_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", "*")
        elif origin and origin in CORS_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type,Stripe-Signature,X-Requested-With")
        self.send_header("Access-Control-Max-Age", "600")

    def _auth_context(self):
        clean_path = urlsplit(self.path).path
        if clean_path in PUBLIC_PATHS:
            return {"type": "public", "preserve_authorization": True}
        if is_public_control_plane_path(self.path):
            return {"type": "public_control_plane", "preserve_authorization": False}

        token = bearer_token(self.headers)
        if token_matches(token, EDGE_TOKEN):
            return {"type": "edge_token", "preserve_authorization": False}

        if is_public_signed_backend_path(self.path):
            return {"type": "public_signed_backend", "preserve_authorization": False}

        if EDGE_AUTH_MODE in {"", "shared-token", "token", "legacy"}:
            if not EDGE_TOKEN:
                return {"type": "disabled", "preserve_authorization": True}
            return None

        if EDGE_AUTH_MODE in {"supabase", "saas"}:
            if is_user_jwt_path(self.path):
                return verify_supabase_user_jwt(token)
            if not is_generated_api_key_path(self.path):
                return None
            return verify_supabase_generated_key(token)

        if EDGE_AUTH_MODE in {"disabled", "off"}:
            return {"type": "disabled", "preserve_authorization": True}

        return None

    def _edge_health(self):
        upstreams = [upstream.snapshot() for upstream in UPSTREAMS]
        control_plane = CONTROL_PLANE_UPSTREAM.snapshot() if CONTROL_PLANE_UPSTREAM else None
        fastest = choose_upstream()
        self._json(200, {
            "status": "ok" if fastest else "degraded",
            "selected": fastest.raw_url if fastest else None,
            "upstreams": upstreams,
            "controlPlane": control_plane,
            "authMode": EDGE_AUTH_MODE,
            "enforcement": edge_enforcement_state(),
        })

    def _proxy(self):
        if urlsplit(self.path).path == "/edge/health" and self.command in {"GET", "HEAD"}:
            self._edge_health()
            return
        if self.command == "OPTIONS":
            self.send_response(204)
            self._cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        auth_context = self._auth_context()
        if not auth_context:
            self._json(
                401,
                edge_error_payload(
                    "unauthorized",
                    self.path,
                    "Use an active Sage Router API key for model API routes, or sign in for account routes.",
                ),
                edge_error_headers("unauthorized", self.path),
            )
            return
        if (
            EDGE_AUTH_MODE in {"supabase", "saas"}
            and auth_context.get("type") not in {"edge_token", "public_control_plane", "public_signed_backend"}
            and not supabase_auth_configured(require_service=not is_user_jwt_path(self.path))
        ):
            self._json(
                503,
                edge_error_payload("edge_auth_not_configured", self.path),
                edge_error_headers("edge_auth_not_configured", self.path),
            )
            return
        allowed, rate_state = check_rate_limit(auth_context, self.path)
        if not allowed:
            self._json(429, edge_error_payload("rate_limited", self.path), {
                **edge_error_headers("rate_limited", self.path),
                "Retry-After": rate_state["retry_after"],
                "X-RateLimit-Limit": rate_state["limit"],
                "X-RateLimit-Remaining": rate_state["remaining"],
                "X-RateLimit-Reset": rate_state["reset"],
            })
            return
        quota_allowed, quota_state = check_usage_quota(auth_context, self.path)
        if not quota_allowed:
            status = 503 if quota_state and str(quota_state.get("error") or "").startswith("edge_quota_") else 402
            error = (quota_state or {}).get("error") or "quota_exceeded"
            self._json(
                status,
                edge_error_payload(error, self.path, quota=quota_state.get("quota") if quota_state else None),
                {**edge_error_headers(error, self.path), **quota_headers(quota_state)},
            )
            return

        upstreams = control_plane_upstreams() if should_use_control_plane(self.path) else None
        if upstreams is None:
            upstreams = healthy_upstreams()
        if not upstreams:
            self._json(
                503,
                edge_error_payload("no healthy sage-router upstreams", self.path),
                edge_error_headers("no healthy sage-router upstreams", self.path),
            )
            return

        body = None
        content_length = self.headers.get("Content-Length")
        if content_length:
            body = self.rfile.read(int(content_length))

        base_headers = {}
        for key, value in self.headers.items():
            lower = key.lower()
            if lower in HOP_BY_HOP_HEADERS or lower == "host":
                continue
            base_headers[key] = value

        attempts = []
        for index, upstream in enumerate(upstreams):
            headers = dict(base_headers)
            headers["Host"] = upstream.hostport
            headers["X-Sage-Router-Edge"] = "tailnet-lowest-latency"
            headers["X-Sage-Router-Selected-Upstream"] = upstream.raw_url
            headers["X-Sage-Router-Edge-Auth-Type"] = str(auth_context.get("type") or "")
            if auth_context.get("customer_id"):
                headers["X-Sage-Router-Customer-Id"] = str(auth_context.get("customer_id"))
            if auth_context.get("user_id"):
                headers["X-Sage-Router-User-Id"] = str(auth_context.get("user_id"))
            outbound_token = outbound_bearer_token(self.path, auth_context)
            if outbound_token:
                headers["Authorization"] = f"Bearer {outbound_token}"

            conn = None
            try:
                conn = upstream.connection(timeout=REQUEST_TIMEOUT)
                upstream_method = "GET" if self.command == "HEAD" else self.command
                conn.request(upstream_method, upstream.target_path(self.path), body=body, headers=headers)
                resp = conn.getresponse()
                if resp.status in RETRY_STATUSES and index < len(upstreams) - 1:
                    detail = resp.read(4096).decode("utf-8", errors="replace")
                    attempts.append({
                        "upstream": upstream.raw_url,
                        "status": resp.status,
                        "detail": detail[:500],
                    })
                    conn.close()
                    continue

                self.close_connection = True
                self.send_response(resp.status, resp.reason)
                for key, value in resp.getheaders():
                    if key.lower() in HOP_BY_HOP_HEADERS or key.lower() in EDGE_OWNED_RESPONSE_HEADERS:
                        continue
                    self.send_header(key, value)
                self.send_header("X-Sage-Router-Edge", "tailnet-lowest-latency")
                self.send_header("X-Sage-Router-Upstream", upstream.raw_url)
                if attempts:
                    self.send_header("X-Sage-Router-Retry-Count", str(len(attempts)))
                if rate_state:
                    self.send_header("X-RateLimit-Limit", str(rate_state["limit"]))
                    self.send_header("X-RateLimit-Remaining", str(rate_state["remaining"]))
                    self.send_header("X-RateLimit-Reset", str(rate_state["reset"]))
                for key, value in quota_headers(quota_state).items():
                    self.send_header(key, str(value))
                self.send_header("Connection", "close")
                self._cors_headers()
                self.end_headers()
                if self.command == "HEAD":
                    resp.read(READ_CHUNK_SIZE)
                    return
                while True:
                    chunk = resp.read(READ_CHUNK_SIZE)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
                return
            except Exception as exc:
                attempts.append({
                    "upstream": upstream.raw_url,
                    "status": 0,
                    "detail": str(exc)[:500],
                })
            finally:
                if conn:
                    conn.close()

        self._json(502, {"error": "all sage-router upstreams failed", "attempts": attempts})

    def do_GET(self):
        self._proxy()

    def do_HEAD(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_PATCH(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()


if __name__ == "__main__":
    for upstream in UPSTREAMS + ([CONTROL_PLANE_UPSTREAM] if CONTROL_PLANE_UPSTREAM else []):
        check_upstream(upstream)
    threading.Thread(target=health_loop, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", EDGE_PORT), EdgeHandler)
    print(f"sage-router-tailnet-edge listening on :{EDGE_PORT} with {len(UPSTREAMS)} upstream(s)", flush=True)
    server.serve_forever()
