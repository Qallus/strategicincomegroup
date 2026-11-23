"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureTouch, getSession, trackingOptedOut } from "@/lib/analytics/attribution";
import type { BeaconPayload } from "@/lib/analytics/types";

/**
 * SIG's own cookieless site analytics (public site only — mounted in SiteShell).
 *
 * Sends to /api/t: a page_view on every route change, one engagement event per page
 * (visible time + max scroll depth) when the page is hidden or left, and clicks on
 * tel:, mailto: and outbound links. No cookies; a random session id lives in
 * sessionStorage. Nothing is sent when the browser sets Do Not Track or Global
 * Privacy Control, on localhost or the preview host (unless NEXT_PUBLIC_ANALYTICS_DEBUG=1),
 * or on dashboard / editor-preview paths. The server also drops bots and signed-in staff.
 */

const ENDPOINT = "/api/t";
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";
const SKIP_PATHS = /^\/(dashboard|website-preview|api|login|auth|oauth)(\/|$)/;

function enabled(pathname: string): boolean {
  if (typeof window === "undefined" || trackingOptedOut()) return false;
  if (SKIP_PATHS.test(pathname)) return false;
  if (DEBUG) return true;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host.startsWith("preview.")) return false;
  return true;
}

function send(payload: BeaconPayload) {
  const s = getSession();
  if (!s) return;
  const body = JSON.stringify({ ...payload, s: s.id, r: s.referrer || undefined, q: s.query || undefined });
  try {
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  try {
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" }, credentials: "same-origin" }).catch(() => {});
  } catch {
    /* never let analytics throw */
  }
}

function scrollDepth(): number {
  const doc = document.documentElement;
  const max = Math.max(doc.scrollHeight - window.innerHeight, 0);
  if (max <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / max) * 100));
}

export function AnalyticsBeacon() {
  const pathname = usePathname() || "/";
  const page = useRef<{ path: string; visibleSince: number | null; ms: number; depth: number; sent: boolean } | null>(null);

  // Flush the current page's engagement (once per page).
  const flush = useRef(() => {
    const p = page.current;
    if (!p || p.sent) return;
    if (p.visibleSince != null) p.ms += Date.now() - p.visibleSince;
    p.visibleSince = null;
    if (p.ms < 1000 && p.depth === 0) return;
    p.sent = true;
    send({ e: "engagement", p: p.path, ms: Math.min(p.ms, 6 * 60 * 60 * 1000), sd: p.depth });
  });

  // Page view on every route change.
  useEffect(() => {
    if (!enabled(pathname)) return;
    flush.current();
    captureTouch();
    page.current = { path: pathname, visibleSince: document.visibilityState === "visible" ? Date.now() : null, ms: 0, depth: 0, sent: false };
    // Title updates after navigation; read it on the next frame.
    const raf = requestAnimationFrame(() => send({ e: "page_view", p: pathname, t: document.title.slice(0, 300) }));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // Visibility, scroll and leave listeners (mounted once).
  useEffect(() => {
    if (!enabled(window.location.pathname)) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const p = page.current;
        if (p) p.depth = Math.max(p.depth, scrollDepth());
      });
    };
    const onVisibility = () => {
      const p = page.current;
      if (!p) return;
      if (document.visibilityState === "hidden") {
        flush.current();
      } else if (!p.sent) {
        p.visibleSince = Date.now();
      }
    };
    const onLeave = () => flush.current();
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const path = window.location.pathname;
      if (/^tel:/i.test(href)) return send({ e: "click_tel", p: path });
      if (/^mailto:/i.test(href)) return send({ e: "click_mailto", p: path });
      try {
        const u = new URL(a.href, window.location.href);
        if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname !== window.location.hostname) {
          send({ e: "click_outbound", p: path, h: `${u.hostname}${u.pathname}`.slice(0, 300) });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}
