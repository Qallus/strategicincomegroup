// Job postings — server reads/writes with the service-role client.
// Table: supabase/migrations/202611190180_job_postings.sql. Every public read
// fails soft to the static roles in lib/public-site/careers.ts (via
// staticJobPostings) if the table is missing or the query errors.
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { saveEmailTemplate } from "@/lib/email/templates";
import { createPost } from "@/lib/social-media/data";
import { BRAND_KIT, brandEmailButton, brandEmailHeader } from "@/lib/brand/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  EMPLOYMENT_TYPES,
  HIRING_STATUSES,
  JOB_STATUSES,
  employmentLabel,
  hasJobDetail,
  introParagraphs,
  isJobLive,
  jobPath,
  jobSlugify,
  jobTypeLabel,
  normalizeSections,
  sortJobs,
  staticJobPostings,
  type JobPosting,
  type JobPostingInput,
} from "./shared";

export const JOB_POSTINGS_TAG = "job-postings";

const COLS =
  "id, title, slug, department, employment_type, type_label, badge_text, hiring_status, location, compensation, summary, intro, sections, apply_instructions, status, publish_at, close_at, sort_order, featured, created_at, updated_at";

/** Absolute site URL for links in emails / social posts. */
export function careersSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://app.strategicincomegroup.com").replace(/\/$/, "");
}

export function jobUrl(slug: string) {
  return `${careersSiteUrl()}${jobPath(slug)}`;
}

function toPosting(row: Record<string, unknown>): JobPosting {
  return {
    ...(row as unknown as JobPosting),
    sections: normalizeSections(row.sections),
    sort_order: Number(row.sort_order ?? 0),
    featured: Boolean(row.featured),
    summary: String(row.summary ?? ""),
  };
}

// ── Public reads (cached; saves call revalidateTag) ──────────────────────────

type Source = { jobs: JobPosting[]; source: "db" | "static" };

/**
 * Every row that could be live (published / scheduled, not yet closed). The
 * publish window is applied per request in getLiveJobs, so scheduled starts and
 * closes take effect within the page's revalidate period without a save.
 */
const loadCandidates = unstable_cache(
  async (): Promise<Source> => {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("job_postings")
        .select(COLS)
        .in("status", ["published", "scheduled"])
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true })
        .limit(500);
      if (error) throw error;
      return { jobs: (data ?? []).map((r) => toPosting(r as Record<string, unknown>)), source: "db" };
    } catch {
      return { jobs: staticJobPostings(), source: "static" };
    }
  },
  ["job-postings-public-v1"],
  { revalidate: 300, tags: [JOB_POSTINGS_TAG] },
);

/** Listings live on the website right now, in site order. */
export const getLiveJobs = cache(async (): Promise<JobPosting[]> => {
  const { jobs } = await loadCandidates();
  const now = Date.now();
  return sortJobs(jobs.filter((j) => isJobLive(j, now)));
});

export const getJobsSource = cache(async () => (await loadCandidates()).source);

/** A live listing with its own detail page, by slug. */
export async function getLiveJob(slug: string): Promise<JobPosting | null> {
  const job = (await getLiveJobs()).find((j) => j.slug === slug);
  return job && hasJobDetail(job) ? job : null;
}

// ── Admin reads / writes (uncached) ──────────────────────────────────────────

export async function listJobPostings(): Promise<JobPosting[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("job_postings")
    .select(COLS)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPosting(r as Record<string, unknown>));
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
  const { data, error } = await createSupabaseAdminClient().from("job_postings").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPosting(data as Record<string, unknown>) : null;
}

export async function findJobPosting(ref: string): Promise<JobPosting | null> {
  if (/^[0-9a-f-]{36}$/i.test(ref)) {
    const byId = await getJobPosting(ref);
    if (byId) return byId;
  }
  const slug = ref.replace(/^.*join-our-team\//, "").replace(/^\/+|\/+$/g, "");
  const { data, error } = await createSupabaseAdminClient().from("job_postings").select(COLS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPosting(data as Record<string, unknown>) : null;
}

const clip = (v: unknown, max: number) => {
  const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return t ? t.slice(0, max) : null;
};
const isoOrNull = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`"${t}" isn't a valid date/time.`);
  return new Date(ms).toISOString();
};

/** Validate + normalise a save payload. Throws with a person-readable message. */
export function cleanJobInput(input: Partial<JobPostingInput>) {
  const title = clip(input.title, 160);
  if (!title) throw new Error("A job title is required.");
  const slug = jobSlugify(clip(input.slug, 80) || title);
  if (!slug) throw new Error("The URL slug needs at least one letter or number.");
  const status = (input.status ?? "draft") as string;
  if (!JOB_STATUSES.some((s) => s.value === status)) throw new Error("Unknown status.");
  const employment = (input.employment_type ?? "full_time") as string;
  if (!EMPLOYMENT_TYPES.some((s) => s.value === employment)) throw new Error("Unknown employment type.");
  const hiring = (input.hiring_status ?? "open") as string;
  if (!HIRING_STATUSES.some((s) => s.value === hiring)) throw new Error("Unknown hiring status.");
  const publish_at = isoOrNull(input.publish_at);
  const close_at = isoOrNull(input.close_at);
  if (publish_at && close_at && Date.parse(close_at) <= Date.parse(publish_at)) throw new Error("The close date must be after the publish date.");
  if (status === "scheduled" && !publish_at) throw new Error("Pick a publish date & time to schedule this listing.");
  const summary = clip(input.summary, 600) ?? "";
  return {
    title,
    slug,
    department: clip(input.department, 80) || "Financial & Investment Professionals",
    employment_type: employment,
    type_label: clip(input.type_label, 120),
    badge_text: clip(input.badge_text, 30),
    hiring_status: hiring,
    location: clip(input.location, 160),
    compensation: clip(input.compensation, 160),
    summary,
    intro: clip(input.intro, 20000),
    sections: normalizeSections(input.sections),
    apply_instructions: clip(input.apply_instructions, 4000),
    status,
    publish_at,
    close_at,
    sort_order: Math.round(Number(input.sort_order ?? 0)) || 0,
    featured: Boolean(input.featured),
  };
}

function friendly(error: { message: string; code?: string }) {
  if (error.code === "23505" || /duplicate key/i.test(error.message)) return new Error("Another listing already uses that URL slug. Pick a different one.");
  if (/job_postings|schema cache|does not exist/i.test(error.message)) {
    return new Error("The job_postings table isn't in the database yet. Apply supabase/migrations/202611190180_job_postings.sql first.");
  }
  return new Error(error.message);
}

export async function upsertJobPosting(input: Partial<JobPostingInput>, actorId: string | null) {
  const clean = cleanJobInput(input);
  const sb = createSupabaseAdminClient();
  let before: JobPosting | null = null;
  if (input.id) {
    before = await getJobPosting(input.id);
    if (!before) throw new Error("That listing no longer exists.");
  }
  const query = input.id
    ? sb.from("job_postings").update({ ...clean, updated_by: actorId }).eq("id", input.id)
    : sb.from("job_postings").insert({ ...clean, created_by: actorId, updated_by: actorId });
  const { data, error } = await query.select(COLS).single();
  if (error) throw friendly(error);
  revalidateTag(JOB_POSTINGS_TAG);
  return { before, after: toPosting(data as Record<string, unknown>) };
}

/** A copy as a draft with a unique "-copy" slug. */
export async function duplicateJobPosting(id: string, actorId: string | null) {
  const src = await getJobPosting(id);
  if (!src) throw new Error("That listing no longer exists.");
  const { data: taken } = await createSupabaseAdminClient().from("job_postings").select("slug").like("slug", `${src.slug}-copy%`);
  const used = new Set((taken ?? []).map((r) => r.slug as string));
  let slug = `${src.slug}-copy`.slice(0, 80);
  for (let n = 2; used.has(slug); n++) slug = `${src.slug}-copy-${n}`.slice(0, 80);
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = src;
  return upsertJobPosting({ ...rest, title: `${src.title} (copy)`, slug, status: "draft", featured: false, sort_order: src.sort_order + 1 }, actorId);
}

export async function setJobStatus(id: string, status: JobPosting["status"], actorId: string | null) {
  const src = await getJobPosting(id);
  if (!src) throw new Error("That listing no longer exists.");
  const patch: Record<string, unknown> = { status, updated_by: actorId };
  if (status === "scheduled" && !src.publish_at) throw new Error(`"${src.title}" needs a publish date before it can be scheduled.`);
  // Publishing a listing whose close date has passed would keep it hidden — clear it.
  if (status === "published" && src.close_at && Date.parse(src.close_at) <= Date.now()) patch.close_at = null;
  if (status === "published" && src.publish_at && Date.parse(src.publish_at) > Date.now()) patch.status = "scheduled";
  const { data, error } = await createSupabaseAdminClient().from("job_postings").update(patch).eq("id", id).select(COLS).single();
  if (error) throw friendly(error);
  revalidateTag(JOB_POSTINGS_TAG);
  return { before: src, after: toPosting(data as Record<string, unknown>) };
}

export async function deleteJobPosting(id: string) {
  const { error } = await createSupabaseAdminClient().from("job_postings").delete().eq("id", id);
  if (error) throw friendly(error);
  revalidateTag(JOB_POSTINGS_TAG);
}

// ── Drafts in other systems (never sent or published) ────────────────────────

const esc = (v: string) =>
  v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function jobFacts(job: JobPosting) {
  return [jobTypeLabel(job), job.location, job.compensation].filter((v): v is string => Boolean(v && v.trim()));
}

/** Branded "We're hiring" email template, saved as a DRAFT. Returns the template + editor link. */
export async function createJobEmailTemplate(job: JobPosting, actorId: string | null) {
  const url = jobUrl(job.slug);
  const { colors, fonts } = BRAND_KIT;
  const intro = introParagraphs(job.intro).slice(0, 2);
  const highlights = job.sections.flatMap((s) => s.items ?? []).slice(0, 5);
  const facts = jobFacts(job);
  const htmlBody = `
<div style="background:${colors.cream.hex};padding:24px 0;">
  <div style="font-family:${fonts.emailSans};line-height:1.65;color:${colors.ink.hex};max-width:640px;margin:0 auto;padding:28px;background:#ffffff;border-radius:12px;border-top:4px solid ${colors.gold.hex};">
    ${brandEmailHeader()}
    <p style="text-transform:uppercase;letter-spacing:.14em;color:${colors.gold.hex};font-size:12px;font-weight:700;margin:16px 0 0;">We're hiring · ${esc(job.department)}</p>
    <h1 style="font-family:${fonts.emailSerif};font-size:32px;line-height:1.15;margin:8px 0 12px;color:${colors.navy.hex};">${esc(job.title)}</h1>
    ${facts.length ? `<p style="margin:0 0 16px;color:#5b6473;font-size:14px;">${facts.map(esc).join(" &middot; ")}</p>` : ""}
    <p style="font-size:17px;margin:0 0 16px;">Hi {{first_name}},</p>
    ${job.summary ? `<p style="font-size:16px;margin:0 0 16px;">${esc(job.summary)}</p>` : ""}
    ${intro.map((p) => `<p style="font-size:15px;color:#3d4656;margin:0 0 14px;">${esc(p)}</p>`).join("\n    ")}
    ${
      highlights.length
        ? `<h2 style="font-family:${fonts.emailSerif};font-size:20px;color:${colors.navy.hex};margin:22px 0 8px;">What you'll do</h2>
    <ul style="padding-left:20px;margin:0 0 16px;">${highlights.map((h) => `<li style="margin:0 0 6px;">${esc(h)}</li>`).join("")}</ul>`
        : ""
    }
    <p style="margin:24px 0 8px;">${brandEmailButton(url, "View the role &amp; apply")}</p>
    <p style="font-size:14px;color:#5b6473;margin:20px 0 0;">Know someone who'd be a great fit? Forward this email — we'd love to meet them.</p>
    <p style="font-size:12px;color:#8a919c;margin:24px 0 0;">${esc(BRAND_KIT.name)} · <a href="${url}" style="color:${colors.sky.hex};">${esc(url)}</a></p>
  </div>
</div>`.trim();
  const textBody = [
    `We're hiring: ${job.title}`,
    facts.join(" · "),
    "",
    "Hi {{first_name}},",
    job.summary,
    ...intro,
    ...(highlights.length ? ["", "What you'll do:", ...highlights.map((h) => `- ${h}`)] : []),
    "",
    `View the role & apply: ${url}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const template = await saveEmailTemplate({
    name: `We're hiring: ${job.title}`,
    slug: `careers-${job.slug}-${Date.now().toString(36)}`,
    subject: `We're hiring: ${job.title}`,
    preheader: job.summary.slice(0, 140) || `Join the ${BRAND_KIT.name} team.`,
    htmlBody,
    textBody,
    category: "careers",
    status: "draft",
    actorUserId: actorId ?? undefined,
  });
  return { template: { id: template.id as string, name: template.name as string }, editUrl: `/dashboard/emails/editor?id=${template.id}` };
}

/** A DRAFT social post (LinkedIn by default) announcing the listing. Never scheduled or published. */
export async function createJobSocialPost(job: JobPosting, actorId: string | null, platform = "linkedin") {
  const url = jobUrl(job.slug);
  const facts = jobFacts(job);
  const body = [
    `We're hiring: ${job.title}`,
    "",
    job.summary || `Join the ${BRAND_KIT.name} team in ${job.department}.`,
    facts.length ? `\n${facts.join(" · ")}` : "",
    "",
    `Learn more and apply: ${url}`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const hashtags = ["hiring", "careers", "financialplanning", job.employment_type === "internship" ? "internship" : "jobs"];
  const post = await createPost({ platform, body_text: body, hashtags, link_url: url, status: "draft", actorUserId: actorId ?? undefined });
  return { post: { id: post.id, platform: post.platform }, editUrl: `/dashboard/social-media/history?post=${post.id}` };
}

export { employmentLabel };
