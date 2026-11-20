// Job postings (Content → Job Postings, /join-our-team). Reuses lib/careers/server.ts
// so the AI and the dashboard write listings the same way. Same access as the
// dashboard page (review_content): policy area "blog" — Super Admin, Admin,
// Content Reviewer.
//
// Risk: list → read; create/edit → write, but a change that would put a listing
// on (or change it while it is on) the public site escalates to a preview +
// sig_confirm; delete → high (trashed, restorable with sig_restore).
import { revalidateTag } from "next/cache";
import { JOB_POSTINGS_TAG, findJobPosting, listJobPostings, upsertJobPosting } from "@/lib/careers/server";
import { EMPLOYMENT_TYPES, HIRING_STATUSES, JOB_STATUSES, isJobLive, jobPath, type JobPosting, type JobPostingInput } from "@/lib/careers/shared";
import { trashRecord } from "./trash";
import { anyObj, bool, clamp, int, need, obj, opt, s, str, strEnum, type Json, type McpTool } from "./types";

const STATUS_VALUES = JOB_STATUSES.map((x) => x.value);

function shape(j: JobPosting, full = false) {
  const base = {
    id: j.id,
    title: j.title,
    slug: j.slug,
    url: jobPath(j.slug),
    department: j.department,
    employment_type: j.employment_type,
    hiring_status: j.hiring_status,
    badge_text: j.badge_text,
    status: j.status,
    live_now: isJobLive(j),
    publish_at: j.publish_at,
    close_at: j.close_at,
    sort_order: j.sort_order,
    featured: j.featured,
    location: j.location,
    compensation: j.compensation,
    summary: j.summary,
    updated_at: j.updated_at,
    edit_url: `/dashboard/careers/${j.id}`,
  };
  return full ? { ...base, type_label: j.type_label, intro: j.intro, sections: j.sections, apply_instructions: j.apply_instructions } : base;
}

const FIELDS = {
  title: str("Job title"),
  slug: str("URL slug (optional; generated from the title). Detail page: /join-our-team/<slug>."),
  department: str("Department / tab, e.g. 'Financial & Investment Professionals', 'Client Services & Operations', 'Administrative & Technology'"),
  employment_type: strEnum(EMPLOYMENT_TYPES.map((x) => x.value), "Employment type"),
  type_label: str("Subtitle on the detail page, e.g. 'Full-Time Position'"),
  badge_text: str("Optional status badge on the card, e.g. 'Open', 'Part-Time'"),
  hiring_status: strEnum(HIRING_STATUSES.map((x) => x.value), "open = actively hiring; waitlist = always-accepting role"),
  location: str("Location / office"),
  compensation: str("Optional compensation text"),
  summary: str("One- or two-sentence card summary"),
  intro: str("About the role — paragraphs separated by blank lines"),
  sections: { type: "array", description: "Detail-page sections: [{ heading, paragraphs?: string[], items?: string[] }]. Replaces all sections.", items: anyObj("Section") },
  apply_instructions: str("How to apply (closing box)"),
  status: strEnum(STATUS_VALUES, "draft | scheduled | published | closed (default draft on create)"),
  publish_at: str("ISO date/time it may appear from (optional; required for scheduled)"),
  close_at: str("ISO date/time it is removed (optional)"),
  sort_order: int("Order within its tab (lower first)", -100000, 100000),
  featured: bool("Featured (shown first, gold outline)"),
};

const KEYS = Object.keys(FIELDS) as (keyof typeof FIELDS)[];

function merge(base: Partial<JobPostingInput>, a: Json): Partial<JobPostingInput> {
  const next: Record<string, unknown> = { ...base };
  for (const k of KEYS) if (k in a && a[k] !== undefined) next[k] = a[k];
  return next as Partial<JobPostingInput>;
}

async function find(ref: string) {
  const job = await findJobPosting(ref);
  if (!job) throw new Error(`No job posting matches "${ref}". Use sig_job_postings_list to find its id.`);
  return job;
}

export function careersTools(): McpTool[] {
  return [
    {
      name: "sig_job_postings_list",
      title: "List job postings",
      description: "List the job postings behind /join-our-team (all statuses) with live_now, publish window, department and slug. Filter by status, department or words in the title/summary.",
      risk: "read",
      area: "blog",
      inputSchema: obj({
        status: strEnum(STATUS_VALUES, "Only this status"),
        department: str("Only this department"),
        search: str("Words in the title or summary"),
        live_only: bool("Only listings live on the site right now"),
        full: bool("Include detail-page content"),
        limit: int("Max rows (default 50)", 1, 200),
      }),
      run: async (a) => {
        const term = s(a.search).toLowerCase();
        const list = (await listJobPostings()).filter(
          (j) =>
            (!opt(a.status) || j.status === opt(a.status)) &&
            (!opt(a.department) || j.department.toLowerCase() === s(a.department).toLowerCase()) &&
            (!a.live_only || isJobLive(j)) &&
            (!term || `${j.title} ${j.summary} ${j.slug}`.toLowerCase().includes(term)),
        );
        return { result: { total: list.length, job_postings: list.slice(0, clamp(a.limit, 50, 200)).map((j) => shape(j, Boolean(a.full))) } };
      },
    },
    {
      name: "sig_job_posting_upsert",
      title: "Create or edit a job posting",
      description:
        "Create a job posting (pass no `job`; defaults to a DRAFT) or edit one (pass `job` = id or slug; only fields you pass change). Anything that would be live on the public site after the save returns a preview + confirmation_id first.",
      risk: "write",
      area: "blog",
      inputSchema: obj({ job: str("Existing posting id or slug (omit to create)"), ...FIELDS }),
      escalate: async (a) => {
        const ref = opt(a.job);
        const before = ref ? await find(ref) : null;
        const after = merge(before ?? { status: "draft" }, a) as JobPosting;
        if (!isJobLive({ status: after.status, publish_at: (after.publish_at as string) ?? null, close_at: (after.close_at as string) ?? null }) && !(before && isJobLive(before))) return null;
        const changed = KEYS.filter((k) => a[k] !== undefined);
        return {
          summary: before
            ? `Edit the job posting "${before.title}" (${changed.join(", ") || "no fields"}) — it is or will be live on /join-our-team.`
            : `Create and publish the job posting "${s(a.title)}" on /join-our-team.`,
          details: { id: before?.id ?? null, url: jobPath(s(after.slug) || s(a.title)), fields: changed, status: after.status },
          entity: "job_posting",
          recordId: before?.id,
        };
      },
      run: async (a, c) => {
        const ref = opt(a.job);
        const before = ref ? await find(ref) : null;
        if (!before) need(a, "title");
        const input = merge(before ?? { status: "draft" }, a);
        if (before) input.id = before.id;
        const { after } = await upsertJobPosting(input, c.profile.id);
        return {
          result: { [before ? "updated" : "created"]: true, ...shape(after) },
          summary: `${before ? "Edited" : "Created"} job posting "${after.title}" (${after.status})`,
          entity: "job_posting",
          recordId: after.id,
          before,
          after,
        };
      },
    },
    {
      name: "sig_job_posting_delete",
      title: "Delete a job posting",
      description: "Remove a job posting from the site and the dashboard (moved to the trash; restorable with sig_restore). To just hide it, set status=closed with sig_job_posting_upsert instead. High risk: returns a preview first.",
      risk: "high",
      area: "blog",
      openWorld: true,
      inputSchema: obj({ job: str("Posting id or slug") }, ["job"]),
      preview: async (a) => {
        const job = await find(need(a, "job"));
        return {
          summary: `Delete job posting "${job.title}" (${job.status}${isJobLive(job) ? ", live on the site" : ""}). It can be restored from the trash.`,
          details: { id: job.id, url: jobPath(job.slug) },
          entity: "job_posting",
          recordId: job.id,
        };
      },
      execute: async (a, c) => {
        const job = await find(need(a, "job"));
        const { trashId, label, before } = await trashRecord("job_posting", job.id, c.profile);
        revalidateTag(JOB_POSTINGS_TAG);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted job posting "${label}"`, entity: "job_posting", recordId: job.id, before };
      },
    },
  ];
}
