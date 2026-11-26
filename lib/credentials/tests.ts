import "server-only";
import { createSign } from "node:crypto";
import { CUSTOM_PREFIX } from "./catalog";
import { getCustomDefinition, getProviderConfig } from "./server";
import { REDTAIL_ENV_LABEL, REDTAIL_FIELDS, resolveRedtail } from "@/lib/redtail/env";

// "Test connection" checks — lightweight, read-only calls with a 10-second limit. A result
// message never contains a credential value (values are scrubbed before returning).

export type TestResult = {
  ok: boolean;
  message: string;
  /**
   * Server-only follow-up for the test route: values to save (encrypted) and fields to clear.
   * Used by Redtail to store a freshly fetched UserKey and drop the password. The route strips
   * this before responding — it never reaches the browser.
   */
  persist?: { values: Record<string, string>; clear: string[] };
};

const TIMEOUT_MS = 10_000;
type Config = Record<string, string | undefined>;

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

async function bodySnippet(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const e = (j.error ?? j.message ?? j.error_description ?? j.detail) as unknown;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
  } catch {
    /* not json */
  }
  return text.replace(/\s+/g, " ").slice(0, 160);
}

async function expectOk(res: Response, okMessage: string): Promise<TestResult> {
  if (res.ok) return { ok: true, message: okMessage };
  return { ok: false, message: `HTTP ${res.status}: ${await bodySnippet(res)}`.trim() };
}

const need = (cfg: Config, ...keys: string[]): string | null => {
  const missing = keys.filter((k) => !cfg[k]);
  return missing.length ? `Missing ${missing.join(", ")}.` : null;
};

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function bearerModels(base: string, key: string, label: string, headers: Record<string, string> = { Authorization: `Bearer ${key}` }) {
  const res = await call(`${base.replace(/\/+$/, "")}/models`, { headers });
  if (!res.ok) return expectOk(res, "");
  const data = (await res.json().catch(() => ({}))) as { data?: unknown[] };
  return { ok: true, message: `${label} key works${Array.isArray(data.data) ? ` — ${data.data.length} models available` : ""}.` };
}

async function reachability(url: string | undefined, token: string | undefined): Promise<TestResult> {
  if (!url) return { ok: false, message: "Missing URL." };
  const res = await call(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 401 || res.status === 403) return { ok: false, message: `Reached the service but it refused the token (HTTP ${res.status}).` };
  if (res.status >= 500) return { ok: false, message: `Service error (HTTP ${res.status}).` };
  return { ok: true, message: `Reachable (HTTP ${res.status}).` };
}

const TESTS: Record<string, (cfg: Config) => Promise<TestResult>> = {
  async resend(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    const res = await call("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${cfg.api_key}` } });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { data?: { name?: string; status?: string }[] };
      const verified = (data.data ?? []).filter((d) => d.status === "verified").map((d) => d.name).filter(Boolean);
      return { ok: true, message: `Key works${verified.length ? ` — verified: ${verified.join(", ")}` : ""}.` };
    }
    const snippet = await bodySnippet(res);
    // A sending-only key can't list domains but is valid for sending.
    if (res.status === 401 && /restricted/i.test(snippet)) return { ok: true, message: "Key works (sending-only access)." };
    return { ok: false, message: `HTTP ${res.status}: ${snippet}` };
  },
  async twilio(cfg) {
    const miss = need(cfg, "account_sid", "auth_token");
    if (miss) return { ok: false, message: miss };
    const res = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.account_sid!)}.json`, {
      headers: { Authorization: `Basic ${b64(`${cfg.account_sid}:${cfg.auth_token}`)}` },
    });
    if (!res.ok) return expectOk(res, "");
    const data = (await res.json().catch(() => ({}))) as { status?: string; friendly_name?: string };
    return { ok: true, message: `Connected to ${data.friendly_name ?? "the account"} (${data.status ?? "unknown status"}).` };
  },
  async openai(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    return bearerModels(cfg.base_url || "https://api.openai.com/v1", cfg.api_key!, "OpenAI");
  },
  async anthropic(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    return bearerModels("https://api.anthropic.com/v1", cfg.api_key!, "Anthropic", { "x-api-key": cfg.api_key!, "anthropic-version": "2023-06-01" });
  },
  async xai(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    return bearerModels("https://api.x.ai/v1", cfg.api_key!, "xAI");
  },
  async openrouter(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    const base = (cfg.base_url || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const res = await call(`${base}/key`, { headers: { Authorization: `Bearer ${cfg.api_key}` } });
    return expectOk(res, "OpenRouter key works.");
  },
  async redtail(cfg) {
    // Active environment's base URL + keys (Development by default).
    const r = resolveRedtail(cfg);
    const env = REDTAIL_ENV_LABEL[r.environment];
    const fields = REDTAIL_FIELDS[r.environment];
    if (!r.apiKey) return { ok: false, message: `Add the ${env} API Key (from Redtail's partner welcome email).` };

    // Username + password present → Redtail's UserKey retrieval method (Basic auth on
    // /authentication). Save the returned UserKey encrypted and clear the password.
    if (r.username && r.password && !r.userKey) {
      const res = await call(`${r.baseUrl}/authentication`, {
        headers: { Authorization: `Basic ${b64(`${r.apiKey}:${r.username}:${r.password}`)}`, Accept: "application/json" },
      });
      if (!res.ok) {
        // Include Redtail's own reason (e.g. invalid API key vs invalid user credentials).
        const reason = (await bodySnippet(res)).trim();
        const hint =
          res.status === 401
            ? " Check: (1) the username — not the email — and password sign in at review.crm.redtailtechnology.com; (2) the Development API Key; (3) Redtail has activated this account for API access (email partnersupport@redtailtechnology.com with the username)."
            : "";
        return { ok: false, message: `${env}: authentication failed (HTTP ${res.status})${reason ? ` — Redtail says: "${reason}"` : ""}.${hint}` };
      }
      const data = (await res.json().catch(() => ({}))) as { authenticated_user?: { user_key?: string }; user_key?: string; UserKey?: string };
      const userKey = data.authenticated_user?.user_key ?? data.user_key ?? data.UserKey;
      if (!userKey) return { ok: false, message: `${env}: signed in, but Redtail's response had no UserKey.` };
      return {
        ok: true,
        message: `${env}: signed in. UserKey retrieved and saved (encrypted); the password was cleared.`,
        persist: { values: { [fields.userKey]: userKey }, clear: ["password"] },
      };
    }

    if (r.userKey) {
      const res = await call(`${r.baseUrl}/contacts?page=1`, {
        headers: { Authorization: `Userkeyauth ${b64(`${r.apiKey}:${r.userKey}`)}`, Accept: "application/json" },
      });
      if (res.status === 401) return { ok: false, message: `${env}: Redtail rejected the API Key + UserKey (HTTP 401). Keys from one environment don't work in the other.` };
      return expectOk(res, `${env}: connected — API Key + UserKey work and contacts are readable.`);
    }
    return { ok: false, message: `${env}: add the trial's Redtail username and password, then Test connection to fetch the UserKey.` };
  },
  async microsoft(cfg) {
    const miss = need(cfg, "tenant_id", "client_id", "client_secret");
    if (miss) return { ok: false, message: miss };
    const res = await call(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant_id!)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.client_id!, client_secret: cfg.client_secret!, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
    });
    return expectOk(res, "App credentials accepted by Microsoft.");
  },
  async google(cfg) {
    if (!cfg.service_account_json) {
      if (cfg.maps_api_key || cfg.oauth_client_id) return { ok: false, message: "Only the service account can be tested. Add the JSON key." };
      return { ok: false, message: "Missing service_account_json." };
    }
    let sa: { client_email?: string; private_key?: string; token_uri?: string };
    try { sa = JSON.parse(cfg.service_account_json); } catch { return { ok: false, message: "Service account JSON is not valid JSON." }; }
    if (!sa.client_email || !sa.private_key) return { ok: false, message: "The JSON has no client_email / private_key." };
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
      iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: tokenUri, iat: now, exp: now + 300,
    }))}`;
    let signature: string;
    try {
      signature = b64url(createSign("RSA-SHA256").update(unsigned).sign(sa.private_key));
    } catch {
      return { ok: false, message: "The private key in the JSON can't sign (is it complete?)." };
    }
    const res = await call(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    });
    return expectOk(res, `Service account ${sa.client_email} can sign in.`);
  },
  async meta(cfg) {
    const miss = need(cfg, "app_id", "app_secret");
    if (miss) return { ok: false, message: miss };
    const url = new URL("https://graph.facebook.com/oauth/access_token");
    url.searchParams.set("client_id", cfg.app_id!);
    url.searchParams.set("client_secret", cfg.app_secret!);
    url.searchParams.set("grant_type", "client_credentials");
    const res = await call(url.toString());
    return expectOk(res, "Meta accepted the app ID and secret.");
  },
  async smtp(cfg) {
    const miss = need(cfg, "host", "port", "user", "password");
    if (miss) return { ok: false, message: miss };
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(cfg.port);
    const secure = cfg.secure ? cfg.secure === "true" : port === 465;
    const t = nodemailer.createTransport({ host: cfg.host, port, secure, auth: { user: cfg.user, pass: cfg.password }, connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS });
    try {
      await t.verify();
      return { ok: true, message: `Signed in to ${cfg.host}:${port}.` };
    } finally {
      t.close();
    }
  },
  async imap(cfg) {
    const miss = need(cfg, "host", "port", "user", "password");
    if (miss) return { ok: false, message: miss };
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({ host: cfg.host!, port: Number(cfg.port), secure: cfg.secure !== "false", auth: { user: cfg.user!, pass: cfg.password! }, logger: false, connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS });
    await client.connect();
    await client.logout().catch(() => {});
    return { ok: true, message: `Signed in to ${cfg.host}:${cfg.port}.` };
  },
  async finnhub(cfg) {
    const miss = need(cfg, "api_key");
    if (miss) return { ok: false, message: miss };
    const res = await call("https://finnhub.io/api/v1/quote?symbol=SPY", { headers: { "X-Finnhub-Token": cfg.api_key! } });
    if (!res.ok) return expectOk(res, "");
    const data = (await res.json().catch(() => ({}))) as { c?: number };
    if (typeof data.c !== "number" || data.c === 0) return { ok: false, message: "Finnhub answered but returned no quote for SPY." };
    return { ok: true, message: `Key works — SPY last traded at $${data.c.toFixed(2)}.` };
  },
  hermes: (cfg) => reachability(cfg.base_url, cfg.api_key),
  openclaw: (cfg) => reachability(cfg.url, cfg.token),
  eve: (cfg) => reachability(cfg.url, cfg.token),
};

export function isTestable(provider: string): boolean {
  return provider in TESTS || provider.startsWith(CUSTOM_PREFIX);
}

function scrub(message: string, cfg: Config): string {
  let out = message;
  for (const v of Object.values(cfg)) {
    if (v && v.length >= 6) out = out.split(v).join("••••");
  }
  return out.slice(0, 300);
}

/** Run a provider's connection test with the values the app would use right now. */
export async function runCredentialTest(provider: string, instance = "default"): Promise<TestResult> {
  const cfg = await getProviderConfig(provider, instance);
  let result: TestResult;
  try {
    if (provider.startsWith(CUSTOM_PREFIX)) {
      const def = await getCustomDefinition(provider);
      if (!def?.pingUrl) return { ok: false, message: "This custom provider has no ping URL." };
      const tokenField = def.fields.find((f) => f.secret && /token|key|secret/i.test(f.key));
      result = await reachability(def.pingUrl, tokenField ? cfg[tokenField.key] : undefined);
    } else {
      const test = TESTS[provider];
      if (!test) return { ok: false, message: "No connection test for this provider." };
      result = await test(cfg);
    }
  } catch (e) {
    const err = e as Error;
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    result = { ok: false, message: timedOut ? "Timed out after 10 seconds." : err?.message || "Test failed." };
  }
  // `persist` is passed through for the server-side test route only (never returned to the page).
  return { ok: result.ok, message: scrub(result.message, cfg), ...(result.persist ? { persist: result.persist } : {}) };
}
