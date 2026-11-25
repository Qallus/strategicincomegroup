// Map a widget's settings to its data request. Shared by the server shell (which preloads
// the first data) and the client hook, so both compute the same request id.

import { WIDGET_MAP } from "./registry";
import type { WidgetDataRequest, WidgetInstance } from "./types";

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, x]) => x !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableStringify(x)}`).join(",")}}`;
}

export function requestId(key: string, params: Record<string, unknown> = {}): string {
  return `${key}:${stableStringify(params)}`;
}

export function makeRequest(key: string, params: Record<string, unknown> = {}): WidgetDataRequest {
  return { id: requestId(key, params), key, params };
}

const pick = (s: Record<string, unknown>, keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (s[k] !== undefined && s[k] !== null && s[k] !== "") out[k] = s[k];
  return out;
};

/** The default data request for a widget instance, or null if it loads nothing. */
export function widgetRequest(widget: Pick<WidgetInstance, "kind" | "settings">): WidgetDataRequest | null {
  const def = WIDGET_MAP[widget.kind];
  if (!def?.dataKey) return null;
  const s = (widget.settings ?? {}) as Record<string, unknown>;
  switch (def.dataKey) {
    case "stat":
      return makeRequest("stat", pick(s, ["metric", "period", "scope"]));
    case "notifications":
      return makeRequest("notifications", pick(s, ["limit", "unreadOnly"]));
    case "alerts":
      return makeRequest("alerts", pick(s, ["limit", "severity"]));
    case "appointments":
      return makeRequest("appointments", pick(s, ["limit", "scope"]));
    case "calendar":
      return makeRequest("calendar", pick(s, ["scope"]));
    case "call_log":
      return makeRequest("call_log", pick(s, ["limit", "filter", "scope"]));
    case "sms_inbox":
    case "email_inbox":
      return makeRequest(def.dataKey, pick(s, ["limit"]));
    case "charts":
      return makeRequest("charts", pick(s, ["days", "calls", "sms", "bookings", "scope"]));
    case "weather":
      return makeRequest("weather", pick(s, ["location"]));
    case "markets":
      return makeRequest("markets", widget.kind === "ticker" ? pick(s, ["symbol"]) : {});
    case "latest_transcript":
      return makeRequest("latest_transcript", pick(s, ["scope"]));
    default:
      return makeRequest(def.dataKey, {});
  }
}

/** Refresh interval for a widget in ms (settings.refresh is in seconds). 0 = never. */
export function widgetRefreshMs(widget: Pick<WidgetInstance, "kind" | "settings">): number {
  const def = WIDGET_MAP[widget.kind];
  if (!def?.dataKey) return 0;
  if (def.dataKey === "weather") return 10 * 60_000;
  if (def.dataKey === "markets" || (def.dataKey === "stat" && ["market", "dow", "nasdaq", "sp500"].includes(String(widget.settings?.metric)))) return 60_000;
  if (def.dataKey === "whats_new" || def.dataKey === "get_started" || def.dataKey === "redtail" || def.dataKey === "invitations") return 5 * 60_000;
  const r = Number(widget.settings?.refresh);
  return Number.isFinite(r) && r >= 15 ? r * 1000 : 60_000;
}
