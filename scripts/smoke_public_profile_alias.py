#!/usr/bin/env python3
"""Create a disposable generated key and verify public profile aliasing."""
import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


def read_env_file(path):
    env = {}
    if not path:
        return env
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip("'\"")
    return env


def env_value(env, *names):
    for name in names:
        value = env.get(name) or os.environ.get(name)
        if value:
            return value
    return ""


def supabase_request(supabase_url, service_key, method, path, payload=None, prefer=False):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = "return=representation"
    req = urllib.request.Request(supabase_url.rstrip("/") + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=os.environ.get("SAGE_ROUTER_EDGE_ENV_FILE", ""))
    parser.add_argument("--api-base", default=os.environ.get("SAGEROUTER_API_BASE_URL", "https://api.sagerouter.dev"))
    parser.add_argument("--model", default=os.environ.get("SAGEROUTER_SMOKE_MODEL", "sage-router/frontier"))
    args = parser.parse_args()

    env = read_env_file(args.env_file)
    supabase_url = env_value(env, "SAGE_ROUTER_SUPABASE_URL", "SUPABASE_URL").rstrip("/")
    service_key = env_value(env, "SAGE_ROUTER_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE")
    pepper = env_value(env, "SAGE_ROUTER_API_KEY_HASH_PEPPER", "SAGE_ROUTER_SIGNING_SECRET")
    if not (supabase_url and service_key and pepper):
        raise SystemExit("missing Supabase URL, service role key, or generated-key pepper")

    now = int(time.time())
    raw_key = f"sk_sage_smoke_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    customer_id = f"edge-smoke-{uuid.uuid4().hex}"
    user_id = f"edge-smoke-user-{uuid.uuid4().hex}"
    key_id = f"edge-smoke-key-{uuid.uuid4().hex}"
    digest = hashlib.sha256((pepper + raw_key).encode("utf-8")).hexdigest()
    result = {"status": None}

    try:
        supabase_request(supabase_url, service_key, "POST", "/rest/v1/sage_router_customers", {
            "id": customer_id,
            "user_id": user_id,
            "email": f"{customer_id}@example.invalid",
            "plan": "pro",
            "status": "active",
            "created_at_epoch": now,
            "updated_at_epoch": now,
        }, prefer=True)
        supabase_request(supabase_url, service_key, "POST", "/rest/v1/sage_router_api_keys", {
            "id": key_id,
            "customer_id": customer_id,
            "user_id": user_id,
            "name": "edge smoke",
            "prefix": raw_key[:18],
            "api_key_hash": digest,
            "status": "active",
            "plan": "pro",
            "created_at_epoch": now,
            "last_used_at_epoch": None,
            "revoked_at_epoch": None,
        }, prefer=True)

        req = urllib.request.Request(
            f"{args.api_base.rstrip('/')}/v1/chat/completions",
            data=json.dumps({
                "model": args.model,
                "messages": [{"role": "user", "content": "Return only ok."}],
                "max_tokens": 8,
                "stream": False,
            }).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {raw_key}",
                "Content-Type": "application/json",
                "User-Agent": "SageRouterEdgeProfileSmoke/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                response_headers = {key.lower(): value for key, value in resp.headers.items()}
                result = {"status": resp.status, "payload": payload, "headers": response_headers}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw)
            except Exception:
                payload = {"raw": raw[:300]}
            result = {"status": exc.code, "payload": payload, "headers": {key.lower(): value for key, value in exc.headers.items()}}
    finally:
        try:
            supabase_request(
                supabase_url,
                service_key,
                "PATCH",
                f"/rest/v1/sage_router_api_keys?id=eq.{urllib.parse.quote(key_id, safe='')}",
                {"status": "revoked", "revoked_at_epoch": int(time.time())},
            )
        except Exception:
            pass
        for table, column in (
            ("sage_router_usage_counters", "customer_id"),
            ("sage_router_api_keys", "customer_id"),
            ("sage_router_customers", "id"),
        ):
            try:
                supabase_request(
                    supabase_url,
                    service_key,
                    "DELETE",
                    f"/rest/v1/{table}?{column}=eq.{urllib.parse.quote(customer_id, safe='')}",
                )
            except Exception:
                pass

    payload = result.get("payload") if isinstance(result.get("payload"), dict) else {}
    headers = result.get("headers") if isinstance(result.get("headers"), dict) else {}
    print(json.dumps({
        "status": result.get("status"),
        "bodyModel": payload.get("model"),
        "bodyUpstreamModel": payload.get("upstream_model"),
        "edge": headers.get("x-sage-router-edge"),
        "selectedUpstream": headers.get("x-sage-router-upstream"),
        "headerModel": headers.get("x-sage-router-model"),
        "headerProvider": headers.get("x-sage-router-provider"),
        "headerModelName": headers.get("x-sage-router-model-name"),
        "headerUpstreamModel": headers.get("x-sage-router-upstream-model"),
        "headerUpstreamProvider": headers.get("x-sage-router-upstream-provider"),
        "headerUpstreamModelName": headers.get("x-sage-router-upstream-model-name"),
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
