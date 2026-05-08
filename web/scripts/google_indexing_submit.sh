#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SITE_URL="${SITE_URL:-https://sagerouter.dev}"
SITE_URL="${SITE_URL%/}"
SERVICE_ACCOUNT_PATH="${GIS_SERVICE_ACCOUNT_PATH:-}"
if [[ -z "$SERVICE_ACCOUNT_PATH" && -f "$HOME/.config/rclone/rclone.conf" ]]; then
  SERVICE_ACCOUNT_PATH="$(python3 - <<'PYSA'
from configparser import ConfigParser
from pathlib import Path
cp = ConfigParser()
cp.read(Path.home() / '.config/rclone/rclone.conf')
for section in ('drive', 'evc228_gdrive'):
    if cp.has_section(section):
        candidate = cp.get(section, 'service_account_file', fallback='').strip()
        if candidate and Path(candidate).expanduser().exists():
            print(Path(candidate).expanduser())
            break
PYSA
)"
fi
SERVICE_ACCOUNT_PATH="${SERVICE_ACCOUNT_PATH:-$HOME/.gis/service_account.json}"

if [[ ! -f public/sitemap.xml ]]; then
  echo "Missing public/sitemap.xml. Add/update the sitemap before submitting." >&2
  exit 1
fi

if ! grep -q "${SITE_URL}" public/sitemap.xml; then
  echo "Warning: public/sitemap.xml does not appear to contain ${SITE_URL}." >&2
fi

if [[ -n "${GIS_CLIENT_EMAIL:-}" && -n "${GIS_PRIVATE_KEY:-}" ]]; then
  echo "Submitting ${SITE_URL} to Google Indexing API using GIS_CLIENT_EMAIL/GIS_PRIVATE_KEY..."
  npx google-indexing-script@0.4.0 "${SITE_URL}"
elif [[ -f "$SERVICE_ACCOUNT_PATH" ]]; then
  echo "Submitting ${SITE_URL} to Google Indexing API using configured service account..."
  npx google-indexing-script@0.4.0 "${SITE_URL}" --path "$SERVICE_ACCOUNT_PATH"
else
  cat >&2 <<EOF
Missing Google Indexing API credentials.

Provide either:
  GIS_SERVICE_ACCOUNT_PATH=/path/to/service_account.json npm run seo:index
or:
  GIS_CLIENT_EMAIL=... GIS_PRIVATE_KEY=... npm run seo:index

Expected default path: ${SERVICE_ACCOUNT_PATH}
EOF
  exit 2
fi
