// Shared analytics types. Safe to import from client and server code.

/** Keep in sync with the check constraints in 202611210190_analytics.sql. */
export const CHANNELS = [
  "organic_search",
  "ai_assistant",
  "social",
  "email",
  "sms",
  "business_card",
  "paid",
  "referral",
  "direct",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  organic_search: "Organic Search",
  ai_assistant: "AI Assistant",
  social: "Social",
  email: "Email",
  sms: "SMS",
  business_card: "Business Card",
  paid: "Paid",
  referral: "Referral",
  direct: "Direct",
};

export function isChannel(v: unknown): v is Channel {
  return typeof v === "string" && (CHANNELS as readonly string[]).includes(v);
}

export function channelLabel(v: string | null | undefined): string {
  return isChannel(v) ? CHANNEL_LABELS[v] : v ? v : "Direct";
}

/** One touch point: where a visit came from. Stored on conversions as first/last touch. */
export type Touch = {
  channel: Channel;
  /** Human source, e.g. "google", "chatgpt.com", "newsletter". */
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer_host: string | null;
  landing_path: string;
  /** ISO timestamp. */
  at: string;
};

/** What the site attaches to conversion API payloads. */
export type AttributionPayload = {
  first_touch: Touch | null;
  last_touch: Touch | null;
  landing_path: string | null;
  session_id: string | null;
};

export const ANALYTICS_EVENTS = ["page_view", "engagement", "click_tel", "click_mailto", "click_outbound"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Body the beacon POSTs to /api/t. Server validates everything. */
export type BeaconPayload = {
  e: AnalyticsEventName;
  p: string; // path
  t?: string; // title
  s?: string; // session id
  /** Session entry: referrer URL + query string of the landing page (for UTM). */
  r?: string;
  q?: string;
  ms?: number; // engaged ms
  sd?: number; // scroll depth %
  h?: string; // click target host / href (no query)
};

export type DateRange = { from: string; to: string }; // YYYY-MM-DD inclusive (Arizona days)
