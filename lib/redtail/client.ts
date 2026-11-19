// Redtail CRM API client (scaffolding for the Phase 3 sync — see BUILD_PLAN.md).
//
// Auth (Redtail public API v1):
//   - UserKey auth (preferred):  Authorization: Userkeyauth base64(API_KEY:USER_KEY)
//   - Basic auth (bootstrap):    Authorization: Basic base64(API_KEY:USERNAME:PASSWORD)
//     GET /authentication with Basic auth returns the user key to store in REDTAIL_USER_KEY.
// Confirm endpoint shapes against SIG's Redtail API documentation before relying on fields.

export type RedtailConfig = {
  baseUrl: string;
  apiKey: string;
  userKey?: string;
  username?: string;
  password?: string;
};

export function redtailConfig(env: NodeJS.ProcessEnv = process.env): RedtailConfig {
  const baseUrl = (env.REDTAIL_API_BASE_URL || "https://review.crm.redtailtechnology.com/api/public/v1").replace(/\/+$/, "");
  const apiKey = env.REDTAIL_API_KEY || "";
  if (!apiKey) throw new Error("REDTAIL_API_KEY is not set.");
  return { baseUrl, apiKey, userKey: env.REDTAIL_USER_KEY || undefined, username: env.REDTAIL_USERNAME || undefined, password: env.REDTAIL_PASSWORD || undefined };
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

export function authHeader(cfg: RedtailConfig, mode: "userkey" | "basic" = cfg.userKey ? "userkey" : "basic") {
  if (mode === "userkey") {
    if (!cfg.userKey) throw new Error("REDTAIL_USER_KEY is not set.");
    return `Userkeyauth ${b64(`${cfg.apiKey}:${cfg.userKey}`)}`;
  }
  if (!cfg.username || !cfg.password) throw new Error("REDTAIL_USERNAME / REDTAIL_PASSWORD are required for basic auth.");
  return `Basic ${b64(`${cfg.apiKey}:${cfg.username}:${cfg.password}`)}`;
}

/** GET a Redtail endpoint with retry on 429/5xx (respecting Retry-After). Read-only by design for now. */
export async function redtailGet<T = unknown>(
  path: string,
  params: Record<string, string | number> = {},
  cfg: RedtailConfig = redtailConfig(),
  mode?: "userkey" | "basic",
): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: authHeader(cfg, mode), Accept: "application/json" } });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Redtail ${res.status} ${res.statusText} on ${url.pathname}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }
  throw new Error(`Redtail request kept failing: ${url.pathname}`);
}
