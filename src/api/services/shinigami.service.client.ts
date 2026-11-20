import { API_URL } from "@/common/utils/env";
import { ShinigamiService } from "./shinigami.service";

// The browser calls the upstream API directly: Netlify's function egress is
// blocked by the upstream WAF, while the API sends
// `access-control-allow-origin: *` and accepts the request from the visitor.
export const clientShinigamiService = new ShinigamiService(API_URL);
