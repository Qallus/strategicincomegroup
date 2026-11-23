// Fixed categorical slots for analytics entities (dataviz: color follows the entity,
// never its rank; six validated slots from .sig-viz in app/globals.css, the rest
// fold into "Other"). Never cycle or generate hues.
import type { Channel } from "@/lib/analytics/types";

export const CHANNEL_SLOT: Record<Channel, string> = {
  organic_search: "var(--series-1)",
  ai_assistant: "var(--series-2)",
  social: "var(--series-3)",
  email: "var(--series-4)",
  referral: "var(--series-5)",
  direct: "var(--series-6)",
  sms: "var(--series-other)",
  business_card: "var(--series-other)",
  paid: "var(--series-other)",
};

/** Channels drawn as their own line; the others are summed into "Other". */
export const CHART_CHANNELS: Channel[] = ["organic_search", "ai_assistant", "social", "email", "referral", "direct"];

/** AI crawler owners → slots (same idea: identity is fixed). */
export const BOT_OWNER_SLOT: Record<string, string> = {
  OpenAI: "var(--series-1)",
  Anthropic: "var(--series-2)",
  Perplexity: "var(--series-3)",
  Google: "var(--series-4)",
  Microsoft: "var(--series-5)",
  Apple: "var(--series-6)",
};

export const OTHER = "var(--series-other)";
