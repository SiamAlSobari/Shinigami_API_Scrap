import { describe, expect, it, vi } from "vitest";
import { createAxiosClient } from "./axios.client";

describe("createAxiosClient", () => {
  it("omits non-CORS-safelisted headers in browser environments", () => {
    vi.stubGlobal("window", {});
    try {
      const client = createAxiosClient("https://api.shinigami.io/v1", "https://s1.shinigami.mx");
      const common = client.defaults.headers.common as Record<string, unknown>;
      const top = client.defaults.headers as Record<string, unknown>;

      expect(top.Accept ?? common.Accept).toBe("application/json, text/plain, */*");
      expect(top.Pragma).toBeUndefined();
      expect(top["Sec-GPC"]).toBeUndefined();
      expect(top.DNT).toBeUndefined();
      expect(top.Origin).toBeUndefined();
      expect(top.Referer).toBeUndefined();
      expect(top["User-Agent"]).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("includes scraper headers in server environments", () => {
    vi.stubGlobal("window", undefined);
    try {
      const client = createAxiosClient("https://api.shinigami.io/v1", "https://s1.shinigami.mx");
      const headers = client.defaults.headers as Record<string, unknown>;

      expect(headers.Origin).toBe("https://s1.shinigami.mx");
      expect(headers.Referer).toBe("https://s1.shinigami.mx/");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
