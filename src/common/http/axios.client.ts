import axios, { AxiosInstance } from "axios";
import { getScraperHeaders } from "./headers";

export function createAxiosClient(
    baseUrl: string,
    siteUrl?: string
): AxiosInstance {
    // Browsers cannot override Origin/Referer/User-Agent, and extra headers like
    // Pragma or Sec-GPC fail upstream CORS preflight with Axios "Network Error".
    const headers =
        typeof window !== "undefined"
            ? { Accept: "application/json, text/plain, */*" }
            : getScraperHeaders(siteUrl);

    return axios.create({
        baseURL: baseUrl,
        timeout: 30000,
        headers,
    });
}
