"use server";

import { getCurrentProfile } from "@/lib/auth/server";
import { can, PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import {
  createJobEmailTemplate,
  createJobSocialPost,
  deleteJobPosting,
  duplicateJobPosting,
  getJobPosting,
  setJobStatus,
  upsertJobPosting,
} from "@/lib/careers/server";
import type { JobPosting, JobPostingInput, JobStatus } from "@/lib/careers/shared";

// Job Postings writes. Listings: same gate as the page (review_content — Super
// Admin, Admin, Content Reviewer). Creating email-template / social drafts also
// needs manage_settings, the gate on Dashboard → Emails and → Social Media.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function guard(permission: Permission = PERMISSIONS.REVIEW_CONTENT) {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !can(profile.role, permission)) {
    throw new Error(permission === PERMISSIONS.MANAGE_SETTINGS ? "Creating email or social drafts needs admin access." : "Content permission required.");
  }
  return profile;
}

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "That didn't save." });

export type ExtraDraft = { kind: "email" | "social"; ok: boolean; editUrl?: string; error?: string };

export async function saveJobPosting(
  input: Partial<JobPostingInput>,
  extras: { email?: boolean; social?: boolean } = {},
): Promise<Result<{ job: JobPosting; drafts: ExtraDraft[] }>> {
  try {
    const me = await guard();
    const { after } = await upsertJobPosting(input, me.id);
    const drafts: ExtraDraft[] = [];
    if (extras.email || extras.social) {
      const admin = can(me.role, PERMISSIONS.MANAGE_SETTINGS);
      if (extras.email) drafts.push(admin ? await draftSafely("email", () => createJobEmailTemplate(after, me.id)) : { kind: "email", ok: false, error: "Needs admin access." });
      if (extras.social) drafts.push(admin ? await draftSafely("social", () => createJobSocialPost(after, me.id)) : { kind: "social", ok: false, error: "Needs admin access." });
    }
    return { ok: true, data: { job: after, drafts } };
  } catch (e) {
    return fail(e);
  }
}

async function draftSafely(kind: ExtraDraft["kind"], run: () => Promise<{ editUrl: string }>): Promise<ExtraDraft> {
  try {
    const { editUrl } = await run();
    return { kind, ok: true, editUrl };
  } catch (e) {
    return { kind, ok: false, error: e instanceof Error ? e.message : "Couldn't create the draft." };
  }
}

export async function duplicateJob(id: string): Promise<Result<JobPosting>> {
  try {
    const me = await guard();
    const { after } = await duplicateJobPosting(id, me.id);
    return { ok: true, data: after };
  } catch (e) {
    return fail(e);
  }
}

export async function changeJobStatus(id: string, status: JobStatus): Promise<Result<JobPosting>> {
  try {
    const me = await guard();
    const { after } = await setJobStatus(id, status, me.id);
    return { ok: true, data: after };
  } catch (e) {
    return fail(e);
  }
}

export async function removeJob(id: string): Promise<Result> {
  try {
    await guard();
    await deleteJobPosting(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function createJobDraft(id: string, kind: "email" | "social"): Promise<Result<{ editUrl: string }>> {
  try {
    const me = await guard(PERMISSIONS.MANAGE_SETTINGS);
    const job = await getJobPosting(id);
    if (!job) throw new Error("That listing no longer exists.");
    const { editUrl } = kind === "email" ? await createJobEmailTemplate(job, me.id) : await createJobSocialPost(job, me.id);
    return { ok: true, data: { editUrl } };
  } catch (e) {
    return fail(e);
  }
}
