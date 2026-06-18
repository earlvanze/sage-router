#!/usr/bin/env python3
import json
import os
import ssl
import threading
import time
from http.client import HTTPConnection, HTTPSConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


EDGE_PORT = int(os.environ.get("SAGE_ROUTER_EDGE_PORT", "8790"))
UPSTREAMS_RAW = os.environ.get("SAGE_ROUTER_UPSTREAMS", "")
EDGE_TOKEN = os.environ.get("SAGE_ROUTER_EDGE_TOKEN", "")
BACKEND_TOKEN = os.environ.get("SAGE_ROUTER_BACKEND_TOKEN", "local")
HEALTH_PATH = os.environ.get("SAGE_ROUTER_HEALTH_PATH", "/health")
HEALTH_INTERVAL = float(os.environ.get("SAGE_ROUTER_HEALTH_INTERVAL_SECONDS", os.environ.get("SAGE_ROUTER_HEALTH_INTERVAL", "10").rstrip("s")))
HEALTH_TIMEOUT = float(os.environ.get("SAGE_ROUTER_HEALTH_TIMEOUT_SECONDS", os.environ.get("SAGE_ROUTER_HEALTH_TIMEOUT", "3").rstrip("s")))
REQUEST_CONNECT_TIMEOUT = float(os.environ.get("SAGE_ROUTER_REQUEST_CONNECT_TIMEOUT_SECONDS", "5"))
READ_CHUNK_SIZE = int(os.environ.get("SAGE_ROUTER_EDGE_READ_CHUNK_SIZE", "65536"))

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
        for upstream in UPSTREAMS:
            thread = threading.Thread(target=check_upstream, args=(upstream,), daemon=True)
            thread.start()
            threads.append(thread)
        for thread in threads:
            thread.join(timeout=HEALTH_TIMEOUT + 1)
        time.sleep(max(1.0, HEALTH_INTERVAL))


def choose_upstream():
    snapshots = []
    for upstream in UPSTREAMS:
        snap = upstream.snapshot()
        if snap["healthy"]:
            snapshots.append((snap["latency_ms"] if snap["latency_ms"] is not None else 999999, upstream))
    if snapshots:
        snapshots.sort(key=lambda item: item[0])
        return snapshots[0][1]
    return None


class EdgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "sage-router-tailnet-edge"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}", flush=True)

    def _json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8") + b"\n"
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        if not EDGE_TOKEN:
            return True
        return self.headers.get("Authorization", "") == f"Bearer {EDGE_TOKEN}"

    def _edge_health(self):
        upstreams = [upstream.snapshot() for upstream in UPSTREAMS]
        fastest = choose_upstream()
        self._json(200, {
            "status": "ok" if fastest else "degraded",
            "selected": fastest.raw_url if fastest else None,
            "upstreams": upstreams,
        })

    def _proxy(self):
        if self.path in {"/edge/health", "/health"} and self.command == "GET":
            self._edge_health()
            return
        if not self._authorized():
            self._json(401, {"error": "unauthorized"})
            return
        upstream = choose_upstream()
        if not upstream:
            self._json(503, {"error": "no healthy sage-router upstreams"})
            return

        body = None
        content_length = self.headers.get("Content-Length")
        if content_length:
            body = self.rfile.read(int(content_length))

        headers = {}
        for key, value in self.headers.items():
            lower = key.lower()
            if lower in HOP_BY_HOP_HEADERS or lower == "host":
                continue
            headers[key] = value
        headers["Host"] = upstream.hostport
        headers["X-Sage-Router-Edge"] = "tailnet-lowest-latency"
        headers["X-Sage-Router-Selected-Upstream"] = upstream.raw_url
        if BACKEND_TOKEN:
            headers["Authorization"] = f"Bearer {BACKEND_TOKEN}"

        conn = None
        try:
            conn = upstream.connection(timeout=REQUEST_CONNECT_TIMEOUT)
            conn.request(self.command, upstream.target_path(self.path), body=body, headers=headers)
            resp = conn.getresponse()
            self.close_connection = True
            self.send_response(resp.status, resp.reason)
            for key, value in resp.getheaders():
                if key.lower() in HOP_BY_HOP_HEADERS:
                    continue
                self.send_header(key, value)
            self.send_header("X-Sage-Router-Edge", "tailnet-lowest-latency")
            self.send_header("X-Sage-Router-Upstream", upstream.raw_url)
            self.send_header("Connection", "close")
            self.end_headers()
            while True:
                chunk = resp.read(READ_CHUNK_SIZE)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except Exception as exc:
            self._json(502, {"error": "upstream proxy failed", "upstream": upstream.raw_url, "detail": str(exc)})
        finally:
            if conn:
                conn.close()

    def do_GET(self):
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
    for upstream in UPSTREAMS:
        check_upstream(upstream)
    threading.Thread(target=health_loop, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", EDGE_PORT), EdgeHandler)
    print(f"sage-router-tailnet-edge listening on :{EDGE_PORT} with {len(UPSTREAMS)} upstream(s)", flush=True)
    server.serve_forever()
