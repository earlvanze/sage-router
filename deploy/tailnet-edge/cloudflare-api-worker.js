const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_CACHE_SECONDS = 8;
const PUBLIC_EDGE_HEALTH_ERROR = "origin health did not prove public edge controls";
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

function truthyEnv(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function privateHostname(hostname) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname);
}

function originKind(originUrl) {
  try {
    const hostname = new URL(originUrl).hostname.toLowerCase();
    if (hostname.endsWith(".ts.net")) {
      return "tailnet";
    }
    if (privateHostname(hostname)) {
      return "private";
    }
    if (hostname.endsWith(".run.app") || hostname.includes(".cloudfunctions.") || hostname.includes(".googleapis.")) {
      return "cloud fallback";
    }
    if (hostname.endsWith("sagerouter.dev")) {
      return "public edge";
    }
    return "public origin";
  } catch (_error) {
    return "unknown";
  }
}

function publicOriginId(index) {
  return `origin-${index + 1}`;
}

function publicOriginSnapshot(check, index) {
  return {
    id: publicOriginId(index),
    originKind: originKind(check.url),
    healthy: check.healthy,
    status: check.status,
    latencyMs: check.latencyMs,
    checkedAt: check.checkedAt,
    error: check.error || null,
  };
}

function publicOriginsSnapshot(checks) {
  return checks.map(publicOriginSnapshot);
}

function selectedOriginId(checks, selected) {
  if (!selected) {
    return null;
  }
  const index = checks.findIndex((check) => check.name === selected.name && check.url === selected.url);
  return index >= 0 ? publicOriginId(index) : null;
}

function hasRawOriginUrl(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, "url") || Object.prototype.hasOwnProperty.call(value, "healthPath")) {
    return true;
  }
  return Object.values(value).some((item) => {
    if (Array.isArray(item)) {
      return item.some(hasRawOriginUrl);
    }
    return hasRawOriginUrl(item);
  });
}

function publicEdgeHealthSatisfied(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const enforcement = payload.enforcement || {};
  const failover = payload.failover || {};
  const retryStatuses = Array.isArray(failover.retryStatuses) ? failover.retryStatuses : [];
  return payload.status === "ok"
    && payload.authMode === "supabase"
    && enforcement.rateLimitEnabled === true
    && enforcement.authAttemptRateLimitEnabled === true
    && Number(enforcement.authAttemptRateLimit || 0) > 0
    && enforcement.quotaEnabled === true
    && Number(enforcement.apiKeyAuthCacheSeconds) === 0
    && enforcement.corsWildcardAllowed === false
    && enforcement.corsExplicitOriginRequired === true
    && Number(enforcement.corsAllowedOriginsCount || 0) > 0
    && failover.mode === "lowest-latency-healthy"
    && failover.retryEnabled === true
    && retryStatuses.includes(502)
    && retryStatuses.includes(503)
    && retryStatuses.includes(504)
    && failover.retryHeader === "X-Sage-Router-Retry-Count"
    && !hasRawOriginUrl(payload.upstreams || [])
    && !hasRawOriginUrl(payload.controlPlane || {});
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

async function checkOrigin(origin, requirePublicEdgeHealth) {
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

    const body = await result.response.text();
    let health = null;
    try {
      health = body ? JSON.parse(body) : null;
    } catch (_error) {
      health = null;
    }
    const statusHealthy = result.response.status >= 200 && result.response.status < 500;
    const publicEdgeHealthy = !requirePublicEdgeHealth || publicEdgeHealthSatisfied(health);
    return {
      name: origin.name,
      url: origin.url,
      healthPath: origin.healthPath,
      healthy: statusHealthy && publicEdgeHealthy,
      status: result.response.status,
      latencyMs: result.latencyMs,
      checkedAt: new Date().toISOString(),
      error: statusHealthy && !publicEdgeHealthy ? PUBLIC_EDGE_HEALTH_ERROR : null,
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
  const requirePublicEdgeHealth = truthyEnv(env.SAGE_ROUTER_REQUIRE_PUBLIC_EDGE_HEALTH, true);
  const checks = await Promise.all(origins.map((origin) => checkOrigin(origin, requirePublicEdgeHealth)));
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
  const selectedId = selectedOriginId(checks, selected);
  return {
    origin: origins.find((candidate) => candidate.name === selected.name && candidate.url === selected.url),
    checks,
    originId: selectedId,
    originKind: originKind(selected.url),
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
        const selectedId = selectedOriginId(checks, healthy[0]);
        return responseJson({
          status: healthy.length ? "ok" : "degraded",
          selected: selectedId,
          selectedOriginId: selectedId,
          origins: publicOriginsSnapshot(checks),
        }, healthy.length ? 200 : 503);
      }

      const { origin, checks, originId, originKind: selectedKind } = await chooseOrigin(env);
      if (!origin) {
        return responseJson({ error: "no healthy sage-router origins", origins: publicOriginsSnapshot(checks) }, 503);
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
      headers.set("x-sage-router-api-origin", originId || "origin-unknown");
      headers.set("x-sage-router-api-origin-kind", selectedKind || "unknown");
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
