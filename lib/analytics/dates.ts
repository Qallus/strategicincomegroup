// Date-range helpers for the Analytics dashboard. Days are Arizona calendar days
// (UTC-7 all year — Arizona has no DST). Pure; safe on client and server.

export const RANGE_PRESETS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "ytd", label: "Year to date", days: 0 },
  { value: "custom", label: "Custom range", days: 0 },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export type ResolvedRange = {
  preset: RangePreset;
  from: string; // YYYY-MM-DD
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
  compare: boolean;
  label: string;
};

const DAY = 86_400_000;
const AZ_OFFSET = 7 * 60 * 60 * 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function arizonaToday(now = new Date()): string {
  return new Date(now.getTime() - AZ_OFFSET).toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}

/** Every day in the range, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

/** UTC ISO instant for the start of an Arizona day. */
export function arizonaDayStartIso(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + AZ_OFFSET).toISOString();
}

export function formatDay(ymd: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Resolve ?range=&from=&to=&compare= into concrete Arizona days + the previous period. */
export function resolveRange(sp: Record<string, string | string[] | undefined>, now = new Date()): ResolvedRange {
  const today = arizonaToday(now);
  const raw = pick(sp.range) as RangePreset | undefined;
  const preset: RangePreset = RANGE_PRESETS.some((p) => p.value === raw) ? (raw as RangePreset) : "30d";
  let from: string;
  let to = today;

  if (preset === "ytd") {
    from = `${today.slice(0, 4)}-01-01`;
  } else if (preset === "custom") {
    const f = pick(sp.from);
    const t = pick(sp.to);
    from = f && YMD.test(f) ? f : addDays(today, -29);
    to = t && YMD.test(t) ? t : today;
    if (to > today) to = today;
    if (from > to) [from, to] = [to, from];
    if (daysBetween(from, to) > 400) from = addDays(to, -399);
  } else {
    const days = RANGE_PRESETS.find((p) => p.value === preset)!.days;
    from = addDays(today, -(days - 1));
  }

  const days = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const compare = pick(sp.compare) !== "0";
  const label =
    preset === "custom"
      ? `${formatDay(from, { month: "short", day: "numeric", year: "numeric" })} – ${formatDay(to, { month: "short", day: "numeric", year: "numeric" })}`
      : RANGE_PRESETS.find((p) => p.value === preset)!.label;
  return { preset, from, to, prevFrom, prevTo, days, compare, label };
}
