"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Loader2, MailPlus, Plus, Save, Share2, Trash2, X } from "lucide-react";
import { changeJobStatus, createJobDraft, duplicateJob, removeJob, saveJobPosting, type ExtraDraft } from "@/app/dashboard/careers/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BADGE_SUGGESTIONS,
  EMPLOYMENT_TYPES,
  HIRING_STATUSES,
  JOB_DEPARTMENTS,
  JOB_STATUSES,
  azToIso,
  formatAz,
  isJobLive,
  isoToAz,
  jobPath,
  jobSlugify,
  jobTypeLabel,
  sectionToText,
  textToSection,
  type EmploymentType,
  type HiringStatus,
  type JobPosting,
  type JobStatus,
} from "@/lib/careers/shared";
import { cn } from "@/lib/utils";

const SECTION_PRESETS = ["About the Role", "Key Responsibilities", "Qualifications", "What We Offer", "Location & Schedule", "Compensation & Benefits"];
const NEW_DEPT = "__new__";

type SectionDraft = { key: number; heading: string; text: string };

function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function JobPostingForm({
  job,
  extraDepartments = [],
  defaultSortOrder = 10,
  canDraftComms,
}: {
  job?: JobPosting;
  extraDepartments?: string[];
  defaultSortOrder?: number;
  canDraftComms: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);

  const [title, setTitle] = useState(job?.title ?? "");
  const [slug, setSlug] = useState(job?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(job));
  const departments = useMemo(() => [...new Set([...JOB_DEPARTMENTS, ...extraDepartments, ...(job ? [job.department] : [])])], [extraDepartments, job]);
  const [department, setDepartment] = useState(job?.department ?? JOB_DEPARTMENTS[0]);
  const [newDept, setNewDept] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [employment, setEmployment] = useState<EmploymentType>(job?.employment_type ?? "full_time");
  const [typeLabel, setTypeLabel] = useState(job?.type_label ?? "");
  const [badge, setBadge] = useState(job?.badge_text ?? (job ? "" : "Open"));
  const [hiring, setHiring] = useState<HiringStatus>(job?.hiring_status ?? "open");
  const [location, setLocation] = useState(job?.location ?? "");
  const [compensation, setCompensation] = useState(job?.compensation ?? "");
  const [summary, setSummary] = useState(job?.summary ?? "");
  const [intro, setIntro] = useState(job?.intro ?? "");
  const [sections, setSections] = useState<SectionDraft[]>(() =>
    job?.sections.length
      ? job.sections.map((s, i) => ({ key: i, heading: s.heading, text: sectionToText(s) }))
      : job
        ? []
        : ["Key Responsibilities", "Qualifications", "What We Offer"].map((heading, i) => ({ key: i, heading, text: "" })),
  );
  const [apply, setApply] = useState(job?.apply_instructions ?? "");
  const [status, setStatus] = useState<JobStatus>(job?.status ?? "draft");
  const [publish, setPublish] = useState(isoToAz(job?.publish_at));
  const [close, setClose] = useState(isoToAz(job?.close_at));
  const [sortOrder, setSortOrder] = useState(String(job?.sort_order ?? defaultSortOrder));
  const [featured, setFeatured] = useState(job?.featured ?? false);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [alsoSocial, setAlsoSocial] = useState(false);

  const effectiveSlug = slugTouched ? slug : jobSlugify(title);
  const publishIso = azToIso(publish.date, publish.time);
  const closeIso = azToIso(close.date, close.time, "23:59");
  const liveNow = isJobLive({ status, publish_at: publishIso, close_at: closeIso });

  function updateSection(key: number, patch: Partial<SectionDraft>) {
    setSections((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function moveSection(key: number, dir: -1 | 1) {
    setSections((list) => {
      const i = list.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addSection(heading = "") {
    setSections((list) => [...list, { key: Math.max(-1, ...list.map((s) => s.key)) + 1, heading, text: "" }]);
  }

  function draftLinks(drafts: ExtraDraft[]) {
    if (!drafts.length) return null;
    return (
      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {drafts.map((d) =>
          d.ok && d.editUrl ? (
            <Link key={d.kind} href={d.editUrl} className="font-semibold underline">
              Open the {d.kind === "email" ? "email template" : "social post"} draft
            </Link>
          ) : (
            <span key={d.kind} className="text-destructive">
              {d.kind === "email" ? "Email template" : "Social post"} not created: {d.error}
            </span>
          ),
        )}
      </span>
    );
  }

  function save() {
    setError(null);
    setNotice(null);
    const dept = addingDept ? newDept.trim() : department;
    if (!dept) return setError("Pick or type a department.");
    start(async () => {
      const res = await saveJobPosting(
        {
          id: job?.id,
          title,
          slug: effectiveSlug,
          department: dept,
          employment_type: employment,
          type_label: typeLabel || null,
          badge_text: badge || null,
          hiring_status: hiring,
          location: location || null,
          compensation: compensation || null,
          summary,
          intro: intro || null,
          sections: sections.map((s) => textToSection(s.heading, s.text)).filter((s) => s.heading || s.items || s.paragraphs),
          apply_instructions: apply || null,
          status,
          publish_at: publishIso,
          close_at: closeIso,
          sort_order: Number(sortOrder) || 0,
          featured,
        },
        job ? {} : { email: alsoEmail, social: alsoSocial },
      );
      if (!res.ok) return setError(res.error);
      if (!job) {
        if (res.data.drafts.length) {
          setNotice(
            <>
              Listing created. {draftLinks(res.data.drafts)}
              <Link href={`/dashboard/careers/${res.data.job.id}`} className="mt-1 block font-semibold underline">
                Continue editing the listing
              </Link>
            </>,
          );
          return;
        }
        router.push(`/dashboard/careers/${res.data.job.id}`);
        return;
      }
      setNotice("Saved.");
      router.refresh();
    });
  }

  function runDraft(kind: "email" | "social") {
    if (!job) return;
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await createJobDraft(job.id, kind);
      if (!res.ok) return setError(res.error);
      setNotice(
        <>
          {kind === "email" ? "Draft email template created (not sent)." : "Draft social post created (not scheduled or published)."}{" "}
          <Link href={res.data.editUrl} className="font-semibold underline">
            Open it
          </Link>
        </>,
      );
    });
  }

  function duplicate() {
    if (!job) return;
    start(async () => {
      const res = await duplicateJob(job.id);
      if (!res.ok) return setError(res.error);
      router.push(`/dashboard/careers/${res.data.id}`);
    });
  }

  function destroy() {
    if (!job || !window.confirm(`Delete "${job.title}"? This removes it from the website and can't be undone.`)) return;
    start(async () => {
      const res = await removeJob(job.id);
      if (!res.ok) return setError(res.error);
      router.push("/dashboard/careers");
    });
  }

  function quickStatus(next: JobStatus) {
    if (!job) return setStatus(next);
    start(async () => {
      const res = await changeJobStatus(job.id, next);
      if (!res.ok) return setError(res.error);
      setStatus(res.data.status);
      setClose(isoToAz(res.data.close_at));
      setNotice(`Status: ${JOB_STATUSES.find((s) => s.value === res.data.status)?.label}.`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Listing</CardTitle>
            <CardDescription>What shows on the role card in “The roles we offer”.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="job-title" className="sm:col-span-2">
              <Input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Associate Financial Planner" maxLength={160} />
            </Field>
            <Field label="URL slug" htmlFor="job-slug" hint={`Detail page: ${jobPath(effectiveSlug || "…")}`} className="sm:col-span-2">
              <Input
                id="job-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(jobSlugify(e.target.value) + (e.target.value.endsWith("-") ? "-" : ""));
                }}
                onBlur={() => setSlug(jobSlugify(effectiveSlug))}
                maxLength={80}
              />
            </Field>
            <Field label="Department (tab)">
              {addingDept ? (
                <div className="flex gap-2">
                  <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department name" maxLength={80} aria-label="New department name" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAddingDept(false)} aria-label="Cancel new department">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <FieldSelect
                  aria-label="Department"
                  value={department}
                  onChange={(v) => (v === NEW_DEPT ? setAddingDept(true) : setDepartment(v))}
                  options={[...departments.map((d) => ({ value: d, label: d })), { value: NEW_DEPT, label: "+ New department…" }]}
                />
              )}
            </Field>
            <Field label="Employment type">
              <FieldSelect aria-label="Employment type" value={employment} onChange={(v) => setEmployment(v as EmploymentType)} options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
            <Field label="Hiring status" hint="Open roles are counted as “Positions Available” and appear under “Open now”.">
              <FieldSelect aria-label="Hiring status" value={hiring} onChange={(v) => setHiring(v as HiringStatus)} options={HIRING_STATUSES.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
            <Field label="Status badge" htmlFor="job-badge" hint="Optional pill on the card, e.g. Open, Part-Time.">
              <Input id="job-badge" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={30} placeholder="None" />
              <div className="flex flex-wrap gap-1.5">
                {BADGE_SUGGESTIONS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBadge(b)}
                    className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:bg-accent", badge === b && "border-primary bg-primary/10 text-primary")}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Location / office" htmlFor="job-location">
              <Input id="job-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chandler or Peoria office" maxLength={160} />
            </Field>
            <Field label="Compensation (optional)" htmlFor="job-comp">
              <Input id="job-comp" value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="$22 – $28/hour" maxLength={160} />
            </Field>
            <Field label="Summary" htmlFor="job-summary" hint={`${summary.length}/600 · one or two sentences for the card.`} className="sm:col-span-2">
              <Textarea id="job-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={600} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail page</CardTitle>
            <CardDescription>
              Leave this empty for a waitlist-only role (the card then links to the career application). In section bodies, lines starting with “- ” become a checklist; other lines are paragraphs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Subtitle" htmlFor="job-type-label" hint={`Shown above the title. Default: “${jobTypeLabel({ type_label: null, employment_type: employment })}”.`}>
              <Input id="job-type-label" value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} maxLength={120} placeholder={jobTypeLabel({ type_label: null, employment_type: employment })} />
            </Field>
            <Field label="About the role" htmlFor="job-intro" hint="The first paragraph is the page's lead. Separate paragraphs with a blank line.">
              <Textarea id="job-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={6} />
            </Field>

            <div className="space-y-3">
              <p className="text-sm font-medium">Sections</p>
              {sections.map((s, i) => (
                <div key={s.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <Input value={s.heading} onChange={(e) => updateSection(s.key, { heading: e.target.value })} placeholder="Section heading" aria-label={`Section ${i + 1} heading`} className="font-medium" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(s.key, -1)} disabled={i === 0} aria-label="Move section up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(s.key, 1)} disabled={i === sections.length - 1} aria-label="Move section down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSections((l) => l.filter((x) => x.key !== s.key))} aria-label="Remove section">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea value={s.text} onChange={(e) => updateSection(s.key, { text: e.target.value })} rows={6} placeholder={"A short paragraph…\n\n- First point\n- Second point"} aria-label={`Section ${i + 1} body`} />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {SECTION_PRESETS.filter((p) => !sections.some((s) => s.heading.toLowerCase() === p.toLowerCase())).map((p) => (
                  <Button key={p} type="button" variant="outline" size="sm" onClick={() => addSection(p)}>
                    <Plus className="h-3.5 w-3.5" /> {p}
                  </Button>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addSection()}>
                  <Plus className="h-3.5 w-3.5" /> Custom section
                </Button>
              </div>
            </div>

            <Field label="How to apply" htmlFor="job-apply" hint="Shown in the “Apply Now” box at the end of the page.">
              <Textarea id="job-apply" value={apply} onChange={(e) => setApply(e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
            <CardDescription>
              {liveNow ? (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Will be live on the website.</span>
              ) : (
                <span>Not visible on the website with these settings.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Status">
              <FieldSelect aria-label="Status" value={status} onChange={(v) => setStatus(v as JobStatus)} options={JOB_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
            </Field>
            <Field label="Publish at (Arizona time)" hint="Optional. Hidden until this time; required for Scheduled.">
              <DateTimePicker date={publish.date} time={publish.time} onChange={(date, time) => setPublish({ date, time })} placeholder="Immediately" />
            </Field>
            <Field label="Close at (Arizona time)" hint="Optional. Removed from the website at this time.">
              <DateTimePicker date={close.date} time={close.time} onChange={(date, time) => setClose({ date, time })} placeholder="No close date" />
            </Field>
            <div className="grid grid-cols-2 items-end gap-3">
              <Field label="Sort order" htmlFor="job-sort" hint="Lower first.">
                <Input id="job-sort" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ""))} />
              </Field>
              <label className="flex items-center gap-2 pb-6 text-sm font-medium">
                <Switch checked={featured} onCheckedChange={setFeatured} aria-label="Featured" /> Featured
              </label>
            </div>

            {!job && canDraftComms ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Also create (drafts only)</p>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>An email template</span>
                  <Switch checked={alsoEmail} onCheckedChange={setAlsoEmail} aria-label="Also create an email template draft" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>A social post</span>
                  <Switch checked={alsoSocial} onCheckedChange={setAlsoSocial} aria-label="Also create a social post draft" />
                </label>
                <p className="text-xs text-muted-foreground">Nothing is sent or published automatically.</p>
              </div>
            ) : null}

            {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
            {notice ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800 dark:text-emerald-300">{notice}</div> : null}

            <Button type="button" className="w-full" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {job ? "Save changes" : "Create listing"}
            </Button>
            {job?.updated_at ? <p className="text-center text-xs text-muted-foreground">Last saved {formatAz(job.updated_at)}</p> : null}
          </CardContent>
        </Card>

        {job ? (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {status !== "published" ? (
                <Button type="button" variant="outline" onClick={() => quickStatus("published")} disabled={pending}>
                  Publish now
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => quickStatus("closed")} disabled={pending}>
                  Close listing
                </Button>
              )}
              {canDraftComms ? (
                <>
                  <Button type="button" variant="outline" onClick={() => runDraft("email")} disabled={pending}>
                    <MailPlus className="h-4 w-4" /> Create email template
                  </Button>
                  <Button type="button" variant="outline" onClick={() => runDraft("social")} disabled={pending}>
                    <Share2 className="h-4 w-4" /> Create social post
                  </Button>
                </>
              ) : null}
              <Button variant="outline" asChild>
                <a href={jobPath(job.slug)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> View on site
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={duplicate} disabled={pending}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              <Button type="button" variant="destructive" onClick={destroy} disabled={pending}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
