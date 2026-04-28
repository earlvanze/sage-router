import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const integrations = [
  'OpenClaw',
  'Codex CLI',
  'Claude Code',
  'Cursor',
  'Aider',
  'Continue',
  'OpenHands',
  'Ollama',
  'NVIDIA NIM',
  'OpenAI SDKs',
  'Anthropic clients',
];

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

const comparison = [
  ['Default posture', 'Local-first router you operate', 'Hosted marketplace/proxy'],
  ['Access model', 'Your own authorized providers, subscriptions, API keys, and local models', 'Marketplace access through a third-party proxy'],
  ['Key custody', 'Local by default. Provider keys stay under your control.', 'Provider credentials and requests flow through the marketplace layer'],
  ['Primary job', 'Routing infrastructure for serious agent workflows', 'Model discovery, purchasing, and proxy access'],
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
            <a href="#compare">Compare</a>
            <a href="https://github.com/earlvanze/sage-router">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid" id="top">
          <div className="heroCopy">
            <p className="eyebrow">Open-source • local-first • agent-focused</p>
            <h1>Smarter model routing for serious AI agents.</h1>
            <p className="subhero">
              One local-first endpoint for OpenClaw, Codex, Claude Code, Cursor, Aider, Continue,
              OpenHands, and the tools your agents already use. Make your agents’ engine
              hot-swappable, across authorized providers and local/cloud models.
            </p>
            <div className="heroActions">
              <a className="button primary" href="https://github.com/earlvanze/sage-router">
                View on GitHub
              </a>
              <a className="button secondary" href="#docs">
                Read docs
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
python3 router.py --port 8788

# connect an OpenAI-compatible tool
export OPENAI_BASE_URL=http://localhost:8788/v1
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

      <section className="section integrations">
        <div className="sectionHeader">
          <p className="eyebrow">Integrations</p>
          <h2>Designed for agent harnesses and developer AI tools.</h2>
        </div>
        <div className="logoGrid">
          {integrations.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section compare" id="compare">
        <div className="sectionHeader">
          <p className="eyebrow">Careful comparison</p>
          <h2>Sage Router is not a marketplace.</h2>
          <p>
            OpenRouter is useful as a marketplace and hosted proxy. Sage Router is local-first routing
            infrastructure for your own authorized access, built for people who want control over key
            custody, failover, policies, and agent reliability.
          </p>
        </div>
        <div className="comparisonTable" role="table" aria-label="Sage Router compared with OpenRouter">
          <div className="tableRow tableHead" role="row">
            <span>Category</span><span>Sage Router</span><span>OpenRouter-style marketplace</span>
          </div>
          {comparison.map(([category, sage, market]) => (
            <div className="tableRow" role="row" key={category}>
              <span>{category}</span><span>{sage}</span><span>{market}</span>
            </div>
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
              Configure authorized access for OpenAI, Anthropic, Gemini, Ollama, OpenRouter-compatible
              endpoints, local models, and other BYOK providers, then expose a stable router endpoint
              to agents and developer tools.
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
            <h3>OpenRouter alternative for teams using their own subscriptions</h3>
            <p>
              Sage Router is not a model marketplace. It is routing infrastructure for teams that
              already have authorized provider accounts, subscriptions, API keys, local models, or
              approved proxy endpoints and want smarter selection/fallback.
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
          <p className="eyebrow">FAQ for humans, agents, and search</p>
          <h2>Answers for AI model routing discovery.</h2>
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
            <summary>Is Sage Router an OpenRouter alternative?</summary>
            <p>Yes, for teams that want local-first routing infrastructure using their own authorized access. OpenRouter is a hosted marketplace/proxy. Sage Router is not a marketplace and does not resell model access, pool accounts, or bypass provider terms.</p>
          </details>
          <details>
            <summary>Does Sage Router work with OpenAI-compatible and Anthropic-compatible clients?</summary>
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

      <section className="section docs" id="docs">
        <div className="sectionHeader">
          <p className="eyebrow">Developer-first docs</p>
          <h2>Connect the tools your agents already use.</h2>
          <p>
            Start with practical guides for Codex, Claude Code, OpenClaw, Ollama, NVIDIA NIM,
            OpenAI-compatible clients, and BYOK fallback routes.
          </p>
        </div>
        <div className="docsGrid">
          {["Use Sage Router with Codex", "Use Sage Router with Claude Code", "Use Sage Router with OpenClaw", "Use Sage Router with Ollama/Ollama Cloud", "Use Sage Router with NVIDIA NIM", "Use Sage Router as an OpenAI-compatible endpoint", "Use Sage Router for BYOK provider fallback"].map((item) => (
            <a key={item} href="https://github.com/earlvanze/sage-router#readme">{item}</a>
          ))}
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

      <footer>
        <span>© Sage Router</span>
        <a href="https://github.com/earlvanze/sage-router">GitHub</a>
        <a href="https://github.com/earlvanze/sage-router#readme">Docs</a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
