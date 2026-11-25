"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, Loader2, Plus, Search, Send, ShieldCheck, Tags, UserPlus, Users, X, FileText,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FieldSelect } from "@/components/ui/field-select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { cn } from "@/lib/utils";

type Kind = "contact" | "participant" | "profile" | "manual";
type Individual = { phone: string; kind: Kind; id: string | null; name: string | null; phoneDisplay?: string };

export type CampaignAudience = {
  contacts: { enabled: boolean; types: ("contact" | "lead")[]; tags: string[]; tagMatch: "any" | "all" };
  segment: { enabled: boolean; tagIds: string[]; match: "any" | "all" };
  individuals: Individual[];
};

type Options = {
  contactTags: { name: string; count: number }[];
  contactCount: number;
  leadCount: number;
  participantTags: { id: string; name: string; category: string; count: number }[];
};

type Preview = {
  total: number;
  eligible: number;
  skippedOptOut: number;
  skippedInvalid: number;
  sample: string;
  sampleName: string | null;
  segments: number;
  recipients: { name: string | null; phone: string; kind: Kind; status: string; error: string | null }[];
};

const EMPTY_AUDIENCE: CampaignAudience = {
  contacts: { enabled: false, types: ["contact", "lead"], tags: [], tagMatch: "any" },
  segment: { enabled: false, tagIds: [], match: "any" },
  individuals: [],
};

const MERGE_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "full_name", label: "Full name" },
  { key: "company", label: "Company" },
];

const STOP_FOOTER = "Reply STOP to opt out.";
const STEPS = ["Audience", "Message", "Review"] as const;

function segmentsFor(text: string) {
  if (!text) return 0;
  const unicode = /[^\x00-\x7F]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return text.length <= single ? 1 : Math.ceil((text.length - single) / multi) + 1;
}

export function CampaignComposer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const actionToken = useDashboardActionToken();
  const [step, setStep] = useState(0);
  const [audience, setAudience] = useState<CampaignAudience>(EMPTY_AUDIENCE);
  const [options, setOptions] = useState<Options | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [addStop, setAddStop] = useState(true);
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([]);
  const [count, setCount] = useState<Preview | null>(null);
  const [counting, setCounting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [when, setWhen] = useState<"now" | "schedule" | "draft">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset each time the composer opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAudience(EMPTY_AUDIENCE);
    setName("");
    setBody("");
    setAddStop(true);
    setPreview(null);
    setCount(null);
    setWhen("now");
    setDate("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || options) return;
    const headers = { "x-sig-action-token": actionToken };
    fetch("/api/admin/sms/campaigns/options", { headers })
      .then((r) => r.json())
      .then((j) => setOptions(j.error ? { contactTags: [], contactCount: 0, leadCount: 0, participantTags: [] } : j))
      .catch(() => undefined);
    fetch("/api/admin/sms/templates?status=active", { headers })
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []))
      .catch(() => undefined);
  }, [open, options, actionToken]);

  const finalBody = useMemo(() => {
    const trimmed = body.trim();
    if (!trimmed || !addStop || /\bSTOP\b/i.test(trimmed)) return trimmed;
    return `${trimmed}\n${STOP_FOOTER}`;
  }, [body, addStop]);

  const hasAudience = audience.contacts.enabled || audience.segment.enabled || audience.individuals.length > 0;

  const runPreview = useCallback(
    async (text: string) => {
      const res = await fetch("/api/admin/sms/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, audience, body: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not preview.");
      return json as Preview;
    },
    [actionToken, audience],
  );

  // Live recipient count while building the audience.
  useEffect(() => {
    if (!open || step !== 0) return;
    if (!hasAudience) {
      setCount(null);
      return;
    }
    let cancelled = false;
    setCounting(true);
    const t = setTimeout(() => {
      runPreview("")
        .then((p) => !cancelled && setCount(p))
        .catch(() => undefined)
        .finally(() => !cancelled && setCounting(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audience, open, step, hasAudience, runPreview]);

  async function goReview() {
    setStep(2);
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await runPreview(finalBody));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview.");
    } finally {
      setPreviewing(false);
    }
  }

  function insertField(key: string) {
    const token = `{${key}}`;
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const scheduledIso = useMemo(() => {
    if (!date || !time) return null;
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [date, time]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, name, body: finalBody, audience, mode: when, scheduledAt: when === "schedule" ? scheduledIso : null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not create the campaign.");
      setConfirming(false);
      onCreated(json.campaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the campaign.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  const canNext = step === 0 ? hasAudience && (count?.eligible ?? 1) > 0 : step === 1 ? Boolean(name.trim() && body.trim()) : true;
  const scheduleInvalid = when === "schedule" && (!scheduledIso || new Date(scheduledIso).getTime() < Date.now());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pb-4 pt-6 text-left">
          <SheetTitle>New SMS campaign</SheetTitle>
          <SheetDescription>Text many people at once. Opted-out numbers are skipped automatically.</SheetDescription>
          <ol className="flex items-center gap-2 pt-2 text-xs">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                    i < step ? "border-primary bg-primary text-primary-foreground" : i === step ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={cn("font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
              </li>
            ))}
          </ol>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 ? <AudienceStep audience={audience} setAudience={setAudience} options={options} /> : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. December client check-in" maxLength={200} />
                <p className="text-xs text-muted-foreground">Only your team sees this.</p>
              </div>

              {templates.length ? (
                <div className="space-y-1.5">
                  <Label>Start from a template</Label>
                  <FieldSelect
                    value=""
                    onChange={(id) => {
                      const tpl = templates.find((t) => t.id === id);
                      if (tpl) setBody(tpl.body);
                    }}
                    options={templates.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="Choose a template…"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <div className="flex items-end justify-between gap-2">
                  <Label htmlFor="campaign-body">Message</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {finalBody.length} chars · {segmentsFor(finalBody)} segment{segmentsFor(finalBody) === 1 ? "" : "s"}
                  </span>
                </div>
                <Textarea
                  id="campaign-body"
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  maxLength={1500}
                  placeholder="Hi {first_name|there}, …"
                  className="resize-none"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Insert:</span>
                  {MERGE_FIELDS.map((f) => (
                    <button key={f.key} type="button" onClick={() => insertField(f.key)} className="rounded-full border px-2.5 py-0.5 text-xs hover:border-primary hover:text-primary">
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Use <code className="font-mono">{"{first_name|there}"}</code> to fall back to “there” when a name is missing.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Add opt-out line</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Appends “{STOP_FOOTER}” — carriers expect it on bulk texts.</p>
                </div>
                <Switch checked={addStop} onCheckedChange={setAddStop} aria-label="Add opt-out line" />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              {previewing || !preview ? (
                <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Building the recipient list…</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <CountTile label="Will receive" value={preview.eligible} strong />
                    <CountTile label="Opted out / no consent" value={preview.skippedOptOut} />
                    <CountTile label="Invalid numbers" value={preview.skippedInvalid} />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sample{preview.sampleName ? ` — as ${preview.sampleName} will see it` : ""}
                    </p>
                    <div className="rounded-2xl bg-muted/60 p-4">
                      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
                        {preview.sample || <span className="opacity-70">(empty)</span>}
                      </div>
                      <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{preview.segments} segment{preview.segments === 1 ? "" : "s"} per text · ~{preview.eligible * preview.segments} segments total</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</p>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="When to send">
                      {([
                        { v: "now", label: "Send now", icon: Send },
                        { v: "schedule", label: "Schedule", icon: CalendarClock },
                        { v: "draft", label: "Save draft", icon: FileText },
                      ] as const).map(({ v, label, icon: Icon }) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={when === v}
                          onClick={() => setWhen(v)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm",
                            when === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                    {when === "schedule" ? (
                      <DateTimePicker date={date} time={time} onChange={(d, t) => { setDate(d); setTime(t || "09:00"); }} placeholder="Pick a date & time…" />
                    ) : null}
                  </div>

                  <details className="group rounded-lg border">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
                      Recipients ({preview.total}){preview.total > preview.recipients.length ? ` — first ${preview.recipients.length}` : ""}
                    </summary>
                    <ul className="max-h-64 divide-y overflow-y-auto border-t">
                      {preview.recipients.map((r, i) => (
                        <li key={`${r.phone}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{r.name ?? r.phone}</span>
                          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{r.phone}</span>
                          <RecipientBadge status={r.status} title={r.error ?? undefined} />
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </div>
          ) : null}

          {error ? <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-background px-6 py-4">
          <div className="min-w-0 text-xs text-muted-foreground">
            {step === 0 ? (
              counting ? (
                <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…</span>
              ) : count ? (
                <span><span className="font-semibold text-foreground">{count.eligible}</span> will receive{count.total - count.eligible ? ` · ${count.total - count.eligible} skipped` : ""}</span>
              ) : (
                "Choose who to text."
              )
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            )}
            {step === 0 ? <Button onClick={() => setStep(1)} disabled={!canNext} className="gap-1.5">Next <ArrowRight className="h-4 w-4" /></Button> : null}
            {step === 1 ? <Button onClick={goReview} disabled={!canNext} className="gap-1.5">Review <ArrowRight className="h-4 w-4" /></Button> : null}
            {step === 2 ? (
              <Button
                onClick={() => (when === "draft" ? submit() : setConfirming(true))}
                disabled={!preview || previewing || saving || (when !== "draft" && !preview.eligible) || scheduleInvalid}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : when === "now" ? <Send className="h-4 w-4" /> : when === "schedule" ? <CalendarClock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {when === "now" ? "Send" : when === "schedule" ? "Schedule" : "Save draft"}
              </Button>
            ) : null}
          </div>
        </div>

        <Dialog open={confirming} onOpenChange={(o) => !saving && setConfirming(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{when === "now" ? `Send to ${preview?.eligible ?? 0} people now?` : `Schedule for ${preview?.eligible ?? 0} people?`}</DialogTitle>
              <DialogDescription>
                {when === "now"
                  ? "Texts start going out right away and can't be unsent. You can cancel the rest while it's sending."
                  : `It will start ${scheduledIso ? new Date(scheduledIso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}. You can cancel it until then.`}
                {preview && preview.total - preview.eligible > 0 ? ` ${preview.total - preview.eligible} number${preview.total - preview.eligible === 1 ? " is" : "s are"} skipped (opted out, no consent or invalid).` : ""}
              </DialogDescription>
            </DialogHeader>
            {preview ? <div className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">{preview.sample}</div> : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {when === "now" ? "Send now" : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

// ── Audience step ──────────────────────────────────────────────────────────

function AudienceStep({ audience, setAudience, options }: { audience: CampaignAudience; setAudience: React.Dispatch<React.SetStateAction<CampaignAudience>>; options: Options | null }) {
  const setContacts = (patch: Partial<CampaignAudience["contacts"]>) => setAudience((a) => ({ ...a, contacts: { ...a.contacts, ...patch } }));
  const setSegment = (patch: Partial<CampaignAudience["segment"]>) => setAudience((a) => ({ ...a, segment: { ...a.segment, ...patch } }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-4">
      <Section
        icon={Users}
        title="Contacts & leads"
        description={options ? `${options.contactCount} contacts and ${options.leadCount} leads with a phone number. Only those with SMS consent on file are texted.` : "From the Contacts page."}
        enabled={audience.contacts.enabled}
        onToggle={(v) => setContacts({ enabled: v })}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(["contact", "lead"] as const).map((t) => (
              <Chip key={t} active={audience.contacts.types.includes(t)} onClick={() => setContacts({ types: toggle(audience.contacts.types, t).length ? toggle(audience.contacts.types, t) : audience.contacts.types })}>
                {t === "contact" ? "Contacts" : "Leads"}
              </Chip>
            ))}
          </div>
          {options?.contactTags.length ? (
            <TagPicker
              label="Only with tags"
              tags={options.contactTags.map((t) => ({ value: t.name, label: t.name, count: t.count }))}
              selected={audience.contacts.tags}
              onToggle={(v) => setContacts({ tags: toggle(audience.contacts.tags, v) })}
              match={audience.contacts.tagMatch}
              onMatch={(m) => setContacts({ tagMatch: m })}
            />
          ) : null}
        </div>
      </Section>

      <Section
        icon={Tags}
        title="Participant segment"
        description="Participants matched by tags — the same segments as Tags & Segments. No tags = every participant with a phone."
        enabled={audience.segment.enabled}
        onToggle={(v) => setSegment({ enabled: v })}
      >
        {options?.participantTags.length ? (
          <TagPicker
            label="Tags"
            tags={options.participantTags.map((t) => ({ value: t.id, label: t.name, count: t.count }))}
            selected={audience.segment.tagIds}
            onToggle={(v) => setSegment({ tagIds: toggle(audience.segment.tagIds, v) })}
            match={audience.segment.match}
            onMatch={(m) => setSegment({ match: m })}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{options ? "No participant tags yet." : "Loading tags…"}</p>
        )}
      </Section>

      <IndividualsPicker
        value={audience.individuals}
        onChange={(individuals) => setAudience((a) => ({ ...a, individuals }))}
      />
    </div>
  );
}

function Section({ icon: Icon, title, description, enabled, onToggle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border transition-colors", enabled && "border-primary/50 bg-primary/[0.03]")}>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Include ${title}`} />
      </div>
      {enabled ? <div className="border-t px-4 py-3">{children}</div> : null}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/60")}
    >
      {active ? <Check className="h-3 w-3" /> : null}
      {children}
    </button>
  );
}

function TagPicker({ label, tags, selected, onToggle, match, onMatch }: { label: string; tags: { value: string; label: string; count: number }[]; selected: string[]; onToggle: (v: string) => void; match: "any" | "all"; onMatch: (m: "any" | "all") => void }) {
  const [filter, setFilter] = useState("");
  const shown = tags.filter((t) => t.label.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}{selected.length ? ` · ${selected.length} selected` : ""}</span>
        <div className="inline-flex rounded-md border p-0.5 text-[11px]" role="radiogroup" aria-label="Tag match">
          {(["any", "all"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={match === m} onClick={() => onMatch(m)} className={cn("rounded px-2 py-0.5 font-medium", match === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {m === "any" ? "Any tag" : "All tags"}
            </button>
          ))}
        </div>
      </div>
      {tags.length > 12 ? <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tags…" className="h-8 text-xs" /> : null}
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map((t) => (
          <Chip key={t.value} active={selected.includes(t.value)} onClick={() => onToggle(t.value)}>
            {t.label} <span className="tabular-nums opacity-70">{t.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

function IndividualsPicker({ value, onChange }: { value: Individual[]; onChange: (v: Individual[]) => void }) {
  const actionToken = useDashboardActionToken();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Individual & { email?: string | null })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/sms/recipients?search=${encodeURIComponent(q)}`, { headers: { "x-sig-action-token": actionToken } });
        const json = await res.json().catch(() => ({}));
        if (!cancelled)
          setResults(((json.recipients ?? []) as any[]).slice(0, 8).map((r) => ({ phone: r.phone, kind: r.kind, id: r.id, name: r.name, phoneDisplay: r.phoneDisplay, email: r.email })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, actionToken]);

  const digits = query.replace(/\D/g, "");
  const typed = digits.length === 10 || (digits.length === 11 && digits.startsWith("1")) ? `+${digits.length === 10 ? "1" : ""}${digits}` : null;
  const has = (phone: string) => value.some((v) => v.phone.replace(/\D/g, "").slice(-10) === phone.replace(/\D/g, "").slice(-10));
  const add = (i: Individual) => {
    if (!has(i.phone)) onChange([...value, i]);
    setQuery("");
  };

  return (
    <div className="rounded-xl border">
      <div className="flex gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><UserPlus className="h-4 w-4 text-muted-foreground" /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">Specific people</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Add anyone by name, email or number.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search or type a number…" className="pl-8" />
            {query.trim().length >= 2 ? (
              <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                {loading ? <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</p> : null}
                {typed && !results.some((r) => r.phone.replace(/\D/g, "").endsWith(digits.slice(-10))) ? (
                  <button type="button" onClick={() => add({ phone: typed, kind: "manual", id: null, name: null, phoneDisplay: typed })} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <Plus className="h-3.5 w-3.5" /> Add {typed}
                  </button>
                ) : null}
                {results.map((r) => (
                  <button key={`${r.kind}-${r.id}`} type="button" disabled={has(r.phone)} onClick={() => add(r)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.name ?? r.phoneDisplay}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.phoneDisplay}{r.email ? ` · ${r.email}` : ""}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{r.kind}</span>
                    {has(r.phone) ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </button>
                ))}
                {!loading && !results.length && !typed ? <p className="p-2 text-xs text-muted-foreground">No matches. Type a full number to add it.</p> : null}
              </div>
            ) : null}
          </div>
          {value.length ? (
            <div className="flex flex-wrap gap-1.5">
              {value.map((v) => (
                <span key={v.phone} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
                  {v.name ?? v.phoneDisplay ?? v.phone}
                  <button type="button" aria-label={`Remove ${v.name ?? v.phone}`} onClick={() => onChange(value.filter((x) => x.phone !== v.phone))} className="rounded-full p-0.5 hover:bg-background hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CountTile({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", strong && "border-primary/50 bg-primary/5")}>
      <p className={cn("text-2xl font-semibold tabular-nums", strong && "text-primary")}>{value}</p>
      <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
    </div>
  );
}

export function RecipientBadge({ status, title }: { status: string; title?: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    queued: { label: "Queued", variant: "outline" },
    sending: { label: "Sending", variant: "secondary" },
    sent: { label: "Sent", variant: "secondary" },
    delivered: { label: "Delivered", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
    skipped_opt_out: { label: "Opted out", variant: "outline" },
    skipped_invalid: { label: "Invalid", variant: "outline" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={m.variant} className="shrink-0 text-[10px]" title={title}>
      {m.label}
    </Badge>
  );
}
