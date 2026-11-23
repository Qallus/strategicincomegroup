// Date / time helpers for the public booking UI. Dates are "YYYY-MM-DD" strings — no
// local-time Date math, so the calendar never drifts with the viewer's own timezone.

export function addDaysStr(d: string, n: number) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
export function addMonths(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
export function dateLabel(d: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
export const dowOf = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export function tzName(tz: string, style: "short" | "long" = "short") {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}
export const tzCity = (tz: string) => (tz === "America/Phoenix" ? "Arizona" : (tz.split("/").pop() ?? tz).replace(/_/g, " "));
/** "Arizona time (MST — no daylight saving)" for Phoenix; "Chicago time (CST)" elsewhere. */
export function tzLabel(tz: string) {
  if (tz === "America/Phoenix") return "Arizona time (MST — no daylight saving)";
  return `${tzCity(tz)} time (${tzName(tz)})`;
}
export const fmtTime = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
export function fmtDay(iso: string, tz: string, long = true) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric" });
}
export function fmtDayYear(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export const LOCATION_LABEL: Record<string, string> = { video: "Video call", phone: "Phone call", in_person: "In person", custom: "Details to follow" };

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
