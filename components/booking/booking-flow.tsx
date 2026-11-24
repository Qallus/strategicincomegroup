"use client";

// Public booking flow: 1 Appointment · 2 Date & time · 3 Your details → confirmation.
// One stepper from the first screen of /book (and /book/[slug], which starts at step 2).
// The URL is the source of truth for planner / type / step, so Back moves between steps and a
// refresh restores the place: /book?planner=…&type=…&step=2, or /book/<slug>?step=3 on deep links.
// Desktop: step cards + a sticky booking summary. Mobile: compact numbered line, sticky bottom bar.

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronDown, ChevronUp, Clock, Globe, Loader2,
  Lock, Mail, MapPin, MessageSquareText, Phone, Settings2, Sparkles, UserRound, Video,
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
import { LOCATION_LABEL, fmtDay, fmtTime, prefersReducedMotion, tzLabel, tzName, tzCity } from "@/components/booking/format";

const ICONS: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: MapPin, custom: Clock };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type PlannerInfo = { slug: string; name: string; credentials: string | null; title: string | null; photo: string | null; office: string | null };
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
  hostSlug: string | null;
  hostName: string | null;
  planner: PlannerInfo | null;
  /** False for pages reachable by link only (not listed in the planner tabs / step-1 cards). */
  listed: boolean;
};
type Result = {
  reference: string; message: string | null; start: string; end: string;
  notify: { email: boolean; sms: boolean }; manageUrl: string | null;
};
type StepNum = 1 | 2 | 3 | 4;

/** The website stores offices by region; clients know them by city. */
const OFFICE_LABELS: Record<string, string> = { "East Valley Office": "Chandler Office", "West Valley Office": "Peoria Office" };
export const officeLabel = (office: string | null | undefined) => (office ? OFFICE_LABELS[office] ?? office : null);

function locationLine(o: MeetingOption) {
  const office = officeLabel(o.office);
  return o.locationType === "in_person" ? (office ? `In person · ${office}` : "In person") : LOCATION_LABEL[o.locationType] ?? "Details to follow";
}
const firstName = (name: string) => name.split(",")[0].split(/\s+/)[0];

// ── URL state ──────────────────────────────────────────────────────────────────

function readUrl(pathname: string, sp: URLSearchParams, options: MeetingOption[]) {
  const m = pathname.match(/^\/book\/([^/]+)\/?$/);
  const routeSlug = m && m[1] !== "manage" ? decodeURIComponent(m[1]) : null;
  const typeSlug = sp.get("type") || routeSlug;
  const opt = options.find((o) => o.slug === typeSlug) ?? null;
  const raw = Number(sp.get("step"));
  const step = (raw >= 1 && raw <= 4 ? raw : routeSlug && opt ? 2 : 1) as StepNum;
  const param = sp.get("planner");
  let planner = param && options.some((o) => o.hostSlug === param) ? param : null;
  // A selected appointment always belongs to the planner shown; deep links open on their planner.
  if (opt && (planner ? opt.hostSlug !== planner : routeSlug && param === null)) planner = opt.hostSlug;
  return { routeSlug, opt, step, planner };
}

function buildUrl(s: { planner: string | null; type: string | null; step: StepNum }, routeSlug: string | null) {
  if (routeSlug && s.type === routeSlug && s.step >= 2) return `/book/${encodeURIComponent(routeSlug)}${s.step !== 2 ? `?step=${s.step}` : ""}`;
  const p = new URLSearchParams();
  if (s.planner) p.set("planner", s.planner);
  if (s.type) p.set("type", s.type);
  if (s.step > 1) p.set("step", String(s.step));
  const q = p.toString();
  return `/book${q ? `?${q}` : ""}`;
}

// ── Flow ───────────────────────────────────────────────────────────────────────

export function BookingFlow(props: {
  options: MeetingOption[];
  planners: PlannerInfo[];
  officePhone?: string;
  officePhoneHref?: string;
}) {
  const { options, planners } = props;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = readUrl(pathname, new URLSearchParams(searchParams.toString()), options);
  const opt = url.opt;
  const plannerSlug = url.planner;
  const filterPlanner = plannerSlug ? options.find((o) => o.hostSlug === plannerSlug)?.planner ?? null : null;
  const planner = opt?.planner ?? filterPlanner;
  const host = opt ? opt.planner?.name || opt.hostName || "Strategic Income Group" : planner?.name ?? null;
  const timezone = opt?.timezone || "America/Phoenix";

  function navigate(next: { planner?: string | null; type?: string | null; step: StepNum }, mode: "push" | "replace" = "push") {
    const target = buildUrl(
      { planner: next.planner !== undefined ? next.planner : plannerSlug, type: next.type !== undefined ? next.type : opt?.slug ?? null, step: next.step },
      url.routeSlug,
    );
    const current = `${window.location.pathname}${window.location.search}`;
    if (target === current) return;
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", target);
  }
  const go = (s: StepNum) => navigate({ step: s });

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
  const optSlug = opt?.slug ?? null;
  const maxAdvance = opt?.maxAdvanceDays ?? 60;
  const loadSlots = React.useCallback(async () => {
    const id = ++reqId.current;
    if (!optSlug) { setSlots([]); setLoading(false); return; }
    setLoading(true); setLoadError(false);
    try {
      const from = new Date().toISOString().slice(0, 10);
      const toD = new Date(Date.now() + Math.min(120, (maxAdvance || 60) + 1) * 86400000).toISOString().slice(0, 10);
      const res = await fetch(`/api/booking/slots?slug=${encodeURIComponent(optSlug)}&from=${from}&to=${toD}`, { cache: "no-store" });
      if (!res.ok) throw new Error("slots");
      const r = await res.json();
      if (id === reqId.current) setSlots(r.slots ?? []);
    } catch {
      if (id === reqId.current) { setSlots([]); setLoadError(true); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [optSlug, maxAdvance]);
  React.useEffect(() => { void loadSlots(); }, [loadSlots]);

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

  // A different appointment starts the time + intake answers over.
  const prevSlug = React.useRef(optSlug);
  React.useEffect(() => {
    if (prevSlug.current === optSlug) return;
    prevSlug.current = optSlug;
    setSelectedSlot(null); setNotice(null); setAnswers({}); setErrors({});
  }, [optSlug]);
  // Leaving the confirmation (Back, or "Book another") starts a fresh booking.
  const prevUrlStep = React.useRef(url.step);
  React.useEffect(() => {
    if (prevUrlStep.current === 4 && url.step !== 4) { setResult(null); setSelectedSlot(null); }
    prevUrlStep.current = url.step;
  }, [url.step]);

  // The step actually shown — never past what's been chosen (e.g. after a refresh on step 3).
  let step: StepNum = url.step;
  if (!opt) step = 1;
  else if (step === 4 && !result) step = selectedSlot ? 3 : 2;
  if (step === 3 && !selectedSlot) step = 2;
  if (result) step = 4;

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.name = "Please enter your name.";
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email so we can confirm your booking.";
    if (phone.trim() && phoneDigits.length < 10) e.phone = "Enter a full phone number, including area code.";
    if (notifySms && phoneDigits.length < 10) e.phone = "Add a mobile number to get text reminders.";
    for (const q of opt?.questions ?? []) if (q.required && !answers[q.key]?.trim()) e[`q_${q.key}`] = "This one’s required.";
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
    if (!opt) { go(1); return; }
    if (!selectedSlot) { go(2); return; }
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
          setSelectedSlot(null); go(2);
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
      go(4);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "We couldn’t complete your booking.");
    } finally {
      setSubmitting(false);
    }
  }

  function onContinue() {
    if (step === 1) { if (opt) go(2); }
    else if (step === 2) { if (selectedSlot) { setNotice(null); go(3); } }
    else if (step === 3) void submit();
  }
  const canContinue = (step === 1 && Boolean(opt)) || (step === 2 && Boolean(selectedSlot)) || (step === 3 && !submitting);
  const continueLabel = step === 3 ? (submitting ? "Booking…" : "Confirm booking") : "Continue";

  function chooseType(slug: string) {
    const next = options.find((o) => o.slug === slug);
    if (!next) return;
    navigate({ type: slug, planner: plannerSlug && next.hostSlug === plannerSlug ? plannerSlug : plannerSlug ? next.hostSlug : null, step: 1 }, "replace");
  }
  function choosePlanner(slug: string | null) {
    const keep = opt && (slug === null || opt.hostSlug === slug) ? opt.slug : null;
    navigate({ planner: slug, type: keep, step: 1 }, "replace");
  }

  const liveMsg = step === 3 && selectedSlot
    ? `Selected ${fmtDay(selectedSlot.start, displayTz)} at ${fmtTime(selectedSlot.start, displayTz)}. Enter your details.`
    : step === 4 ? "Your appointment is confirmed." : "";

  if (step === 4 && result && opt) {
    return (
      <div ref={rootRef} className="scroll-mt-24">
        <p className="sr-only" aria-live="polite">{liveMsg}</p>
        <Success
          headingRef={headingRef} name={fullName.trim()} result={result} opt={opt} host={host ?? "Strategic Income Group"}
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

  const stepInfo: { label: string; sub: string; icon: typeof Clock; filled: boolean }[] = [
    { label: "Appointment", sub: opt ? opt.name : "Choose a meeting", icon: CalendarDays, filled: Boolean(opt) },
    {
      label: "Date & time",
      sub: selectedSlot ? `${fmtDay(selectedSlot.start, displayTz, false)} · ${fmtTime(selectedSlot.start, displayTz)}` : "Pick availability",
      icon: Clock, filled: Boolean(selectedSlot),
    },
    { label: "Your details", sub: fullName.trim() || "Contact info", icon: UserRound, filled: Boolean(fullName.trim()) },
  ];
  // Step 1 with every planner shown uses the full width (three roomy columns); the sticky summary
  // sidebar returns for a single planner and for steps 2–3, and a slim bar stands in for it here.
  const wide = step === 1 && !plannerSlug && planners.length > 1;
  const reachable = (i: number) => i === 0 || (i === 1 && Boolean(opt)) || (i === 2 && Boolean(opt && selectedSlot));

  const summaryFooter = step !== 3 ? (
    <Button key="continue" type="button" className="h-11 w-full" disabled={!canContinue} onClick={onContinue}>
      {step === 1 && !opt ? "Choose an appointment" : continueLabel} {opt ? <ArrowRight className="h-4 w-4" /> : null}
    </Button>
  ) : (
    <Button key="submit" type="submit" form="bk-form" className="h-11 w-full" disabled={submitting}>
      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</> : <><Check className="h-4 w-4" /> Confirm booking</>}
    </Button>
  );

  return (
    <div ref={rootRef} className="scroll-mt-24 pb-28 lg:pb-0">
      <p className="sr-only" aria-live="polite">{liveMsg}</p>

      <div className={cn("grid gap-6", !wide && "lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start")}>
        <div className="min-w-0">
          <StepCards steps={stepInfo} current={step} reachable={reachable} onGo={(i) => go((i + 1) as StepNum)} />
          <StepLine steps={stepInfo} current={step} reachable={reachable} onGo={(i) => go((i + 1) as StepNum)} />

          <div className="mt-4 min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-6 lg:mt-5">
            {step === 1 ? (
              <section key="type" className="sig-book-in" aria-labelledby="bk-step-title">
                <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Choose your appointment</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filterPlanner ? `Select the meeting that best fits what you need with ${firstName(filterPlanner.name)}.` : "Pick a planner, then the meeting that best fits what you need."}
                </p>
                {planners.length > 1 ? <PlannerTabs planners={planners} value={plannerSlug} onChange={choosePlanner} /> : null}
                <TypeChooser options={options} planners={planners} plannerSlug={plannerSlug} value={opt?.slug ?? null} onChange={chooseType} />
                {options.length === 0 ? (
                  <Empty icon={CalendarDays} title="Online scheduling is being set up" body={`Call us${props.officePhone ? ` at ${props.officePhone}` : ""} or send a message and we’ll find a time that works for you.`}>
                    {props.officePhoneHref ? <Button asChild size="sm"><a href={props.officePhoneHref}><Phone className="h-4 w-4" /> {props.officePhone}</a></Button> : null}
                  </Empty>
                ) : null}
                {wide ? (
                  <WideBar opt={opt} host={host} planner={planner} onContinue={onContinue} />
                ) : (
                  <div className="mt-6 hidden lg:block">
                    <Button type="button" className="h-12 w-full text-base" disabled={!opt} onClick={onContinue}>
                      {opt ? <>Continue <ArrowRight className="h-4 w-4" /></> : "Choose an appointment to continue"}
                    </Button>
                  </div>
                )}
              </section>
            ) : null}

            {step === 2 && opt ? (
              <section key="time" className="sig-book-in" aria-labelledby="bk-step-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Pick a date &amp; time</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {opt.name}{host ? ` with ${host.split(",")[0]}` : ""} · {opt.durationMinutes} min · {locationLine(opt)}
                    </p>
                  </div>
                  <button type="button" onClick={() => go(1)} className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Change appointment
                  </button>
                </div>
                {notice ? (
                  <div role="status" className="sig-book-in mt-4 flex items-start gap-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> {notice}
                  </div>
                ) : null}
                <BookingCalendar
                  key={opt.slug}
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
                    <Empty icon={CalendarDays} title="No times are available" body={`${host ? firstName(host) : "Our"}’s calendar is full for the next few weeks. Call and we’ll find you a time.`}>
                      {props.officePhoneHref ? <Button asChild size="sm"><a href={props.officePhoneHref}><Phone className="h-4 w-4" /> {props.officePhone}</a></Button> : null}
                    </Empty>
                  }
                />
              </section>
            ) : null}

            {step === 3 && opt && selectedSlot ? (
              <form id="bk-form" key="details" onSubmit={submit} noValidate className="sig-book-in">
                <button type="button" onClick={() => go(2)} className="mb-3 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back to times
                </button>
                <h2 id="bk-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none sm:text-3xl">Your details</h2>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your selection">
                  <Chip onClick={() => go(1)} label="Change appointment">{opt.name}</Chip>
                  {host ? <Chip onClick={() => go(1)} label="Change planner">{host.split(",")[0]}</Chip> : null}
                  <Chip onClick={() => go(2)} label="Change date">{fmtDay(selectedSlot.start, displayTz, false)}</Chip>
                  <Chip onClick={() => go(2)} label="Change time">{fmtTime(selectedSlot.start, displayTz)} <span className="text-muted-foreground">({tzName(displayTz)})</span></Chip>
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
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> Free and no obligation. Your details go only to {host ? host.split(",")[0] : "your planner"} and the SIG team.
                </p>
              </form>
            ) : null}
          </div>
        </div>

        {/* Sticky booking summary (desktop) */}
        <aside className={cn("hidden", !wide && "lg:sticky lg:top-24 lg:block")} aria-label="Booking summary">
          <Summary opt={opt} host={host} planner={planner} slot={selectedSlot} tz={displayTz} name={fullName.trim()} email={email.trim()} footer={summaryFooter} />
          <Reassurance className="mt-4" />
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            Already booked? <Link href="/book/manage" className="font-medium text-primary underline-offset-2 hover:underline">Manage your appointments</Link>
          </p>
        </aside>
      </div>

      <MobileBar
        opt={opt} host={host} planner={planner} slot={selectedSlot} tz={displayTz} name={fullName.trim()} email={email.trim()}
        step={step} canContinue={canContinue} continueLabel={continueLabel} submitting={submitting} onContinue={onContinue}
      />
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

function ariaFor(id: string, error?: string) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined } as const;
}

type StepView = { label: string; sub: string; icon: typeof Clock; filled: boolean };

/** Desktop: three step cards, each showing what's been chosen so far. */
function StepCards({ steps, current, reachable, onGo }: { steps: StepView[]; current: StepNum; reachable: (i: number) => boolean; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Booking progress" className="hidden lg:block">
      <ol className="grid grid-cols-3 gap-3">
        {steps.map((s, i) => {
          const isCurrent = i === current - 1;
          const done = i < current - 1;
          const canGo = !isCurrent && reachable(i);
          const Icon = done ? Check : s.icon;
          const body = (
            <>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]", isCurrent ? "text-gold" : done ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={done ? 3 : 2} /> Step {i + 1}
              </span>
              <span className="mt-1.5 block text-base font-semibold leading-tight">
                {s.label}
                <span className="sr-only">{done ? " (completed)" : isCurrent ? " (current step)" : ""}</span>
              </span>
              <span key={s.sub} className={cn("mt-0.5 block truncate text-sm", s.filled ? "sig-book-swap text-foreground/80" : "text-muted-foreground")}>{s.sub}</span>
            </>
          );
          const cls = cn(
            "relative block h-full w-full overflow-hidden rounded-2xl border bg-card px-4 py-3.5 text-left transition",
            isCurrent ? "border-brand-gold/70 shadow-sm ring-1 ring-brand-gold/30" : "shadow-sm",
            canGo && "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          );
          return (
            <li key={s.label} aria-current={isCurrent ? "step" : undefined}>
              {canGo ? (
                <button type="button" onClick={() => onGo(i)} className={cls}>{body}</button>
              ) : (
                <div className={cn(cls, !isCurrent && !done && "opacity-80")}>
                  {isCurrent ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold" /> : null}
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Mobile / tablet: compact numbered line. */
function StepLine({ steps, current, reachable, onGo }: { steps: StepView[]; current: StepNum; reachable: (i: number) => boolean; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Booking progress" className="lg:hidden">
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const done = i < current - 1;
          const isCurrent = i === current - 1;
          const canGo = !isCurrent && reachable(i);
          const circle = (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                done ? "border-primary bg-primary text-primary-foreground" : isCurrent ? "border-brand-gold bg-brand-gold/15 text-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
          );
          const text = (
            <span className={cn("whitespace-nowrap text-sm", isCurrent ? "font-semibold text-foreground" : "hidden text-muted-foreground sm:inline")}>
              {s.label}
              <span className="sr-only">{done ? " (completed)" : isCurrent ? " (current step)" : ""}</span>
            </span>
          );
          return (
            <li key={s.label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")} aria-current={isCurrent ? "step" : undefined}>
              {canGo ? (
                <button type="button" onClick={() => onGo(i)} className="flex items-center gap-2 rounded-full pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {circle}{text}
                </button>
              ) : (
                <span className="flex items-center gap-2">{circle}{text}</span>
              )}
              {i < steps.length - 1 ? (
                <span aria-hidden className="relative mx-3 h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-border">
                  <span className={cn("absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 motion-reduce:transition-none", i < current - 1 ? "w-full" : "w-0")} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Avatar({ planner, name, className }: { planner: PlannerInfo | null; name: string; className?: string }) {
  return planner?.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={planner.photo} alt="" className={cn("shrink-0 border bg-gradient-to-b from-muted to-background object-cover object-top", className)} />
  ) : (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center border bg-muted font-serif text-muted-foreground", className)}>{name.charAt(0)}</span>
  );
}

/** Segmented planner filter. Keeps `?planner=` deep links working. */
function PlannerTabs({ planners, value, onChange }: { planners: PlannerInfo[]; value: string | null; onChange: (slug: string | null) => void }) {
  const items: { slug: string | null; label: string; planner: PlannerInfo | null }[] = [
    { slug: null, label: "All planners", planner: null },
    ...planners.map((p) => ({ slug: p.slug, label: p.name, planner: p })),
  ];
  // Keep the active planner in view when the row scrolls sideways (phones, deep links).
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !active) return;
    const a = active.getBoundingClientRect();
    const left = el.scrollLeft + (a.left - el.getBoundingClientRect().left) - (el.clientWidth - a.width) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [value]);
  return (
    <div ref={scroller} className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="group" aria-label="Choose a planner" className="inline-flex min-w-max gap-1 rounded-full border bg-muted/50 p-1">
        {items.map((it) => {
          const active = value === it.slug;
          return (
            <button
              key={it.slug ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(it.slug)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                it.planner ? "pl-1.5 pr-3.5" : "px-4",
                active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {it.planner ? <Avatar planner={it.planner} name={it.label} className="h-6 w-6 rounded-full text-xs" /> : null}
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Planner header shown above their appointment cards. */
function PlannerHeader({ planner, compact }: { planner: PlannerInfo; compact?: boolean }) {
  const office = officeLabel(planner.office);
  const lg = (full: string, col: string) => (compact ? cn(full, col) : full);
  return (
    <div className={lg("relative flex items-center gap-3 rounded-2xl border bg-muted/30 p-4", "xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:pb-3")}>
      <Avatar planner={planner} name={planner.name} className={lg("h-16 w-16 rounded-2xl text-3xl", "xl:h-12 xl:w-12 xl:rounded-xl xl:text-xl")} />
      <div className="min-w-0">
        <h3 className={lg("font-serif text-xl leading-tight", "xl:text-lg")}>{planner.name}</h3>
        {planner.credentials ? <p className="text-xs font-medium text-gold">{planner.credentials}</p> : null}
        {planner.title ? <p className={lg("text-sm text-muted-foreground", "xl:hidden")}>{planner.title}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {office ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden /> {office}
            </span>
          ) : null}
          <Link href={`/team/${planner.slug}`} className={lg("font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", "xl:hidden")}>
            About {firstName(planner.name)} →
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Step 1 appointment cards — one radiogroup across everything visible. "All planners" shows one
 * column per planner (3 across at xl+, where each is ~340px; stacked below); a single planner shows one column.
 */
function TypeChooser({ options, planners, plannerSlug, value, onChange }: {
  options: MeetingOption[]; planners: PlannerInfo[]; plannerSlug: string | null; value: string | null; onChange: (slug: string) => void;
}) {
  const listedHosts = new Set(planners.map((p) => p.slug));
  const selected = options.find((o) => o.slug === value) ?? null;
  type Group = { key: string; planner: PlannerInfo | null; title?: string; items: MeetingOption[] };
  let groups: Group[];
  if (plannerSlug) {
    const items = options.filter((o) => o.hostSlug === plannerSlug);
    groups = [{ key: plannerSlug, planner: items[0]?.planner ?? null, items }];
  } else {
    groups = planners.map((p) => ({ key: p.slug, planner: p, items: options.filter((o) => o.listed && o.hostSlug === p.slug) }));
    const other = options.filter((o) => o.listed && (!o.hostSlug || !listedHosts.has(o.hostSlug)));
    if (other.length) groups.push({ key: "other", planner: null, title: "Other ways to meet", items: other });
    // A link-only appointment that's selected (e.g. a direct link) stays visible.
    if (selected && !selected.listed) groups.unshift({ key: "selected", planner: selected.planner, items: [selected] });
  }
  groups = groups.filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);
  const focusable = value && flat.some((o) => o.slug === value) ? value : flat[0]?.slug;
  const columns = !plannerSlug && groups.length >= 3;

  const [open, setOpen] = React.useState<string | null>(null);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  function onKey(e: React.KeyboardEvent, slug: string) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = flat.findIndex((o) => o.slug === slug);
    const next = flat[(i + delta + flat.length) % flat.length];
    onChange(next.slug);
    refs.current.get(next.slug)?.focus();
  }

  if (!flat.length) return null;
  return (
    <div role="radiogroup" aria-label="Appointment type" className={cn("mt-6 grid gap-6", columns ? "xl:grid-cols-3 xl:gap-4" : "")}>
      {groups.map((g) => (
        <div key={g.key} className={cn("min-w-0", columns && "xl:rounded-2xl xl:border xl:bg-muted/20 xl:p-3")}>
          {g.planner ? (
            <PlannerHeader planner={g.planner} compact={columns} />
          ) : g.title ? (
            <h3 className="pb-3 font-serif text-xl">{g.title}</h3>
          ) : null}
          <div className={cn("space-y-3", g.planner && (columns ? "mt-4 xl:mt-0" : "mt-4"))}>
            {g.items.map((o) => (
              <TypeCard
                key={o.slug}
                o={o}
                selected={o.slug === value}
                tabbable={o.slug === focusable}
                expanded={open === o.slug}
                compact={columns}
                onSelect={() => onChange(o.slug)}
                onToggle={() => setOpen(open === o.slug ? null : o.slug)}
                onKeyDown={(e) => onKey(e, o.slug)}
                buttonRef={(el) => { if (el) refs.current.set(o.slug, el); else refs.current.delete(o.slug); }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeCard({ o, selected, tabbable, expanded, compact, onSelect, onToggle, onKeyDown, buttonRef }: {
  o: MeetingOption; selected: boolean; tabbable: boolean; expanded: boolean; compact: boolean;
  onSelect: () => void; onToggle: () => void; onKeyDown: (e: React.KeyboardEvent) => void; buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  // `compact` = one of three planner columns on wide screens (xl+); below xl every card uses the full-width layout.
  const lg = (full: string, col: string) => (compact ? cn(full, col) : full);
  const Icon = ICONS[o.locationType] ?? Clock;
  const audience = o.audience !== "everyone" ? (
    <span className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{BOOKING_AUDIENCE_LABELS[o.audience]}</span>
  ) : null;
  const duration = <span className="shrink-0 whitespace-nowrap rounded-full border bg-background px-2.5 py-0.5 text-xs font-semibold tabular-nums">{o.durationMinutes} min</span>;
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow]", selected ? "border-primary shadow-sm ring-1 ring-primary/25 dark:border-brand-gold/70 dark:ring-brand-gold/25" : "hover:border-primary/40")}>
      <div className={lg("flex items-start gap-3 p-4", "xl:gap-2.5 xl:p-3")}>
        <button
          ref={buttonRef}
          type="button"
          role="radio"
          aria-checked={selected}
          tabIndex={tabbable ? 0 : -1}
          onClick={onSelect}
          onKeyDown={onKeyDown}
          className={lg("flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card", "xl:gap-2.5")}
        >
          <span aria-hidden className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
            {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
          </span>
          <span aria-hidden className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color || "hsl(var(--primary))" }} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold leading-snug">{o.name}</span>
              {audience ? <span className={lg("inline-flex", "xl:hidden")}>{audience}</span> : null}
              <span className={lg("inline-flex sm:hidden", "xl:hidden")}>{duration}</span>
            </span>
            {compact ? <span className="mt-1.5 hidden flex-wrap items-center gap-1.5 xl:flex">{audience}{duration}</span> : null}
            {o.description && !expanded ? <span className={lg("mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1", "xl:line-clamp-2")}>{o.description}</span> : null}
          </span>
        </button>
        <span className={lg("mt-0.5 hidden sm:inline", "xl:hidden")}>{duration}</span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`bk-type-${o.slug}`}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${o.name}`}
          onClick={onToggle}
          className={lg("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "xl:h-7 xl:w-7")}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
      {expanded ? (
        <div id={`bk-type-${o.slug}`} className={lg("sig-book-in border-t bg-muted/30 px-4 py-3 text-sm", "xl:px-3")}>
          {o.description ? <p className="text-muted-foreground">{o.description}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden /> {o.durationMinutes} minutes</span>
            <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" aria-hidden /> {locationLine(o)}</span>
            {o.planner ? <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" aria-hidden /> {o.planner.name}</span> : null}
          </p>
          {o.locationType === "in_person" && o.locationDetails ? <p className="mt-1 text-xs text-muted-foreground">{o.locationDetails}</p> : null}
        </div>
      ) : null}
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
  const office = officeLabel(planner?.office);
  return (
    <div className="flex items-center gap-3">
      <Avatar planner={planner} name={host} className="h-14 w-14 rounded-xl text-2xl" />
      <div className="min-w-0">
        <p className="font-serif text-lg leading-tight">{host.split(",")[0]}</p>
        {planner?.credentials ? <p className="text-xs font-medium text-gold">{planner.credentials}</p> : null}
        {planner?.title ? <p className="truncate text-xs text-muted-foreground">{planner.title}</p> : null}
        {office ? <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden /> {office}</p> : null}
      </div>
    </div>
  );
}

type SummaryProps = { opt: MeetingOption | null; host: string | null; planner: PlannerInfo | null; slot: Slot | null; tz: string; name: string; email: string };

function SummaryRows({ opt, slot, tz, name, email }: SummaryProps) {
  const rows: [string, React.ReactNode, boolean][] = [
    ["Appointment", opt ? opt.name : "Not selected", Boolean(opt)],
    ["Duration", opt ? `${opt.durationMinutes} minutes` : "—", Boolean(opt)],
    ["Where", opt ? locationLine(opt) : "—", Boolean(opt)],
    ["Date", slot ? fmtDay(slot.start, tz, false) : "Not selected", Boolean(slot)],
    ["Time", slot ? `${fmtTime(slot.start, tz)} – ${fmtTime(slot.end, tz)}` : "Not selected", Boolean(slot)],
    ["Contact", name || email ? [name, email].filter(Boolean).join(" · ") : "Add your details", Boolean(name || email)],
  ];
  return (
    <dl className="divide-y text-sm">
      {rows.map(([k, v, filled]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-muted-foreground">{k}</dt>
          <dd key={String(v)} className={cn("min-w-0 break-words text-right", filled ? "sig-book-swap font-medium" : "text-muted-foreground")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Summary(p: SummaryProps & { footer: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative border-b p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Booking summary</p>
        <div className="mt-3">
          {p.host ? (
            <PlannerMini host={p.host} planner={p.planner} />
          ) : (
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed text-muted-foreground"><UserRound className="h-6 w-6" /></span>
              <p className="text-sm text-muted-foreground">Choose a planner and appointment to get started.</p>
            </div>
          )}
        </div>
      </div>
      <div className="px-5"><SummaryRows {...p} /></div>
      <p className="flex items-center gap-1.5 px-5 pb-1 pt-2 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> {tzLabel(p.tz)}</p>
      <div className="p-5 pt-3">{p.footer}</div>
    </div>
  );
}

const PROMISES = [
  { icon: Sparkles, text: "Free & no obligation — your first conversation is on us." },
  { icon: CalendarCheck2, text: "About a minute — pick a time, add your details, done." },
  { icon: MapPin, text: "In person in Chandler or Peoria, by phone, or by video." },
] as const;

function Reassurance({ className }: { className?: string }) {
  return (
    <ul className={cn("space-y-2 rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground", className)}>
      {PROMISES.map((p) => (
        <li key={p.text} className="flex items-start gap-2">
          <p.icon className="mt-px h-3.5 w-3.5 shrink-0 text-gold" aria-hidden /> {p.text}
        </li>
      ))}
    </ul>
  );
}

/** Desktop, step 1 with all planners: a slim sticky summary + Continue under the planner columns. */
function WideBar({ opt, host, planner, onContinue }: { opt: MeetingOption | null; host: string | null; planner: PlannerInfo | null; onContinue: () => void }) {
  return (
    <div className="sig-book-widebar sticky bottom-4 z-20 mt-6 hidden items-center gap-4 rounded-2xl border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:flex" aria-label="Booking summary" role="region">
      {opt && host ? (
        <>
          <Avatar planner={planner} name={host} className="h-11 w-11 rounded-xl text-lg" />
          <div key={opt.slug} className="sig-book-swap min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{opt.name} <span className="font-normal text-muted-foreground">with {host.split(",")[0]}</span></p>
            <p className="truncate text-xs text-muted-foreground">{opt.durationMinutes} minutes · {locationLine(opt)} · Arizona time</p>
          </div>
        </>
      ) : (
        <>
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed text-muted-foreground"><UserRound className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">Choose an appointment with any planner to continue. Free, no obligation, and it takes about a minute.</p>
        </>
      )}
      <Button key="continue" type="button" className="h-11 shrink-0 px-6" disabled={!opt} onClick={onContinue}>
        Continue <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Mobile / tablet: sticky bar with an expandable summary and the Continue button. */
function MobileBar(p: SummaryProps & { step: StepNum; canContinue: boolean; continueLabel: string; submitting: boolean; onContinue: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="sig-book-sticky fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
      {open ? (
        <div id="bk-mobile-summary" className="sig-book-in max-h-[55vh] overflow-y-auto border-b px-4 pb-2 pt-4">
          <div className="mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Booking summary</p>
            {p.host ? <div className="mt-3"><PlannerMini host={p.host} planner={p.planner} /></div> : null}
            <div className="mt-2"><SummaryRows {...p} /></div>
            <p className="flex items-center gap-1.5 pb-2 pt-1 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> {tzLabel(p.tz)}</p>
            <p className="pb-2 text-xs text-muted-foreground">
              Already booked? <Link href="/book/manage" className="font-medium text-primary underline-offset-2 hover:underline">Manage your appointments</Link>
            </p>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="bk-mobile-summary"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-xs leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{p.opt ? p.opt.name : "Choose an appointment"}</span>
            <span className="block truncate text-muted-foreground">
              {p.slot ? `${fmtDay(p.slot.start, p.tz, false)} · ${fmtTime(p.slot.start, p.tz)}` : p.opt ? `${p.opt.durationMinutes} min${p.host ? ` · ${p.host.split(",")[0]}` : ""}` : "Booking summary"}
            </span>
          </span>
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="sr-only">{open ? "Hide" : "Show"} booking summary</span>
        </button>
        {p.step === 3 ? (
          <Button key="submit" type="submit" form="bk-form" className="h-11 shrink-0 px-5" disabled={p.submitting}>
            {p.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {p.continueLabel}
          </Button>
        ) : (
          <Button key="continue" type="button" className="h-11 shrink-0 px-5" disabled={!p.canContinue} onClick={p.onContinue}>
            {p.continueLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Success(p: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  name: string; result: Result; opt: MeetingOption; host: string;
  tz: string; email: string; phone: string; officePhone?: string; officePhoneHref?: string;
}) {
  const first = p.name.split(/\s+/)[0];
  const hostShort = p.host.split(",")[0];
  const planner = p.opt.planner;
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
    location: p.opt.locationType === "in_person" ? p.opt.locationDetails || officeLabel(p.opt.office) || "Strategic Income Group" : LOCATION_LABEL[p.opt.locationType],
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
            <Link href={planner?.slug ? `/book?planner=${planner.slug}` : "/book"}>Book another</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border p-4">
            <PlannerMini host={p.host} planner={planner} />
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
