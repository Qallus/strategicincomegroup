"use client";

// Public booking flow: 1 Appointment · 2 Date & time · 3 Your details → confirmation.
// Desktop: step card + a sticky booking summary. Mobile: stacked, sticky bottom Continue.

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock, Globe, Loader2, Lock, Mail, MapPin,
  MessageSquareText, Phone, Settings2, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAttribution } from "@/lib/analytics/attribution";
import type { CalendarEvent } from "@/lib/booking/ics";
import { BOOKING_AUDIENCE_LABELS, type BookingAudience, type IntakeQuestion, type Slot } from "@/lib/booking/types";
import { BookingCalendar, Empty } from "@/components/booking/booking-calendar";
import { AddToCalendar } from "@/components/booking/add-to-calendar";
import { NotifyPrefs } from "@/components/booking/notify-prefs";
import { LOCATION_LABEL, fmtDay, fmtTime, prefersReducedMotion, tzCity, tzLabel, tzName } from "@/components/booking/format";

const ICONS: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: MapPin, custom: Clock };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Step = "type" | "time" | "details" | "done";
const STEP_ORDER: Step[] = ["type", "time", "details"];

export type MeetingOption = {
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  locationType: string;
  locationDetails: string | null;
  office: string | null;
  audience: BookingAudience;
  color: string | null;
  timezone: string;
  questions: IntakeQuestion[];
  maxAdvanceDays: number;
};
export type PlannerInfo = { name: string; credentials: string | null; title: string | null; slug: string | null; photo: string | null; office: string | null };
type Result = {
  reference: string; message: string | null; start: string; end: string;
  notify: { email: boolean; sms: boolean }; manageUrl: string | null;
};

function locationLine(o: MeetingOption) {
  return o.locationType === "in_person" ? (o.office ? `In person · ${o.office}` : "In person") : LOCATION_LABEL[o.locationType] ?? "Details to follow";
}

export function BookWidget(props: {
  initialSlug: string;
  options: MeetingOption[];
  planner: PlannerInfo | null;
  /** Fallback host name when the page isn't on a planner page. */
  hostName: string | null;
  officePhone?: string;
  officePhoneHref?: string;
}) {
  const { options } = props;
  const [slug, setSlug] = React.useState(props.initialSlug);
  const opt = options.find((o) => o.slug === slug) ?? options[0];
  const host = props.planner?.name || props.hostName || "Strategic Income Group";
  const hostShort = host.split(",")[0];
  const hostFirst = hostShort.split(/\s+/)[0];
  const timezone = opt.timezone || "America/Phoenix";

  const [step, setStep] = React.useState<Step>("time");
  const [reached, setReached] = React.useState(1); // highest step index visited (0-based)
  function go(next: Step) {
    setStep(next);
    const i = STEP_ORDER.indexOf(next);
    if (i >= 0) setReached((r) => Math.max(r, i));
  }

  // ── availability ──
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [localTz, setLocalTz] = React.useState<string | null>(null);
  const [displayTz, setDisplayTz] = React.useState(timezone);
  React.useEffect(() => {
    try { setLocalTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null); } catch { setLocalTz(null); }
  }, []);
  React.useEffect(() => { setDisplayTz(timezone); }, [timezone]);
  const now = new Date().toISOString();
  const tzDiffers = Boolean(localTz && localTz !== timezone && fmtTime(now, localTz) !== fmtTime(now, timezone));

  const reqId = React.useRef(0);
  const loadSlots = React.useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setLoadError(false);
    try {
      const from = new Date().toISOString().slice(0, 10);
      const toD = new Date(Date.now() + Math.min(120, (opt.maxAdvanceDays || 60) + 1) * 86400000).toISOString().slice(0, 10);
      const res = await fetch(`/api/booking/slots?slug=${encodeURIComponent(opt.slug)}&from=${from}&to=${toD}`, { cache: "no-store" });
      if (!res.ok) throw new Error("slots");
      const r = await res.json();
      if (id === reqId.current) setSlots(r.slots ?? []);
    } catch {
      if (id === reqId.current) { setSlots([]); setLoadError(true); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [opt.slug, opt.maxAdvanceDays]);
  React.useEffect(() => { void loadSlots(); }, [loadSlots]);

  function chooseType(next: string) {
    if (next === slug) return;
    setSlug(next);
    setSelectedSlot(null);
    setNotice(null);
    setAnswers({});
    try { window.history.replaceState(null, "", `/book/${next}`); } catch { /* ignore */ }
  }

  // ── details ──
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [notifySms, setNotifySms] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const phoneDigits = phone.replace(/\D/g, "");

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.name = "Please enter your name.";
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email so we can confirm your booking.";
    if (phone.trim() && phoneDigits.length < 10) e.phone = "Enter a full phone number, including area code.";
    if (notifySms && phoneDigits.length < 10) e.phone = "Add a mobile number to get text reminders.";
    for (const q of opt.questions) if (q.required && !answers[q.key]?.trim()) e[`q_${q.key}`] = "This one’s required.";
    return e;
  }

  // Focus the new step's heading so keyboard and screen-reader users follow along.
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [step]);

  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (!selectedSlot) { go("time"); return; }
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const firstKey = ["name", "email", "phone", ...opt.questions.map((q) => `q_${q.key}`)].find((k) => e[k]);
      if (firstKey) document.getElementById(`bk-${firstKey}`)?.focus();
      return;
    }
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch("/api/booking/book", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: opt.slug, start_at: selectedSlot.start, invitee_name: fullName.trim(), invitee_email: email.trim() || null,
          invitee_phone: phone.trim() || null, answers, notify_email: notifyEmail, notify_sms: notifySms, attribution: getAttribution(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setSelectedSlot(null); go("time");
          setNotice("Sorry — that time was just taken. Here are the latest openings.");
          await loadSlots();
          return;
        }
        throw new Error(json.message || "We couldn’t complete your booking.");
      }
      setResult({
        reference: json.reference, message: json.confirmation_message, start: json.start_at, end: json.end_at,
        notify: json.notify ?? { email: notifyEmail, sms: notifySms }, manageUrl: json.manage_url ?? null,
      });
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "We couldn’t complete your booking.");
    } finally {
      setSubmitting(false);
    }
  }

  function onContinue() {
    if (step === "type") go("time");
    else if (step === "time") { if (selectedSlot) { setNotice(null); go("details"); } }
    else if (step === "details") void submit();
  }
  const canContinue = step === "type" || (step === "time" && Boolean(selectedSlot)) || (step === "details" && !submitting);
  const continueLabel = step === "details" ? (submitting ? "Booking…" : "Confirm booking") : "Continue";

  const liveMsg = step === "details" && selectedSlot
    ? `Selected ${fmtDay(selectedSlot.start, displayTz)} at ${fmtTime(selectedSlot.start, displayTz)}. Enter your details.`
    : step === "done" ? "Your appointment is confirmed." : "";

  if (step === "done" && result) {
    return (
      <div ref={rootRef} className="scroll-mt-24">
        <p className="sr-only" aria-live="polite">{liveMsg}</p>
        <Success
          headingRef={headingRef} name={fullName.trim()} result={result} opt={opt} host={host} planner={props.planner}
          tz={displayTz} email={email.trim()} phone={phone.trim()} officePhone={props.officePhone} officePhoneHref={props.officePhoneHref}
        />
      </div>
    );
  }

  const tzControl = tzDiffers && localTz ? (
    <div role="group" aria-label="Show times in" className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
      {[timezone, localTz].map((tz) => (
        <button
          key={tz}
          type="button"
          aria-pressed={displayTz === tz}
          onClick={() => setDisplayTz(tz)}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            displayTz === tz ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tz === timezone ? `${tzCity(tz)} time` : `Your time (${tzName(tz)})`}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="scroll-mt-24 pb-24 lg:pb-0">
      <p className="sr-only" aria-live="polite">{liveMsg}</p>
      <Stepper step={step} reached={reached} onGo={(s) => go(s)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          {step === "type" ? (
            <section key="type" className="sig-book-in" aria-labelledby="bk-step-title">
              <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Choose an appointment</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select the meeting that best fits what you need{props.planner ? ` with ${hostShort}` : ""}.</p>
              <TypePicker options={options} value={opt.slug} onChange={chooseType} />
            </section>
          ) : null}

          {step === "time" ? (
            <section key="time" className="sig-book-in" aria-labelledby="bk-step-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Pick a date &amp; time</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {opt.name} · {opt.durationMinutes} min · {locationLine(opt)}
                  </p>
                </div>
                {options.length > 1 ? (
                  <button type="button" onClick={() => go("type")} className="rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Change appointment
                  </button>
                ) : null}
              </div>
              {notice ? (
                <div role="status" className="sig-book-in mt-4 flex items-start gap-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {notice}
                </div>
              ) : null}
              <BookingCalendar
                className="mt-5"
                slots={slots}
                loading={loading}
                error={loadError}
                onRetry={() => void loadSlots()}
                timezone={displayTz}
                maxAdvanceDays={opt.maxAdvanceDays}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
                tzControl={tzControl}
                empty={
                  <Empty icon={CalendarDays} title="No times are available" body={`${hostFirst}’s calendar is full for the next few weeks. Call and we’ll find you a time.`}>
                    {props.officePhoneHref ? <Button asChild size="sm"><a href={props.officePhoneHref}><Phone className="h-4 w-4" /> {props.officePhone}</a></Button> : null}
                  </Empty>
                }
              />
            </section>
          ) : null}

          {step === "details" && selectedSlot ? (
            <form id="bk-form" key="details" onSubmit={submit} noValidate className="sig-book-in">
              <button type="button" onClick={() => go("time")} className="mb-3 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back to times
              </button>
              <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Your details</h2>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your selection">
                <Chip onClick={() => go("type")} label="Change appointment">{opt.name}</Chip>
                <Chip onClick={() => go("time")} label="Change date">{fmtDay(selectedSlot.start, displayTz, false)}</Chip>
                <Chip onClick={() => go("time")} label="Change time">{fmtTime(selectedSlot.start, displayTz)} <span className="text-muted-foreground">({tzName(displayTz)})</span></Chip>
              </ul>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field id="bk-name" label="Full name" required error={errors.name} className="sm:col-span-2">
                  <Input id="bk-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" {...ariaFor("bk-name", errors.name)} />
                </Field>
                <Field id="bk-email" label="Email" required error={errors.email}>
                  <Input id="bk-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" {...ariaFor("bk-email", errors.email)} />
                </Field>
                <Field id="bk-phone" label="Phone" hint={notifySms ? "Required for texts" : "Optional"} error={errors.phone}>
                  <Input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(480) 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" {...ariaFor("bk-phone", errors.phone)} />
                </Field>
                {opt.questions.map((q) => {
                  const id = `bk-q_${q.key}`;
                  const err = errors[`q_${q.key}`];
                  const set = (v: string) => setAnswers((a) => ({ ...a, [q.key]: v }));
                  return (
                    <Field key={q.key} id={id} label={q.label} required={q.required} error={err} className="sm:col-span-2">
                      {q.type === "textarea" ? (
                        <Textarea id={id} rows={3} value={answers[q.key] ?? ""} onChange={(e) => set(e.target.value)} {...ariaFor(id, err)} />
                      ) : q.type === "select" ? (
                        <Select value={answers[q.key] || undefined} onValueChange={set}>
                          <SelectTrigger id={id} className="h-11" {...ariaFor(id, err)}><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {(q.options ?? []).filter(Boolean).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input id={id} className="h-11" type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"} value={answers[q.key] ?? ""} onChange={(e) => set(e.target.value)} {...ariaFor(id, err)} />
                      )}
                    </Field>
                  );
                })}
              </div>

              <NotifyPrefs
                notifyEmail={notifyEmail}
                notifySms={notifySms}
                onEmail={setNotifyEmail}
                onSms={(v) => {
                  setNotifySms(v);
                  if (v && phoneDigits.length < 10) requestAnimationFrame(() => document.getElementById("bk-phone")?.focus());
                  if (!v && errors.phone === "Add a mobile number to get text reminders.") setErrors(({ phone: _p, ...rest }) => rest);
                }}
                missingPhone={notifySms && phoneDigits.length < 10}
              />

              {submitError ? (
                <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {submitError}
                </div>
              ) : null}

              <Button type="submit" className="mt-6 hidden h-12 w-full text-base lg:inline-flex" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking your time…</> : <><Check className="h-4 w-4" /> Confirm booking</>}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Free and no obligation. Your details go only to {hostShort} and the SIG team.
              </p>
            </form>
          ) : null}
        </div>

        {/* Sticky booking summary (desktop) */}
        <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Booking summary">
          <Summary
            opt={opt} host={host} planner={props.planner} slot={selectedSlot} tz={displayTz}
            name={fullName.trim()} email={email.trim()}
            footer={
              step !== "details" ? (
                <Button type="button" className="h-11 w-full" disabled={!canContinue} onClick={onContinue}>
                  {continueLabel} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" form="bk-form" className="h-11 w-full" disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</> : <><Check className="h-4 w-4" /> Confirm booking</>}
                </Button>
              )
            }
          />
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            Already booked? <Link href="/book/manage" className="font-medium text-primary underline-offset-2 hover:underline">Manage your appointments</Link>
          </p>
        </aside>
      </div>

      {/* Sticky Continue (mobile / tablet) */}
      <div className="sig-book-sticky fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs leading-tight">
            <p className="truncate font-semibold">{opt.name}</p>
            <p className="truncate text-muted-foreground">
              {selectedSlot ? `${fmtDay(selectedSlot.start, displayTz, false)} · ${fmtTime(selectedSlot.start, displayTz)}` : `${opt.durationMinutes} min · pick a time`}
            </p>
          </div>
          {step === "details" ? (
            <Button type="submit" form="bk-form" className="h-11 shrink-0 px-5" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {continueLabel}
            </Button>
          ) : (
            <Button type="button" className="h-11 shrink-0 px-5" disabled={!canContinue} onClick={onContinue}>
              {continueLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

function ariaFor(id: string, error?: string) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined } as const;
}

function Stepper({ step, reached, onGo }: { step: Step; reached: number; onGo: (s: Step) => void }) {
  const steps: [Step, string][] = [["type", "Appointment"], ["time", "Date & time"], ["details", "Your details"]];
  const current = STEP_ORDER.indexOf(step);
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center">
        {steps.map(([key, label], i) => {
          const done = i < current;
          const isCurrent = i === current;
          const canGo = i <= reached && !isCurrent;
          const circle = (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                done ? "border-primary bg-primary text-primary-foreground" : isCurrent ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
          );
          const text = (
            <span className={cn("whitespace-nowrap text-sm", isCurrent ? "font-semibold text-foreground" : done ? "font-medium text-foreground" : "text-muted-foreground", !isCurrent && "hidden sm:inline")}>
              {label}
              <span className="sr-only">{done ? " (completed)" : isCurrent ? " (current step)" : ""}</span>
            </span>
          );
          return (
            <li key={key} className={cn("flex items-center", i < steps.length - 1 && "flex-1")} aria-current={isCurrent ? "step" : undefined}>
              {canGo ? (
                <button type="button" onClick={() => onGo(key)} className="flex items-center gap-2 rounded-full pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {circle}{text}
                </button>
              ) : (
                <span className="flex items-center gap-2">{circle}{text}</span>
              )}
              {i < steps.length - 1 ? (
                <span aria-hidden className="relative mx-3 h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-border">
                  <span className={cn("absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 motion-reduce:transition-none", i < current ? "w-full" : "w-0")} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TypePicker({ options, value, onChange }: { options: MeetingOption[]; value: string; onChange: (slug: string) => void }) {
  const [open, setOpen] = React.useState<string | null>(value);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  function onKey(e: React.KeyboardEvent, i: number) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(i + delta + options.length) % options.length];
    onChange(next.slug);
    setOpen(next.slug);
    refs.current.get(next.slug)?.focus();
  }
  return (
    <div role="radiogroup" aria-label="Appointment type" className="mt-5 space-y-3">
      {options.map((o, i) => {
        const sel = o.slug === value;
        const expanded = open === o.slug;
        const Icon = ICONS[o.locationType] ?? Clock;
        return (
          <div key={o.slug} className={cn("overflow-hidden rounded-2xl border bg-card transition-shadow", sel ? "border-primary shadow-sm ring-1 ring-primary/20" : "hover:border-primary/40")}>
            <div className="flex items-center gap-3 p-4">
              <button
                ref={(el) => { if (el) refs.current.set(o.slug, el); else refs.current.delete(o.slug); }}
                type="button"
                role="radio"
                aria-checked={sel}
                tabIndex={sel ? 0 : -1}
                onClick={() => { onChange(o.slug); setOpen(o.slug); }}
                onKeyDown={(e) => onKey(e, i)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <span aria-hidden className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors", sel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {sel ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color || "hsl(var(--primary))" }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.name}</span>
                    {o.audience !== "everyone" ? (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{BOOKING_AUDIENCE_LABELS[o.audience]}</span>
                    ) : null}
                  </span>
                  {o.description && !expanded ? <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{o.description}</span> : null}
                </span>
              </button>
              <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums">{o.durationMinutes} min</span>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`bk-type-${o.slug}`}
                aria-label={`${expanded ? "Hide" : "Show"} details for ${o.name}`}
                onClick={() => setOpen(expanded ? null : o.slug)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
              </button>
            </div>
            {expanded ? (
              <div id={`bk-type-${o.slug}`} className="sig-book-in border-t bg-muted/30 px-4 py-3 text-sm">
                {o.description ? <p className="text-muted-foreground">{o.description}</p> : null}
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden /> {o.durationMinutes} minutes</span>
                  <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" aria-hidden /> {locationLine(o)}</span>
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-label={`${label}: ${typeof children === "string" ? children : ""}`.trim()} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm font-medium transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </button>
    </li>
  );
}

function Field({ id, label, required, hint, error, className, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? <span className="text-destructive" aria-hidden> *</span> : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function PlannerMini({ host, planner }: { host: string; planner: PlannerInfo | null }) {
  return (
    <div className="flex items-center gap-3">
      {planner?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={planner.photo} alt="" className="h-14 w-14 shrink-0 rounded-xl border bg-gradient-to-b from-muted to-background object-cover object-top" />
      ) : (
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted font-serif text-2xl text-muted-foreground">{host.charAt(0)}</span>
      )}
      <div className="min-w-0">
        <p className="font-serif text-lg leading-tight">{host.split(",")[0]}</p>
        {planner?.credentials ? <p className="text-xs font-medium text-gold">{planner.credentials}</p> : null}
        {planner?.title ? <p className="truncate text-xs text-muted-foreground">{planner.title}</p> : null}
      </div>
    </div>
  );
}

function Summary({ opt, host, planner, slot, tz, name, email, footer }: {
  opt: MeetingOption; host: string; planner: PlannerInfo | null; slot: Slot | null; tz: string; name: string; email: string; footer: React.ReactNode;
}) {
  const rows: [string, React.ReactNode, boolean][] = [
    ["Appointment", opt.name, true],
    ["Duration", `${opt.durationMinutes} minutes`, true],
    ["Where", locationLine(opt), true],
    ["Date", slot ? fmtDay(slot.start, tz, false) : "Not selected", Boolean(slot)],
    ["Time", slot ? `${fmtTime(slot.start, tz)} – ${fmtTime(slot.end, tz)}` : "Not selected", Boolean(slot)],
    ["Contact", name || email ? [name, email].filter(Boolean).join(" · ") : "Add your details", Boolean(name || email)],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative border-b p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Booking summary</p>
        <div className="mt-3"><PlannerMini host={host} planner={planner} /></div>
      </div>
      <dl className="divide-y px-5 text-sm">
        {rows.map(([k, v, filled]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd key={String(v)} className={cn("min-w-0 text-right", filled ? "sig-book-in font-medium" : "text-muted-foreground")}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-1.5 px-5 pb-1 pt-2 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> {tzLabel(tz)}</p>
      <div className="p-5 pt-3">{footer}</div>
    </div>
  );
}

function Success(p: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  name: string; result: Result; opt: MeetingOption; host: string; planner: PlannerInfo | null;
  tz: string; email: string; phone: string; officePhone?: string; officePhoneHref?: string;
}) {
  const first = p.name.split(/\s+/)[0];
  const hostShort = p.host.split(",")[0];
  const LIcon = ICONS[p.opt.locationType] ?? Clock;
  const token = p.result.manageUrl?.split("/").pop() ?? null;
  const absoluteManage = p.result.manageUrl && typeof window !== "undefined" ? `${window.location.origin}${p.result.manageUrl}` : null;
  const calEvent: CalendarEvent = {
    uid: p.result.reference,
    title: `${p.opt.name} with ${p.host}`,
    description: [
      `${p.opt.name} with ${p.host} — Strategic Income Group.`,
      `Reference: ${p.result.reference}`,
      absoluteManage ? `Reschedule or cancel: ${absoluteManage}` : p.officePhone ? `Need to reschedule? Call ${p.officePhone}.` : "",
    ].filter(Boolean).join("\n"),
    location: p.opt.locationType === "in_person" ? p.opt.locationDetails || p.opt.office || "Strategic Income Group" : LOCATION_LABEL[p.opt.locationType],
    start: p.result.start,
    end: p.result.end,
    url: absoluteManage,
  };
  const expect = [
    { title: p.result.notify.email ? "Check your inbox" : "Save the date", body: p.result.notify.email ? `Your confirmation and calendar invite are on the way to ${p.email}.` : "Add it to your calendar above so it’s easy to find." },
    { title: `${hostShort.split(" ")[0]} prepares`, body: "Your planner reviews your notes so the time is spent on what matters to you." },
    {
      title: "We meet",
      body: p.opt.locationType === "in_person" ? "Come as you are — bring any statements or questions you’d like to cover." : p.opt.locationType === "phone" ? `We’ll call you${p.phone ? ` at ${p.phone}` : ""} at the scheduled time.` : "We’ll send any meeting details ahead of time.",
    },
  ];
  return (
    <div className="sig-book-in mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative border-b bg-gradient-to-b from-brand-gold/10 to-transparent px-6 pb-8 pt-10 text-center sm:px-10">
        <div className="relative mx-auto h-16 w-16">
          <span aria-hidden className="sig-book-ring absolute inset-0 rounded-full bg-brand-gold/40" />
          <span className="sig-book-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-brand-gold/30">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path className="sig-book-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>
        <h2 ref={p.headingRef} tabIndex={-1} className="mt-6 font-serif text-3xl outline-none sm:text-4xl">You’re booked{first ? `, ${first}` : ""}!</h2>
        <p className="mt-2 text-muted-foreground">
          {p.opt.name} with {hostShort} · {fmtDay(p.result.start, p.tz)} · {fmtTime(p.result.start, p.tz)} – {fmtTime(p.result.end, p.tz)}{" "}
          <span className="whitespace-nowrap">({tzName(p.tz)})</span>
        </p>
        {p.result.message ? <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{p.result.message}</p> : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="h-11 px-5">
            <Link href={p.result.manageUrl ?? "/book/manage"}><Settings2 className="h-4 w-4" /> {p.result.manageUrl ? "Manage your appointment" : "Manage your appointments"}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href={p.planner?.slug ? `/book?planner=${p.planner.slug}` : "/book"}>Book another</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border p-4">
            <PlannerMini host={p.host} planner={p.planner} />
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <LIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{locationLine(p.opt)}{p.opt.locationType === "in_person" && p.opt.locationDetails ? ` — ${p.opt.locationDetails}` : ""}</span>
          </p>
          <AddToCalendar event={calEvent} icsHref={token ? `/api/booking/manage/${token}?view=ics` : null} />
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Mail className={cn("h-4 w-4", p.result.notify.email ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {p.result.notify.email ? <>Email updates to <span className="font-medium">{p.email}</span></> : <span className="text-muted-foreground">No email reminders</span>}
            </li>
            <li className="flex items-center gap-2">
              <MessageSquareText className={cn("h-4 w-4", p.result.notify.sms ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {p.result.notify.sms ? <>Text reminders to <span className="font-medium">{p.phone}</span></> : <span className="text-muted-foreground">No text reminders</span>}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">Confirmation <span className="font-mono font-semibold text-foreground">{p.result.reference}</span></p>
        </div>

        <div>
          <p className="text-sm font-semibold">What to expect</p>
          <ol className="mt-3">
            {expect.map((e, i) => (
              <li key={e.title} className="relative flex gap-3 pb-5 last:pb-0">
                {i < expect.length - 1 ? <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border" /> : null}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold text-gold">{i + 1}</span>
                <span className="pt-0.5">
                  <span className="block text-sm font-medium">{e.title}</span>
                  <span className="block text-sm text-muted-foreground">{e.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-2xl bg-muted/50 p-4 text-sm">
            <p className="font-medium">Need to make a change?</p>
            <p className="mt-0.5 text-muted-foreground">
              {p.result.manageUrl ? (
                <>Reschedule or cancel any time from <Link href={p.result.manageUrl} className="font-medium text-primary hover:underline">your manage page</Link>. </>
              ) : (
                <>Find it any time at <Link href="/book/manage" className="font-medium text-primary hover:underline">Manage your appointments</Link>. </>
              )}
              {p.officePhone ? <>Or call <a href={p.officePhoneHref} className="font-medium text-primary hover:underline">{p.officePhone}</a>.</> : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
