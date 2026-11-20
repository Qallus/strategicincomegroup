"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock,
  Download, Globe, Loader2, Mail, MapPin, MessageSquareText, Phone, RefreshCw, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { groupSlotsByDate, utcToZonedDate } from "@/lib/booking/availability";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/booking/ics";
import {
  BOOKING_EMAIL_CONSENT_HINT, BOOKING_EMAIL_CONSENT_LABEL, BOOKING_SMS_CONSENT_LABEL, BOOKING_SMS_CONSENT_TEXT,
} from "@/lib/booking/consent";
import { BOOKING_AUDIENCE_LABELS, type BookingAudience, type IntakeQuestion, type Slot } from "@/lib/booking/types";

const ICONS: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: MapPin, custom: Clock };
const LOCATION_LABEL: Record<string, string> = { video: "Video call", phone: "Phone call", in_person: "In person", custom: "Details to follow" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const WEEKDAYS = [["S", "Sunday"], ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"], ["F", "Friday"], ["S", "Saturday"]] as const;

type Step = "time" | "details" | "done";
type MeetingOption = { slug: string; name: string; durationMinutes: number; locationType: string; audience: BookingAudience };
type Result = { reference: string; message: string | null; start: string; end: string; notify: { email: boolean; sms: boolean } };

// ── date helpers (all dates are "YYYY-MM-DD" strings, no local-time Date math) ──
function addDaysStr(d: string, n: number) { const dt = new Date(`${d}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
function monthStart(d: string) { return `${d.slice(0, 7)}-01`; }
function addMonths(d: string, n: number) { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); }
function dateLabel(d: string, opts: Intl.DateTimeFormatOptions) { return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" }); }
function dowOf(d: string) { return new Date(`${d}T12:00:00Z`).getUTCDay(); }

function tzName(tz: string, style: "short" | "long" = "short") {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch { return tz; }
}
function tzCity(tz: string) { return tz === "America/Phoenix" ? "Arizona" : (tz.split("/").pop() ?? tz).replace(/_/g, " "); }
function tzLabel(tz: string) { return `${tzCity(tz)} time (${tzName(tz)})`; }
function fmtTime(iso: string, tz: string) { return new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }); }
function fmtDay(iso: string, tz: string, long = true) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric" });
}

export function BookWidget(props: {
  slug: string; name: string; description: string | null; durationMinutes: number;
  locationType: string; locationDetails: string | null; hostName: string | null; color: string | null;
  timezone: string; questions: IntakeQuestion[];
  /** Planner headshot, credentials and office from the public team page (optional). */
  hostPhoto?: string | null; office?: string | null; hostCredentials?: string | null; hostTitle?: string | null; hostSlug?: string | null;
  maxAdvanceDays?: number;
  /** This planner's other public meeting types (including this one), for the switcher. */
  meetingOptions?: MeetingOption[];
  officePhone?: string; officePhoneHref?: string;
}) {
  const { slug, timezone } = props;
  const Icon = ICONS[props.locationType] ?? Clock;
  const host = props.hostName || "Strategic Income Group";
  const hostFirst = host.split(/[\s,]/)[0];
  const locationLine =
    props.locationType === "in_person" ? (props.office ? `In person · ${props.office}` : "In person") : LOCATION_LABEL[props.locationType] ?? "Details to follow";

  // ── availability ──
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [localTz, setLocalTz] = React.useState<string | null>(null);
  const [displayTz, setDisplayTz] = React.useState(timezone);
  React.useEffect(() => {
    try { setLocalTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null); } catch { setLocalTz(null); }
  }, []);
  // Only offer "your time" when it actually differs from the planner's clock right now.
  const tzDiffers = Boolean(localTz && localTz !== timezone && fmtTime(new Date().toISOString(), localTz) !== fmtTime(new Date().toISOString(), timezone));

  const today = React.useMemo(() => utcToZonedDate(new Date(), displayTz), [displayTz]);
  const lastDay = addDaysStr(today, props.maxAdvanceDays ?? 60);
  const [monthAnchor, setMonthAnchor] = React.useState(() => monthStart(new Date().toISOString().slice(0, 10)));
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [focusDate, setFocusDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);
  const [step, setStep] = React.useState<Step>("time");
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadSlots = React.useCallback(async (opts: { keepSelection?: boolean } = {}) => {
    setLoading(true); setLoadError(false);
    try {
      const from = new Date().toISOString().slice(0, 10);
      const to = addDaysStr(from, Math.min(120, (props.maxAdvanceDays ?? 60) + 1));
      const res = await fetch(`/api/booking/slots?slug=${encodeURIComponent(slug)}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error("slots");
      const r = await res.json();
      const list: Slot[] = r.slots ?? [];
      setSlots(list);
      if (!opts.keepSelection && list.length) {
        // Land on the first open day so times are visible straight away.
        const first = utcToZonedDate(new Date(list[0].start), displayTz);
        setMonthAnchor(monthStart(first));
        setSelectedDate(first);
        setFocusDate(first);
      }
    } catch { setSlots([]); setLoadError(true); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, props.maxAdvanceDays]);
  React.useEffect(() => { void loadSlots(); }, [loadSlots]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const g of groupSlotsByDate(slots, displayTz)) map.set(g.date, g.slots);
    return map;
  }, [slots, displayTz]);

  // Re-anchor the selected day when the viewer switches timezone.
  function switchTz(tz: string) {
    setDisplayTz(tz);
    if (selectedSlot) {
      const d = utcToZonedDate(new Date(selectedSlot.start), tz);
      setSelectedDate(d); setFocusDate(d); setMonthAnchor(monthStart(d));
    }
  }

  const grid = React.useMemo(() => {
    const start = addDaysStr(monthAnchor, -dowOf(monthAnchor));
    const daysInMonth = Number(addDaysStr(addMonths(monthAnchor, 1), -1).slice(8, 10));
    const weeks = Math.ceil((dowOf(monthAnchor) + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, k) => addDaysStr(start, k));
  }, [monthAnchor]);
  const canPrev = monthAnchor > monthStart(today);
  const canNext = addMonths(monthAnchor, 1) <= monthStart(lastDay);
  const monthHasSlots = grid.some((d) => d.slice(0, 7) === monthAnchor.slice(0, 7) && (byDate.get(d)?.length ?? 0) > 0);
  const nextOpenDay = React.useMemo(() => {
    for (const k of byDate.keys()) if (k > addDaysStr(addMonths(monthAnchor, 1), -1)) return k;
    return null;
  }, [byDate, monthAnchor]);
  const daySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  // Roving focus for the calendar grid (arrow keys, Home/End, PageUp/PageDown).
  const dayRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const calendarHasFocus = React.useRef(false);
  React.useEffect(() => {
    if (focusDate && calendarHasFocus.current) dayRefs.current.get(focusDate)?.focus();
  }, [focusDate, monthAnchor]);
  function moveFocus(to: string) {
    if (to < today || to > lastDay) return;
    setFocusDate(to);
    if (monthStart(to) !== monthAnchor) setMonthAnchor(monthStart(to));
  }
  function onDayKey(e: React.KeyboardEvent, day: string) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) { e.preventDefault(); moveFocus(addDaysStr(day, map[e.key])); }
    else if (e.key === "Home") { e.preventDefault(); moveFocus(addDaysStr(day, -dowOf(day))); }
    else if (e.key === "End") { e.preventDefault(); moveFocus(addDaysStr(day, 6 - dowOf(day))); }
    else if (e.key === "PageUp") { e.preventDefault(); moveFocus(addMonths(day, -1)); }
    else if (e.key === "PageDown") { e.preventDefault(); moveFocus(addMonths(day, 1)); }
  }
  function pickDay(day: string) {
    if (!(byDate.get(day)?.length)) return;
    setSelectedDate(day); setFocusDate(day); setSelectedSlot(null);
    // On small screens, bring the times into view.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => slotsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }));
    }
  }
  const slotsRef = React.useRef<HTMLDivElement>(null);

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
    for (const q of props.questions) if (q.required && !answers[q.key]?.trim()) e[`q_${q.key}`] = "This one’s required.";
    return e;
  }

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [step]);
  const rootRef = React.useRef<HTMLDivElement>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedSlot) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const firstKey = ["name", "email", "phone", ...props.questions.map((q) => `q_${q.key}`)].find((k) => e[k]);
      if (firstKey) document.getElementById(`bk-${firstKey}`)?.focus();
      return;
    }
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch("/api/booking/book", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug, start_at: selectedSlot.start, invitee_name: fullName.trim(), invitee_email: email.trim() || null,
          invitee_phone: phone.trim() || null, answers, notify_email: notifyEmail, notify_sms: notifySms,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setSelectedSlot(null); setStep("time");
          setNotice("Sorry — that time was just taken. Here are the latest openings.");
          await loadSlots({ keepSelection: true });
          return;
        }
        throw new Error(json.message || "We couldn’t complete your booking.");
      }
      setResult({
        reference: json.reference, message: json.confirmation_message, start: json.start_at, end: json.end_at,
        notify: json.notify ?? { email: notifyEmail, sms: notifySms },
      });
      setStep("done");
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "We couldn’t complete your booking."); }
    finally { setSubmitting(false); }
  }

  const calEvent: CalendarEvent | null = result
    ? {
        uid: result.reference,
        title: `${props.name} with ${host}`,
        description: `${props.name} with ${host} — Strategic Income Group.\nReference: ${result.reference}${props.officePhone ? `\nNeed to reschedule? Call ${props.officePhone}.` : ""}`,
        location: props.locationType === "in_person" ? props.locationDetails || props.office || "Strategic Income Group" : LOCATION_LABEL[props.locationType],
        start: result.start, end: result.end,
      }
    : null;

  function downloadIcs() {
    if (!calEvent) return;
    const blob = new Blob([buildIcs(calEvent)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SIG-appointment-${calEvent.uid}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stepIndex = step === "time" ? 0 : step === "details" ? 1 : 2;
  const liveMsg = step === "details" && selectedSlot
    ? `Selected ${fmtDay(selectedSlot.start, displayTz)} at ${fmtTime(selectedSlot.start, displayTz)}. Enter your details.`
    : step === "done" ? "Your appointment is confirmed." : "";

  // ── render ──
  return (
    <div ref={rootRef} className="scroll-mt-24">
      <p className="sr-only" aria-live="polite">{liveMsg}</p>
      <Stepper index={stepIndex} />

      {step === "done" && result && calEvent ? (
        <Success
          headingRef={headingRef}
          name={fullName.trim()}
          result={result}
          meeting={props.name}
          host={host}
          hostFirst={hostFirst}
          hostPhoto={props.hostPhoto ?? null}
          hostCredentials={props.hostCredentials ?? null}
          locationType={props.locationType}
          locationLine={locationLine}
          locationDetails={props.locationDetails}
          tz={displayTz}
          email={email.trim()}
          phone={phone.trim()}
          calEvent={calEvent}
          onDownload={downloadIcs}
          officePhone={props.officePhone}
          officePhoneHref={props.officePhoneHref}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ── Summary rail ── */}
          <aside className="border-b p-5 sm:p-6 lg:border-b-0 lg:border-r" aria-label="Appointment summary">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              {props.hostPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.hostPhoto} alt="" className="h-16 w-16 shrink-0 rounded-2xl border bg-gradient-to-b from-muted to-background object-cover object-top lg:h-20 lg:w-20" />
              ) : (
                <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Icon className="h-6 w-6" /></span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{host}</p>
                {props.hostCredentials ? <p className="text-xs font-medium text-gold">{props.hostCredentials}</p> : null}
                {props.hostTitle ? <p className="text-xs text-muted-foreground">{props.hostTitle}</p> : null}
              </div>
            </div>

            <h1 className="mt-5 font-serif text-2xl leading-tight sm:text-3xl">{props.name}</h1>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 shrink-0" aria-hidden /> {props.durationMinutes} minutes</li>
              <li className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {locationLine}
                  {props.locationType === "in_person" && props.locationDetails ? <span className="block text-xs">{props.locationDetails}</span> : null}
                </span>
              </li>
              <li className="flex items-center gap-2.5"><Globe className="h-4 w-4 shrink-0" aria-hidden /> {tzLabel(displayTz)}</li>
            </ul>

            {selectedSlot ? (
              <div className="sig-book-in mt-5 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Your time</p>
                <p className="mt-1 text-sm font-semibold">{fmtDay(selectedSlot.start, displayTz)}</p>
                <p className="text-sm">{fmtTime(selectedSlot.start, displayTz)} – {fmtTime(selectedSlot.end, displayTz)}</p>
                {step === "details" ? (
                  <button type="button" onClick={() => setStep("time")} className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Change time
                  </button>
                ) : null}
              </div>
            ) : null}

            {props.description ? <p className="mt-5 hidden border-t pt-5 text-sm leading-relaxed text-muted-foreground sm:block">{props.description}</p> : null}

            {props.meetingOptions && props.meetingOptions.length > 1 ? (
              <div className="mt-5 border-t pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meeting type</p>
                <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {props.meetingOptions.map((m) => {
                    const active = m.slug === slug;
                    const MIcon = ICONS[m.locationType] ?? Clock;
                    return (
                      <li key={m.slug} className="shrink-0">
                        <Link
                          href={`/book/${m.slug}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary bg-primary/5 font-semibold" : "hover:border-primary/40 hover:bg-muted",
                          )}
                        >
                          <MIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0">
                            <span className="block whitespace-nowrap">{m.name}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {m.durationMinutes} min{m.audience !== "everyone" ? ` · ${BOOKING_AUDIENCE_LABELS[m.audience]}` : ""}
                            </span>
                          </span>
                          {active ? <Check className="ml-auto h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </aside>

          {/* ── Body ── */}
          <div className="min-w-0 p-5 sm:p-6">
            {step === "time" ? (
              <div key="time" className="sig-book-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl outline-none sm:text-2xl">Choose a time</h2>
                  {tzDiffers && localTz ? (
                    <div role="group" aria-label="Show times in" className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
                      {[timezone, localTz].map((tz) => (
                        <button
                          key={tz}
                          type="button"
                          aria-pressed={displayTz === tz}
                          onClick={() => switchTz(tz)}
                          className={cn(
                            "rounded-full px-3 py-1 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            displayTz === tz ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {tz === timezone ? `${tzCity(tz)} time` : "Your time"} <span className="text-muted-foreground">({tzName(tz)})</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {notice ? (
                  <div role="status" className="sig-book-in mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {notice}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(200px,240px)]">
                  {/* Calendar */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold" aria-live="polite">{dateLabel(monthAnchor, { month: "long", year: "numeric" })}</p>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!canPrev} aria-label="Previous month" onClick={() => setMonthAnchor((a) => addMonths(a, -1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!canNext} aria-label="Next month" onClick={() => setMonthAnchor((a) => addMonths(a, 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground" aria-hidden>
                      {WEEKDAYS.map(([s, l]) => <div key={l} className="py-1.5">{s}</div>)}
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-7 gap-1" aria-busy="true" aria-label="Loading availability">
                        {Array.from({ length: 35 }, (_, i) => <div key={i} className="sig-book-skeleton aspect-square rounded-lg" />)}
                      </div>
                    ) : (
                      <div
                        role="group"
                        aria-label={`Available days in ${dateLabel(monthAnchor, { month: "long", year: "numeric" })}`}
                        className="grid grid-cols-7 gap-1"
                        onFocus={() => { calendarHasFocus.current = true; }}
                        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) calendarHasFocus.current = false; }}
                      >
                        {grid.map((day) => {
                          const inMonth = day.slice(0, 7) === monthAnchor.slice(0, 7);
                          const count = byDate.get(day)?.length ?? 0;
                          const has = count > 0 && inMonth;
                          const isSel = day === selectedDate && inMonth;
                          const isToday = day === today;
                          const tabbable = inMonth && (focusDate ? day === focusDate : day === (selectedDate ?? today));
                          if (!inMonth) return <div key={day} aria-hidden className="aspect-square" />;
                          return (
                            <button
                              key={day}
                              ref={(el) => { if (el) dayRefs.current.set(day, el); else dayRefs.current.delete(day); }}
                              type="button"
                              tabIndex={tabbable ? 0 : -1}
                              aria-disabled={!has}
                              aria-pressed={isSel}
                              aria-label={`${dateLabel(day, { weekday: "long", month: "long", day: "numeric" })}${has ? `, ${count} time${count === 1 ? "" : "s"} available` : ", unavailable"}`}
                              onClick={() => pickDay(day)}
                              onKeyDown={(e) => onDayKey(e, day)}
                              className={cn(
                                "relative flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                                isSel
                                  ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                                  : has
                                    ? "bg-primary/10 font-semibold text-primary hover:bg-primary/20 dark:bg-primary/15 dark:hover:bg-primary/25"
                                    : "cursor-default text-muted-foreground/50",
                              )}
                            >
                              {Number(day.slice(8, 10))}
                              {isToday ? <span aria-hidden className={cn("absolute bottom-1.5 h-1 w-1 rounded-full", isSel ? "bg-primary-foreground" : "bg-brand-gold")} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!loading && !loadError && slots.length > 0 && !monthHasSlots ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No openings this month.{" "}
                        {nextOpenDay ? (
                          <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setMonthAnchor(monthStart(nextOpenDay)); pickDay(nextOpenDay); }}>
                            Jump to {dateLabel(nextOpenDay, { month: "short", day: "numeric" })} →
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  {/* Times */}
                  <div ref={slotsRef} className="scroll-mt-24 md:border-l md:pl-6">
                    {loading ? (
                      <div className="space-y-2" aria-hidden>
                        <div className="sig-book-skeleton h-5 w-32 rounded" />
                        {Array.from({ length: 6 }, (_, i) => <div key={i} className="sig-book-skeleton h-11 rounded-lg" />)}
                      </div>
                    ) : loadError ? (
                      <EmptyState icon={AlertCircle} title="We couldn’t load times" body="Check your connection and try again.">
                        <Button type="button" size="sm" variant="outline" onClick={() => void loadSlots()}><RefreshCw className="h-4 w-4" /> Try again</Button>
                      </EmptyState>
                    ) : slots.length === 0 ? (
                      <EmptyState icon={CalendarDays} title="Fully booked right now" body={`${hostFirst}’s calendar is full for the next few weeks. Call and we’ll find you a time.`}>
                        {props.officePhoneHref ? (
                          <Button asChild size="sm"><a href={props.officePhoneHref}><Phone className="h-4 w-4" /> {props.officePhone}</a></Button>
                        ) : null}
                      </EmptyState>
                    ) : !selectedDate ? (
                      <EmptyState icon={CalendarDays} title="Pick a day" body="Highlighted days have openings." />
                    ) : (
                      <div key={`${selectedDate}-${displayTz}`} className="sig-book-in">
                        <p className="text-sm font-semibold">{dateLabel(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</p>
                        <p className="mb-3 text-xs text-muted-foreground">{daySlots.length} time{daySlots.length === 1 ? "" : "s"} · {tzName(displayTz)}</p>
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:max-h-[24rem] md:grid-cols-1 md:overflow-y-auto md:pr-1" aria-label="Available times">
                          {daySlots.map((s) => {
                            const sel = selectedSlot?.start === s.start;
                            return (
                              <li key={s.start} className={cn(sel && "col-span-2 sm:col-span-3 md:col-span-1")}>
                                {sel ? (
                                  <div className="sig-book-in grid grid-cols-2 gap-2">
                                    <span className="flex h-11 items-center justify-center rounded-lg bg-foreground/90 text-sm font-semibold text-background">{fmtTime(s.start, displayTz)}</span>
                                    <Button type="button" className="h-11" onClick={() => { setNotice(null); setStep("details"); }} autoFocus>
                                      Next <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSlot(s)}
                                    className="h-11 w-full rounded-lg border text-sm font-semibold tabular-nums text-primary transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {fmtTime(s.start, displayTz)}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {step === "details" && selectedSlot ? (
              <form key="details" onSubmit={submit} noValidate className="sig-book-in mx-auto max-w-xl">
                <button type="button" onClick={() => setStep("time")} className="mb-4 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back to times
                </button>
                <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl outline-none sm:text-2xl">Your details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fmtDay(selectedSlot.start, displayTz)} at {fmtTime(selectedSlot.start, displayTz)} with {host.split(",")[0]}.
                </p>

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
                  {props.questions.map((q) => {
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

                {/* Notification opt-ins — both off by default. */}
                <fieldset className="mt-6 rounded-xl border bg-muted/30">
                  <legend className="sr-only">Reminders and updates</legend>
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">Stay in the loop</p>
                    <p className="text-xs text-muted-foreground">Optional — choose how you’d like to hear from us about this appointment.</p>
                  </div>
                  <OptInRow
                    id="bk-notify-email"
                    icon={Mail}
                    label={BOOKING_EMAIL_CONSENT_LABEL}
                    hint={BOOKING_EMAIL_CONSENT_HINT}
                    checked={notifyEmail}
                    onChange={setNotifyEmail}
                  />
                  <OptInRow
                    id="bk-notify-sms"
                    icon={MessageSquareText}
                    label={BOOKING_SMS_CONSENT_LABEL}
                    hint={BOOKING_SMS_CONSENT_TEXT}
                    checked={notifySms}
                    onChange={(v) => {
                      setNotifySms(v);
                      if (v && phoneDigits.length < 10) requestAnimationFrame(() => document.getElementById("bk-phone")?.focus());
                      if (!v && errors.phone === "Add a mobile number to get text reminders.") setErrors(({ phone: _p, ...rest }) => rest);
                    }}
                    border
                    footnote={
                      <>
                        See our <Link href="/communication-policy" className="underline underline-offset-2 hover:text-foreground">communication policy</Link> and{" "}
                        <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">privacy policy</Link>.
                      </>
                    }
                  />
                  {notifySms && phoneDigits.length < 10 ? (
                    <p className="sig-book-in border-t px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">Add your mobile number above to get text reminders.</p>
                  ) : null}
                </fieldset>

                {submitError ? (
                  <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {submitError}
                  </div>
                ) : null}

                <Button type="submit" className="mt-6 h-12 w-full text-base" disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking your time…</> : <><Check className="h-4 w-4" /> Confirm booking</>}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Free and no obligation. Your details go only to {host.split(",")[0]} and the SIG team.
                </p>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ariaFor(id: string, error?: string) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined } as const;
}

function Stepper({ index }: { index: number }) {
  const steps = ["Choose a time", "Your details", "Confirmed"];
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm" aria-label="Booking progress">
      {steps.map((label, i) => {
        const done = i < index || index === 2;
        const current = i === index && index !== 2;
        return (
          <li key={label} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary text-primary" : "text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("truncate", current || done ? "font-medium text-foreground" : "text-muted-foreground", !current && "hidden sm:inline")}>
              {label}
              <span className="sr-only">{done ? " (completed)" : current ? " (current step)" : ""}</span>
            </span>
            {i < steps.length - 1 ? <span aria-hidden className={cn("h-px w-6 shrink-0 sm:w-12", i < index ? "bg-primary" : "bg-border")} /> : null}
          </li>
        );
      })}
    </ol>
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

function OptInRow({ id, icon: RowIcon, label, hint, checked, onChange, border, footnote }: {
  id: string; icon: typeof Mail; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; border?: boolean; footnote?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", border && "border-t")}>
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors", checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        <RowIcon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">{label}</label>
        <p id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-desc`} className="mt-1 data-[state=unchecked]:bg-muted-foreground/30" />
    </div>
  );
}

function EmptyState({ icon: EIcon, title, body, children }: { icon: typeof Mail; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
      <EIcon className="h-6 w-6 text-gold" aria-hidden />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function Success(p: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  name: string; result: Result; meeting: string; host: string; hostFirst: string; hostPhoto: string | null; hostCredentials: string | null;
  locationType: string; locationLine: string; locationDetails: string | null; tz: string; email: string; phone: string;
  calEvent: CalendarEvent; onDownload: () => void; officePhone?: string; officePhoneHref?: string;
}) {
  const first = p.name.split(/\s+/)[0];
  const LIcon = ICONS[p.locationType] ?? Clock;
  const hostShort = p.host.split(",")[0];
  const expect = [
    { title: p.result.notify.email ? "Check your inbox" : "Save the date", body: p.result.notify.email ? `Your confirmation and calendar invite are on the way to ${p.email}.` : "Add it to your calendar below so it’s easy to find." },
    { title: `${hostShort.split(" ")[0]} prepares`, body: "Your planner reviews your notes so the time is spent on what matters to you." },
    {
      title: "We meet",
      body: p.locationType === "in_person" ? "Come as you are — bring any statements or questions you’d like to cover." : p.locationType === "phone" ? `We’ll call you${p.phone ? ` at ${p.phone}` : ""} at the scheduled time.` : "We’ll send any meeting details ahead of time.",
    },
  ];
  return (
    <div className="sig-book-in mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative border-b bg-gradient-to-b from-brand-gold/10 to-transparent px-6 pb-8 pt-10 text-center sm:px-10">
        <div className="relative mx-auto h-16 w-16">
          <span aria-hidden className="sig-book-ring absolute inset-0 rounded-full bg-brand-sage/40" />
          <span className="sig-book-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-sage text-white shadow-lg shadow-brand-sage/30">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path className="sig-book-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>
        <h2 ref={p.headingRef} tabIndex={-1} className="mt-6 font-serif text-3xl outline-none sm:text-4xl">You’re booked{first ? `, ${first}` : ""}!</h2>
        <p className="mt-2 text-muted-foreground">
          {fmtDay(p.result.start, p.tz)} · {fmtTime(p.result.start, p.tz)} – {fmtTime(p.result.end, p.tz)} <span className="whitespace-nowrap">({tzName(p.tz)})</span>
        </p>
        {p.result.message ? <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{p.result.message}</p> : null}
      </div>

      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border p-4">
            {p.hostPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.hostPhoto} alt="" className="h-14 w-14 shrink-0 rounded-xl border object-cover object-top" />
            ) : null}
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{p.meeting}</p>
              <p className="text-muted-foreground">with {hostShort}{p.hostCredentials ? <span className="text-gold">, {p.hostCredentials}</span> : null}</p>
              <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
                <LIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{p.locationLine}{p.locationType === "in_person" && p.locationDetails ? ` — ${p.locationDetails}` : ""}</span>
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarPlus className="h-4 w-4 text-gold" aria-hidden /> Add to your calendar</p>
            <div className="grid grid-cols-3 gap-2">
              <Button asChild variant="outline" size="sm" className="h-10"><a href={googleCalendarUrl(p.calEvent)} target="_blank" rel="noopener noreferrer">Google</a></Button>
              <Button asChild variant="outline" size="sm" className="h-10"><a href={outlookCalendarUrl(p.calEvent)} target="_blank" rel="noopener noreferrer">Outlook</a></Button>
              <Button type="button" variant="outline" size="sm" className="h-10" onClick={p.onDownload}><Download className="h-4 w-4" /> .ics</Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">The .ics file works with Apple Calendar and most other apps.</p>
          </div>

          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Mail className={cn("h-4 w-4", p.result.notify.email ? "text-brand-sage" : "text-muted-foreground")} aria-hidden />
              {p.result.notify.email ? <>Email updates to <span className="font-medium">{p.email}</span></> : <span className="text-muted-foreground">No email reminders</span>}
            </li>
            <li className="flex items-center gap-2">
              <MessageSquareText className={cn("h-4 w-4", p.result.notify.sms ? "text-brand-sage" : "text-muted-foreground")} aria-hidden />
              {p.result.notify.sms ? <>Text reminders to <span className="font-medium">{p.phone}</span></> : <span className="text-muted-foreground">No text reminders</span>}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Confirmation <span className="font-mono font-semibold text-foreground">{p.result.reference}</span>
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">What to expect</p>
          <ol className="mt-3 space-y-0">
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
          <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-medium">Need to make a change?</p>
            <p className="mt-0.5 text-muted-foreground">
              Call us{p.officePhone ? <> at <a href={p.officePhoneHref} className="font-medium text-primary hover:underline">{p.officePhone}</a></> : null} and mention your confirmation number.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-between sm:px-8">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to strategicincomegroup.com</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href="/team">Meet the rest of the team <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
    </div>
  );
}
