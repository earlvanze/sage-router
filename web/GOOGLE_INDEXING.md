# Google Indexing integration

This landing site is wired to use [`google-indexing-script`](https://github.com/goenning/google-indexing-script) for Search Console URL inspection and Indexing API submission.

## One-time setup

1. Verify `https://sagerouter.dev/` in Google Search Console.
2. In Google Cloud, enable:
   - Google Search Console API
   - Web Search Indexing API
3. Create a service account, add its email as an Owner for the Search Console property, and save the JSON key at `~/.gis/service_account.json`.

Do not commit the service account JSON.

## Run

```bash
npm install
npm run index:google
```

If minute quota throttling gets in the way:

```bash
npm run index:google:retry
```

## Notes

- `public/sitemap.xml` and `public/robots.txt` are already present for `https://sagerouter.dev/`.
- Google's Indexing API is officially intended for pages with `JobPosting` or `BroadcastEvent` structured data. This script can still inspect sitemap URLs, but indexing submission behavior depends on Google's API eligibility and Search Console ownership.
