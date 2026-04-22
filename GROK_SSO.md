# Grok SSO local proxy

The old `xai-grok-auth` install path appears dead, so this repo now ships a local replacement: `grok_sso_proxy.py`.

It exposes an OpenAI-compatible endpoint at:

- `http://127.0.0.1:18923/v1/chat/completions`
- `http://127.0.0.1:18923/v1/models`
- `http://127.0.0.1:18923/health`

## What it does

- uses Grok web/session cookies instead of xAI API credits
- translates OpenAI chat-completions requests into Grok's web conversation endpoint
- auto-loads into Sage Router as `grok-sso` **only when `/health` reports `ready: true`**

## Current limits

- chat completions only
- no OpenAI-style tool calling
- no OpenAI streaming passthrough
- each request is treated like a fresh Grok conversation

## Cookie sources

The proxy checks these in order:

1. `GROK_SSO_PROXY_COOKIE_HEADER`
2. `GROK_SSO_PROXY_COOKIE_JSON`
3. Chromium cookie DB at `GROK_SSO_PROXY_BROWSER_COOKIE_DB`

Default browser path:

- `~/.config/BraveSoftware/Brave-Browser/Default/Cookies`

Default required cookie set for readiness:

- `sso`

Recommended additional cookies if present:

- `sso-rw`
- `x-anonuserid`
- `x-challenge`
- `x-signature`

## Run manually

```bash
cd /home/umbrel/.openclaw/workspace/skills/sage-router
python3 grok_sso_proxy.py --port 18923
```

Check readiness:

```bash
python3 - <<'PY'
import json, urllib.request
print(json.load(urllib.request.urlopen('http://127.0.0.1:18923/health')))
PY
```

## Example cookie JSON

```json
{
  "sso": "...",
  "sso-rw": "...",
  "x-anonuserid": "...",
  "x-challenge": "...",
  "x-signature": "..."
}
```

Then point the proxy at it:

```bash
export GROK_SSO_PROXY_COOKIE_JSON=/absolute/path/to/grok-cookies.json
python3 grok_sso_proxy.py --port 18923
```

## Systemd

See:

- `systemd/grok-sso-proxy.service`
- `systemd/grok-sso-proxy.env.example`

## Sage Router behavior

`provider-profiles.json` already contains the `grok-sso` overlay:

- base URL: `http://127.0.0.1:18923/v1`
- provider id: `grok-sso`

Sage Router now checks `/health` and only loads the overlay when the local proxy is both reachable and ready.
