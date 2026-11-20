// Job postings — shared (client-safe) types, constants and helpers.
// Rows live in public.job_postings (supabase/migrations/202611190180_job_postings.sql),
// managed in Dashboard → Content → Job Postings. Until that migration runs, the
// public site falls back to the static content in lib/public-site/careers.ts via
// staticJobPostings() below, so /join-our-team looks the same either way.
import { JOBS, ROLE_GROUPS } from "@/lib/public-site/careers";

export const JOB_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number]["value"];

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

/** open = actively hiring (counted as "Positions Available"); waitlist = always-accepting role. */
export const HIRING_STATUSES = [
  { value: "open", label: "Open now" },
  { value: "waitlist", label: "Waitlist" },
] as const;
export type HiringStatus = (typeof HIRING_STATUSES)[number]["value"];

/** The department groups shown as tabs on /join-our-team (in this order). */
export const JOB_DEPARTMENTS = ROLE_GROUPS.map((g) => g.heading);

export const BADGE_SUGGESTIONS = ["Open", "Now Hiring", "Available", "Part-Time", "Internship", "Contract"];

export type JobSection = { heading: string; paragraphs?: string[]; items?: string[] };

export type JobPosting = {
  id: string;
  title: string;
  slug: string;
  department: string;
  employment_type: EmploymentType;
  /** Shown under the title on the detail page, e.g. "Full-Time Position". */
  type_label: string | null;
  badge_text: string | null;
  hiring_status: HiringStatus;
  location: string | null;
  compensation: string | null;
  summary: string;
  /** "About the role" — paragraphs separated by blank lines. */
  intro: string | null;
  sections: JobSection[];
  /** Closing / how to apply copy. */
  apply_instructions: string | null;
  status: JobStatus;
  publish_at: string | null;
  close_at: string | null;
  sort_order: number;
  featured: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type JobPostingInput = Omit<JobPosting, "id" | "created_at" | "updated_at"> & { id?: string };

export const employmentLabel = (t: string) => EMPLOYMENT_TYPES.find((x) => x.value === t)?.label ?? t;
export const jobStatusLabel = (s: string) => JOB_STATUSES.find((x) => x.value === s)?.label ?? s;

/** Default subtitle for the detail page when type_label is blank. */
export function jobTypeLabel(j: Pick<JobPosting, "type_label" | "employment_type">) {
  return j.type_label?.trim() || `${employmentLabel(j.employment_type)} Position`;
}

/** Readable load error for the dashboard (the migration may not be applied yet). */
export function missingTableMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /job_postings|schema cache|does not exist/i.test(msg)
    ? "The job_postings table isn't in the database yet. Apply supabase/migrations/202611190180_job_postings.sql, then reload. Until then /join-our-team shows the built-in roles."
    : msg;
}

export function jobPath(slug: string) {
  return `/join-our-team/${slug}`;
}

/** Live on the website right now: published (or scheduled) and inside its window. */
export function isJobLive(j: Pick<JobPosting, "status" | "publish_at" | "close_at">, now = Date.now()) {
  if (j.status !== "published" && j.status !== "scheduled") return false;
  if (j.publish_at && Date.parse(j.publish_at) > now) return false;
  if (j.close_at && Date.parse(j.close_at) <= now) return false;
  return true;
}

/** Has enough content for its own detail page. */
export function hasJobDetail(j: Pick<JobPosting, "intro" | "sections">) {
  return Boolean(j.intro?.trim()) || j.sections.some((s) => (s.items?.length ?? 0) + (s.paragraphs?.length ?? 0) > 0);
}

export function jobSlugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

/** Intro text → paragraphs. */
export function introParagraphs(intro: string | null | undefined) {
  return (intro ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

// ── Arizona time (SIG offices: America/Phoenix, UTC-7, no DST) ───────────────

/** ISO → { date: YYYY-MM-DD, time: HH:MM } in Arizona time. */
export function isoToAz(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { date: "", time: "" };
  const d = new Date(ms - 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

/** Arizona date (+ optional time, default `fallbackTime`) → ISO, or null without a date. */
export function azToIso(date: string, time: string, fallbackTime = "09:00"): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || fallbackTime}:00-07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatAz(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── Markdown-lite for section bodies ─────────────────────────────────────────
// "- item" / "* item" / "• item" lines become bullet items; other blocks become
// paragraphs. Sections render paragraphs first, then the checklist.

export function sectionToText(s: JobSection) {
  const parts: string[] = [];
  if (s.paragraphs?.length) parts.push(s.paragraphs.join("\n\n"));
  if (s.items?.length) parts.push(s.items.map((i) => `- ${i}`).join("\n"));
  return parts.join("\n\n");
}

export function textToSection(heading: string, text: string): JobSection {
  const items: string[] = [];
  const paragraphs: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) paragraphs.push(para.join(" ").trim());
    para = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flush();
      if (bullet[1].trim()) items.push(bullet[1].trim());
    } else if (!line) flush();
    else para.push(line);
  }
  flush();
  const out: JobSection = { heading: heading.trim() };
  if (paragraphs.length) out.paragraphs = paragraphs;
  if (items.length) out.items = items;
  return out;
}

export function normalizeSections(value: unknown): JobSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
    .map((s) => {
      const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : undefined);
      const out: JobSection = { heading: String(s.heading ?? "").trim() };
      const p = strs(s.paragraphs);
      const i = strs(s.items);
      if (p?.length) out.paragraphs = p;
      if (i?.length) out.items = i;
      return out;
    })
    .filter((s) => s.heading || s.paragraphs || s.items);
}

// ── Static fallback (mirrors the seed in the migration) ──────────────────────

const STATUS_TO_EMPLOYMENT: Record<string, EmploymentType> = { "Part-Time": "part_time" };

export function staticJobPostings(): JobPosting[] {
  const out: JobPosting[] = [];
  let order = 0;
  for (const group of ROLE_GROUPS) {
    for (const role of group.roles) {
      order += 10;
      const job = role.slug ? JOBS.find((j) => j.slug === role.slug) : undefined;
      const slug = role.slug ?? jobSlugify(role.title);
      const internship = /intern/i.test(role.title);
      out.push({
        id: `static-${slug}`,
        title: role.title,
        slug,
        department: group.heading,
        employment_type: internship ? "internship" : (role.status && STATUS_TO_EMPLOYMENT[role.status]) || "full_time",
        type_label: job?.type ?? null,
        badge_text: role.status ?? null,
        hiring_status: role.slug && role.status ? "open" : "waitlist",
        location: null,
        compensation: null,
        summary: role.summary,
        intro: job ? job.intro.join("\n\n") : null,
        sections: job ? job.sections.map((s) => ({ ...s })) : [],
        apply_instructions: job?.closing ?? null,
        status: "published",
        publish_at: null,
        close_at: null,
        sort_order: order,
        featured: false,
        created_at: null,
        updated_at: null,
      });
    }
  }
  return out;
}

export function sortJobs(list: JobPosting[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

/** Department tabs in site order (known groups first, then any new ones). */
export function groupJobs(list: JobPosting[]) {
  const names = [...JOB_DEPARTMENTS];
  for (const j of list) if (!names.includes(j.department)) names.push(j.department);
  return names
    .map((heading) => ({ heading, jobs: sortJobs(list.filter((j) => j.department === heading)) }))
    .filter((g) => g.jobs.length);
}
