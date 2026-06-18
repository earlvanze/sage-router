#!/usr/bin/env sh
set -eu

EDGE_PORT="${SAGE_ROUTER_EDGE_PORT:-8790}"
UPSTREAMS_RAW="${SAGE_ROUTER_UPSTREAMS:-}"
EDGE_TOKEN="${SAGE_ROUTER_EDGE_TOKEN:-}"
BACKEND_TOKEN="${SAGE_ROUTER_BACKEND_TOKEN:-local}"
HEALTH_PATH="${SAGE_ROUTER_HEALTH_PATH:-/health}"
LB_POLICY="${SAGE_ROUTER_LB_POLICY:-first}"
FAIL_DURATION="${SAGE_ROUTER_FAIL_DURATION:-30s}"
HEALTH_INTERVAL="${SAGE_ROUTER_HEALTH_INTERVAL:-10s}"
HEALTH_TIMEOUT="${SAGE_ROUTER_HEALTH_TIMEOUT:-3s}"
CADDY_CONFIG_DIR="${CADDY_CONFIG_DIR:-/etc/caddy}"
CADDY_CONFIG_FILE="${CADDY_CONFIG_FILE:-${CADDY_CONFIG_DIR}/Caddyfile}"

if [ -z "$UPSTREAMS_RAW" ]; then
  echo "SAGE_ROUTER_UPSTREAMS is required, for example: http://cyber.tailnet.ts.net:8790,http://umbrel.tailnet.ts.net:8788" >&2
  exit 2
fi

UPSTREAMS=""
OLD_IFS="$IFS"
IFS=", "
for upstream in $UPSTREAMS_RAW; do
  [ -n "$upstream" ] || continue
  case "$upstream" in
    http://*|https://*) ;;
    *)
      echo "invalid upstream '$upstream': use an http:// or https:// URL" >&2
      exit 2
      ;;
  esac
  UPSTREAMS="${UPSTREAMS} ${upstream}"
done
IFS="$OLD_IFS"

if [ -z "$UPSTREAMS" ]; then
  echo "SAGE_ROUTER_UPSTREAMS did not contain any usable upstream URLs" >&2
  exit 2
fi

mkdir -p "$CADDY_CONFIG_DIR"

cat > "$CADDY_CONFIG_FILE" <<EOF
{
	admin off
}

:${EDGE_PORT} {
	encode zstd gzip

	header {
		-Server
		Cache-Control "no-store"
	}

	handle /edge/health {
		respond "ok\n" 200
	}

	handle /health {
		respond "ok\n" 200
	}

EOF

if [ -n "$EDGE_TOKEN" ]; then
  cat >> "$CADDY_CONFIG_FILE" <<EOF
	@authorized header Authorization "Bearer ${EDGE_TOKEN}"
	handle @authorized {
EOF
else
  cat >> "$CADDY_CONFIG_FILE" <<EOF
	handle {
EOF
fi

cat >> "$CADDY_CONFIG_FILE" <<EOF
		reverse_proxy${UPSTREAMS} {
			health_uri ${HEALTH_PATH}
			health_interval ${HEALTH_INTERVAL}
			health_timeout ${HEALTH_TIMEOUT}
			lb_policy ${LB_POLICY}
			lb_try_duration 2m
			lb_try_interval 250ms
			fail_duration ${FAIL_DURATION}
			flush_interval -1
			header_up Host {upstream_hostport}
			header_up X-Sage-Router-Edge "tailnet"
EOF

if [ -n "$BACKEND_TOKEN" ]; then
  cat >> "$CADDY_CONFIG_FILE" <<EOF
			header_up Authorization "Bearer ${BACKEND_TOKEN}"
EOF
fi

cat >> "$CADDY_CONFIG_FILE" <<EOF
			transport http {
				dial_timeout 5s
				read_timeout 0
				write_timeout 0
				response_header_timeout 0
			}
		}
	}
EOF

if [ -n "$EDGE_TOKEN" ]; then
  cat >> "$CADDY_CONFIG_FILE" <<EOF

	respond "{\"error\":\"unauthorized\"}\n" 401
EOF
fi

cat >> "$CADDY_CONFIG_FILE" <<EOF
}
EOF

exec "$@"
