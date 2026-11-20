import { SectionHeader } from "@/components/dashboard/section-header";
import { JobPostingViews } from "@/components/careers/job-posting-views";
import { getCurrentProfile } from "@/lib/auth/server";
import { listJobPostings } from "@/lib/careers/server";
import { missingTableMessage, type JobPosting } from "@/lib/careers/shared";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Postings — SIG Dashboard" };

export default async function CareersDashboardPage() {
  const profile = await getCurrentProfile();
  let jobs: JobPosting[] = [];
  let loadError: string | null = null;
  try {
    jobs = await listJobPostings();
  } catch (e) {
    loadError = missingTableMessage(e);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Website"
        title="Job Postings"
        description="The roles on /join-our-team and their detail pages. Listings show on the site only while Published (or Scheduled) and inside their publish / close window. Times are Arizona time."
      />
      {loadError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : null}
      <JobPostingViews jobs={jobs} canDraftComms={can(profile?.role, PERMISSIONS.MANAGE_SETTINGS)} disabled={Boolean(loadError)} />
    </div>
  );
}
