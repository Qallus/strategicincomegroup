// First / last touch attribution.
//
// Client: captureTouch() runs on every page load (from the analytics beacon). It
// keeps the first touch and the last non-direct touch in first-party localStorage
// (no cookies), plus a random session id in sessionStorage that expires after 30
// minutes idle. getAttribution() returns what to attach to conversion API payloads.
// Nothing is stored when the browser sends Do Not Track or Global Privacy Control.
//
// Server: sanitizeAttribution() validates and size-limits what the client sent, and
// insertWithAttribution() retries an insert without the attribution columns when the
// 202611210190 migration has not been applied yet.
import { classify } from "./channels";
import { isChannel, type AttributionPayload, type Touch } from "./types";

const FIRST_KEY = "sig_a_first";
const LAST_KEY = "sig_a_last";
const SESSION_KEY = "sig_a_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;

export type SessionEntry = { id: string; last: number; referrer: string; query: string; landing: string };

// ── Client ───────────────────────────────────────────────────────────────────

/** True when the visitor asked not to be tracked (DNT or GPC). */
export function trackingOptedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = typeof window !== "undefined" ? (window as Window & { doNotTrack?: string }) : undefined;
  return nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || win?.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function randomId(): string {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 22);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full / blocked */
  }
}

const local = () => (typeof window !== "undefined" ? safe(() => window.localStorage) : undefined);
const session = () => (typeof window !== "undefined" ? safe(() => window.sessionStorage) : undefined);
function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * Current session (30-minute idle window), started on this page view if needed.
 * `isNew` is true when this call started it. Returns null when tracking is opted out.
 */
export function getSession(touch = true): (SessionEntry & { isNew: boolean }) | null {
  if (typeof window === "undefined" || trackingOptedOut()) return null;
  const now = Date.now();
  const cur = readJson<SessionEntry>(session(), SESSION_KEY);
  if (cur && now - cur.last < SESSION_IDLE_MS && typeof cur.id === "string") {
    if (touch) writeJson(session(), SESSION_KEY, { ...cur, last: now });
    return { ...cur, last: now, isNew: false };
  }
  const entry: SessionEntry = {
    id: randomId(),
    last: now,
    referrer: (document.referrer || "").slice(0, 500),
    query: (window.location.search || "").slice(0, 500),
    landing: (window.location.pathname || "/").slice(0, 500),
  };
  writeJson(session(), SESSION_KEY, entry);
  return { ...entry, isNew: true };
}

/** Record this visit's touch. Call once per page view; cheap. */
export function captureTouch(): void {
  if (typeof window === "undefined" || trackingOptedOut()) return;
  const s = getSession();
  if (!s) return;
  const hasUtm = /[?&]utm_[a-z]+=/i.test(window.location.search);
  // A touch is the session's entry (or a mid-session tagged link, e.g. from an email).
  if (!s.isNew && !hasUtm) return;
  const query = s.isNew ? s.query : window.location.search;
  const landing = s.isNew ? s.landing : window.location.pathname;
  const c = classify({ referrer: s.isNew ? s.referrer : "", query, landingPath: landing, siteHosts: [window.location.hostname] });
  const t: Touch = {
    channel: c.channel,
    source: c.sourceLabel ?? c.source,
    medium: c.medium,
    campaign: c.campaign,
    content: c.content,
    term: c.term,
    referrer_host: c.referrer_host,
    landing_path: landing,
    at: new Date().toISOString(),
  };
  if (!readJson<Touch>(local(), FIRST_KEY)) writeJson(local(), FIRST_KEY, t);
  // Last non-direct touch: a later direct visit doesn't erase the campaign that brought them.
  const last = readJson<Touch>(local(), LAST_KEY);
  if (t.channel !== "direct" || !last) writeJson(local(), LAST_KEY, t);
}

/** Attach to conversion API payloads: `{ ...body, attribution: getAttribution() }`. */
export function getAttribution(): AttributionPayload {
  const empty: AttributionPayload = { first_touch: null, last_touch: null, landing_path: null, session_id: null };
  if (typeof window === "undefined" || trackingOptedOut()) return empty;
  const s = getSession(false);
  return {
    first_touch: readJson<Touch>(local(), FIRST_KEY),
    last_touch: readJson<Touch>(local(), LAST_KEY),
    landing_path: s?.landing ?? null,
    session_id: s?.id ?? null,
  };
}

// ── Server ───────────────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

const path = (v: unknown): string | null => {
  const s = str(v, 500);
  return s && s.startsWith("/") ? s.split("?")[0].split("#")[0] : null;
};

export const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function sanitizeTouch(v: unknown): Touch | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isChannel(o.channel)) return null;
  const at = str(o.at, 40);
  return {
    channel: o.channel,
    source: str(o.source, 120),
    medium: str(o.medium, 120),
    campaign: str(o.campaign, 200),
    content: str(o.content, 200),
    term: str(o.term, 200),
    referrer_host: str(o.referrer_host, 255),
    landing_path: path(o.landing_path) ?? "/",
    at: at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString(),
  };
}

/** Validate the client's `attribution` object. Always returns the four columns (maybe null). */
export function sanitizeAttribution(v: unknown): AttributionPayload {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const sid = str(o.session_id, 64);
  const first = sanitizeTouch(o.first_touch);
  const last = sanitizeTouch(o.last_touch) ?? first;
  return {
    first_touch: first,
    last_touch: last,
    landing_path: path(o.landing_path) ?? last?.landing_path ?? null,
    session_id: sid && SESSION_ID_RE.test(sid) ? sid : null,
  };
}

/** The channel a conversion is credited to (last touch, else direct). */
export function conversionChannel(a: AttributionPayload): string {
  return a.last_touch?.channel ?? "direct";
}

/** "column does not exist" from PostgREST / Postgres. */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /column .* (does not exist|could not find)|Could not find the '.*' column/i.test(error.message ?? "");
}

/**
 * Run an insert with the attribution columns; if the columns don't exist yet
 * (migration not applied), run it again without them so the conversion is never lost.
 */
export async function insertWithAttribution<T extends { error: { code?: string; message?: string } | null }>(
  attribution: AttributionPayload,
  run: (extra: Partial<AttributionPayload>) => PromiseLike<T>,
): Promise<T> {
  const hasAny = attribution.first_touch || attribution.last_touch || attribution.landing_path || attribution.session_id;
  if (!hasAny) return run({});
  const first = await run(attribution);
  if (first.error && isMissingColumn(first.error)) {
    console.warn("[analytics] attribution columns missing; saved without them. Apply 202611210190_analytics.sql.");
    return run({});
  }
  return first;
}
