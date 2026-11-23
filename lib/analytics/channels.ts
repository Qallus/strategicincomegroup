// Channel classification: which bucket a visit belongs to, from its referrer and
// UTM tags. Rules run in order and the first match wins. Pure — safe on the client
// (attribution capture) and the server (/api/t re-classifies; it never trusts the
// client's answer).
import type { Channel } from "./types";

export type Utm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

export type Classified = Utm & { channel: Channel; referrer_host: string | null; sourceLabel: string | null };

const clip = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").trim().toLowerCase();
  return s ? s.slice(0, max) : null;
};

/** Parse utm_* from a query string ("?a=b" or "a=b"). */
export function parseUtm(query: string | null | undefined): Utm {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams((query ?? "").replace(/^\?/, ""));
  } catch {
    params = new URLSearchParams();
  }
  return {
    source: clip(params.get("utm_source") ?? params.get("ref") ?? params.get("source"), 120),
    medium: clip(params.get("utm_medium"), 120),
    campaign: clip(params.get("utm_campaign"), 200),
    content: clip(params.get("utm_content"), 200),
    term: clip(params.get("utm_term"), 200),
  };
}

/** Hostname of a referrer URL, lowercased, without "www.". Null when absent/invalid. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "android-app:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "").slice(0, 255) || null;
  } catch {
    return null;
  }
}

const matches = (host: string, list: readonly string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

/** AI assistants: referrer hosts (and their utm_source spellings). Checked before search. */
export const AI_HOSTS: { host: string; name: string }[] = [
  { host: "chatgpt.com", name: "ChatGPT" },
  { host: "chat.openai.com", name: "ChatGPT" },
  { host: "openai.com", name: "ChatGPT" },
  { host: "perplexity.ai", name: "Perplexity" },
  { host: "gemini.google.com", name: "Gemini" },
  { host: "bard.google.com", name: "Gemini" },
  { host: "copilot.microsoft.com", name: "Copilot" },
  { host: "copilot.cloud.microsoft", name: "Copilot" },
  { host: "claude.ai", name: "Claude" },
  { host: "you.com", name: "You.com" },
  { host: "phind.com", name: "Phind" },
  { host: "meta.ai", name: "Meta AI" },
  { host: "grok.com", name: "Grok" },
  { host: "x.ai", name: "Grok" },
  { host: "deepseek.com", name: "DeepSeek" },
  { host: "chat.mistral.ai", name: "Mistral" },
];

/** Name of the AI assistant for a host / utm_source, or null. */
export function aiAssistantName(hostOrSource: string | null | undefined): string | null {
  if (!hostOrSource) return null;
  const h = hostOrSource.toLowerCase().replace(/^www\./, "");
  const hit = AI_HOSTS.find((a) => h === a.host || h.endsWith(`.${a.host}`));
  if (hit) return hit.name;
  if (/^(chatgpt|openai|perplexity|gemini|copilot|claude|anthropic|phind|grok|deepseek)\b/.test(h)) {
    return h.split(/[.\s_-]/)[0].replace(/^./, (c) => c.toUpperCase());
  }
  return null;
}

const SEARCH_RULES: { test: (h: string) => boolean; name: string }[] = [
  { test: (h) => /(^|\.)google\.[a-z.]+$/.test(h) && !h.startsWith("mail.") && !h.startsWith("gemini.") && !h.startsWith("bard."), name: "google" },
  { test: (h) => matches(h, ["bing.com"]), name: "bing" },
  { test: (h) => matches(h, ["duckduckgo.com"]), name: "duckduckgo" },
  { test: (h) => /(^|\.)search\.yahoo\.[a-z.]+$/.test(h) || matches(h, ["yahoo.com"]), name: "yahoo" },
  { test: (h) => matches(h, ["ecosia.org"]), name: "ecosia" },
  { test: (h) => matches(h, ["search.brave.com"]), name: "brave" },
  { test: (h) => matches(h, ["yandex.com", "yandex.ru"]), name: "yandex" },
  { test: (h) => matches(h, ["baidu.com"]), name: "baidu" },
  { test: (h) => matches(h, ["startpage.com", "qwant.com", "aol.com", "ask.com"]), name: "search" },
];

const SOCIAL_HOSTS: { hosts: string[]; name: string }[] = [
  { hosts: ["facebook.com", "fb.com", "l.facebook.com", "lm.facebook.com", "m.facebook.com", "fb.me"], name: "facebook" },
  { hosts: ["instagram.com", "l.instagram.com"], name: "instagram" },
  { hosts: ["linkedin.com", "lnkd.in"], name: "linkedin" },
  { hosts: ["x.com", "twitter.com", "t.co"], name: "x" },
  { hosts: ["youtube.com", "youtu.be", "m.youtube.com"], name: "youtube" },
  { hosts: ["pinterest.com", "pin.it"], name: "pinterest" },
  { hosts: ["tiktok.com"], name: "tiktok" },
  { hosts: ["nextdoor.com"], name: "nextdoor" },
  { hosts: ["threads.net", "threads.com"], name: "threads" },
  { hosts: ["reddit.com", "out.reddit.com"], name: "reddit" },
];

const EMAIL_HOSTS = ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com", "mail.aol.com", "webmail"];

const SOCIAL_SOURCES = /^(facebook|fb|instagram|ig|linkedin|li|twitter|x|youtube|yt|pinterest|tiktok|nextdoor|threads|reddit|social)$/;

function socialName(host: string): string | null {
  const hit = SOCIAL_HOSTS.find((s) => matches(host, s.hosts));
  return hit?.name ?? null;
}

function searchName(host: string): string | null {
  return SEARCH_RULES.find((r) => r.test(host))?.name ?? null;
}

/**
 * Classify a visit. `siteHosts` are this site's own hosts — a referrer from them is
 * internal navigation and counts as no referrer.
 */
export function classify(input: { referrer?: string | null; query?: string | null; landingPath?: string | null; siteHosts?: string[] }): Classified {
  const utm = parseUtm(input.query);
  let host = referrerHost(input.referrer);
  const own = (input.siteHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, ""));
  let fromCardPage = false;
  if (host && (own.includes(host) || own.some((o) => host!.endsWith(`.${o}`)) || host === "localhost")) {
    // Internal navigation — but a hop from a digital business card (/c/<card>) is the card's visit.
    try {
      fromCardPage = /^\/c(\/|$)/.test(new URL(input.referrer!).pathname);
    } catch {
      /* ignore */
    }
    host = null;
  }

  const src = utm.source;
  const med = utm.medium;
  const out = (channel: Channel, sourceLabel: string | null): Classified => ({ ...utm, channel, referrer_host: host, sourceLabel });

  // 1. Explicit UTM medium.
  if (med) {
    if (/^(e-?mail|newsletter)$/.test(med)) return out("email", src ?? "email");
    if (/^(sms|text|mms)$/.test(med)) return out("sms", src ?? "sms");
    if (/^(cpc|ppc|paid|paidsearch|paid_search|paid-social|paid_social|display|cpm|ads?)$/.test(med)) return out("paid", src ?? host);
    if (/^(business_?card|card|nfc|qr)$/.test(med)) return out("business_card", src ?? "business_card");
    if (/^(social|social-media|social_media|sm|organic_social)$/.test(med)) return out("social", src ?? (host ? socialName(host) : null));
    if (/^(ai|llm|assistant|chat)$/.test(med)) return out("ai_assistant", aiAssistantName(src) ?? src);
  }
  // 2. UTM source alone.
  if (src) {
    if (/^(business_?card|bizcard|sig_card|card)$/.test(src)) return out("business_card", "business_card");
    const ai = aiAssistantName(src);
    if (ai) return out("ai_assistant", ai);
    if (/^(newsletter|resend|email|mailchimp)$/.test(src)) return out("email", src);
    if (/^(sms|twilio|text)$/.test(src)) return out("sms", src);
    if (SOCIAL_SOURCES.test(src)) return out("social", src);
  }
  // 3. Business-card pages linking onward (/c/<card>).
  if (fromCardPage || (input.landingPath && /^\/c(\/|$)/.test(input.landingPath) && !host)) return out("business_card", "business_card");

  if (host) {
    // 4. AI assistants first (gemini.google.com must not count as Google search).
    const ai = aiAssistantName(host);
    if (ai) return out("ai_assistant", ai);
    // 5. Organic search.
    const se = searchName(host);
    if (se) return out("organic_search", se);
    // 6. Social.
    const so = socialName(host);
    if (so) return out("social", so);
    // 7. Webmail.
    if (EMAIL_HOSTS.some((d) => host === d || host!.startsWith(`${d}.`))) return out("email", host);
    // 8. Anything else external.
    return out("referral", host);
  }
  // 9. No referrer, no tags.
  return out(src ? "referral" : "direct", src);
}
