#!/usr/bin/env python3
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HostedOnboardingTests(unittest.TestCase):
    def read_public(self, name):
        return (ROOT / "web" / "public" / name).read_text(encoding="utf-8")

    def read_text(self, *parts):
        return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")

    def test_account_page_has_explicit_email_signup(self):
        html = self.read_public("account.html")
        js = self.read_public("account.js")
        self.assertIn('id="password-signup"', html)
        self.assertIn("Create account", html)
        self.assertIn("sb.auth.signUp", js)
        self.assertIn("emailRedirectTo: `${window.location.origin}/account.html`", js)
        self.assertIn('id="key-limit-note"', html)
        self.assertIn("maxActiveApiKeysPerCustomer", js)

    def test_account_page_has_stripe_billing_management(self):
        html = self.read_public("account.html")
        js = self.read_public("account.js")
        self.assertIn('id="stripe-portal"', html)
        self.assertIn("Manage billing", html)
        self.assertIn("api('/billing/stripe/portal'", js)
        self.assertIn("params.get('billing')", js)
        self.assertIn("billing === 'portal'", js)

    def test_account_page_shows_usage_and_quota(self):
        html = self.read_public("account.html")
        js = self.read_public("account.js")
        self.assertIn('id="usage-status"', html)
        self.assertIn('id="usage-fill"', html)
        self.assertIn('id="usage-remaining"', html)
        self.assertIn("api('/account/usage'", js)
        self.assertIn("rateLimitPerMinute", js)

    def test_login_page_has_explicit_email_signup(self):
        html = self.read_public("login.html")
        js = self.read_public("auth.js")
        self.assertIn('id="password-signup"', html)
        self.assertIn("Create account", html)
        self.assertIn("sb.auth.signUp", js)
        self.assertIn("emailRedirectTo: `${window.location.origin}/login.html`", js)

    def test_analytics_page_has_explicit_email_signup_and_account_link(self):
        html = self.read_public("analytics.html")
        js = self.read_public("analytics.js")
        self.assertIn('id="password-signup"', html)
        self.assertIn("Create account", html)
        self.assertIn('href="/account.html"', html)
        self.assertIn("Manage API access", html)
        self.assertIn("sb.auth.signUp", js)
        self.assertIn("emailRedirectTo: `${window.location.origin}/analytics.html`", js)

    def test_public_status_page_uses_edge_health_and_pricing(self):
        html = self.read_public("status.html")
        js = self.read_public("status.js")
        self.assertIn("Public edge status", html)
        self.assertIn('id="upstreams"', html)
        self.assertIn('id="plans"', html)
        self.assertIn("/edge/health", js)
        self.assertIn("/pricing", js)
        self.assertIn("https://api.sagerouter.dev", js)
        self.assertIn("api.sagerouter.dev/v1", html)

    def test_waitlist_endpoint_has_non_mutating_launch_health_check(self):
        function_js = self.read_text("web", "functions", "api", "waitlist.js")
        readiness = self.read_text("scripts", "check_sagerouter_launch_readiness.sh")
        readme = self.read_text("web", "README.md")
        self.assertIn("export async function onRequestGet", function_js)
        self.assertIn("sage-router-waitlist", function_js)
        self.assertIn("primaryTable: 'sage_router_waitlist'", function_js)
        self.assertIn("fallbackTable: 'funnel_leads'", function_js)
        self.assertIn("/api/waitlist", readiness)
        self.assertIn("hosted waitlist endpoint is configured", readiness)
        self.assertIn("GET /api/waitlist", readme)

    def test_openrouter_comparison_page_is_discoverable(self):
        page = self.read_text("web", "public", "compare", "openrouter.html")
        sitemap = self.read_public("sitemap.xml")
        llms = self.read_public("llms.txt")
        llms_full = self.read_public("llms-full.txt")
        readiness = self.read_text("scripts", "check_sagerouter_launch_readiness.sh")
        landing = self.read_text("web", "src", "main.jsx")
        self.assertIn("Sage Router vs OpenRouter", page)
        self.assertIn('href="https://sagerouter.dev/compare/openrouter"', page)
        self.assertIn("Create hosted API key", page)
        self.assertIn("Bring your own authorized provider access", landing)
        self.assertIn("/compare/openrouter", landing)
        self.assertIn("https://sagerouter.dev/compare/openrouter", sitemap)
        self.assertIn("OpenRouter comparison: https://sagerouter.dev/compare/openrouter", llms)
        self.assertIn("OpenRouter alternative for agents", llms_full)
        self.assertIn("SAGEROUTER_MARKETING_BASE_URL", readiness)
        self.assertIn("marketing OpenRouter comparison page is live and in sitemap", readiness)

    def test_hosted_pricing_page_and_10k_mrr_plan_are_discoverable(self):
        page = self.read_public("pricing.html")
        sitemap = self.read_public("sitemap.xml")
        llms = self.read_public("llms.txt")
        llms_full = self.read_public("llms-full.txt")
        readiness = self.read_text("scripts", "check_sagerouter_launch_readiness.sh")
        launch_plan = self.read_text("docs", "saas-launch-10k-mrr.md")
        landing = self.read_text("web", "src", "main.jsx")
        readme = self.read_text("README.md")

        self.assertIn("Sage Router Hosted Pricing", page)
        self.assertIn("100 Lite, 200 Pro, and 50 Max customers is $10,200 MRR", page)
        self.assertIn("It does not grant unauthorized model access", page)
        self.assertIn("https://sagerouter.dev/pricing", sitemap)
        self.assertIn("Hosted pricing: https://sagerouter.dev/pricing", llms)
        self.assertIn("balanced path to $10k MRR", llms_full)
        self.assertIn("/pricing", landing)
        self.assertIn("endpoint, limit, and launch metadata", readiness)
        self.assertIn("marketing hosted pricing page is live and in sitemap", readiness)
        self.assertIn("Target: `$10,000 MRR`", launch_plan)
        self.assertIn("docs/saas-launch-10k-mrr.md", readme)


if __name__ == "__main__":
    unittest.main()
