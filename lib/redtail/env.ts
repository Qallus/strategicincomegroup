// Redtail environments (from Redtail's partner welcome email).
//   Development (review): https://review.crm.redtailtechnology.com/api/public/v1
//   Production:           https://crm.redtailtechnology.com/api/public/v1
// Each environment has its own API Key and its own UserKey (UserKeys come from the trial /
// database you created in that environment). Redtail asks partners to do all development
// work in the review environment — bad PUT calls against production can corrupt live data.
//
// Pure helper (no server-only imports) so the client, the connection test and the dashboard
// status all pick the active environment the same way.

export type RedtailEnvironment = "development" | "production";

export const REDTAIL_BASE_URLS: Record<RedtailEnvironment, string> = {
  development: "https://review.crm.redtailtechnology.com/api/public/v1",
  production: "https://crm.redtailtechnology.com/api/public/v1",
};

export const REDTAIL_ENV_LABEL: Record<RedtailEnvironment, string> = {
  development: "Development (review)",
  production: "Production",
};

/** Credentials fields that hold each environment's keys. */
export const REDTAIL_FIELDS: Record<RedtailEnvironment, { apiKey: string; userKey: string }> = {
  development: { apiKey: "dev_api_key", userKey: "dev_user_key" },
  production: { apiKey: "prod_api_key", userKey: "prod_user_key" },
};

export type ResolvedRedtail = {
  environment: RedtailEnvironment;
  baseUrl: string;
  apiKey?: string;
  userKey?: string;
  username?: string;
  password?: string;
};

export function resolveRedtail(cfg: Record<string, string | undefined>): ResolvedRedtail {
  const environment: RedtailEnvironment = (cfg.environment ?? "").trim().toLowerCase() === "production" ? "production" : "development";
  const f = REDTAIL_FIELDS[environment];
  return {
    environment,
    baseUrl: (cfg.base_url?.trim() || REDTAIL_BASE_URLS[environment]).replace(/\/+$/, ""),
    apiKey: cfg[f.apiKey] || undefined,
    userKey: cfg[f.userKey] || undefined,
    username: cfg.username || undefined,
    password: cfg.password || undefined,
  };
}
