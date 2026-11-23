// Server-only helpers shared by /api/t and /api/t/bot: privacy-preserving visitor
// hashing, geo headers, a small in-memory rate limiter and the missing-table check.
import { createHash, randomBytes } from "node:crypto";

/** Per-process fallback salt when ANALYTICS_IP_SALT is unset (rotates on restart). */
const FALLBACK_SALT = randomBytes(16).toString("hex");

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    ""
  );
}

/** Arizona calendar day, YYYY-MM-DD. */
export function arizonaDay(d = new Date()): string {
  return new Date(d.getTime() - 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Daily-rotating, truncated visitor hash: sha256(salt + day + ip + ua). The IP and
 * UA are never stored, and the same visitor gets a different hash tomorrow.
 */
export function visitorHash(ip: string, ua: string): string {
  const salt = process.env.ANALYTICS_IP_SALT || FALLBACK_SALT;
  return createHash("sha256").update(`${salt}|${arizonaDay()}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** Short hash used only as a rate-limit key. */
export function rateKey(ip: string): string {
  return createHash("sha256").update(`rl|${ip}`).digest("hex").slice(0, 16);
}

/** Country / region from Cloudflare or proxy headers, when the edge provides them. */
export function geo(headers: Headers): { country: string | null; region: string | null } {
  const c = (
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    headers.get("x-geo-country") ||
    ""
  ).toUpperCase();
  const country = /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
  const r = (headers.get("cf-region-code") || headers.get("cf-region") || headers.get("x-vercel-ip-country-region") || headers.get("x-geo-region") || "").trim();
  let region: string | null = null;
  if (r) {
    try {
      region = decodeURIComponent(r).slice(0, 80);
    } catch {
      region = r.slice(0, 80);
    }
  }
  return { country, region };
}

const buckets = new Map<string, { count: number; reset: number }>();

/** True when this key is over `limit` requests in the window. */
export function rateLimited(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    if (buckets.size > 10_000) buckets.clear();
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

/** A Supabase auth cookie is present (a signed-in staff/client browser). */
export function hasAuthCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/.test(cookieHeader);
}

/** Paths that are never public pages. */
export const NON_PUBLIC_PATH = /^\/(dashboard|api|_next|website-preview|auth|oauth|login|accept-invite|reset-password|two-factor|access-restricted)(\/|$)/;

/** Normalize a page path: leading slash, no query/hash, capped. Null when invalid. */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let p = v.trim().split("#")[0].split("?")[0];
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  try {
    p = decodeURI(p);
  } catch {
    /* keep raw */
  }
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/$/, "");
  // Never store booking self-service tokens (they grant access to an appointment).
  p = p.replace(/^\/book\/manage\/list\/[^/]+/, "/book/manage/list/[token]").replace(/^\/book\/manage\/(?!list(?:\/|$))[^/]+/, "/book/manage/[token]");
  return p.slice(0, 500) || "/";
}

/** "relation does not exist" / missing-function errors (migration not applied yet). */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /relation .* does not exist|Could not find the table|Could not find the function|schema cache/i.test(error.message ?? "")
  );
}
