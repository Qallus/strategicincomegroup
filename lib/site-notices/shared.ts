// Site notices: the site-wide announcement bar and the blog sidebar notification.
// Client-safe types, defaults and helpers (no server imports here).
import { CONTACT } from "@/lib/public-site/site-data";

export const ANNOUNCEMENT_TONES = ["navy", "gold", "alert"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

export const TONE_LABELS: Record<AnnouncementTone, string> = {
  navy: "Info (navy)",
  gold: "Highlight (gold)",
  alert: "Alert (red)",
};

export type SiteAnnouncement = {
  id: string;
  message: string;
  link_label: string | null;
  link_url: string | null;
  tone: AnnouncementTone;
  enabled: boolean;
  dismissible: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The subset of an announcement the public bar needs. */
export type PublicAnnouncement = Pick<
  SiteAnnouncement,
  "id" | "message" | "link_label" | "link_url" | "tone" | "dismissible" | "priority" | "starts_at" | "ends_at" | "updated_at"
>;

export type AnnouncementStatus = "off" | "scheduled" | "live" | "ended";

export function announcementStatus(a: Pick<SiteAnnouncement, "enabled" | "starts_at" | "ends_at">, now = Date.now()): AnnouncementStatus {
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return "ended";
  if (!a.enabled) return "off";
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return "scheduled";
  return "live";
}

export function isLive(a: Pick<SiteAnnouncement, "starts_at" | "ends_at">, now = Date.now()) {
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return false;
  return true;
}

/** Highest priority first, then the most recently started / updated. */
export function compareAnnouncements(a: PublicAnnouncement, b: PublicAnnouncement) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const as = a.starts_at ? Date.parse(a.starts_at) : 0;
  const bs = b.starts_at ? Date.parse(b.starts_at) : 0;
  if (bs !== as) return bs - as;
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}

/** The announcement to show right now out of the enabled candidates. */
export function pickActiveAnnouncement<T extends PublicAnnouncement>(list: T[], now = Date.now()): T | null {
  return list.filter((a) => isLive(a, now)).sort(compareAnnouncements)[0] ?? null;
}

/** A safe href: a site path or an http(s) URL. */
export function safeHref(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^(mailto|tel):[^\s]+$/i.test(s)) return s;
  return null;
}

// ── Blog sidebar notification ────────────────────────────────────────────────

export const BLOG_SIDEBAR_KEY = "blog_sidebar";

export type BlogSidebarContent = {
  eyebrow: string;
  title: string;
  /** Plain text. Blank lines separate paragraphs; single line breaks are kept. */
  body: string;
  phone: string;
  email: string;
  hours: string;
  show_offices: boolean;
  cta_label: string;
  cta_url: string;
};

export type BlogSidebarBlock = { enabled: boolean; content: BlogSidebarContent; updated_at: string | null };

/** Default content — also seeded by supabase/migrations/202611190170_site_notices.sql. */
export const DEFAULT_BLOG_SIDEBAR: BlogSidebarContent = {
  eyebrow: "Year-end planning",
  title: "Questions before December 31?",
  body:
    "Year-end is a good time to review required minimum distributions, charitable giving and retirement-plan contributions with your planner.\n\n" +
    "Our team is happy to help you decide what deserves attention before the calendar turns.",
  phone: CONTACT.phone,
  email: CONTACT.email,
  hours: CONTACT.hours,
  show_offices: true,
  cta_label: "Contact us",
  cta_url: "/contact",
};

export const DEFAULT_BLOG_SIDEBAR_BLOCK: BlogSidebarBlock = { enabled: true, content: DEFAULT_BLOG_SIDEBAR, updated_at: null };

const LIMITS: Record<keyof Omit<BlogSidebarContent, "show_offices">, number> = {
  eyebrow: 60,
  title: 120,
  body: 1500,
  phone: 40,
  email: 160,
  hours: 120,
  cta_label: 40,
  cta_url: 300,
};

/** Merge stored jsonb over the defaults so a partial row still renders. */
export function normalizeBlogSidebar(raw: unknown): BlogSidebarContent {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_BLOG_SIDEBAR };
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (typeof r[k] === "string") out[k] = (r[k] as string).slice(0, LIMITS[k]);
  }
  if (typeof r.show_offices === "boolean") out.show_offices = r.show_offices;
  return out;
}

/** Validate an edit from the dashboard / MCP (strings trimmed, lengths capped, link checked). */
export function sanitizeBlogSidebar(input: Partial<BlogSidebarContent>, base: BlogSidebarContent): BlogSidebarContent {
  const out = { ...base };
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = input[k];
    if (v === undefined) continue;
    if (typeof v !== "string") throw new Error(`${k} must be text.`);
    const t = k === "body" ? v.replace(/\r\n/g, "\n").trim() : v.trim();
    if (t.length > LIMITS[k]) throw new Error(`${k} is too long (max ${LIMITS[k]} characters).`);
    out[k] = t;
  }
  if (input.show_offices !== undefined) out.show_offices = Boolean(input.show_offices);
  if (out.cta_url && !safeHref(out.cta_url)) throw new Error("Button link must be a site path (/contact) or an https:// URL.");
  if (!out.title) throw new Error("Give the notification a title.");
  return out;
}

/** "(480) 466-7070" → "tel:+14804667070". */
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`;
}

// ── Arizona time helpers (SIG offices are in America/Phoenix, UTC-7, no DST) ──

export const SITE_TZ = "America/Phoenix";

/** ISO timestamp → { date: YYYY-MM-DD, time: HH:MM } in Arizona time. */
export function toAzParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const az = new Date(d.getTime() - 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${az.getUTCFullYear()}-${p(az.getUTCMonth() + 1)}-${p(az.getUTCDate())}`, time: `${p(az.getUTCHours())}:${p(az.getUTCMinutes())}` };
}

/** Arizona date + time → ISO timestamp (null when no date). */
export function fromAzParts(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const d = new Date(`${date}T${t}:00-07:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatAz(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
