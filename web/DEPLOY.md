# Sage Router Landing Page Deployment

## Hosting decision

Frontend hosting decision: use Cloudflare Pages for the static marketing site, especially while the free tier is sufficient. Keep backend/control plane decisions separate from the static frontend.


Static frontend for `sagerouter.ai`.

## Local preview

```bash
cd web
npm install
npm run dev
```

Production build:

```bash
cd web
npm run build
npm run preview
```

Build output is written to `web/dist`.

## Recommended deploy path: Cloudflare Pages

Use Cloudflare Pages for the marketing site and keep the router service separate.

Cloudflare Pages settings:

- Project name: `sage-router-web`
- Production branch: `main`
- Root directory: `web`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Custom domain: `sagerouter.ai`

Do not deploy the Python router service or any local provider credentials to Pages. This site is static marketing/docs content only.

## DNS

After the Pages project exists, attach:

- `sagerouter.ai`
- optionally `www.sagerouter.ai`

Let Cloudflare manage the required CNAME/flattened records.

## SEO / GEO launch checklist

Before public launch:

- Confirm canonical URL is `https://sagerouter.ai/`.
- Confirm `robots.txt`, `sitemap.xml`, `llms.txt`, and `llms-full.txt` are reachable at site root.
- Submit sitemap in Google Search Console and Bing Webmaster Tools.
- Add GitHub repo link back to `https://sagerouter.ai/`.
- Add docs/tutorial pages for:
  - Codex
  - Claude Code
  - OpenClaw
  - Ollama / Ollama Cloud
  - OpenAI-compatible endpoint
  - BYOK provider fallback

## Deployment boundary

The landing page must not include provider API keys, user credentials, systemd environment files, or router runtime config.

Hosted Sage Router infra, if added later, should be a separate service with explicit architecture review for key custody and customer data boundaries.
