import { createServerOnlyFn } from "@tanstack/react-start";

const DEFAULT_API_URL = "https://api.shinigami.io/v1";

function resolveApiUrl(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) return DEFAULT_API_URL;

  // The old api.shngm.io origin is decommissioned and answers 502.
  if (configured.includes("api.shngm.io")) {
    console.warn(
      `[Env] API_URL points to the retired api.shngm.io host. Using ${DEFAULT_API_URL} instead.`
    );
    return DEFAULT_API_URL;
  }

  return configured.replace(/\/+$/, "");
}

export const getEnv = createServerOnlyFn(() => {
  return {
    API_URL: resolveApiUrl(process.env.API_URL),
    REDIS_URL: process.env.REDIS_URL || "",
  };
});

export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL_CLIENT);
