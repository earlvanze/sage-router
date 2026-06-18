const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_CACHE_SECONDS = 8;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

let cachedHealth = {
  expiresAt: 0,
  checks: [],
};

function parseOrigins(env) {
  const raw = (env.SAGE_ROUTER_ORIGINS || "").trim();
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("SAGE_ROUTER_ORIGINS must be a JSON array");
    }
    return parsed.map(normalizeOrigin);
  }

  const legacy = (env.SAGE_ROUTER_EDGE_ORIGIN || "").trim();
  if (legacy) {
    return [normalizeOrigin({ name: "tailnet-edge", url: legacy, healthPath: "/edge/health" })];
  }

  throw new Error("SAGE_ROUTER_ORIGINS is not configured");
}

function normalizeOrigin(origin) {
  if (!origin || !origin.url) {
    throw new Error("each origin needs a url");
  }
  const url = new URL(origin.url);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return {
    name: origin.name || url.hostname,
    url: url.toString().replace(/\/$/, ""),
    healthPath: origin.healthPath || "/health",
    timeoutMs: Number(origin.timeoutMs || DEFAULT_TIMEOUT_MS),
  };
}

function originTarget(origin, incomingUrl) {
  return new URL(incomingUrl.pathname + incomingUrl.search, origin.url);
}

async function timedFetch(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return {
      response,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkOrigin(origin) {
  const healthUrl = new URL(origin.healthPath, origin.url);
  try {
    const result = await timedFetch(healthUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
        "user-agent": "sage-router-api-edge/1.0",
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    }, origin.timeoutMs);

    await result.response.arrayBuffer();
    return {
      name: origin.name,
      url: origin.url,
      healthPath: origin.healthPath,
      healthy: result.response.status >= 200 && result.response.status < 500,
      status: result.response.status,
      latencyMs: result.latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: origin.name,
      url: origin.url,
      healthPath: origin.healthPath,
      healthy: false,
      status: 0,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: String(error && error.message ? error.message : error),
    };
  }
}

async function getHealth(env, force = false) {
  const now = Date.now();
  if (!force && cachedHealth.expiresAt > now && cachedHealth.checks.length) {
    return cachedHealth.checks;
  }

  const origins = parseOrigins(env);
  const checks = await Promise.all(origins.map(checkOrigin));
  cachedHealth = {
    checks,
    expiresAt: now + Number(env.SAGE_ROUTER_ORIGIN_CACHE_SECONDS || DEFAULT_CACHE_SECONDS) * 1000,
  };
  return checks;
}

async function chooseOrigin(env) {
  const origins = parseOrigins(env);
  const checks = await getHealth(env);
  const healthy = checks
    .filter((check) => check.healthy)
    .sort((a, b) => (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER));
  const selected = healthy[0];
  if (!selected) {
    return { origin: null, checks };
  }
  return {
    origin: origins.find((candidate) => candidate.name === selected.name && candidate.url === selected.url),
    checks,
  };
}

function responseJson(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function outboundHeaders(request, selectedOrigin) {
  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete("host");
  headers.set("x-sage-router-cloudflare-edge", "api.sagerouter.dev");
  headers.set("x-sage-router-origin", selectedOrigin.name);
  return headers;
}

export default {
  async fetch(request, env) {
    try {
      const incoming = new URL(request.url);
      if (incoming.pathname === "/edge/health") {
        const checks = await getHealth(env, incoming.searchParams.get("refresh") === "1");
        const healthy = checks
          .filter((check) => check.healthy)
          .sort((a, b) => (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER));
        return responseJson({
          status: healthy.length ? "ok" : "degraded",
          selected: healthy[0] || null,
          origins: checks,
        }, healthy.length ? 200 : 503);
      }

      const { origin, checks } = await chooseOrigin(env);
      if (!origin) {
        return responseJson({ error: "no healthy sage-router origins", origins: checks }, 503);
      }

      const target = originTarget(origin, incoming);
      const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
      const response = await timedFetch(target, {
        method: request.method,
        headers: outboundHeaders(request, origin),
        body,
        redirect: "manual",
      }, origin.timeoutMs);

      const headers = new Headers(response.response.headers);
      for (const header of HOP_BY_HOP_HEADERS) {
        headers.delete(header);
      }
      headers.set("x-sage-router-api-origin", origin.name);
      headers.set("x-sage-router-api-origin-url", origin.url);
      headers.set("x-sage-router-api-origin-latency-ms", String(response.latencyMs));
      return new Response(response.response.body, {
        status: response.response.status,
        statusText: response.response.statusText,
        headers,
      });
    } catch (error) {
      return responseJson({
        error: "sage-router api edge failed",
        detail: String(error && error.message ? error.message : error),
      }, 500);
    }
  },
};
