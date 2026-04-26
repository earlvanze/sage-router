#!/usr/bin/env sh
set -eu

# Keep mounted config paths predictable for the bundled router and Dario proxy.
mkdir -p "${SAGE_ROUTER_HOME:-/config}" /root/.dario

# If caller passes a custom command, run it. Otherwise append --port from env
# only when the argument list does not already specify a port.
if [ "$#" -ge 1 ] && [ "$1" = "python3" ]; then
  for arg in "$@"; do
    if [ "$arg" = "--port" ]; then
      exec "$@"
    fi
  done
  exec "$@" --port "${PORT:-8788}"
fi
exec "$@"
