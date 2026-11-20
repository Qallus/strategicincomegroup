"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, Copy, ExternalLink, EyeOff, Globe, MailPlus, Pencil, Rocket, Share2, Star, Trash2 } from "lucide-react";
import { changeJobStatus, createJobDraft, duplicateJob, removeJob } from "@/app/dashboard/careers/actions";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import {
  EMPLOYMENT_TYPES,
  HIRING_STATUSES,
  JOB_STATUSES,
  employmentLabel,
  formatAz,
  isJobLive,
  jobPath,
  jobStatusLabel,
  type JobPosting,
  type JobStatus,
} from "@/lib/careers/shared";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

function StatusPill({ job }: { job: JobPosting }) {
  const live = isJobLive(job);
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[job.status] ?? "bg-muted")}>{jobStatusLabel(job.status)}</span>
      {(job.status === "published" || job.status === "scheduled") && !live ? (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">{job.close_at && Date.parse(job.close_at) <= Date.now() ? "Ended" : "Not yet live"}</span>
      ) : null}
    </span>
  );
}

const options = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));

/** Job Postings list on the shared DataView: stats, filters, list/table/cards/board/calendar, bulk actions, export. */
export function JobPostingViews({ jobs, canDraftComms, disabled }: { jobs: JobPosting[]; canDraftComms: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(jobs);
  const [flash, setFlash] = useState<{ text: string; href?: string; label?: string } | null>(null);
  useEffect(() => setRows(jobs), [jobs]);

  const departments = useMemo(() => options(rows.map((r) => r.department)), [rows]);
  const live = rows.filter((r) => isJobLive(r));

  async function setStatus(sel: JobPosting[], status: JobStatus) {
    const results = await Promise.all(sel.map((r) => changeJobStatus(r.id, status)));
    const updated = new Map(results.flatMap((r) => (r.ok ? [[r.data.id, r.data] as const] : [])));
    setRows((list) => list.map((r) => updated.get(r.id) ?? r));
    router.refresh();
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) throw new Error(failed.error);
  }

  async function remove(sel: JobPosting[]) {
    if (!window.confirm(`Delete ${sel.length} listing${sel.length === 1 ? "" : "s"}? This removes ${sel.length === 1 ? "it" : "them"} from the website and can't be undone.`)) return false;
    const results = await Promise.all(sel.map((r) => removeJob(r.id)));
    const gone = new Set(sel.filter((_, i) => results[i].ok).map((r) => r.id));
    setRows((list) => list.filter((r) => !gone.has(r.id)));
    router.refresh();
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) throw new Error(failed.error);
  }

  async function draft(job: JobPosting, kind: "email" | "social") {
    const res = await createJobDraft(job.id, kind);
    if (!res.ok) throw new Error(res.error);
    setFlash({
      text: kind === "email" ? `Draft email template created for “${job.title}” (not sent).` : `Draft social post created for “${job.title}” (not scheduled or published).`,
      href: res.data.editUrl,
      label: kind === "email" ? "Open in email editor" : "Open in Social Media",
    });
  }

  const columns: DataColumn<JobPosting>[] = [
    {
      id: "title",
      label: "Title",
      required: true,
      width: 300,
      sort: (r) => r.title,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          {r.featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Featured" /> : null}
          <span className="truncate font-medium">{r.title}</span>
        </span>
      ),
    },
    { id: "department", label: "Department", width: 230, sort: (r) => r.department, cell: (r) => r.department },
    { id: "type", label: "Type", width: 120, sort: (r) => employmentLabel(r.employment_type), cell: (r) => employmentLabel(r.employment_type) },
    { id: "hiring", label: "Hiring", width: 100, sort: (r) => r.hiring_status, cell: (r) => (r.hiring_status === "open" ? "Open" : "Waitlist") },
    { id: "badge", label: "Badge", width: 110, sort: (r) => r.badge_text, cell: (r) => r.badge_text || "—" },
    { id: "status", label: "Status", width: 170, sort: (r) => jobStatusLabel(r.status), exportValue: (r) => r.status, cell: (r) => <StatusPill job={r} /> },
    { id: "publish_at", label: "Publish at", width: 170, sort: (r) => r.publish_at, exportValue: (r) => r.publish_at ?? "", cell: (r) => (r.publish_at ? formatAz(r.publish_at) : "—") },
    { id: "close_at", label: "Close at", width: 170, sort: (r) => r.close_at, exportValue: (r) => r.close_at ?? "", cell: (r) => (r.close_at ? formatAz(r.close_at) : "—") },
    { id: "sort", label: "Order", width: 80, align: "right", sort: (r) => r.sort_order, cell: (r) => r.sort_order },
    { id: "location", label: "Location", width: 180, defaultHidden: true, sort: (r) => r.location, cell: (r) => r.location || "—" },
    { id: "compensation", label: "Compensation", width: 160, defaultHidden: true, sort: (r) => r.compensation, cell: (r) => r.compensation || "—" },
    { id: "slug", label: "URL", width: 260, defaultHidden: true, sort: (r) => r.slug, cell: (r) => <span className="text-muted-foreground">{jobPath(r.slug)}</span> },
    { id: "summary", label: "Summary", width: 320, defaultHidden: true, exportValue: (r) => r.summary, cell: (r) => <span className="text-muted-foreground">{r.summary || "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      {flash ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          <span>
            {flash.text}{" "}
            {flash.href ? (
              <a href={flash.href} className="font-semibold underline">
                {flash.label}
              </a>
            ) : null}
          </span>
          <button type="button" onClick={() => setFlash(null)} className="text-xs font-medium underline">
            Dismiss
          </button>
        </div>
      ) : null}
      <DataView<JobPosting>
        storageKey="job-postings"
        exportName="sig-job-postings"
        noun={["listing", "listings"]}
        defaultView="table"
        items={rows}
        getId={(r) => r.id}
        title={(r) => r.title}
        subtitle={(r) => [r.department, employmentLabel(r.employment_type), r.location].filter(Boolean).join(" · ")}
        media={() => (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
        )}
        badge={(r) => <StatusPill job={r} />}
        meta={(r) => <span className="block max-w-[16rem] truncate">{r.badge_text ? `${r.badge_text} · ` : ""}{jobPath(r.slug)}</span>}
        columns={columns}
        searchText={(r) => [r.title, r.slug, r.department, r.summary, r.location, r.badge_text, r.status, r.employment_type].join(" ")}
        stats={[
          { label: "Live on site", value: live.length, icon: Globe, hint: "Published & in window" },
          { label: "Open roles", value: live.filter((r) => r.hiring_status === "open").length, icon: Briefcase, hint: "“Positions Available”" },
          { label: "Scheduled", value: rows.filter((r) => r.status === "scheduled" || (r.status === "published" && r.publish_at && Date.parse(r.publish_at) > Date.now())).length, icon: CalendarClock, hint: "Future publish dates" },
          { label: "Drafts", value: rows.filter((r) => r.status === "draft").length, icon: Pencil, hint: "Not on the site" },
        ]}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "live", label: "Live now", test: (r) => isJobLive(r) },
          ...JOB_STATUSES.map((s) => ({ id: s.value, label: s.label, test: (r: JobPosting) => r.status === s.value })),
        ]}
        selectFilters={[
          { id: "department", label: "Department", options: departments, get: (r) => r.department },
          { id: "type", label: "Type", options: EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label })), get: (r) => r.employment_type },
          { id: "hiring", label: "Hiring", options: HIRING_STATUSES.map((t) => ({ value: t.value, label: t.label })), get: (r) => r.hiring_status },
        ]}
        board={{
          lanes: JOB_STATUSES.map((s) => ({ id: s.value, label: s.label })),
          get: (r) => r.status,
          onMove: (r, lane) => setStatus([r], lane as JobStatus).catch((e) => window.alert(e instanceof Error ? e.message : "Could not move that listing.")),
        }}
        date={(r) => r.publish_at ?? r.close_at ?? r.created_at}
        onOpen={(r) => router.push(`/dashboard/careers/${r.id}`)}
        add={disabled ? undefined : { label: "New listing", onClick: () => router.push("/dashboard/careers/new") }}
        actions={[
          { label: "Edit", icon: Pencil, single: true, run: (sel) => router.push(`/dashboard/careers/${sel[0].id}`) },
          { label: "Publish", icon: Rocket, run: (sel) => setStatus(sel, "published") },
          { label: "Close", icon: EyeOff, run: (sel) => setStatus(sel, "closed") },
          { label: "Move to draft", icon: Pencil, run: (sel) => setStatus(sel, "draft") },
          {
            label: "Duplicate",
            icon: Copy,
            single: true,
            run: async (sel) => {
              const res = await duplicateJob(sel[0].id);
              if (!res.ok) throw new Error(res.error);
              router.push(`/dashboard/careers/${res.data.id}`);
            },
          },
          ...(canDraftComms
            ? [
                { label: "Create email template", icon: MailPlus, single: true, run: (sel: JobPosting[]) => draft(sel[0], "email") },
                { label: "Create social post", icon: Share2, single: true, run: (sel: JobPosting[]) => draft(sel[0], "social") },
              ]
            : []),
          { label: "View on site", icon: ExternalLink, single: true, run: (sel) => window.open(jobPath(sel[0].slug), "_blank", "noopener,noreferrer") },
          { label: "Delete", icon: Trash2, destructive: true, run: (sel) => remove(sel) },
        ]}
        empty={disabled ? "Apply the job postings migration to manage listings here." : "No job postings yet. Create the first listing."}
      />
    </div>
  );
}
