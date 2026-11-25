import "server-only";

import { getCredential } from "@/lib/credentials/server";

// Market quotes from Finnhub (free key, Dashboard → Credentials → Data feeds). On the free
// plan the indexes are shown through their tracking funds: Dow (DIA), NASDAQ (QQQ),
// S&P 500 (SPY). Quotes are cached on the server for 60 s and only refreshed while US
// markets are open; outside market hours the last quote is served (fetched once if empty).

export type Quote = {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high: number;
  low: number;
  open: number;
  /** Quote time from Finnhub (ISO). */
  asOf: string | null;
};

export type MarketsResult =
  | { configured: false; open: boolean; quotes: [] }
  | { configured: true; open: boolean; quotes: Quote[]; error?: string };

export const INDEX_FUNDS = [
  { symbol: "DIA", label: "Dow (DIA)", key: "dow" },
  { symbol: "QQQ", label: "NASDAQ (QQQ)", key: "nasdaq" },
  { symbol: "SPY", label: "S&P 500 (SPY)", key: "sp500" },
] as const;

const TTL_OPEN_MS = 60_000;
const TTL_CLOSED_MS = 30 * 60_000;
const cache = new Map<string, { at: number; quote: Quote }>();

/** US equities regular session: Mon–Fri 9:30–16:00 America/New_York (holidays not modelled). */
export function isUsMarketOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday");
  if (wd === "Sat" || wd === "Sun") return false;
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

async function finnhubKey(): Promise<string | undefined> {
  try {
    return (await getCredential("finnhub", "api_key")) || undefined;
  } catch {
    return process.env.FINNHUB_API_KEY || undefined;
  }
}

export async function hasMarketKey(): Promise<boolean> {
  return Boolean(await finnhubKey());
}

async function fetchQuote(symbol: string, key: string, label: string): Promise<Quote> {
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  const res = await fetch(url, { headers: { "X-Finnhub-Token": key }, signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new Error("Finnhub refused the API key.");
  if (res.status === 429) throw new Error("Finnhub rate limit reached — try again in a minute.");
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  const j = (await res.json()) as { c?: number; d?: number | null; dp?: number | null; pc?: number; h?: number; l?: number; o?: number; t?: number };
  if (!j || typeof j.c !== "number" || (j.c === 0 && !j.pc)) throw new Error(`No quote for ${symbol}.`);
  return {
    symbol,
    label,
    price: j.c,
    change: j.d ?? j.c - (j.pc ?? j.c),
    changePercent: j.dp ?? (j.pc ? ((j.c - j.pc) / j.pc) * 100 : 0),
    previousClose: j.pc ?? 0,
    high: j.h ?? 0,
    low: j.l ?? 0,
    open: j.o ?? 0,
    asOf: j.t ? new Date(j.t * 1000).toISOString() : null,
  };
}

export function normalizeSymbol(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s) ? s : null;
}

/** Quotes for the index funds plus any extra symbols. */
export async function getQuotes(extra: string[] = []): Promise<MarketsResult> {
  const open = isUsMarketOpen();
  const key = await finnhubKey();
  if (!key) return { configured: false, open, quotes: [] };

  const wanted: { symbol: string; label: string }[] = [
    ...INDEX_FUNDS.map((f) => ({ symbol: f.symbol, label: f.label })),
    ...extra.map((s) => normalizeSymbol(s)).filter((s): s is string => Boolean(s)).filter((s) => !INDEX_FUNDS.some((f) => f.symbol === s)).slice(0, 5).map((s) => ({ symbol: s, label: s })),
  ];
  const ttl = open ? TTL_OPEN_MS : TTL_CLOSED_MS;
  let lastError: string | undefined;
  const quotes = await Promise.all(
    wanted.map(async ({ symbol, label }) => {
      const hit = cache.get(symbol);
      if (hit && Date.now() - hit.at < ttl) return hit.quote;
      try {
        const q = await fetchQuote(symbol, key, label);
        cache.set(symbol, { at: Date.now(), quote: q });
        return q;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Quote failed.";
        return hit?.quote ?? null;
      }
    }),
  );
  const ok = quotes.filter((q): q is Quote => Boolean(q));
  return { configured: true, open, quotes: ok, ...(ok.length < wanted.length && lastError ? { error: lastError } : {}) };
}
