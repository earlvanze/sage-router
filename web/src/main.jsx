import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const steps = [
  {
    number: '01',
    title: 'Point tools at one endpoint',
    body: 'Use OpenAI-compatible, Anthropic-compatible, and local endpoints from the same router running on your machine or server.',
  },
  {
    number: '02',
    title: 'Connect your authorized providers',
    body: 'Bring your own API keys, subscriptions, local models, and team-approved access. Credentials stay under your custody by default.',
  },
  {
    number: '03',
    title: 'Route, fallback, and observe',
    body: 'Route by task, provider health, latency, capability, and policy. Fall back automatically and inspect what happened afterward.',
  },
];

function App() {
  return (
    <main>
      <section className="hero">
        <nav className="nav" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="Sage Router home">
            <span className="brandMark">S</span>
            <span>Sage Router</span>
          </a>
          <div className="navLinks">
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#automation">Automation</a>
            <a href="#analytics">Analytics</a>
            <a href="/compare/openrouter">Compare</a>
            <a href="/model-routing-calculator">Calculator</a>
            <a href="/pricing">Pricing</a>
            <a href="/status">Status</a>
            <a href="/analytics.html">Dashboard</a>
            <a href="/login.html">Login</a>
            <a href="#docs">Guides</a>
            <a href="#waitlist">Waitlist</a>
            <a href="https://github.com/earlvanze/sage-router">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid" id="top">
          <div className="heroCopy">
            <p className="eyebrow">Open-source • local-first • agent-focused</p>
            <h1>Smarter model routing for serious AI agents.</h1>
            <p className="subhero">
              One local-first endpoint for OpenClaw, Hermes, Pi agents, Codex, Claude Code, Cursor, Aider, Continue,
              OpenHands, and the tools your agents already use. Make your agents’ engine
              hot-swappable, across authorized providers and local/cloud models.
            </p>
            <div className="heroActions">
              <a className="button primary" href="https://github.com/earlvanze/sage-router">
                View on GitHub
              </a>
              <a className="button secondary" href="#waitlist">
                Join waitlist
              </a>
              <a className="button secondary" href="/analytics.html">
                View analytics dashboard
              </a>
              <a className="button secondary" href="/status">
                View public status
              </a>
              <a className="button secondary" href="/compare/openrouter">
                Compare OpenRouter
              </a>
              <a className="button secondary" href="/model-routing-calculator">
                Estimate routing savings
              </a>
              <a className="button secondary" href="/pricing">
                View pricing
              </a>
              <a className="button secondary" href="/login.html">
                Sign in
              </a>
            </div>
            <p className="complianceNote">
              Bring your own authorized provider access. Sage Router does not resell models, pool
              accounts, or bypass provider terms.
            </p>
          </div>

          <div className="terminalCard" aria-label="Sage Router quick start terminal example">
            <div className="terminalTop">
              <span></span><span></span><span></span>
            </div>
            <pre>{`# run the local router
python3 router.py --port 8790

# connect an OpenAI-compatible tool
export OPENAI_BASE_URL=http://localhost:8790/v1
export OPENAI_API_KEY=local-router

# Sage Router selects a route
route: codex-task → local/qwen-coder
fallback: openai/gpt-4.1 → anthropic/sonnet`}</pre>
          </div>
        </div>
      </section>

      <section className="section hotSwap" aria-label="Hot-swappable AI engine layer">
        <div>
          <p className="eyebrow">Hot-swappable model layer</p>
          <h2>Your agents’ engine is now hot-swappable.</h2>
        </div>
        <p>
          Swap models without rewiring your agents. Sage Router lets agent harnesses route and fail
          over between authorized providers, subscriptions, local models, and cloud engines, improving
          speed, reliability, and task fit when a model is slow, down, or wrong for the job.
        </p>
      </section>

      <section className="section intro">
        <div>
          <p className="eyebrow">Why it exists</p>
          <h2>Built when basic routing stopped being enough.</h2>
        </div>
        <p>
          OpenClaw’s built-in model routing was not smart enough for serious agent workflows, so we
          built a better layer: routing across your own providers, subscriptions, API keys, and local
          models with fewer brittle tool-by-tool configs.
        </p>
      </section>

      <section className="section cards" aria-label="Core product promises">
        <article>
          <h3>Route across what you already have</h3>
          <p>
            Use OpenAI, Anthropic, Gemini, Grok, NVIDIA NIM / NVIDIA Cloud, GitHub Copilot-compatible endpoints, Ollama, and
            other local or authorized providers behind one policy-aware gateway.
          </p>
        </article>
        <article id="security">
          <h3>Keys stay local by default</h3>
          <p>
            The default architecture keeps provider credentials on your machine or server. Routing
            policy and fallback behavior stay inspectable instead of disappearing inside a black-box proxy.
          </p>
        </article>
        <article>
          <h3>Agent-grade fallback</h3>
          <p>
            Route for coding, reasoning, chat, refactors, documentation, health, latency, and model
            capability, then fall back when providers fail or rate limit.
          </p>
        </article>
      </section>

      <section className="section how" id="how">
        <div className="sectionHeader">
          <p className="eyebrow">How it works</p>
          <h2>One endpoint. Your policies. Better routes.</h2>
        </div>
        <div className="steps">
          {steps.map((step) => (
            <article className="step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>


      <section className="section analytics" id="analytics">
        <div className="sectionHeader">
          <p className="eyebrow">Paid performance intelligence</p>
          <h2>Free routing. Paid analytics that prove the best route.</h2>
          <p>
            When teams bring their own subscriptions, they are not paying Sage for model access. They are paying
            for live provider intelligence: latency trends, error rates, fallback frequency, best-model recommendations,
            and alerts when a provider degrades.
          </p>
          <p><a className="inlineLink" href="/analytics.html">Open the private analytics dashboard →</a></p>
          <p><a className="inlineLink" href="/compare/openrouter">Read the Sage Router vs OpenRouter comparison →</a></p>
          <p><a className="inlineLink" href="/model-routing-calculator">Estimate routing savings for one workflow →</a></p>
          <p><a className="inlineLink" href="/pricing">See hosted routing pricing and plan limits →</a></p>
        </div>
        <div className="cards">
          <article>
            <h3>Model rankings over time</h3>
            <p>See which model is fastest and most reliable by task type, provider, route mode, and time window.</p>
          </article>
          <article>
            <h3>Degradation detection</h3>
            <p>Spot rate limits, timeouts, empty outputs, and provider slowdowns before they break agent workflows.</p>
          </article>
          <article>
            <h3>Routing recommendations</h3>
            <p>Turn telemetry into policy suggestions: default models, fallback order, budget caps, and providers to cancel.</p>
          </article>
        </div>
      </section>

      <section className="section integrations" id="docs">
        <div className="sectionHeader">
          <p className="eyebrow">Integrations</p>
          <h2>Connect the tools your agents already use.</h2>
          <p>
            One clean guide grid for agent harnesses, local runtimes, cloud APIs, SDK-compatible clients,
            and harness fallback routes.
          </p>
        </div>
        <div className="docsGrid">
          {[
            ['Codex', 'Codex CLI via the OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/codex.md'],
            ['Claude Code', 'Anthropic Messages routing with fallback behind one endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/claude-code.md'],
            ['OpenClaw', 'Route OpenClaw agents across local, cloud, and authorized providers.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openclaw.md'],
            ['Hermes', 'Operator-agent routing for status, review, and escalation workflows.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/hermes.md'],
            ['Pi agents', 'Route Pi agents through one OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/pi.md'],
            ['Cursor', 'Use OpenAI-compatible or Anthropic-compatible routing from Cursor.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/cursor.md'],
            ['Ollama / Cloud', 'Local Ollama plus :cloud model routing through the local runtime.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/ollama.md'],
            ['NVIDIA NIM', 'NVIDIA-backed inference as a BYOK provider route.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/nvidia-nim.md'],
            ['Aider', 'Aider via the OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/aider.md'],
            ['Continue', 'Continue configured against the Sage Router endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/continue.md'],
            ['OpenHands', 'OpenHands through one policy-routed OpenAI-compatible endpoint.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openhands.md'],
            ['OpenAI clients', 'Drop-in base URL for SDKs and similar tools.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/openai-compatible.md'],
            ['Anthropic clients', 'Claude-style /v1/messages routing with local policy and fallback.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/anthropic-compatible.md'],
            ['Harness fallback', 'Policy-based failover for agent harnesses across your authorized providers.', 'https://github.com/earlvanze/sage-router/blob/master/docs/integrations/harness-fallback.md'],
          ].map(([title, body, href]) => (
            <a className="guideCard" key={title} href={href} aria-label={body}>
              <strong>{title}</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="section searchIntents" id="automation">
        <div className="sectionHeader">
          <p className="eyebrow">Model selection automation</p>
          <h2>How to automate AI model selection.</h2>
          <p>
            Put Sage Router between your agents and model providers. Your tools send requests to one
            local endpoint, while routing policy selects the right model by task type, required
            capability, provider health, latency, fallback order, and local-vs-cloud preference.
          </p>
        </div>
        <div className="intentGrid">
          <article>
            <h3>Route requests across providers</h3>
            <p>
              Configure authorized access for OpenAI, Anthropic, Gemini, NVIDIA NIM, Ollama,
              local models, and other BYOK providers, then expose a stable router endpoint to agents
              and developer tools.
            </p>
          </article>
          <article>
            <h3>Local-first BYOK model routing for AI agents</h3>
            <p>
              Keep provider credentials on your machine or server by default. Sage Router gives teams
              routing policy, health checks, and fallback behavior without default custody of customer
              provider keys.
            </p>
          </article>
          <article>
            <h3>Policy-based routing for teams using their own providers</h3>
            <p>
              Sage Router is routing infrastructure for teams that already have authorized provider
              accounts, subscriptions, API keys, local models, or approved proxy endpoints and want
              smarter selection and fallback.
            </p>
          </article>
          <article>
            <h3>Local + Ollama Cloud hybrid routing</h3>
            <p>
              The router supports local Ollama and Ollama Cloud today through your local Ollama
              runtime. Sage Router discovers available cloud models, can auto-pull matching
              <code>:cloud</code> models, and routes between them and other cloud APIs with
              health-aware fallback.
            </p>
          </article>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="sectionHeader">
          <p className="eyebrow">FAQ</p>
          <h2>Answers for AI model routing.</h2>
        </div>
        <div className="faqList">
          <details open>
            <summary>What is an AI model router?</summary>
            <p>An AI model router is middleware that receives LLM requests and selects which model or provider should handle them based on policy, task type, availability, latency, cost, context size, capability, or fallback rules.</p>
          </details>
          <details>
            <summary>How do I automate model/provider selection for AI agents?</summary>
            <p>Run Sage Router locally, configure your authorized providers and local models, then point OpenAI-compatible or Anthropic-compatible tools at the Sage Router endpoint. The router performs model selection and fallback without every tool needing its own routing logic.</p>
          </details>
          <details>
            <summary>Does Sage Router work with OpenAI-compatible and Anthropic clients?</summary>
            <p>Yes. The repo documents OpenAI-compatible chat completions and Anthropic-compatible messages endpoints, plus Google/Gemini-style endpoints for supported tools.</p>
          </details>
          <details>
            <summary>Can Sage Router route between Ollama, Ollama Cloud, and cloud APIs?</summary>
            <p>Sage Router supports local Ollama and Ollama Cloud today through Ollama running locally. It discovers available <code>:cloud</code> models, can auto-pull discovered cloud models, and routes between local Ollama, Ollama Cloud, NVIDIA NIM, and other cloud APIs according to policy and health.</p>
          </details>
          <details>
            <summary>Where do provider API keys live?</summary>
            <p>By default, provider credentials live locally on the customer machine or server. Sage Router is designed so routing and fallback do not require default custody of customer provider keys.</p>
          </details>
        </div>
      </section>

      <section className="section presets" id="presets">
        <div className="sectionHeader">
          <p className="eyebrow">Provider profiles</p>
          <h2>Routing presets for agent jobs.</h2>
          <p>
            Provider profiles turn routing expertise into reusable defaults: best model for coding,
            best model for fast chat, best local fallback, and hybrid local/cloud routes.
          </p>
        </div>
        <div className="presetGrid">
          <article><h3>Best model for coding</h3><p>Route coding, refactor, and debugging tasks to coding-strong models with sensible fallbacks.</p></article>
          <article><h3>Best model for fast chat</h3><p>Prefer low-latency models for lightweight agent chatter, planning, and status checks.</p></article>
          <article><h3>Best local fallback</h3><p>Keep agents moving with local models when cloud providers are down, slow, or rate limited.</p></article>
          <article><h3>Hybrid local/cloud routes</h3><p>Blend local Ollama routes, Ollama Cloud models exposed through your local Ollama runtime, cloud APIs, and NVIDIA NIM endpoints behind one endpoint.</p></article>
        </div>
      </section>


      <section className="section waitlistSection" id="waitlist">
        <div className="sectionHeader">
          <p className="eyebrow">Waitlist</p>
          <h2>Get Sage Router updates.</h2>
          <p>Join the waitlist for integration updates, release notes, and early hosted reliability testing.</p>
        </div>
        <form className="waitlistForm" onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          const status = form.querySelector('[data-status]');
          status.textContent = 'Submitting...';
          try {
            const response = await fetch('/api/waitlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Submit failed');
            form.reset();
            status.textContent = 'You are on the list.';
          } catch (error) {
            status.textContent = 'Could not submit. Try again or use GitHub for now.';
          }
        }}>
          <input name="website" tabIndex="-1" autoComplete="off" className="honeypot" aria-hidden="true" />
          <input name="email" type="email" placeholder="you@example.com" required />
          <input name="company" type="text" placeholder="Company or project" />
          <button type="submit">Join waitlist</button>
          <p data-status></p>
        </form>
      </section>

      <footer>
        <span>© Sage Router</span>
        <a href="https://github.com/earlvanze/sage-router">GitHub</a>
        <a href="/login.html">Login</a>
        <a href="/pricing">Pricing</a>
        <a href="/compare/openrouter">Compare OpenRouter</a>
        <a href="/model-routing-calculator">Calculator</a>
        <a href="/status">Status</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/acceptable-use">Acceptable Use</a>
        <a href="https://github.com/earlvanze/sage-router#readme">Docs</a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
