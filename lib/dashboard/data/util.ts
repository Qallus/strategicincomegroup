import "server-only";

import { addDays, arizonaDayStartIso, arizonaToday, eachDay } from "@/lib/analytics/dates";

export class DataForbidden extends Error {
  status = 403;
  constructor(message = "You don't have access to this card.") {
    super(message);
  }
}

export class DataBadRequest extends Error {
  status = 400;
}

export type Period = "today" | "7d" | "30d" | "month";

export type PeriodRange = {
  period: Period;
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
  label: string;
  /** Arizona calendar days covered (for sparklines), oldest first. */
  days: string[];
};

export function asPeriod(v: unknown): Period {
  return v === "today" || v === "7d" || v === "30d" || v === "month" ? v : "month";
}

/** Period boundaries in Arizona time (no DST). The previous range has the same length. */
export function periodRange(period: Period, now = new Date()): PeriodRange {
  const today = arizonaToday(now);
  const untilIso = now.toISOString();
  let startDay: string;
  let label: string;
  switch (period) {
    case "today":
      startDay = today;
      label = "today";
      break;
    case "7d":
      startDay = addDays(today, -6);
      label = "last 7 days";
      break;
    case "30d":
      startDay = addDays(today, -29);
      label = "last 30 days";
      break;
    default:
      startDay = `${today.slice(0, 7)}-01`;
      label = "this month";
  }
  const since = arizonaDayStartIso(startDay);
  const span = now.getTime() - new Date(since).getTime();
  const prevUntil = since;
  const prevSince = new Date(new Date(since).getTime() - Math.max(span, 3_600_000)).toISOString();
  const sparkStart = period === "today" ? addDays(today, -6) : startDay;
  return { period, since, until: untilIso, prevSince, prevUntil, label, days: eachDay(sparkStart, today) };
}

export function pctDelta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Bucket ISO timestamps into Arizona days (YYYY-MM-DD) — counts per day in `days`. */
export function bucketByDay(timestamps: (string | null | undefined)[], days: string[]): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const t of timestamps) {
    if (!t) continue;
    const day = arizonaToday(new Date(t));
    const i = index.get(day);
    if (i !== undefined) out[i] += 1;
  }
  return out;
}

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }>;

/** A head-only count that returns 0 instead of throwing (missing tables, etc.). */
export async function safeCount(query: CountQuery): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const head = { count: "exact" as const, head: true };
