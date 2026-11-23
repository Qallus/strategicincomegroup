import { classify } from "@/lib/analytics/channels";
import { browserFamily, deviceClass, isBot } from "@/lib/analytics/bots";
import { cleanPath, clientIp, geo, hasAuthCookie, NON_PUBLIC_PATH, rateKey, rateLimited, visitorHash } from "@/lib/analytics/collect";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// First-party, cookieless analytics collector for the public-site beacon
// (components/public-site/analytics-beacon.tsx). Always answers 204 — a failure here
// must never surface on the site. Never stores the IP or user agent: only a
// daily-rotating visitor hash, device class, browser family and country/region.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 4096;
const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function siteHosts(request: Request): string[] {
  const hosts = new Set<string>();
  const h = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (h) hosts.add(h.split(",")[0].trim().split(":")[0].toLowerCase());
  for (const v of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (v) hosts.add(new URL(v).hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  hosts.add("strategicincomegroup.com");
  return [...hosts];
}

export async function POST(request: Request) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (isBot(ua)) return done();
    // Signed-in browsers (staff checking the site) are excluded.
    if (hasAuthCookie(request.headers.get("cookie"))) return done();

    const ip = clientIp(request.headers);
    if (rateLimited(rateKey(ip || ua))) return done();

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY) return done();
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return done();
      body = parsed as Record<string, unknown>;
    } catch {
      return done();
    }

    const event = body.e as AnalyticsEventName;
    if (!(ANALYTICS_EVENTS as readonly string[]).includes(event)) return done();
    const path = cleanPath(body.p);
    if (!path || NON_PUBLIC_PATH.test(path)) return done();

    const sid = str(body.s, 64);
    const sessionId = sid && /^[A-Za-z0-9_-]{8,64}$/.test(sid) ? sid : null;
    const referrer = str(body.r, 500);
    const query = str(body.q, 500);

    // Re-classify server-side from the session's entry referrer + landing query.
    const c = classify({ referrer, query, landingPath: path, siteHosts: siteHosts(request) });
    const { country, region } = geo(request.headers);

    const ms = Number(body.ms);
    const sd = Number(body.sd);
    const props: Record<string, string> = {};
    if (event === "click_outbound") {
      const h = str(body.h, 300);
      if (h) props.target = h;
    }

    const row = {
      event,
      path,
      title: event === "page_view" ? str(body.t, 300) : null,
      referrer_host: c.referrer_host,
      channel: c.channel,
      source: c.sourceLabel ? c.sourceLabel.slice(0, 120) : null,
      utm_source: c.source,
      utm_medium: c.medium,
      utm_campaign: c.campaign,
      utm_content: c.content,
      utm_term: c.term,
      session_id: sessionId,
      visitor_hash: visitorHash(ip, ua),
      device: deviceClass(ua),
      browser: browserFamily(ua),
      country,
      region,
      engaged_ms: event === "engagement" && Number.isFinite(ms) ? Math.max(0, Math.min(Math.round(ms), 6 * 60 * 60 * 1000)) : null,
      scroll_depth: event === "engagement" && Number.isFinite(sd) ? Math.max(0, Math.min(Math.round(sd), 100)) : null,
      props,
    };

    const { error } = await createSupabaseAdminClient().from("analytics_events").insert(row);
    if (error && process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") console.warn("[analytics] insert failed:", error.message);
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") console.warn("[analytics] collector error:", error instanceof Error ? error.message : error);
  }
  return done();
}
