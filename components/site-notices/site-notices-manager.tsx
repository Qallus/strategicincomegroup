"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Megaphone, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { removeAnnouncement, saveAnnouncement, saveBlogSidebar } from "@/app/dashboard/site-notices/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_TONES,
  DEFAULT_BLOG_SIDEBAR,
  TONE_LABELS,
  announcementStatus,
  formatAz,
  fromAzParts,
  toAzParts,
  type AnnouncementStatus,
  type AnnouncementTone,
  type BlogSidebarBlock,
  type BlogSidebarContent,
  type SiteAnnouncement,
} from "@/lib/site-notices/shared";
import { cn } from "@/lib/utils";

type Draft = {
  id: string | null;
  message: string;
  link_label: string;
  link_url: string;
  tone: AnnouncementTone;
  enabled: boolean;
  dismissible: boolean;
  priority: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const EMPTY_DRAFT: Draft = {
  id: null, message: "", link_label: "", link_url: "", tone: "navy", enabled: true, dismissible: true, priority: 0,
  startDate: "", startTime: "", endDate: "", endTime: "",
};

function toDraft(a: SiteAnnouncement): Draft {
  const s = toAzParts(a.starts_at);
  const e = toAzParts(a.ends_at);
  return {
    id: a.id, message: a.message, link_label: a.link_label ?? "", link_url: a.link_url ?? "", tone: a.tone, enabled: a.enabled,
    dismissible: a.dismissible, priority: a.priority, startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  };
}

const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  scheduled: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ended: "border-border bg-muted text-muted-foreground",
  off: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};
const STATUS_LABELS: Record<AnnouncementStatus, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", off: "Off" };

export function StatusChip({ status }: { status: AnnouncementStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_STYLES[status])}>
      {status === "live" ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {STATUS_LABELS[status]}
    </span>
  );
}

const PREVIEW_TONES: Record<AnnouncementTone, string> = {
  navy: "bg-[hsl(225_45%_12%)] text-white dark:bg-[hsl(225_40%_16%)]",
  gold: "bg-brand-gold text-[hsl(225_45%_12%)] dark:bg-[hsl(36_40%_32%)] dark:text-white",
  alert: "bg-red-700 text-white dark:bg-red-900",
};

function BarPreview({ d }: { d: Draft }) {
  const Icon = d.tone === "alert" ? TriangleAlert : Megaphone;
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-4 py-2 text-sm", PREVIEW_TONES[d.tone])}>
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <p className="min-w-0 flex-1 text-center leading-snug">
        {d.message || <span className="opacity-60">Your announcement message</span>}
        {d.link_url ? (
          <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap font-semibold underline-offset-4">
            {d.link_label || "Learn more"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </p>
      {d.dismissible ? <X className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : null}
    </div>
  );
}

function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SiteNoticesManager({
  announcements: initial,
  sidebar: initialSidebar,
  sidebarSaved,
  disabled,
}: {
  announcements: SiteAnnouncement[];
  sidebar: BlogSidebarBlock;
  sidebarSaved: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const now = Date.now();

  const sorted = useMemo(() => {
    const order: Record<AnnouncementStatus, number> = { live: 0, scheduled: 1, off: 2, ended: 3 };
    return [...list].sort((a, b) => order[announcementStatus(a, now)] - order[announcementStatus(b, now)] || b.priority - a.priority || Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [list, now]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    setMsg(null);
    start(async () => {
      const res = await saveAnnouncement({
        id: draft.id,
        message: draft.message,
        link_label: draft.link_label,
        link_url: draft.link_url,
        tone: draft.tone,
        enabled: draft.enabled,
        dismissible: draft.dismissible,
        priority: draft.priority,
        starts_at: fromAzParts(draft.startDate, draft.startTime),
        ends_at: fromAzParts(draft.endDate, draft.endTime || "23:59"),
      });
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      setList((l) => [res.data, ...l.filter((x) => x.id !== res.data.id)]);
      setDraft(EMPTY_DRAFT);
      setMsg({ kind: "ok", text: draft.id ? "Announcement updated." : "Announcement saved." });
      router.refresh();
    });
  };

  const toggle = (a: SiteAnnouncement) =>
    start(async () => {
      const res = await saveAnnouncement({ id: a.id, enabled: !a.enabled });
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      setList((l) => l.map((x) => (x.id === a.id ? res.data : x)));
    });

  const remove = (a: SiteAnnouncement) => {
    if (!window.confirm(`Delete "${a.message.slice(0, 60)}"? This can't be undone.`)) return;
    start(async () => {
      const res = await removeAnnouncement(a.id);
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      setList((l) => l.filter((x) => x.id !== a.id));
      if (draft.id === a.id) setDraft(EMPTY_DRAFT);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Site Announcement Bar ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Site Announcement Bar</CardTitle>
          <CardDescription>
            A slim bar above the main menu on every public page. It shows only while it&apos;s on and the current time is inside its start/end window.
            If several are live, the highest priority (then the most recent) wins. Visitors can dismiss it; editing an announcement shows it again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{draft.id ? "Edit announcement" : "New announcement"}</p>
              {draft.id ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(EMPTY_DRAFT)}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Message" htmlFor="ann-message" hint={`${draft.message.length}/280 — keep it short; one sentence reads best on phones.`} className="md:col-span-2">
                <Textarea id="ann-message" rows={2} maxLength={280} value={draft.message} onChange={(e) => set("message", e.target.value)} placeholder="Our offices will close at noon on Wednesday, November 26 for Thanksgiving." />
              </Field>
              <Field label="Link label" htmlFor="ann-link-label" hint="Optional, e.g. 'See details'">
                <Input id="ann-link-label" maxLength={40} value={draft.link_label} onChange={(e) => set("link_label", e.target.value)} />
              </Field>
              <Field label="Link URL" htmlFor="ann-link-url" hint="A site path (/events) or https:// URL">
                <Input id="ann-link-url" value={draft.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="/events" />
              </Field>
              <Field label="Tone">
                <FieldSelect value={draft.tone} onChange={(v) => set("tone", v as AnnouncementTone)} options={ANNOUNCEMENT_TONES.map((t) => ({ value: t, label: TONE_LABELS[t] }))} />
              </Field>
              <Field label="Priority" htmlFor="ann-priority" hint="Higher shows first when more than one is live (-100 to 100)">
                <Input id="ann-priority" type="number" min={-100} max={100} value={draft.priority} onChange={(e) => set("priority", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Start (Arizona time)" hint="Leave empty to start as soon as it's saved">
                <DateTimePicker date={draft.startDate} time={draft.startTime} onChange={(d, t) => setDraft((x) => ({ ...x, startDate: d, startTime: t }))} placeholder="Starts immediately" />
              </Field>
              <Field label="End (Arizona time)" hint="Leave empty to run until turned off">
                <DateTimePicker date={draft.endDate} time={draft.endTime} onChange={(d, t) => setDraft((x) => ({ ...x, endDate: d, endTime: t }))} placeholder="No end date" />
              </Field>
              <div className="flex flex-wrap items-center gap-6 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.enabled} onCheckedChange={(v) => set("enabled", v)} /> Enabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.dismissible} onCheckedChange={(v) => set("dismissible", v)} /> Visitors can dismiss
                </label>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Preview</p>
                <BarPreview d={draft} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button type="button" onClick={submit} disabled={pending || disabled || !draft.message.trim()}>
                {draft.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {pending ? "Saving…" : draft.id ? "Save changes" : "Add announcement"}
              </Button>
              {msg ? <p className={cn("text-sm", msg.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{msg.text}</p> : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">All announcements</p>
            {sorted.length ? (
              <ul className="divide-y rounded-lg border">
                {sorted.map((a) => {
                  const status = announcementStatus(a, now);
                  return (
                    <li key={a.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", draft.id === a.id && "bg-primary/5")}>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip status={status} />
                          <span className="text-xs text-muted-foreground">{TONE_LABELS[a.tone]}</span>
                          {a.priority ? <span className="text-xs text-muted-foreground">· priority {a.priority}</span> : null}
                        </div>
                        <p className="text-sm font-medium">{a.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.starts_at ? `From ${formatAz(a.starts_at)}` : "From when saved"} · {a.ends_at ? `until ${formatAz(a.ends_at)}` : "no end date"}
                          {a.link_url ? ` · links to ${a.link_url}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch checked={a.enabled} disabled={pending} onCheckedChange={() => toggle(a)} aria-label={a.enabled ? "Turn off" : "Turn on"} />
                          {a.enabled ? "On" : "Off"}
                        </label>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setDraft(toDraft(a)); setMsg(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(a)} disabled={pending} aria-label="Delete announcement">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No announcements yet. The bar is hidden until you add one.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Blog Sidebar Notification ─────────────────────────────────────── */}
      <BlogSidebarEditor initial={initialSidebar} saved={sidebarSaved} disabled={disabled} />
    </div>
  );
}

function BlogSidebarEditor({ initial, saved, disabled }: { initial: BlogSidebarBlock; saved: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [c, setC] = useState<BlogSidebarContent>(initial.content);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof BlogSidebarContent>(k: K, v: BlogSidebarContent[K]) => setC((x) => ({ ...x, [k]: v }));

  const submit = () => {
    setMsg(null);
    start(async () => {
      const res = await saveBlogSidebar({ enabled, content: c });
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      setC(res.data.content);
      setEnabled(res.data.enabled);
      setMsg({ kind: "ok", text: "Blog sidebar saved — live on every post." });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blog Sidebar Notification</CardTitle>
        <CardDescription>
          The card under &ldquo;Talk to a planner&rdquo; in the sidebar of every blog post (/resources/…). Use it for contact details and a short, timely
          note. Keep it educational — no performance promises.{!saved ? " Showing the default content; it hasn't been edited yet." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" htmlFor="bs-eyebrow" hint="Small gold label above the title (optional)">
            <Input id="bs-eyebrow" maxLength={60} value={c.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
          </Field>
          <Field label="Title" htmlFor="bs-title">
            <Input id="bs-title" maxLength={120} value={c.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Body" htmlFor="bs-body" hint="Plain text. Leave a blank line between paragraphs." className="md:col-span-2">
            <Textarea id="bs-body" rows={5} maxLength={1500} value={c.body} onChange={(e) => set("body", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="bs-phone" hint="Blank hides the phone row">
            <Input id="bs-phone" maxLength={40} value={c.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="bs-email" hint="Blank hides the email row">
            <Input id="bs-email" type="email" maxLength={160} value={c.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Hours" htmlFor="bs-hours" className="md:col-span-2">
            <Input id="bs-hours" maxLength={120} value={c.hours} onChange={(e) => set("hours", e.target.value)} />
          </Field>
          <Field label="Button label" htmlFor="bs-cta-label" hint="Optional text link at the bottom">
            <Input id="bs-cta-label" maxLength={40} value={c.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
          </Field>
          <Field label="Button link" htmlFor="bs-cta-url" hint="A site path (/contact) or https:// URL">
            <Input id="bs-cta-url" maxLength={300} value={c.cta_url} onChange={(e) => set("cta_url", e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={c.show_offices} onCheckedChange={(v) => set("show_offices", v)} /> Show East Valley (Chandler) &amp; West Valley (Peoria) offices
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} /> Show this card on blog posts
            </label>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={pending || disabled}>
            {pending ? "Saving…" : "Save blog sidebar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setC(DEFAULT_BLOG_SIDEBAR)} disabled={pending}>
            Reset to default content
          </Button>
          {msg ? <p className={cn("text-sm", msg.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{msg.text}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
