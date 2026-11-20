const API_ORIGIN = "https://api.shinigami.io/v1";

// Netlify Functions egress is blocked by the upstream WAF. Edge Functions run
// on a different network, so the SSR handler reaches the API through this hop.
export default async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/shinigami/, "");
  const target = `${API_ORIGIN}${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("Origin", "https://s1.shinigami.mx");
  headers.set("Referer", "https://s1.shinigami.mx/");
  headers.set("Accept", "application/json, text/plain, */*");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const config = { path: "/api/shinigami/*" };
