"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, CalendarClock, CalendarX2, Check, CheckCircle2, Clock, Globe, Info, Loader2, MapPin, Phone,
  Save, Video, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BookingStatus, Slot } from "@/lib/booking/types";
import type { CalendarEvent } from "@/lib/booking/ics";
import { BookingCalendar, Empty } from "@/components/booking/booking-calendar";
import { AddToCalendar } from "@/components/booking/add-to-calendar";
import { NotifyPrefs } from "@/components/booking/notify-prefs";
import { LOCATION_LABEL, fmtDayYear, fmtTime, tzLabel, tzName } from "@/components/booking/format";
import type { ChangeState } from "@/lib/booking/manage";

const ICONS: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: MapPin, custom: Clock };

type BookingView = {
  reference: string; status: BookingStatus; start_at: string; end_at: string; timezone: string;
  invitee_name: string; invitee_email: string | null; invitee_phone: string | null;
  notify_email: boolean; notify_sms: boolean; location_type: string; location_details: string | null;
  cancelled_by: "client" | "staff" | null; cancel_reason: string | null; rescheduled_at: string | null;
};
type TypeView = {
  name: string; slug: string; description: string | null; duration_minutes: number; office: string | null;
  min_notice_hours: number; max_advance_days: number; timezone: string;
};
type PlannerView = { name: string; credentials: string | null; title: string | null; slug: string | null; photo: string | null };

export function ManageClient(props: {
  token: string; booking: BookingView; type: TypeView; planner: PlannerView; initialState: ChangeState;
  officePhone: string; officePhoneHref: string;
}) {
  const { token, type, planner } = props;
  const router = useRouter();
  const [b, setB] = React.useState(props.booking);
  const [state, setState] = React.useState<ChangeState>(props.initialState);
  const [mode, setMode] = React.useState<"view" | "reschedule">("view");
  const [flash, setFlash] = React.useState<string | null>(null);
  const tz = b.timezone || type.timezone;
  const hostShort = planner.name.split(",")[0];
  const LIcon = ICONS[b.location_type] ?? Clock;
  const where = b.location_type === "in_person"
    ? [type.office ? `In person · ${type.office}` : "In person", b.location_details].filter(Boolean).join(" — ")
    : LOCATION_LABEL[b.location_type] ?? "Details to follow";
  const cancelled = b.status === "canceled";
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const calEvent: CalendarEvent = {
    uid: b.reference,
    title: `${type.name} with ${planner.name}`,
    description: `${type.name} with ${planner.name} — Strategic Income Group.\nReference: ${b.reference}`,
    location: b.location_type === "in_person" ? b.location_details || type.office || "Strategic Income Group" : LOCATION_LABEL[b.location_type],
    start: b.start_at,
    end: b.end_at,
  };

  // ── reschedule ──
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [picked, setPicked] = React.useState<Slot | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSlots = React.useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await fetch(`/api/booking/manage/${token}?view=slots`, { cache: "no-store" });
      if (!res.ok) throw new Error("slots");
      const json = await res.json();
      setSlots(json.slots ?? []);
    } catch { setSlots([]); setLoadError(true); }
    finally { setLoading(false); }
  }, [token]);

  function startReschedule() {
    setMode("reschedule"); setPicked(null); setError(null); setFlash(null);
    void loadSlots();
    requestAnimationFrame(() => document.getElementById("bm-reschedule-title")?.focus());
  }

  async function confirmReschedule() {
    if (!picked) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/booking/manage/${token}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reschedule", start_at: picked.start }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError("Sorry — that time was just taken. Here are the latest openings.");
        setPicked(null);
        await loadSlots();
        return;
      }
      if (!res.ok) throw new Error(json.message || "We couldn’t move your appointment.");
      setB((prev) => ({ ...prev, start_at: json.start_at, end_at: json.end_at, status: json.status ?? prev.status, rescheduled_at: new Date().toISOString() }));
      setMode("view");
      setFlash(`Done — your appointment is now ${fmtDayYear(json.start_at, tz)} at ${fmtTime(json.start_at, tz)}.${b.notify_email || b.notify_sms ? " We’ve sent you the updated details." : ""}`);
      requestAnimationFrame(() => headingRef.current?.focus());
      if (json.manage_path) router.replace(json.manage_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t move your appointment.");
    } finally {
      setBusy(false);
    }
  }

  // ── cancel ──
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  async function confirmCancel() {
    setBusy(true); setCancelError(null);
    try {
      const res = await fetch(`/api/booking/manage/${token}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", reason: reason.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "We couldn’t cancel your appointment.");
      setB((prev) => ({ ...prev, status: "canceled", cancelled_by: "client", cancel_reason: reason.trim() || null }));
      setState({ ok: false, reason: "canceled", cutoff: state.cutoff });
      setCancelOpen(false);
      setMode("view");
      setFlash(null);
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "We couldn’t cancel your appointment.");
    } finally {
      setBusy(false);
    }
  }

  // ── details ──
  const [phone, setPhone] = React.useState(b.invitee_phone ?? "");
  const [notifyEmail, setNotifyEmail] = React.useState(b.notify_email);
  const [notifySms, setNotifySms] = React.useState(b.notify_sms);
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const phoneDigits = phone.replace(/\D/g, "");
  const dirty = phone !== (b.invitee_phone ?? "") || notifyEmail !== b.notify_email || notifySms !== b.notify_sms;
  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim() && phoneDigits.length < 10) { setSaveMsg({ ok: false, text: "Enter a full phone number, including area code." }); return; }
    if (notifySms && phoneDigits.length < 10) { setSaveMsg({ ok: false, text: "Add a mobile number to get text reminders." }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`/api/booking/manage/${token}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", invitee_phone: phone.trim() || null, notify_email: notifyEmail, notify_sms: notifySms }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "We couldn’t save your changes.");
      setB((prev) => ({ ...prev, invitee_phone: json.invitee_phone ?? null, notify_email: notifyEmail, notify_sms: notifySms }));
      setSaveMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : "We couldn’t save your changes." });
    } finally {
      setSaving(false);
    }
  }

  const past = !cancelled && state.ok === false && state.reason === "past";
  const tooLate = !cancelled && state.ok === false && state.reason === "too_late";
  const closed = !cancelled && state.ok === false && state.reason === "closed";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Your appointment</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-3xl leading-tight outline-none sm:text-4xl">
            {cancelled ? "Appointment cancelled" : `${type.name} with ${hostShort}`}
          </h1>
        </header>

        {/* Status banners */}
        {flash ? <Banner tone="success" icon={CheckCircle2}>{flash}</Banner> : null}
        {cancelled ? (
          <Banner tone="muted" icon={XCircle}>
            This appointment was cancelled{b.cancelled_by === "staff" ? " by our office" : ""}.{b.cancel_reason ? ` Reason: ${b.cancel_reason}` : ""}{" "}
            <Link href={`/book/${type.slug}`} className="font-medium text-primary underline-offset-2 hover:underline">Book a new time</Link>
          </Banner>
        ) : null}
        {past ? <Banner tone="muted" icon={Info}>This appointment has passed. Want to meet again? <Link href={`/book/${type.slug}`} className="font-medium text-primary underline-offset-2 hover:underline">Book another</Link>.</Banner> : null}
        {closed ? <Banner tone="muted" icon={Info}>This appointment is closed. <Link href={`/book/${type.slug}`} className="font-medium text-primary underline-offset-2 hover:underline">Book another</Link>.</Banner> : null}
        {tooLate ? (
          <Banner tone="gold" icon={Phone}>
            It’s within {type.min_notice_hours} hours of your appointment, so changes need a quick call. Please call{" "}
            <a href={props.officePhoneHref} className="font-semibold underline underline-offset-2">{props.officePhone}</a> and mention reference {b.reference}.
          </Banner>
        ) : null}

        {/* Appointment card */}
        <section aria-label="Appointment details" className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", cancelled && "opacity-80")}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className={cn("flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center", cancelled ? "bg-muted" : "bg-primary text-primary-foreground")}>
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{new Date(b.start_at).toLocaleDateString("en-US", { timeZone: tz, month: "short" })}</span>
              <span className="font-serif text-2xl leading-none">{new Date(b.start_at).toLocaleDateString("en-US", { timeZone: tz, day: "numeric" })}</span>
            </div>
            <div className="min-w-0">
              <p className={cn("text-lg font-semibold", cancelled && "line-through decoration-muted-foreground/60")}>{fmtDayYear(b.start_at, tz)}</p>
              <p className="text-muted-foreground">{fmtTime(b.start_at, tz)} – {fmtTime(b.end_at, tz)} <span className="whitespace-nowrap">({tzName(tz)})</span></p>
              {b.rescheduled_at && !cancelled ? <p className="mt-1 text-xs font-medium text-gold">Rescheduled</p> : null}
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-3 border-t px-5 py-4 text-sm sm:grid-cols-2 sm:px-6">
            <Fact label="Meeting">{type.name} · {type.duration_minutes} min</Fact>
            <Fact label="Where"><span className="inline-flex items-start gap-1.5"><LIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{where}</span></Fact>
            <Fact label="Booked for">{b.invitee_name}</Fact>
            <Fact label="Reference"><span className="font-mono">{b.reference}</span></Fact>
          </dl>
          <p className="flex items-center gap-1.5 border-t px-5 py-2.5 text-xs text-muted-foreground sm:px-6"><Globe className="h-3.5 w-3.5" aria-hidden /> Times in {tzLabel(tz)}</p>
          {state.ok && mode === "view" ? (
            <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:px-6">
              <Button type="button" className="h-11" onClick={startReschedule}><CalendarClock className="h-4 w-4" /> Reschedule</Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => { setCancelError(null); setCancelOpen(true); }}><CalendarX2 className="h-4 w-4" /> Cancel appointment</Button>
            </div>
          ) : null}
          {state.ok && mode === "view" ? (
            <p className="px-5 pb-4 text-xs text-muted-foreground sm:px-6">
              Changes can be made online until {fmtDayYear(state.cutoff, tz)} at {fmtTime(state.cutoff, tz)} ({type.min_notice_hours} hours before).
            </p>
          ) : null}
        </section>

        {/* Reschedule */}
        {mode === "reschedule" && state.ok ? (
          <section aria-labelledby="bm-reschedule-title" className="sig-book-in rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <button type="button" onClick={() => setMode("view")} className="mb-3 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Keep my current time
            </button>
            <h2 id="bm-reschedule-title" tabIndex={-1} className="font-serif text-2xl outline-none">Pick a new time</h2>
            <p className="mt-1 text-sm text-muted-foreground">Currently {fmtDayYear(b.start_at, tz)} at {fmtTime(b.start_at, tz)}. Your old time is released when you confirm.</p>
            {error ? <div className="mt-4"><Banner tone="gold" icon={AlertCircle}>{error}</Banner></div> : null}
            <BookingCalendar
              className="mt-5"
              idPrefix="bm"
              slots={slots}
              loading={loading}
              error={loadError}
              onRetry={() => void loadSlots()}
              timezone={tz}
              maxAdvanceDays={type.max_advance_days}
              selected={picked}
              onSelect={setPicked}
              empty={
                <Empty icon={CalendarClock} title="No times are available" body={`${hostShort.split(" ")[0]}’s calendar is full right now. Call and we’ll find you a time.`}>
                  <Button asChild size="sm"><a href={props.officePhoneHref}><Phone className="h-4 w-4" /> {props.officePhone}</a></Button>
                </Empty>
              }
            />
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm" aria-live="polite">
                {picked ? (
                  <>Move to <span className="font-semibold">{fmtDayYear(picked.start, tz)} at {fmtTime(picked.start, tz)}</span></>
                ) : (
                  <span className="text-muted-foreground">Choose a day and time above.</span>
                )}
              </p>
              <Button type="button" className="h-11 shrink-0" disabled={!picked || busy} onClick={confirmReschedule}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm new time
              </Button>
            </div>
          </section>
        ) : null}

        {/* Details & notifications */}
        {!cancelled && !past ? (
          <section aria-labelledby="bm-details-title" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 id="bm-details-title" className="font-serif text-xl">Your details &amp; reminders</h2>
            <form onSubmit={saveDetails} noValidate className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-sm font-medium">Email</p>
                  <p className="flex h-11 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">{b.invitee_email || "—"}</p>
                </div>
                <div>
                  <label htmlFor="bm-phone" className="mb-1.5 block text-sm font-medium">Mobile phone</label>
                  <Input id="bm-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(480) 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
                </div>
              </div>
              <NotifyPrefs
                idPrefix="bm"
                notifyEmail={notifyEmail}
                notifySms={notifySms}
                onEmail={setNotifyEmail}
                onSms={(v) => { setNotifySms(v); if (v && phoneDigits.length < 10) requestAnimationFrame(() => document.getElementById("bm-phone")?.focus()); }}
                missingPhone={notifySms && phoneDigits.length < 10}
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="submit" variant="outline" className="h-10" disabled={!dirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
                </Button>
                {saveMsg ? (
                  <p role="status" className={cn("text-sm", saveMsg.ok ? "text-primary" : "text-destructive")}>{saveMsg.text}</p>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="relative p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Your planner</p>
            <div className="mt-3 flex items-center gap-3">
              {planner.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={planner.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl border bg-gradient-to-b from-muted to-background object-cover object-top" />
              ) : (
                <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border bg-muted font-serif text-2xl text-muted-foreground">{planner.name.charAt(0)}</span>
              )}
              <div className="min-w-0">
                <p className="font-serif text-xl leading-tight">{hostShort}</p>
                {planner.credentials ? <p className="text-xs font-medium text-gold">{planner.credentials}</p> : null}
                {planner.title ? <p className="text-xs text-muted-foreground">{planner.title}</p> : null}
              </div>
            </div>
            {planner.slug ? <Link href={`/team/${planner.slug}`} className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">About {hostShort.split(" ")[0]} →</Link> : null}
          </div>
          {!cancelled && !past ? (
            <div className="border-t p-5">
              <AddToCalendar event={calEvent} icsHref={`/api/booking/manage/${token}?view=ics`} label="Add to calendar" />
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Questions?</p>
          <p className="mt-0.5 text-muted-foreground">
            Call <a href={props.officePhoneHref} className="font-medium text-primary hover:underline">{props.officePhone}</a> and mention reference <span className="font-mono">{b.reference}</span>.
          </p>
          <p className="mt-2"><Link href="/book/manage" className="font-medium text-primary hover:underline">See all your appointments</Link></p>
        </div>
      </aside>

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!busy) setCancelOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">Cancel this appointment?</DialogTitle>
            <DialogDescription>
              {type.name} with {hostShort} on {fmtDayYear(b.start_at, tz)} at {fmtTime(b.start_at, tz)}. The time will be released for others.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="bm-reason" className="text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea id="bm-reason" rows={3} className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Anything you’d like us to know" />
          </div>
          {cancelError ? <p role="alert" className="text-sm text-destructive">{cancelError}</p> : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>Keep appointment</Button>
            <Button type="button" variant="destructive" onClick={confirmCancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarX2 className="h-4 w-4" />} Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

function Banner({ tone, icon: Icon, children }: { tone: "success" | "muted" | "gold"; icon: typeof Info; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "sig-book-in flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm",
        tone === "success" && "border-primary/30 bg-primary/5",
        tone === "muted" && "bg-muted/50",
        tone === "gold" && "border-brand-gold/40 bg-brand-gold/10",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "success" ? "text-primary" : "text-gold")} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
