import type { QueryClient, QueryKey, QueryOptions } from "@tanstack/react-query";

/**
 * Loader-side fetch that never rejects. When the server cannot reach the
 * upstream API (Netlify function egress is blocked), the errored query is
 * dropped from the cache so the page renders its loading state instead of an
 * error panel, and the browser refetches through the client instance.
 */
export async function ensureQueryDataSafe<T>(
  queryClient: QueryClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: QueryOptions<T, Error, T, any> & { queryKey: QueryKey }
): Promise<T | null> {
  try {
    return await queryClient.ensureQueryData(options);
  } catch {
    queryClient.removeQueries({ queryKey: options.queryKey });
    return null;
  }
}
