#!/usr/bin/env python3
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HostedOnboardingTests(unittest.TestCase):
    def read_public(self, name):
        return (ROOT / "web" / "public" / name).read_text(encoding="utf-8")

    def test_account_page_has_explicit_email_signup(self):
        html = self.read_public("account.html")
        js = self.read_public("account.js")
        self.assertIn('id="password-signup"', html)
        self.assertIn("Create account", html)
        self.assertIn("sb.auth.signUp", js)
        self.assertIn("emailRedirectTo: `${window.location.origin}/account.html`", js)

    def test_account_page_has_stripe_billing_management(self):
        html = self.read_public("account.html")
        js = self.read_public("account.js")
        self.assertIn('id="stripe-portal"', html)
        self.assertIn("Manage billing", html)
        self.assertIn("api('/billing/stripe/portal'", js)
        self.assertIn("params.get('billing')", js)
        self.assertIn("billing === 'portal'", js)

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


if __name__ == "__main__":
    unittest.main()
