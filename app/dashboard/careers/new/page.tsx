import Link from "next/link";
import { SectionHeader } from "@/components/dashboard/section-header";
import { JobPostingForm } from "@/components/careers/job-posting-form";
import { getCurrentProfile } from "@/lib/auth/server";
import { listJobPostings } from "@/lib/careers/server";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Job Posting — SIG Dashboard" };

export default async function NewJobPostingPage() {
  const profile = await getCurrentProfile();
  const existing = await listJobPostings().catch(() => []);
  const departments = existing.map((j) => j.department);
  const nextSort = Math.max(0, ...existing.map((j) => j.sort_order)) + 10;

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-primary hover:underline" href="/dashboard/careers">Back to Job Postings</Link>
        <SectionHeader title="New Job Posting" description="Create a listing for /join-our-team. Save as a draft, schedule it, or publish it now." />
      </div>
      <JobPostingForm extraDepartments={departments} defaultSortOrder={nextSort} canDraftComms={can(profile?.role, PERMISSIONS.MANAGE_SETTINGS)} />
    </div>
  );
}
