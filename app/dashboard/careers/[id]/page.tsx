import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/dashboard/section-header";
import { JobPostingForm } from "@/components/careers/job-posting-form";
import { getCurrentProfile } from "@/lib/auth/server";
import { getJobPosting, listJobPostings } from "@/lib/careers/server";
import { missingTableMessage, type JobPosting } from "@/lib/careers/shared";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Job Posting — SIG Dashboard" };

export default async function EditJobPostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  let job: JobPosting | null = null;
  let loadError: string | null = null;
  try {
    job = /^[0-9a-f-]{36}$/i.test(id) ? await getJobPosting(id) : null;
  } catch (e) {
    loadError = missingTableMessage(e);
  }
  if (!job && !loadError) notFound();
  const departments = await listJobPostings().then((l) => l.map((j) => j.department)).catch(() => [] as string[]);

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-primary hover:underline" href="/dashboard/careers">Back to Job Postings</Link>
        <SectionHeader title={job?.title ?? "Job posting"} description="Edit the listing, its detail page, schedule and visibility." />
      </div>
      {loadError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : null}
      {job ? <JobPostingForm job={job} extraDepartments={departments} canDraftComms={can(profile?.role, PERMISSIONS.MANAGE_SETTINGS)} /> : null}
    </div>
  );
}
