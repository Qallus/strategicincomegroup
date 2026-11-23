// User-agent → bot name. Edge-safe (used by middleware) and server-safe (/api/t).
// Order matters: the more specific token wins (Claude-SearchBot before ClaudeBot,
// Applebot-Extended before Applebot, Google-Extended before Googlebot).

export type BotKind = "ai" | "search" | "other";

export const KNOWN_BOTS: { name: string; pattern: RegExp; kind: BotKind; owner: string }[] = [
  { name: "OAI-SearchBot", pattern: /OAI-SearchBot/i, kind: "ai", owner: "OpenAI" },
  { name: "ChatGPT-User", pattern: /ChatGPT-User/i, kind: "ai", owner: "OpenAI" },
  { name: "GPTBot", pattern: /GPTBot/i, kind: "ai", owner: "OpenAI" },
  { name: "Perplexity-User", pattern: /Perplexity-User/i, kind: "ai", owner: "Perplexity" },
  { name: "PerplexityBot", pattern: /PerplexityBot/i, kind: "ai", owner: "Perplexity" },
  { name: "Claude-SearchBot", pattern: /Claude-SearchBot/i, kind: "ai", owner: "Anthropic" },
  { name: "Claude-User", pattern: /Claude-User/i, kind: "ai", owner: "Anthropic" },
  { name: "ClaudeBot", pattern: /ClaudeBot/i, kind: "ai", owner: "Anthropic" },
  { name: "anthropic-ai", pattern: /anthropic-ai/i, kind: "ai", owner: "Anthropic" },
  { name: "Google-Extended", pattern: /Google-Extended/i, kind: "ai", owner: "Google" },
  { name: "Applebot-Extended", pattern: /Applebot-Extended/i, kind: "ai", owner: "Apple" },
  { name: "meta-externalagent", pattern: /meta-externalagent|meta-externalfetcher/i, kind: "ai", owner: "Meta" },
  { name: "CCBot", pattern: /CCBot/i, kind: "ai", owner: "Common Crawl" },
  { name: "Bytespider", pattern: /Bytespider/i, kind: "ai", owner: "ByteDance" },
  { name: "Amazonbot", pattern: /Amazonbot/i, kind: "ai", owner: "Amazon" },
  { name: "MistralAI-User", pattern: /MistralAI-User/i, kind: "ai", owner: "Mistral" },
  { name: "Googlebot", pattern: /Googlebot|Google-InspectionTool|GoogleOther/i, kind: "search", owner: "Google" },
  { name: "Bingbot", pattern: /bingbot|BingPreview|msnbot/i, kind: "search", owner: "Microsoft" },
  { name: "Applebot", pattern: /Applebot/i, kind: "search", owner: "Apple" },
  { name: "DuckDuckBot", pattern: /DuckDuckBot|DuckAssistBot/i, kind: "search", owner: "DuckDuckGo" },
  { name: "YandexBot", pattern: /YandexBot/i, kind: "search", owner: "Yandex" },
];

/** One combined test so the middleware does a single regex pass on every request. */
const KNOWN_ANY = new RegExp(KNOWN_BOTS.map((b) => b.pattern.source).join("|"), "i");

/** Anything else that looks automated — excluded from human analytics, never logged as a bot hit. */
const GENERIC_BOT =
  /bot\b|bot\/|crawl|spider|slurp|scrap|fetch|preview|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget\/|python-requests|python-urllib|httpx|aiohttp|go-http-client|okhttp|java\/|libwww|node-fetch|axios\/|undici|facebookexternalhit|embedly|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|vercel-screenshot|ahrefs|semrush|mj12|dotbot|petalbot|seznam/i;

/** The known bot name for a UA (AI crawler or search engine), or null. */
export function knownBot(ua: string | null | undefined): { name: string; kind: BotKind; owner: string } | null {
  if (!ua || !KNOWN_ANY.test(ua)) return null;
  const hit = KNOWN_BOTS.find((b) => b.pattern.test(ua));
  return hit ? { name: hit.name, kind: hit.kind, owner: hit.owner } : null;
}

/** True for any automated client (known or generic) or a missing UA. */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 12) return true;
  return KNOWN_ANY.test(ua) || GENERIC_BOT.test(ua);
}

export function botOwner(name: string): string {
  return KNOWN_BOTS.find((b) => b.name === name)?.owner ?? "Other";
}

export function botKind(name: string): BotKind {
  return KNOWN_BOTS.find((b) => b.name === name)?.kind ?? "other";
}

/** Coarse device class from a UA (never store the UA itself). */
export function deviceClass(ua: string): "desktop" | "mobile" | "tablet" | "other" {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return "mobile";
  if (/Windows|Macintosh|X11|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}

/** Browser family only. */
export function browserFamily(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS/.test(ua)) return "Firefox";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}
