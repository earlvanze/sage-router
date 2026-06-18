export default {
  async fetch(request, env) {
    const origin = (env.SAGE_ROUTER_EDGE_ORIGIN || "").replace(/\/$/, "");
    if (!origin) {
      return Response.json({ error: "SAGE_ROUTER_EDGE_ORIGIN is not configured" }, { status: 503 });
    }

    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, origin);
    const headers = new Headers(request.headers);
    headers.delete("Host");
    headers.set("X-Sage-Router-Cloudflare-Edge", "api.sagerouter.dev");
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;

    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    const outHeaders = new Headers(response.headers);
    outHeaders.set("X-Sage-Router-Api-Origin", origin);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};
