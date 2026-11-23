"use client";

// "My appointments": the planner's working view of their bookings (admins see everyone,
// with a planner filter). Quick actions: reschedule, cancel, completed, no-show, reassign.

import * as React from "react";
import {
  AlertTriangle, CalendarClock, CalendarX2, CheckCircle2, ChevronDown, Link2, Loader2, Mail, MessageSquareText,
  Phone, UserRoundCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FieldSelect, type FieldSelectOption } from "@/components/ui/field-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { fmtTime, tzLabel } from "@/components/booking/format";
import { utcToZonedDate } from "@/lib/booking/availability";
import type { Booking, BookingType, Slot } from "@/lib/booking/types";
import type { PlannerLink, StaffOption } from "@/lib/booking/data";
import { cn } from "@/lib/utils";

type View = "today" | "upcoming" | "past" | "cancelled";
const AZ = "America/Phoenix";

const statusClass: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-gold",
  completed: "bg-muted text-foreground",
  no_show: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground line-through",
};
const statusLabel: Record<string, string> = { confirmed: "Confirmed", pending: "Pending", completed: "Completed", no_show: "No-show", canceled: "Cancelled" };

export function AppointmentsPanel({
  bookings, types, staffOptions, isAdmin, meId, token, onChanged, plannerLinks: initialLinks,
}: {
  bookings: Booking[]; types: BookingType[]; staffOptions: StaffOption[]; isAdmin: boolean; meId: string | null;
  token: string; onChanged: () => Promise<void> | void; plannerLinks: PlannerLink[];
}) {
  const [view, setView] = React.useState<View>("today");
  const [planner, setPlanner] = React.useState<string>(isAdmin ? "" : "__mine");
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = React.useState<Booking | null>(null);
  const [cancelFor, setCancelFor] = React.useState<Booking | null>(null);
  const [links, setLinks] = React.useState<PlannerLink[]>(initialLinks);

  const typeById = React.useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const staffName = React.useMemo(() => new Map(staffOptions.map((s) => [s.id, s.display_name])), [staffOptions]);
  const hostOf = (b: Booking) => b.host_staff_id ?? typeById.get(b.booking_type_id)?.host_staff_id ?? null;
  const plannerLabel = (b: Booking) => {
    const h = hostOf(b);
    if (h && staffName.get(h)) return staffName.get(h)!;
    return b.booking_type?.host_name?.split(",")[0] || typeById.get(b.booking_type_id)?.host_name?.split(",")[0] || "Unassigned";
  };

  const nowIso = new Date().toISOString();
  const today = utcToZonedDate(new Date(), AZ);
  const scoped = bookings.filter((b) => {
    if (!planner) return true;
    const h = hostOf(b);
    if (planner === "__mine") return isAdmin ? h === meId : true;
    if (planner === "__none") return !h;
    return h === planner;
  });
  const isToday = (b: Booking) => utcToZonedDate(new Date(b.start_at), b.timezone || AZ) === today;
  const groups: Record<View, Booking[]> = {
    today: scoped.filter((b) => b.status !== "canceled" && isToday(b)),
    upcoming: scoped.filter((b) => b.status !== "canceled" && b.end_at >= nowIso && !isToday(b)),
    past: scoped.filter((b) => b.status !== "canceled" && b.end_at < nowIso && !isToday(b)).reverse(),
    cancelled: scoped.filter((b) => b.status === "canceled").sort((a, b) => b.start_at.localeCompare(a.start_at)),
  };
  const list = groups[view];

  const hostIds = Array.from(new Set(bookings.map(hostOf).filter(Boolean) as string[]));
  const plannerOpts: FieldSelectOption[] = [
    { value: "", label: "All planners" },
    ...(meId ? [{ value: "__mine", label: "My appointments" }] : []),
    { value: "__none", label: "Unassigned (no login)" },
    ...hostIds.filter((id) => id !== meId).map((id) => ({ value: id, label: staffName.get(id) ?? "Staff member" })),
  ];
  const staffOpts: FieldSelectOption[] = [{ value: "", label: "Unassigned (admins)" }, ...staffOptions.map((s) => ({ value: s.id, label: s.display_name }))];

  async function patch(b: Booking, body: Record<string, unknown>) {
    setBusyId(b.id); setError(null);
    try {
      const res = await fetch(`/api/booking/bookings/${b.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actionToken: token }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Update failed.");
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const unlinked = links.filter((l) => !l.profile_id && l.booking_type_count > 0);

  return (
    <div className="space-y-4">
      {isAdmin && unlinked.length ? (
        <PlannerLinkNotice links={links} unlinked={unlinked} staffOptions={staffOptions} token={token} onLinked={async (next) => { setLinks(next); await onChanged(); }} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Appointments" className="flex max-w-full items-center overflow-x-auto rounded-lg border border-border bg-card p-0.5 text-xs [scrollbar-width:none]">
          {([["today", "Today"], ["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"]] as [View, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium", view === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {l}<span className="tabular-nums opacity-60">{groups[k].length}</span>
            </button>
          ))}
        </div>
        {isAdmin ? (
          <div className="w-56"><FieldSelect aria-label="Planner" value={planner} onChange={setPlanner} options={plannerOpts} className="h-9" /></div>
        ) : null}
      </div>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
          <CalendarClock className="h-6 w-6 text-gold" aria-hidden />
          <p className="mt-3 text-sm font-medium">
            {view === "today" ? "Nothing on the calendar today" : view === "upcoming" ? "No upcoming appointments" : view === "past" ? "No past appointments yet" : "No cancellations"}
          </p>
          {!isAdmin && view !== "cancelled" ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">Bookings on your planner pages appear here. If you expected some, ask a SIG Admin to link your team page to your login.</p> : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <AppointmentRow
              key={b.id}
              b={b}
              type={typeById.get(b.booking_type_id)}
              planner={plannerLabel(b)}
              showPlanner={isAdmin}
              busy={busyId === b.id}
              isAdmin={isAdmin}
              staffOpts={staffOpts}
              host={hostOf(b)}
              onReschedule={() => setRescheduleFor(b)}
              onCancel={() => setCancelFor(b)}
              onStatus={(status) => void patch(b, { status })}
              onReassign={(id) => void patch(b, { action: "reassign", host_staff_id: id || null })}
            />
          ))}
        </ul>
      )}

      {rescheduleFor ? (
        <RescheduleDialog
          booking={rescheduleFor}
          token={token}
          onClose={() => setRescheduleFor(null)}
          onConfirm={async (slot, notify) => {
            const ok = await patch(rescheduleFor, { action: "reschedule", start_at: slot.start, notify_client: notify });
            if (ok) setRescheduleFor(null);
            return ok;
          }}
        />
      ) : null}
      {cancelFor ? (
        <CancelDialog
          booking={cancelFor}
          onClose={() => setCancelFor(null)}
          onConfirm={async (reason, notify) => {
            const ok = await patch(cancelFor, { action: "cancel", reason, notify_client: notify });
            if (ok) setCancelFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function dayLabel(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
}

function AppointmentRow({ b, type, planner, showPlanner, busy, isAdmin, staffOpts, host, onReschedule, onCancel, onStatus, onReassign }: {
  b: Booking; type?: BookingType; planner: string; showPlanner: boolean; busy: boolean; isAdmin: boolean; staffOpts: FieldSelectOption[];
  host: string | null; onReschedule: () => void; onCancel: () => void; onStatus: (s: string) => void; onReassign: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const tz = b.timezone || AZ;
  const nowIso = new Date().toISOString();
  const active = b.status === "confirmed" || b.status === "pending";
  const started = b.start_at <= nowIso;
  const answers = Object.entries(b.answers ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const questions = new Map((type?.questions ?? []).map((q) => [q.key, q.label]));
  return (
    <li className={cn("rounded-xl border border-border bg-card shadow-sm", b.status === "canceled" && "opacity-75")}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex w-28 shrink-0 flex-row items-baseline gap-2 sm:flex-col sm:gap-0">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dayLabel(b.start_at, tz)}</span>
          <span className="text-lg font-semibold tabular-nums">{fmtTime(b.start_at, tz)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{b.invitee_name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusClass[b.status] ?? "bg-muted")}>{statusLabel[b.status] ?? b.status}</span>
            {b.rescheduled_at && b.status !== "canceled" ? <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-gold">Rescheduled</span> : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: b.booking_type?.color || "hsl(var(--primary))" }} />{b.booking_type?.name ?? type?.name ?? "Appointment"}</span>
            <span aria-hidden>·</span><span>{Math.round((Date.parse(b.end_at) - Date.parse(b.start_at)) / 60000)} min</span>
            {showPlanner ? <><span aria-hidden>·</span><span>{planner}</span></> : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {b.invitee_email ? <a href={`mailto:${b.invitee_email}`} className="hover:text-foreground hover:underline">{b.invitee_email}</a> : null}
            {b.invitee_phone ? <a href={`tel:${b.invitee_phone}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline"><Phone className="h-3 w-3" aria-hidden />{b.invitee_phone}</a> : null}
            <span className="inline-flex items-center gap-1" title={b.notify_email ? "Email reminders on" : "Email reminders off"}>
              <Mail className={cn("h-3.5 w-3.5", b.notify_email ? "text-primary" : "opacity-40")} aria-hidden /><span className="sr-only">{b.notify_email ? "Email reminders on" : "Email reminders off"}</span>
            </span>
            <span className="inline-flex items-center gap-1" title={b.notify_sms ? "Text reminders on" : "Text reminders off"}>
              <MessageSquareText className={cn("h-3.5 w-3.5", b.notify_sms ? "text-primary" : "opacity-40")} aria-hidden /><span className="sr-only">{b.notify_sms ? "Text reminders on" : "Text reminders off"}</span>
            </span>
            <span className="font-mono">{b.reference}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" /> : null}
          {active && !started ? <Button size="sm" variant="outline" onClick={onReschedule} disabled={busy}><CalendarClock className="h-3.5 w-3.5" /> Reschedule</Button> : null}
          {active && started ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onStatus("completed")} disabled={busy}><CheckCircle2 className="h-3.5 w-3.5" /> Completed</Button>
              <Button size="sm" variant="outline" onClick={() => onStatus("no_show")} disabled={busy}><UserX className="h-3.5 w-3.5" /> No-show</Button>
            </>
          ) : null}
          {active ? <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancel} disabled={busy}><CalendarX2 className="h-3.5 w-3.5" /> Cancel</Button> : null}
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={open ? "Hide details" : "Show details"}>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="grid gap-4 border-t border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client answers</p>
            {answers.length ? (
              <dl className="mt-2 space-y-2">
                {answers.map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{questions.get(k) ?? k.replace(/_/g, " ")}</dt><dd className="whitespace-pre-wrap">{String(v)}</dd></div>
                ))}
              </dl>
            ) : <p className="mt-2 text-muted-foreground">No answers.</p>}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
              <p className="mt-1">{dayLabel(b.start_at, tz)} · {fmtTime(b.start_at, tz)} – {fmtTime(b.end_at, tz)} <span className="text-muted-foreground">({tzLabel(tz)})</span></p>
              <p className="text-muted-foreground">Reminders: {[b.notify_email ? "email" : null, b.notify_sms ? "text" : null].filter(Boolean).join(" + ") || "declined"}</p>
              {b.status === "canceled" ? <p className="text-muted-foreground">Cancelled{b.cancelled_by ? ` by ${b.cancelled_by === "client" ? "the client" : "staff"}` : ""}{b.cancel_reason ? ` — “${b.cancel_reason}”` : ""}</p> : null}
              {b.internal_notes ? <p className="mt-1 text-muted-foreground">Notes: {b.internal_notes}</p> : null}
            </div>
            {isAdmin ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`reassign-${b.id}`}>Assigned to</label>
                <div className="mt-1 max-w-xs"><FieldSelect id={`reassign-${b.id}`} value={host ?? ""} onChange={onReassign} options={staffOpts} className="h-9" /></div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function RescheduleDialog({ booking: b, token, onClose, onConfirm }: {
  booking: Booking; token: string; onClose: () => void; onConfirm: (slot: Slot, notify: boolean) => Promise<boolean>;
}) {
  const tz = b.timezone || AZ;
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [picked, setPicked] = React.useState<Slot | null>(null);
  const [notify, setNotify] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await fetch(`/api/booking/bookings/${b.id}`, { headers: { "x-sig-action-token": token }, cache: "no-store" });
      if (!res.ok) throw new Error();
      setSlots((await res.json()).slots ?? []);
    } catch { setLoadError(true); setSlots([]); }
    finally { setLoading(false); }
  }, [b.id, token]);
  React.useEffect(() => { void load(); }, [load]);
  const clientReachable = (b.notify_email && b.invitee_email) || (b.notify_sms && b.invitee_phone);
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reschedule {b.invitee_name}</DialogTitle>
          <DialogDescription>Currently {dayLabel(b.start_at, tz)} at {fmtTime(b.start_at, tz)}. Open times on this planner’s calendar (min-notice doesn’t apply to staff).</DialogDescription>
        </DialogHeader>
        <BookingCalendar idPrefix={`rs-${b.id}`} slots={slots} loading={loading} error={loadError} onRetry={() => void load()} timezone={tz} maxAdvanceDays={120} selected={picked} onSelect={setPicked} />
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify the client" className="mt-0.5" />
          <span>
            <span className="block font-medium">Notify the client</span>
            <span className="block text-xs text-muted-foreground">{clientReachable ? "Sends the new time by the channels they opted into, with a fresh manage link." : "This client declined reminders, so nothing will be sent — let them know yourself."}</span>
          </span>
        </label>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button disabled={!picked || busy} onClick={async () => { if (!picked) return; setBusy(true); await onConfirm(picked, notify); setBusy(false); }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} {picked ? `Move to ${dayLabel(picked.start, tz)} ${fmtTime(picked.start, tz)}` : "Pick a time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ booking: b, onClose, onConfirm }: { booking: Booking; onClose: () => void; onConfirm: (reason: string | null, notify: boolean) => Promise<void> }) {
  const tz = b.timezone || AZ;
  const [reason, setReason] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {b.invitee_name}’s appointment?</DialogTitle>
          <DialogDescription>{b.booking_type?.name ?? "Appointment"} · {dayLabel(b.start_at, tz)} at {fmtTime(b.start_at, tz)}. The time opens up again.</DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor={`cx-${b.id}`} className="text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(shared with the client)</span></label>
          <Textarea id={`cx-${b.id}`} rows={3} className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify the client" />
          Notify the client (by the channels they opted into)
        </label>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Keep it</Button>
          <Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(reason.trim() || null, notify); setBusy(false); }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarX2 className="h-4 w-4" />} Cancel appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlannerLinkNotice({ links, unlinked, staffOptions, token, onLinked }: {
  links: PlannerLink[]; unlinked: PlannerLink[]; staffOptions: StaffOption[]; token: string; onLinked: (next: PlannerLink[]) => Promise<void>;
}) {
  const [pick, setPick] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const taken = new Set(links.map((l) => l.profile_id).filter(Boolean) as string[]);
  const opts: FieldSelectOption[] = staffOptions.filter((s) => !taken.has(s.id)).map((s) => ({ value: s.id, label: s.display_name }));
  async function link(l: PlannerLink) {
    const profileId = pick[l.id];
    if (!profileId) return;
    setBusy(l.id); setErr(null);
    try {
      const res = await fetch("/api/booking/planner-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employee_profile_id: l.id, profile_id: profileId, actionToken: token }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Link failed.");
      await onLinked(json.links ?? links);
    } catch (e) { setErr(e instanceof Error ? e.message : "Link failed."); }
    finally { setBusy(null); }
  }
  return (
    <section className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4" aria-labelledby="planner-link-title">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0 flex-1">
          <p id="planner-link-title" className="text-sm font-semibold">
            {unlinked.length === 1 ? "1 planner isn’t linked to a dashboard login" : `${unlinked.length} planners aren’t linked to a dashboard login`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Their bookings go to SIG Admins and the planning@ inbox until linked. Pick the planner’s staff login to route their booking pages and upcoming appointments to them.
            No login yet? Invite them in User Management — it links automatically when their account email matches the team page.
          </p>
          {err ? <p className="mt-2 text-xs font-medium text-destructive">{err}</p> : null}
          <ul className="mt-3 space-y-2">
            {unlinked.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{l.full_name ?? l.slug}</span>
                  <span className="text-xs text-muted-foreground"> · {l.booking_type_count} booking page{l.booking_type_count === 1 ? "" : "s"}{l.account_email ? ` · ${l.account_email}` : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-52">
                    <FieldSelect aria-label={`Dashboard login for ${l.full_name ?? l.slug}`} value={pick[l.id] ?? ""} onChange={(v) => setPick((p) => ({ ...p, [l.id]: v }))} options={opts} placeholder={opts.length ? "Choose staff login…" : "No unlinked logins"} disabled={!opts.length} className="h-9" />
                  </div>
                  <Button size="sm" onClick={() => void link(l)} disabled={!pick[l.id] || busy === l.id}>
                    {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Link
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {links.some((l) => l.profile_id) ? (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <UserRoundCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Linked: {links.filter((l) => l.profile_id).map((l) => l.full_name ?? l.slug).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
