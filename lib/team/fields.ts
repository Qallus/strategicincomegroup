// Employee profile fields — shared by the dashboard editor (client), the API
// routes and the MCP tools. No server imports here.
import type { TeamMember } from "@/lib/public-site/team";

export const WORK_DAYS = [
  { key: "mon", short: "Mon", label: "Monday" },
  { key: "tue", short: "Tue", label: "Tuesday" },
  { key: "wed", short: "Wed", label: "Wednesday" },
  { key: "thu", short: "Thu", label: "Thursday" },
  { key: "fri", short: "Fri", label: "Friday" },
  { key: "sat", short: "Sat", label: "Saturday" },
  { key: "sun", short: "Sun", label: "Sunday" },
] as const;
export type WorkDay = (typeof WORK_DAYS)[number]["key"];

export const OFFICES = ["East Valley Office", "West Valley Office"] as const;
export const TEAM_GROUPS = ["leadership", "planner", "admin"] as const;
export const TEAM_GROUP_LABELS: Record<(typeof TEAM_GROUPS)[number], string> = {
  leadership: "Leadership",
  planner: "Financial planner",
  admin: "Administrative team",
};

/** A row of public.employee_profiles. */
export type EmployeeProfile = {
  id: string;
  profile_id: string | null;
  account_email: string | null;
  slug: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  credentials: string | null;
  office: (typeof OFFICES)[number] | null;
  employment_date: string | null;
  photo_url: string | null;
  gallery_urls: string[];
  experience: string | null;
  inspires: string | null;
  hobbies: string | null;
  best_purchase: string | null;
  favorite_destination: string | null;
  why_love_job: string | null;
  favorite_quote: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  work_days: string[];
  start_time: string | null;
  close_time: string | null;
  team_group: (typeof TEAM_GROUPS)[number];
  booking_href: string | null;
  is_published: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields an employee may change on their own profile. */
export const SELF_FIELDS = [
  "full_name", "first_name", "last_name", "job_title", "credentials", "office", "employment_date",
  "photo_url", "gallery_urls",
  "experience", "inspires", "hobbies", "best_purchase", "favorite_destination", "why_love_job", "favorite_quote",
  "phone", "email", "linkedin_url",
  "work_days", "start_time", "close_time",
  "is_published",
] as const;
/** Extra fields only admins may change. */
export const ADMIN_FIELDS = ["slug", "team_group", "booking_href", "sort_order", "account_email"] as const;

export type SelfField = (typeof SELF_FIELDS)[number];
export type AdminField = (typeof ADMIN_FIELDS)[number];
export type EmployeePatch = Partial<Pick<EmployeeProfile, SelfField | AdminField>>;

const TEXT_LIMITS: Partial<Record<SelfField | AdminField, number>> = {
  full_name: 120, first_name: 60, last_name: 60, job_title: 120, credentials: 120,
  experience: 8000, inspires: 2000, hobbies: 2000, best_purchase: 1000, favorite_destination: 2000, why_love_job: 3000,
  favorite_quote: 1000, phone: 40, email: 160, linkedin_url: 300, photo_url: 1000, booking_href: 300, account_email: 160,
};
const TEXT_FIELDS = [
  "full_name", "first_name", "last_name", "job_title", "credentials",
  "experience", "inspires", "hobbies", "best_purchase", "favorite_destination", "why_love_job", "favorite_quote", "phone",
] as const;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : v == null ? "" : String(v).trim());

function imageUrl(v: unknown, label: string): string | null {
  const s = clean(v);
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {
    /* fall through */
  }
  throw new Error(`${label} must be an https:// URL or a site path like /team/photo.webp.`);
}

/**
 * Validate and normalise an update. Unknown keys are dropped; admin-only keys
 * throw for non-admins; empty strings become null (nothing is required).
 */
export function sanitizePatch(input: Record<string, unknown>, opts: { admin: boolean }): EmployeePatch {
  const out: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined;

  for (const k of ADMIN_FIELDS) {
    if (has(k) && !opts.admin) throw new Error(`Only an admin can change ${k.replace(/_/g, " ")}.`);
  }

  for (const k of TEXT_FIELDS) {
    if (!has(k)) continue;
    const s = clean(input[k]);
    const max = TEXT_LIMITS[k] ?? 500;
    if (s.length > max) throw new Error(`${k.replace(/_/g, " ")} is too long (max ${max} characters).`);
    out[k] = s || null;
  }

  if (has("office")) {
    const s = clean(input.office);
    if (s && !(OFFICES as readonly string[]).includes(s)) throw new Error(`office must be one of: ${OFFICES.join(", ")}.`);
    out.office = s || null;
  }
  if (has("employment_date")) {
    const s = clean(input.employment_date).slice(0, 10);
    if (s && (!DATE_RE.test(s) || Number.isNaN(Date.parse(s)))) throw new Error("employment_date must be YYYY-MM-DD.");
    out.employment_date = s || null;
  }
  if (has("photo_url")) out.photo_url = imageUrl(input.photo_url, "photo_url");
  if (has("gallery_urls")) {
    const list = Array.isArray(input.gallery_urls) ? input.gallery_urls : [];
    if (list.length > 40) throw new Error("A gallery can hold up to 40 photos.");
    out.gallery_urls = Array.from(new Set(list.map((u) => imageUrl(u, "gallery_urls")).filter((u): u is string => Boolean(u))));
  }
  if (has("email")) {
    const s = clean(input.email).toLowerCase();
    if (s && !EMAIL_RE.test(s)) throw new Error("email doesn't look like an email address.");
    out.email = s || null;
  }
  if (has("account_email")) {
    const s = clean(input.account_email).toLowerCase();
    if (s && !EMAIL_RE.test(s)) throw new Error("account_email doesn't look like an email address.");
    out.account_email = s || null;
  }
  if (has("linkedin_url")) {
    let s = clean(input.linkedin_url);
    if (s && !/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
    if (s) {
      let host = "";
      try {
        host = new URL(s).hostname.toLowerCase();
      } catch {
        throw new Error("linkedin_url must be a LinkedIn profile URL.");
      }
      if (!/(^|\.)linkedin\.com$/.test(host)) throw new Error("linkedin_url must be a linkedin.com URL.");
    }
    out.linkedin_url = s || null;
  }
  if (has("work_days")) {
    const keys = WORK_DAYS.map((d) => d.key as string);
    const list = (Array.isArray(input.work_days) ? input.work_days : [])
      .map((d) => clean(d).toLowerCase().slice(0, 3))
      .filter(Boolean);
    for (const d of list) if (!keys.includes(d)) throw new Error(`work_days accepts ${keys.join(", ")}.`);
    out.work_days = keys.filter((k) => list.includes(k));
  }
  for (const k of ["start_time", "close_time"] as const) {
    if (!has(k)) continue;
    const s = clean(input[k]);
    if (s && !TIME_RE.test(s)) throw new Error(`${k} must be 24-hour HH:MM, e.g. 08:30 or 17:00.`);
    out[k] = s ? s.slice(0, 5) : null;
  }
  if (has("is_published")) out.is_published = input.is_published === true || input.is_published === "true";

  if (opts.admin) {
    if (has("slug")) {
      const s = clean(input.slug).toLowerCase();
      if (!SLUG_RE.test(s)) throw new Error("slug must be lowercase words separated by hyphens, e.g. jane-doe.");
      out.slug = s;
    }
    if (has("team_group")) {
      const s = clean(input.team_group);
      if (!(TEAM_GROUPS as readonly string[]).includes(s)) throw new Error(`team_group must be one of: ${TEAM_GROUPS.join(", ")}.`);
      out.team_group = s;
    }
    if (has("booking_href")) {
      const s = clean(input.booking_href);
      if (s && !s.startsWith("/") && !/^https:\/\//.test(s)) throw new Error("booking_href must be a site path (/book?planner=…) or https URL.");
      out.booking_href = s || null;
    }
    if (has("sort_order")) {
      const n = Number(input.sort_order);
      if (!Number.isFinite(n)) throw new Error("sort_order must be a number.");
      out.sort_order = Math.round(n);
    }
  }

  return out as EmployeePatch;
}

export function displayName(p: Pick<EmployeeProfile, "full_name" | "first_name" | "last_name" | "slug">) {
  return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.slug;
}

export const splitParagraphs = (text: string | null | undefined) =>
  (text ?? "").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);

/** DB row → the TeamMember shape every public-site consumer already uses. */
export function toTeamMember(p: EmployeeProfile): TeamMember {
  const u = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);
  return {
    slug: p.slug,
    name: displayName(p),
    credentials: u(p.credentials),
    title: p.job_title ?? "",
    group: p.team_group,
    office: p.office ?? undefined,
    photo: p.photo_url ?? "",
    booking: u(p.booking_href),
    quote: u(p.favorite_quote),
    history: splitParagraphs(p.experience),
    inspires: u(p.inspires),
    hobbies: u(p.hobbies),
    destination: u(p.favorite_destination),
    why: u(p.why_love_job),
    firstName: u(p.first_name),
    lastName: u(p.last_name),
    bestPurchase: u(p.best_purchase),
    phone: u(p.phone),
    email: u(p.email),
    linkedin: u(p.linkedin_url),
    workDays: p.work_days ?? [],
    startTime: p.start_time ? p.start_time.slice(0, 5) : undefined,
    closeTime: p.close_time ? p.close_time.slice(0, 5) : undefined,
    employmentDate: u(p.employment_date),
    gallery: p.gallery_urls ?? [],
    sortOrder: p.sort_order,
  };
}

/** The fields counted by the completeness meter. */
export const COMPLETENESS_FIELDS: { key: keyof EmployeeProfile; label: string }[] = [
  { key: "photo_url", label: "Profile photo" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "job_title", label: "Job title" },
  { key: "employment_date", label: "Date of employment" },
  { key: "experience", label: "Professional experience" },
  { key: "inspires", label: "Who inspires you" },
  { key: "hobbies", label: "Favorite hobbies" },
  { key: "best_purchase", label: "Best purchase under $100" },
  { key: "favorite_destination", label: "Favorite destination" },
  { key: "why_love_job", label: "Why you love your job" },
  { key: "favorite_quote", label: "Favorite quote" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "work_days", label: "Work days" },
  { key: "start_time", label: "Start time" },
  { key: "close_time", label: "Close time" },
  { key: "gallery_urls", label: "Photo gallery" },
];

export function completeness(p: Partial<EmployeeProfile>) {
  const missing: string[] = [];
  let done = 0;
  for (const f of COMPLETENESS_FIELDS) {
    const v = p[f.key];
    const filled = Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null;
    if (filled) done += 1;
    else missing.push(f.label);
  }
  return { done, total: COMPLETENESS_FIELDS.length, percent: Math.round((done / COMPLETENESS_FIELDS.length) * 100), missing };
}

/** "08:30" → "8:30 AM" */
export function formatTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** ["mon","tue","wed","thu","fri"] → "Monday – Friday"; otherwise a comma list. */
export function formatWorkDays(days?: string[] | null) {
  const keys = WORK_DAYS.map((d) => d.key as string);
  const idx = (days ?? []).map((d) => keys.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return "";
  const contiguous = idx.length >= 3 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous) return `${WORK_DAYS[idx[0]].label} – ${WORK_DAYS[idx[idx.length - 1]].label}`;
  return idx.map((i) => WORK_DAYS[i].label).join(", ");
}

/** A row in the admin "Team profiles" picker. */
export type PickerItem = {
  slug: string;
  name: string;
  jobTitle: string | null;
  photoUrl: string | null;
  isPublished: boolean;
  percent: number;
  isMine: boolean;
};

export function toPickerItems(rows: EmployeeProfile[], myProfileId: string): PickerItem[] {
  return rows.map((r) => ({
    slug: r.slug,
    name: displayName(r),
    jobTitle: r.job_title,
    photoUrl: r.photo_url,
    isPublished: r.is_published,
    percent: completeness(r).percent,
    isMine: r.profile_id === myProfileId,
  }));
}
