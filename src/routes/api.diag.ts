import { createFileRoute } from "@tanstack/react-router";
import { getEnv } from "@/common/utils/env";
import { getScraperHeaders } from "@/common/http/headers";

const DIAG_KEY = "diag-7f3a91c4";

const PROBES = [
  "/manga/list?offset=0&limit=5&genre=horror&sort=latest&sort_order=desc",
  "/manga/detail/c0f1d049-ff7f-474d-8c6a-3a55e4c44147",
  "/taxonomy/list?type=genre&offset=0&limit=5",
];

export const Route = createFileRoute("/api/diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url);
        if (searchParams.get("key") !== DIAG_KEY) {
          return new Response("Not found", { status: 404 });
        }

        const rawApiUrl = getEnv().API_URL;
        const base = (rawApiUrl || "https://api.shinigami.io/v1").replace(/\/+$/, "");
        const results = [];

        for (const path of PROBES) {
          const url = `${base}${path}`;
          try {
            const res = await fetch(url, {
              headers: getScraperHeaders("https://s1.shinigami.mx"),
            });
            const body = await res.text();
            results.push({
              url,
              status: res.status,
              server: res.headers.get("server"),
              cfRay: res.headers.get("cf-ray"),
              cfMitigated: res.headers.get("cf-mitigated"),
              cfCacheStatus: res.headers.get("cf-cache-status"),
              retryAfter: res.headers.get("retry-after"),
              body: body.slice(0, 400),
            });
          } catch (error) {
            results.push({
              url,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return Response.json({
          rawApiUrl,
          effectiveBase: base,
          nodeEnv: process.env.NODE_ENV,
          results,
        });
      },
    },
  },
});
