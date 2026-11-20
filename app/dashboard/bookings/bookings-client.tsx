"use client";

import * as React from "react";
import {
  Ban, CalendarClock, CalendarDays, Check, CheckCircle2, Clock, Copy, ExternalLink, HeartHandshake, Loader2, Mail, Pencil,
  Phone, Plus, Power, PowerOff, Save, Send, SlidersHorizontal, Trash2, UserX, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldSelect, type FieldSelectOption } from "@/components/ui/field-select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { zonedToUtc, utcToZonedDate } from "@/lib/booking/availability";
import {
  BOOKING_AUDIENCE_LABELS, EVENT_AUDIENCE_LABELS, EVENT_TYPE_LABELS, IMPACT_PROGRAMS, kidsFedForAYear,
  type AvailabilityRule, type Booking, type BookingManagerData, type BookingType, type EventItem,
  type EventRegistration, type EventSpeaker, type IntakeQuestion,
} from "@/lib/booking/types";
import { OFFICES } from "@/lib/public-site/site-data";
import { TEAM } from "@/lib/public-site/team";
import type { StaffOption } from "@/lib/booking/data";

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "UTC",
];
const TIME_OPTS: FieldSelectOption[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  const v = `${pad(h)}:${pad(m)}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: v, label: `${h12}:${pad(m)} ${ampm}` };
});
const LOCATION_OPTS: FieldSelectOption[] = [
  { value: "video", label: "Video call" }, { value: "phone", label: "Phone call" },
  { value: "in_person", label: "In person" }, { value: "custom", label: "Custom" },
];
const EVENT_LOCATION_OPTS: FieldSelectOption[] = [
  { value: "in_person", label: "In person" }, { value: "online", label: "Online" }, { value: "hybrid", label: "Hybrid" },
];
const EVENT_STATUS_OPTS: FieldSelectOption[] = [
  { value: "draft", label: "Draft" }, { value: "published", label: "Published" },
  { value: "canceled", label: "Canceled" }, { value: "completed", label: "Completed" },
];
const BOOKING_STATUS_OPTS: FieldSelectOption[] = [
  { value: "confirmed", label: "Confirmed" }, { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" }, { value: "no_show", label: "No-show" }, { value: "canceled", label: "Canceled" },
];
const REG_STATUS_OPTS: FieldSelectOption[] = [
  { value: "registered", label: "Registered" }, { value: "waitlisted", label: "Waitlisted" },
  { value: "attended", label: "Attended" }, { value: "canceled", label: "Canceled" },
];
const PLANNER_OPTS: FieldSelectOption[] = [
  { value: "", label: "Not on a planner page" },
  ...TEAM.filter((m) => m.group !== "admin").map((m) => ({ value: m.slug, label: m.name })),
];
const OFFICE_OPTS: FieldSelectOption[] = [{ value: "", label: "—" }, ...OFFICES.map((o) => ({ value: o.name, label: `${o.name} (${o.city})` }))];
const officeAddress = (name: string) => {
  const o = OFFICES.find((x) => x.name === name);
  return o ? `${o.street}, ${o.locality}` : "";
};
const BOOKING_AUDIENCE_OPTS: FieldSelectOption[] = Object.entries(BOOKING_AUDIENCE_LABELS).map(([value, label]) => ({ value, label }));
const EVENT_TYPE_OPTS: FieldSelectOption[] = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const EVENT_AUDIENCE_OPTS: FieldSelectOption[] = Object.entries(EVENT_AUDIENCE_LABELS).map(([value, label]) => ({ value, label }));
const plannerName = (slug?: string | null) => TEAM.find((m) => m.slug === slug)?.name;

const tzOpts = (): FieldSelectOption[] => TIMEZONES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }));

function fmtDateTime(iso: string, tz: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
function timeOf(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
function isoToParts(iso: string | null, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = utcToZonedDate(d, tz);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}
function partsToIso(date: string, time: string, tz: string): string {
  if (!date) return "";
  const [h, m] = (time || "00:00").split(":").map(Number);
  return zonedToUtc(date, (h || 0) * 60 + (m || 0), tz).toISOString();
}

const statusClass: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  no_show: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  canceled: "bg-muted text-muted-foreground line-through",
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  registered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  waitlisted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  attended: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};
function Pill({ status }: { status: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", statusClass[status] ?? "bg-muted text-muted-foreground")}>{status.replace(/_/g, " ")}</span>;
}

type Tab = "types" | "bookings" | "events";

export function BookingsClient({ initialData, staffOptions, isAdmin = true }: { initialData: BookingManagerData; staffOptions: StaffOption[]; isAdmin?: boolean }) {
  const token = useDashboardActionToken();
  const [tab, setTab] = React.useState<Tab>("types");
  const [types, setTypes] = React.useState<BookingType[]>(initialData.bookingTypes);
  const [bookings, setBookings] = React.useState<Booking[]>(initialData.bookings);
  const [events, setEvents] = React.useState<EventItem[]>(initialData.events);
  const [error, setError] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  // modals
  const [editType, setEditType] = React.useState<Partial<BookingType> | null>(null);
  const [availFor, setAvailFor] = React.useState<BookingType | null>(null);
  const [editEvent, setEditEvent] = React.useState<Partial<EventItem> | null>(null);
  const [regsFor, setRegsFor] = React.useState<EventItem | null>(null);

  const staffSelectOpts: FieldSelectOption[] = [{ value: "", label: "Unassigned" }, ...staffOptions.map((s) => ({ value: s.id, label: s.display_name }))];

  async function send(url: string, method: string, body: Record<string, unknown>) {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, actionToken: token }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || "Request failed.");
    return json;
  }
  const getJson = React.useCallback((url: string) => fetch(url, { headers: { "x-sig-action-token": token } }).then((r) => r.json()), [token]);

  const reloadTypes = React.useCallback(async () => { const r = await getJson("/api/booking/types"); if (r.bookingTypes) setTypes(r.bookingTypes); }, [getJson]);
  const reloadBookings = React.useCallback(async () => { const r = await getJson("/api/booking/bookings"); if (r.bookings) setBookings(r.bookings); }, [getJson]);
  const reloadEvents = React.useCallback(async () => { const r = await getJson("/api/events"); if (r.events) setEvents(r.events); }, [getJson]);

  async function saveType(draft: Partial<BookingType>) {
    try { await send("/api/booking/types", "POST", draft as Record<string, unknown>); setEditType(null); await reloadTypes(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
  }
  async function removeTypes(list: BookingType[]) {
    if (!list.length) return;
    const what = list.length === 1 ? `"${list[0].name}"` : `${list.length} booking pages`;
    if (!window.confirm(`Delete ${what}? Their bookings and availability are removed too.`)) return;
    try { for (const t of list) await send(`/api/booking/types/${t.id}`, "DELETE", {}); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    await reloadTypes(); await reloadBookings();
  }
  async function setTypesActive(list: BookingType[], is_active: boolean) {
    const ids = new Set(list.map((t) => t.id));
    setTypes((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, is_active } : t)));
    try { await Promise.all(list.map((t) => send("/api/booking/types", "POST", { ...t, is_active }))); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    await reloadTypes();
  }
  async function setBookingStatus(b: Booking, status: string) {
    setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: status as Booking["status"] } : x)));
    try { await send(`/api/booking/bookings/${b.id}`, "PATCH", { status }); } catch { reloadBookings(); }
  }
  async function setBookingsStatus(list: Booking[], status: string) {
    await Promise.all(list.map((b) => setBookingStatus(b, status)));
  }
  async function removeBookings(list: Booking[]) {
    if (!list.length) return;
    if (!window.confirm(list.length === 1 ? "Delete this booking?" : `Delete ${list.length} bookings?`)) return;
    try { for (const b of list) await send(`/api/booking/bookings/${b.id}`, "DELETE", {}); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    await reloadBookings();
  }
  async function saveEvent(draft: Partial<EventItem>) {
    try { await send("/api/events", "POST", draft as Record<string, unknown>); setEditEvent(null); await reloadEvents(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
  }
  async function setEventsStatus(list: EventItem[], status: EventItem["status"]) {
    const todo = list.filter((ev) => ev.status !== status);
    if (!todo.length) return;
    const ids = new Set(todo.map((ev) => ev.id));
    setEvents((prev) => prev.map((ev) => (ids.has(ev.id) ? { ...ev, status } : ev)));
    try { await Promise.all(todo.map((ev) => send("/api/events", "POST", { ...ev, status }))); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    await reloadEvents();
  }
  async function removeEvents(list: EventItem[]) {
    if (!list.length) return;
    const what = list.length === 1 ? `"${list[0].title}"` : `${list.length} events`;
    if (!window.confirm(`Delete ${what}? Their registrations are removed too.`)) return;
    try { for (const ev of list) await send(`/api/events/${ev.id}`, "DELETE", {}); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    await reloadEvents();
  }

  const tabCount: Record<Tab, number> = { types: types.length, bookings: bookings.length, events: events.length };

  return (
    <div className="min-w-0">
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Section" className="flex max-w-full items-center overflow-x-auto rounded-lg border border-border bg-card p-0.5 text-xs [scrollbar-width:none]">
          {([["types", "Booking Pages"], ["bookings", "Bookings"], ["events", "Events"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium", tab === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {l}<span className="tabular-nums opacity-60">{tabCount[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You’re seeing the booking pages, bookings and events you host. A SIG Admin can assign others to you.
        </div>
      )}
      {error && <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span className="min-w-0 break-words">{error}</span><button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button></div>}

      {tab === "types" && (
        <TypesList
          types={types} bookings={bookings} origin={origin}
          onNew={() => setEditType(newType())} onEdit={setEditType} onAvailability={setAvailFor}
          onDelete={removeTypes} onActive={setTypesActive}
        />
      )}
      {tab === "bookings" && <BookingsList bookings={bookings} types={types} onStatus={setBookingsStatus} onDelete={removeBookings} />}
      {tab === "events" && (
        <EventsList
          events={events} origin={origin}
          onNew={() => setEditEvent(newEvent())} onEdit={setEditEvent} onRegs={setRegsFor}
          onStatus={setEventsStatus} onDelete={removeEvents}
        />
      )}

      {editType && <TypeEditor draft={editType} onChange={setEditType} onSave={saveType} onClose={() => setEditType(null)} staffOpts={staffSelectOpts} isAdmin={isAdmin} />}
      {availFor && <AvailabilityModal type={availFor} token={token} onClose={() => setAvailFor(null)} />}
      {editEvent && <EventEditor draft={editEvent} onChange={setEditEvent} onSave={saveEvent} onClose={() => setEditEvent(null)} staffOpts={staffSelectOpts} isAdmin={isAdmin} />}
      {regsFor && <RegistrationsModal event={regsFor} token={token} onClose={() => setRegsFor(null)} />}
    </div>
  );
}

function newType(): Partial<BookingType> {
  return {
    name: "", description: "", duration_minutes: 30, slot_interval_minutes: null,
    buffer_before_minutes: 0, buffer_after_minutes: 0, location_type: "video", location_details: "",
    color: "#1e3a8a", is_active: true, is_public: true, host_staff_id: null, host_name: "",
    timezone: "America/Phoenix", min_notice_hours: 24, max_advance_days: 60, price_cents: 0, currency: "USD",
    questions: [], confirmation_message: "", host_slug: null, office: "East Valley Office", audience: "everyone",
  };
}
function newEvent(): Partial<EventItem> {
  return {
    title: "", summary: "", description: "", status: "draft", start_at: "", end_at: null,
    timezone: "America/Phoenix", location_type: "in_person", location_name: "SIG Chandler Office", location_address: officeAddress("East Valley Office"),
    online_url: "", cover_image_url: "", capacity: null, registration_required: true,
    registration_closes_at: null, price_cents: 0, currency: "USD", host_staff_id: null, host_name: "",
    is_public: true, custom_fields: [], event_type: "workshop", series: "", speakers: [], office: "East Valley Office",
    directions_url: "", audience: "public", waitlist_enabled: true, allow_guests: true, max_party_size: 4,
    arrival_note: "Arrive 10 minutes early.", meeting_id: "",
  };
}

// ── shared bits ──────────────────────────────────────────────────────────────
function Empty({ label }: { label: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">{label}</div>;
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 my-6 w-full rounded-xl border border-border bg-card p-5 shadow-xl", wide ? "max-w-3xl" : "max-w-2xl")}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
      title={url}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy link"}
    </button>
  );
}

// ── Intake question editor (shared by types + events) ──────────────────────────
function QuestionsEditor({ value, onChange }: { value: IntakeQuestion[]; onChange: (q: IntakeQuestion[]) => void }) {
  const set = (i: number, patch: Partial<IntakeQuestion>) => onChange(value.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const add = () => onChange([...value, { key: `q${value.length + 1}`, label: "", type: "text", required: false }]);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Intake questions</div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">No custom questions. Name, email and phone are always collected.</p>}
      <div className="space-y-2">
        {value.map((q, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input value={q.label} onChange={(e) => set(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24) || `q${i + 1}` })} placeholder="Question label" className="h-8 flex-1 min-w-[160px]" />
            <div className="w-32"><FieldSelect value={q.type} onChange={(v) => set(i, { type: v as IntakeQuestion["type"] })} options={[{ value: "text", label: "Short text" }, { value: "textarea", label: "Long text" }, { value: "select", label: "Choice" }, { value: "email", label: "Email" }, { value: "phone", label: "Phone" }]} className="h-8" /></div>
            <label className="flex items-center gap-1 text-xs"><Checkbox checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} /> req</label>
            <button onClick={() => onChange(value.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-2" onClick={add}><Plus className="h-3.5 w-3.5" /> Add question</Button>
    </div>
  );
}

function TypeEditor({ draft, onChange, onSave, onClose, staffOpts, isAdmin }: {
  draft: Partial<BookingType>; onChange: (d: Partial<BookingType>) => void;
  onSave: (d: Partial<BookingType>) => Promise<void>; onClose: () => void; staffOpts: FieldSelectOption[]; isAdmin: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof BookingType>(k: K, v: BookingType[K]) => onChange({ ...draft, [k]: v });
  async function submit() { setBusy(true); try { await onSave(draft); } finally { setBusy(false); } }
  return (
    <Modal title={draft.id ? "Edit booking page" : "New booking page"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" full><Input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Free Consultation" /></Field>
        <Field label="Planner page"><FieldSelect value={draft.host_slug ?? ""} onChange={(v) => {
          const m = TEAM.find((x) => x.slug === v);
          onChange({ ...draft, host_slug: v || null, host_name: m ? `${m.name}${m.credentials ? `, ${m.credentials}` : ""}` : draft.host_name, office: m?.office ?? draft.office });
        }} options={PLANNER_OPTS} /></Field>
        <Field label="Who is it for?"><FieldSelect value={draft.audience ?? "everyone"} onChange={(v) => set("audience", v as BookingType["audience"])} options={BOOKING_AUDIENCE_OPTS} /></Field>
        <Field label="Office"><FieldSelect value={draft.office ?? ""} onChange={(v) => onChange({ ...draft, office: v || null, location_details: draft.location_type === "in_person" && v ? officeAddress(v) : draft.location_details })} options={OFFICE_OPTS} /></Field>
        <Field label="Description" full><Textarea className="min-h-[60px]" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Duration (minutes)"><Input type="number" min={5} value={draft.duration_minutes ?? 30} onChange={(e) => set("duration_minutes", Number(e.target.value))} /></Field>
        <Field label="Slot interval (optional)"><Input type="number" min={5} value={draft.slot_interval_minutes ?? ""} placeholder="= duration" onChange={(e) => set("slot_interval_minutes", e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="Buffer before (min)"><Input type="number" min={0} value={draft.buffer_before_minutes ?? 0} onChange={(e) => set("buffer_before_minutes", Number(e.target.value))} /></Field>
        <Field label="Buffer after (min)"><Input type="number" min={0} value={draft.buffer_after_minutes ?? 0} onChange={(e) => set("buffer_after_minutes", Number(e.target.value))} /></Field>
        <Field label="Location"><FieldSelect value={draft.location_type ?? "video"} onChange={(v) => set("location_type", v as BookingType["location_type"])} options={LOCATION_OPTS} /></Field>
        <Field label="Location details"><Input value={draft.location_details ?? ""} onChange={(e) => set("location_details", e.target.value)} placeholder="Zoom link, address, etc." /></Field>
        <Field label="Timezone"><FieldSelect value={draft.timezone ?? "America/Chicago"} onChange={(v) => set("timezone", v)} options={tzOpts()} /></Field>
        {isAdmin && <Field label="Managed by (dashboard user)"><FieldSelect value={draft.host_staff_id ?? ""} onChange={(v) => set("host_staff_id", v || null)} options={staffOpts} /></Field>}
        <Field label="Host display name"><Input value={draft.host_name ?? ""} onChange={(e) => set("host_name", e.target.value)} /></Field>
        <Field label="Color"><input type="color" value={draft.color ?? "#0f766e"} onChange={(e) => set("color", e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-background" /></Field>
        <Field label="Min notice (hours)"><Input type="number" min={0} value={draft.min_notice_hours ?? 12} onChange={(e) => set("min_notice_hours", Number(e.target.value))} /></Field>
        <Field label="Max advance (days)"><Input type="number" min={1} value={draft.max_advance_days ?? 60} onChange={(e) => set("max_advance_days", Number(e.target.value))} /></Field>
        <Field label="Confirmation message" full><Textarea className="min-h-[52px]" value={draft.confirmation_message ?? ""} onChange={(e) => set("confirmation_message", e.target.value)} placeholder="Shown to the invitee after booking." /></Field>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <Toggle checked={draft.is_active ?? true} onChange={(v) => set("is_active", v)} label="Active" />
          <Toggle checked={draft.is_public ?? true} onChange={(v) => set("is_public", v)} label="Public booking page" />
        </div>
        <div className="sm:col-span-2"><QuestionsEditor value={(draft.questions as IntakeQuestion[]) ?? []} onChange={(q) => set("questions", q)} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !String(draft.name ?? "").trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
      </div>
    </Modal>
  );
}

// ── Availability modal ──────────────────────────────────────────────────────────
function AvailabilityModal({ type, token, onClose }: { type: BookingType; token: string; onClose: () => void }) {
  const [rules, setRules] = React.useState<Pick<AvailabilityRule, "day_of_week" | "start_time" | "end_time" | "is_active">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/booking/availability?booking_type_id=${type.id}`, { headers: { "x-sig-action-token": token } })
      .then((r) => r.json())
      .then((d) => setRules((d.rules ?? []).map((r: AvailabilityRule) => ({ day_of_week: r.day_of_week, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5), is_active: r.is_active }))))
      .catch(() => setErr("Failed to load availability."))
      .finally(() => setLoading(false));
  }, [type.id, token]);

  const byDay = (d: number) => rules.map((r, i) => ({ r, i })).filter(({ r }) => r.day_of_week === d);
  const addWindow = (d: number) => setRules((prev) => [...prev, { day_of_week: d, start_time: "09:00", end_time: "17:00", is_active: true }]);
  const update = (i: number, patch: Partial<typeof rules[number]>) => setRules((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRules((prev) => prev.filter((_, k) => k !== i));

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/booking/availability", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ booking_type_id: type.id, rules, actionToken: token }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Save failed.");
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Availability — ${type.name}`} onClose={onClose} wide>
      <p className="mb-3 text-xs text-muted-foreground">Weekly hours in <span className="font-medium text-foreground">{type.timezone}</span>. Slots are generated from these windows minus existing bookings and buffers.</p>
      {err && <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
      {loading ? <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-1.5">
          {DOW.map((name, d) => (
            <div key={d} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
              <div className="w-12 pt-1.5 text-sm font-medium">{name}</div>
              <div className="flex-1 space-y-1.5">
                {byDay(d).length === 0 && <div className="py-1.5 text-xs text-muted-foreground">Unavailable</div>}
                {byDay(d).map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-28"><FieldSelect value={r.start_time} onChange={(v) => update(i, { start_time: v })} options={TIME_OPTS} className="h-8" /></div>
                    <span className="text-xs text-muted-foreground">to</span>
                    <div className="w-28"><FieldSelect value={r.end_time} onChange={(v) => update(i, { end_time: v })} options={TIME_OPTS} className="h-8" /></div>
                    <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => addWindow(d)} className="pt-1.5 text-muted-foreground hover:text-primary" title="Add window"><Plus className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || loading}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save availability</Button>
      </div>
    </Modal>
  );
}

// ── List helpers (DataView) ─────────────────────────────────────────────────────
function Dot({ color, size = "h-3 w-3" }: { color?: string | null; size?: string }) {
  return <span className={cn("shrink-0 rounded-full", size)} style={{ background: color || "#0f766e" }} aria-hidden />;
}
function ActivePill({ active }: { active: boolean }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", active ? statusClass.confirmed : "bg-muted text-muted-foreground")}>{active ? "Active" : "Inactive"}</span>;
}
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  return (
    <dl className="grid gap-2.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function PreviewActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 border-t border-border pt-4">{children}</div>;
}
function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-muted-foreground hover:text-primary">
      <ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{children}</span>
    </a>
  );
}
const copyText = (text: string) => { void navigator.clipboard?.writeText(text); };
const locationLabel = (v: string) => LOCATION_OPTS.find((o) => o.value === v)?.label ?? v;
const eventLocationLabel = (v: string) => EVENT_LOCATION_OPTS.find((o) => o.value === v)?.label ?? v;
const isoDate = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString() : "");

// ── Booking Pages list ──────────────────────────────────────────────────────────
function TypesList({ types, bookings, origin, onNew, onEdit, onAvailability, onDelete, onActive }: {
  types: BookingType[]; bookings: Booking[]; origin: string;
  onNew: () => void; onEdit: (t: BookingType) => void; onAvailability: (t: BookingType) => void;
  onDelete: (list: BookingType[]) => Promise<void>; onActive: (list: BookingType[], active: boolean) => Promise<void>;
}) {
  const nowIso = React.useMemo(() => new Date().toISOString(), [bookings]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = React.useMemo(() => {
    const m = new Map<string, { total: number; upcoming: number }>();
    for (const b of bookings) {
      const c = m.get(b.booking_type_id) ?? { total: 0, upcoming: 0 };
      c.total += 1;
      if (b.end_at >= nowIso && b.status !== "canceled") c.upcoming += 1;
      m.set(b.booking_type_id, c);
    }
    return m;
  }, [bookings, nowIso]);
  const urlOf = (t: BookingType) => `${origin}/book/${t.slug}`;
  const planners = Array.from(new Set(types.map((t) => t.host_slug).filter(Boolean) as string[]));
  const offices = Array.from(new Set(types.map((t) => t.office).filter(Boolean) as string[]));

  const columns: DataColumn<BookingType>[] = [
    { id: "name", label: "Booking page", required: true, width: 240, cell: (t) => <span className="font-medium">{t.name}</span>, sort: (t) => t.name },
    { id: "planner", label: "Planner", width: 170, cell: (t) => plannerName(t.host_slug) ?? t.host_slug ?? "—", sort: (t) => plannerName(t.host_slug) ?? t.host_slug ?? "" },
    { id: "office", label: "Office", width: 170, cell: (t) => t.office || "—", sort: (t) => t.office ?? "" },
    { id: "format", label: "Format", width: 150, cell: (t) => `${t.duration_minutes} min · ${locationLabel(t.location_type)}`, sort: (t) => t.duration_minutes, exportValue: (t) => `${t.duration_minutes} min ${locationLabel(t.location_type)}` },
    { id: "audience", label: "Audience", width: 150, cell: (t) => BOOKING_AUDIENCE_LABELS[t.audience ?? "everyone"], sort: (t) => BOOKING_AUDIENCE_LABELS[t.audience ?? "everyone"] },
    { id: "status", label: "Status", width: 110, cell: (t) => <ActivePill active={t.is_active} />, sort: (t) => (t.is_active ? "Active" : "Inactive") },
    { id: "upcoming", label: "Upcoming", width: 110, align: "right", cell: (t) => counts.get(t.id)?.upcoming ?? 0, sort: (t) => counts.get(t.id)?.upcoming ?? 0 },
    { id: "bookings", label: "All bookings", width: 120, align: "right", defaultHidden: true, cell: (t) => counts.get(t.id)?.total ?? 0, sort: (t) => counts.get(t.id)?.total ?? 0 },
    { id: "host", label: "Host name", width: 180, defaultHidden: true, cell: (t) => t.host_name || "—", sort: (t) => t.host_name ?? "" },
    { id: "timezone", label: "Timezone", width: 170, defaultHidden: true, cell: (t) => t.timezone.replace(/_/g, " "), sort: (t) => t.timezone },
    {
      id: "link", label: "Public link", width: 240,
      cell: (t) => (t.is_public ? <span className="flex min-w-0 items-center gap-3"><ExtLink href={urlOf(t)}>/book/{t.slug}</ExtLink><CopyLink url={urlOf(t)} /></span> : <span className="text-[11px] text-muted-foreground">Private</span>),
      exportValue: (t) => (t.is_public ? urlOf(t) : "Private"),
    },
  ];

  return (
    <DataView<BookingType>
      storageKey="bookings-pages"
      exportName="sig-booking-pages"
      noun={["booking page", "booking pages"]}
      defaultView="cards"
      items={types}
      getId={(t) => t.id}
      title={(t) => t.name}
      subtitle={(t) => `${t.duration_minutes} min · ${locationLabel(t.location_type)}${t.host_name ? ` · ${t.host_name}` : ""}`}
      media={(t) => <Dot color={t.color} />}
      badge={(t) => (!t.is_active ? <ActivePill active={false} /> : null)}
      meta={(t) => (t.description ? <span className="line-clamp-2">{t.description}</span> : null)}
      columns={columns}
      searchText={(t) => [t.name, t.slug, t.description, t.host_name, plannerName(t.host_slug), t.office, t.location_details].join(" ")}
      stats={[
        { label: "Active pages", value: types.filter((t) => t.is_active).length, icon: SlidersHorizontal, hint: `${types.length} total` },
        { label: "Public", value: types.filter((t) => t.is_active && t.is_public).length, icon: ExternalLink, hint: "Bookable on /book" },
        { label: "Upcoming", value: bookings.filter((b) => b.end_at >= nowIso && b.status !== "canceled").length, icon: CalendarClock, hint: "Appointments on these pages" },
        { label: "Planners", value: planners.length, icon: Users, hint: "With a booking page" },
      ]}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "active", label: "Active", test: (t) => t.is_active },
        { id: "inactive", label: "Inactive", test: (t) => !t.is_active },
      ]}
      selectFilters={[
        { id: "planner", label: "Planner", options: [...planners.map((s) => ({ value: s, label: plannerName(s) ?? s })), { value: "__none", label: "No planner page" }], get: (t) => t.host_slug || "__none" },
        { id: "office", label: "Office", options: offices.map((o) => ({ value: o, label: o })), get: (t) => t.office },
        { id: "audience", label: "Audience", options: BOOKING_AUDIENCE_OPTS.map((o) => ({ value: o.value, label: o.label })), get: (t) => t.audience ?? "everyone" },
      ]}
      add={{ label: "New booking page", onClick: onNew }}
      actions={[
        { label: "Activate", icon: Power, show: (sel) => sel.some((t) => !t.is_active), run: (sel) => onActive(sel.filter((t) => !t.is_active), true) },
        { label: "Deactivate", icon: PowerOff, show: (sel) => sel.some((t) => t.is_active), run: (sel) => onActive(sel.filter((t) => t.is_active), false) },
        { label: "Availability", icon: Clock, single: true, run: (sel) => onAvailability(sel[0]) },
        { label: "Edit", icon: Pencil, single: true, run: (sel) => onEdit(sel[0]) },
        { label: "Copy link", icon: Copy, single: true, show: (sel) => sel.length !== 1 || sel[0].is_public, run: (sel) => copyText(urlOf(sel[0])) },
        { label: "Delete", icon: Trash2, destructive: true, run: (sel) => onDelete(sel) },
      ]}
      preview={(t, close) => {
        const c = counts.get(t.id);
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ActivePill active={t.is_active} />
              <span className="text-xs text-muted-foreground">{t.is_public ? "Public booking page" : "Private booking page"}</span>
            </div>
            {t.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.description}</p> : null}
            <Facts rows={[
              ["Planner", plannerName(t.host_slug) ?? t.host_slug],
              ["Host name", t.host_name],
              ["Office", t.office],
              ["Audience", BOOKING_AUDIENCE_LABELS[t.audience ?? "everyone"]],
              ["Duration", `${t.duration_minutes} min${t.slot_interval_minutes ? ` · every ${t.slot_interval_minutes} min` : ""}`],
              ["Buffers", t.buffer_before_minutes || t.buffer_after_minutes ? `${t.buffer_before_minutes} min before · ${t.buffer_after_minutes} min after` : null],
              ["Location", `${locationLabel(t.location_type)}${t.location_details ? ` — ${t.location_details}` : ""}`],
              ["Timezone", t.timezone.replace(/_/g, " ")],
              ["Notice", `${t.min_notice_hours} h minimum · up to ${t.max_advance_days} days ahead`],
              ["Questions", t.questions?.length ? t.questions.map((q) => q.label).filter(Boolean).join(", ") : null],
              ["Bookings", `${c?.upcoming ?? 0} upcoming · ${c?.total ?? 0} total`],
              ["Public link", t.is_public ? <span className="flex flex-wrap items-center gap-3"><ExtLink href={urlOf(t)}>/book/{t.slug}</ExtLink><CopyLink url={urlOf(t)} /></span> : "Private"],
            ]} />
            <PreviewActions>
              <Button size="sm" onClick={() => { close(); onAvailability(t); }}><Clock className="h-4 w-4" /> Availability</Button>
              <Button size="sm" variant="outline" onClick={() => { close(); onEdit(t); }}><Pencil className="h-4 w-4" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={() => void onActive([t], !t.is_active)}>{t.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />} {t.is_active ? "Deactivate" : "Activate"}</Button>
              {t.is_public ? <Button size="sm" variant="outline" onClick={() => copyText(urlOf(t))}><Copy className="h-4 w-4" /> Copy link</Button> : null}
              <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => void onDelete([t])}><Trash2 className="h-4 w-4" /> Delete</Button>
            </PreviewActions>
          </div>
        );
      }}
      empty="No booking pages yet. Create one to start taking appointments."
    />
  );
}

// ── Bookings list ───────────────────────────────────────────────────────────────
function BookingsList({ bookings, types, onStatus, onDelete }: {
  bookings: Booking[]; types: BookingType[];
  onStatus: (list: Booking[], status: string) => Promise<void>; onDelete: (list: Booking[]) => Promise<void>;
}) {
  const nowIso = new Date().toISOString();
  const typeById = React.useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const plannerOf = (b: Booking) => typeById.get(b.booking_type_id)?.host_slug ?? null;
  const pageName = (b: Booking) => b.booking_type?.name ?? typeById.get(b.booking_type_id)?.name ?? "—";
  const statusLabel = (s: string) => BOOKING_STATUS_OPTS.find((o) => o.value === s)?.label ?? s;
  const upcoming = (b: Booking) => b.end_at >= nowIso && b.status !== "canceled";
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();
  const pageIds = Array.from(new Set(bookings.map((b) => b.booking_type_id)));
  const planners = Array.from(new Set(bookings.map(plannerOf).filter(Boolean) as string[]));

  const columns: DataColumn<Booking>[] = [
    { id: "invitee", label: "Invitee", required: true, width: 200, cell: (b) => <span className="font-medium">{b.invitee_name}</span>, sort: (b) => b.invitee_name },
    { id: "when", label: "When", width: 220, cell: (b) => `${fmtDateTime(b.start_at, b.timezone)} – ${timeOf(b.end_at, b.timezone)}`, sort: (b) => b.start_at, exportValue: (b) => isoDate(b.start_at) },
    { id: "status", label: "Status", width: 120, cell: (b) => <Pill status={b.status} />, sort: (b) => statusLabel(b.status) },
    { id: "page", label: "Booking page", width: 200, cell: (b) => <span className="inline-flex min-w-0 items-center gap-2"><Dot color={b.booking_type?.color} size="h-2.5 w-2.5" /><span className="truncate">{pageName(b)}</span></span>, sort: pageName },
    { id: "planner", label: "Planner", width: 160, cell: (b) => plannerName(plannerOf(b)) ?? "—", sort: (b) => plannerName(plannerOf(b)) ?? "" },
    { id: "email", label: "Email", width: 220, cell: (b) => b.invitee_email || "—", sort: (b) => b.invitee_email ?? "" },
    { id: "phone", label: "Phone", width: 150, cell: (b) => b.invitee_phone || "—", sort: (b) => b.invitee_phone ?? "" },
    { id: "reference", label: "Reference", width: 130, cell: (b) => <span className="font-mono text-xs">{b.reference}</span>, sort: (b) => b.reference },
    { id: "location", label: "Location", width: 150, defaultHidden: true, cell: (b) => locationLabel(b.location_type), sort: (b) => locationLabel(b.location_type) },
    { id: "end", label: "Ends", width: 180, defaultHidden: true, cell: (b) => fmtDateTime(b.end_at, b.timezone), sort: (b) => b.end_at, exportValue: (b) => isoDate(b.end_at) },
    { id: "source", label: "Source", width: 130, defaultHidden: true, cell: (b) => b.source || "—", sort: (b) => b.source ?? "" },
    { id: "booked", label: "Booked", width: 160, defaultHidden: true, cell: (b) => (b.created_at ? new Date(b.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—"), sort: (b) => b.created_at ?? "", exportValue: (b) => isoDate(b.created_at) },
  ];

  return (
    <DataView<Booking>
      storageKey="bookings-appointments"
      exportName="sig-bookings"
      noun={["booking", "bookings"]}
      defaultView="list"
      items={bookings}
      getId={(b) => b.id}
      title={(b) => b.invitee_name}
      subtitle={(b) => `${pageName(b)} · ${fmtDateTime(b.start_at, b.timezone)}`}
      media={(b) => <Dot color={b.booking_type?.color} size="h-2.5 w-2.5" />}
      badge={(b) => <Pill status={b.status} />}
      meta={(b) => <span className="font-mono">{b.reference}</span>}
      columns={columns}
      searchText={(b) => [b.invitee_name, b.invitee_email, b.invitee_phone, b.reference, pageName(b), plannerName(plannerOf(b)), b.internal_notes].join(" ")}
      stats={[
        { label: "Upcoming", value: bookings.filter(upcoming).length, icon: CalendarClock },
        { label: "Next 7 days", value: bookings.filter((b) => upcoming(b) && b.start_at <= weekAhead).length, icon: CalendarDays },
        { label: "Pending", value: bookings.filter((b) => b.status === "pending").length, icon: Clock, hint: "Awaiting confirmation" },
        { label: "Completed", value: bookings.filter((b) => b.status === "completed").length, icon: CheckCircle2 },
        { label: "No-shows", value: bookings.filter((b) => b.status === "no_show").length, icon: UserX },
      ]}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "upcoming", label: "Upcoming", test: upcoming },
        { id: "past", label: "Past", test: (b) => b.end_at < nowIso },
      ]}
      selectFilters={[
        { id: "status", label: "Status", options: BOOKING_STATUS_OPTS.map((o) => ({ value: o.value, label: o.label })), get: (b) => b.status },
        { id: "page", label: "Booking page", options: pageIds.map((id) => ({ value: id, label: typeById.get(id)?.name ?? bookings.find((b) => b.booking_type_id === id)?.booking_type?.name ?? "Unknown" })), get: (b) => b.booking_type_id },
        { id: "planner", label: "Planner", options: planners.map((s) => ({ value: s, label: plannerName(s) ?? s })), get: plannerOf },
      ]}
      board={{
        lanes: BOOKING_STATUS_OPTS.map((o) => ({ id: o.value, label: o.label })),
        get: (b) => b.status,
        onMove: (b, lane) => onStatus([b], lane),
      }}
      date={(b) => b.start_at}
      actions={[
        { label: "Confirm", icon: Check, run: (sel) => onStatus(sel, "confirmed") },
        { label: "Complete", icon: CheckCircle2, run: (sel) => onStatus(sel, "completed") },
        { label: "No-show", icon: UserX, run: (sel) => onStatus(sel, "no_show") },
        { label: "Cancel", icon: Ban, run: (sel) => onStatus(sel, "canceled") },
        { label: "Email", icon: Mail, single: true, show: (sel) => sel.length !== 1 || Boolean(sel[0].invitee_email), run: (sel) => { if (sel[0].invitee_email) window.location.href = `mailto:${sel[0].invitee_email}`; } },
        { label: "Delete", icon: Trash2, destructive: true, run: (sel) => onDelete(sel) },
      ]}
      preview={(b) => {
        const answers = Object.entries(b.answers ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
        return (
          <div className="space-y-5">
            <div className="max-w-xs">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <FieldSelect value={b.status} onChange={(v) => void onStatus([b], v)} options={BOOKING_STATUS_OPTS} />
            </div>
            <Facts rows={[
              ["When", `${fmtDateTime(b.start_at, b.timezone)} – ${timeOf(b.end_at, b.timezone)}`],
              ["Timezone", b.timezone.replace(/_/g, " ")],
              ["Booking page", pageName(b)],
              ["Planner", plannerName(plannerOf(b))],
              ["Email", b.invitee_email ? <a className="text-primary hover:underline" href={`mailto:${b.invitee_email}`}>{b.invitee_email}</a> : null],
              ["Phone", b.invitee_phone ? <a className="text-primary hover:underline" href={`tel:${b.invitee_phone}`}>{b.invitee_phone}</a> : null],
              ["Reminders", b.notify_email === undefined && b.notify_sms === undefined ? null : [b.notify_email ? "Email" : null, b.notify_sms ? "Text (SMS consent given)" : null].filter(Boolean).join(" + ") || "Declined"],
              ["Location", `${locationLabel(b.location_type)}${b.location_details ? ` — ${b.location_details}` : ""}`],
              ["Reference", <span key="ref" className="font-mono">{b.reference}</span>],
              ["Source", b.source],
              ["Cancel reason", b.cancel_reason],
              ["Internal notes", b.internal_notes],
              ...answers.map(([k, v]) => [k.replace(/_/g, " "), String(v)] as [string, React.ReactNode]),
            ]} />
            <PreviewActions>
              {b.invitee_email ? <Button asChild size="sm"><a href={`mailto:${b.invitee_email}`}><Mail className="h-4 w-4" /> Email</a></Button> : null}
              {b.invitee_phone ? <Button asChild size="sm" variant="outline"><a href={`tel:${b.invitee_phone}`}><Phone className="h-4 w-4" /> Call</a></Button> : null}
              <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => void onDelete([b])}><Trash2 className="h-4 w-4" /> Delete</Button>
            </PreviewActions>
          </div>
        );
      }}
      empty="No bookings yet. Share a booking page's public link to start receiving them."
    />
  );
}

// ── Events list ─────────────────────────────────────────────────────────────────
function EventsList({ events, origin, onNew, onEdit, onRegs, onStatus, onDelete }: {
  events: EventItem[]; origin: string;
  onNew: () => void; onEdit: (e: EventItem) => void; onRegs: (e: EventItem) => void;
  onStatus: (list: EventItem[], status: EventItem["status"]) => Promise<void>; onDelete: (list: EventItem[]) => Promise<void>;
}) {
  const nowIso = new Date().toISOString();
  const urlOf = (e: EventItem) => `${origin}/events/${e.slug}`;
  const live = (e: EventItem) => e.status === "published" && e.is_public;
  const endOf = (e: EventItem) => e.end_at || e.start_at;
  const isFull = (e: EventItem) => e.capacity != null && (e.registered_count ?? 0) >= e.capacity;
  const statusLabel = (s: string) => EVENT_STATUS_OPTS.find((o) => o.value === s)?.label ?? s;
  const regsText = (e: EventItem) => `${e.registered_count ?? 0}${e.capacity != null ? `/${e.capacity}` : ""}${(e.waitlist_count ?? 0) > 0 ? ` (+${e.waitlist_count} wait)` : ""}`;
  const regsButton = (e: EventItem) => (
    <button onClick={(ev) => { ev.stopPropagation(); onRegs(e); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-0.5 text-xs hover:bg-muted/50" title="Registrations">
      <Users className="h-3.5 w-3.5" />{regsText(e)}
    </button>
  );
  const types = Array.from(new Set(events.map((e) => e.event_type).filter(Boolean) as string[]));
  const meals = events.reduce((s, e) => s + (e.impact_meals ?? 0), 0);

  const columns: DataColumn<EventItem>[] = [
    { id: "title", label: "Event", required: true, width: 260, cell: (e) => <span className="font-medium">{e.title}</span>, sort: (e) => e.title },
    { id: "when", label: "When", width: 190, cell: (e) => fmtDateTime(e.start_at, e.timezone), sort: (e) => e.start_at, exportValue: (e) => isoDate(e.start_at) },
    { id: "registrations", label: "Registrations", width: 150, cell: (e) => regsButton(e), sort: (e) => e.registered_count ?? 0, exportValue: (e) => e.registered_count ?? 0 },
    { id: "status", label: "Status", width: 120, cell: (e) => <span className="inline-flex items-center gap-1"><Pill status={e.status} />{isFull(e) ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Full</span> : null}</span>, sort: (e) => statusLabel(e.status) },
    { id: "type", label: "Type", width: 200, cell: (e) => (e.event_type ? EVENT_TYPE_LABELS[e.event_type] : "—"), sort: (e) => (e.event_type ? EVENT_TYPE_LABELS[e.event_type] : "") },
    { id: "audience", label: "Audience", width: 170, cell: (e) => EVENT_AUDIENCE_LABELS[e.audience ?? "public"], sort: (e) => EVENT_AUDIENCE_LABELS[e.audience ?? "public"] },
    { id: "location", label: "Location", width: 220, cell: (e) => `${eventLocationLabel(e.location_type)}${e.location_name ? ` · ${e.location_name}` : ""}`, sort: (e) => e.location_name ?? "" },
    { id: "office", label: "Office", width: 160, defaultHidden: true, cell: (e) => e.office || "—", sort: (e) => e.office ?? "" },
    { id: "series", label: "Series", width: 180, defaultHidden: true, cell: (e) => e.series || "—", sort: (e) => e.series ?? "" },
    { id: "host", label: "Host", width: 170, defaultHidden: true, cell: (e) => e.host_name || "—", sort: (e) => e.host_name ?? "" },
    { id: "capacity", label: "Capacity", width: 100, align: "right", defaultHidden: true, cell: (e) => e.capacity ?? "∞", sort: (e) => e.capacity ?? Number.MAX_SAFE_INTEGER, exportValue: (e) => e.capacity ?? "" },
    { id: "waitlist", label: "Waitlist", width: 100, align: "right", defaultHidden: true, cell: (e) => e.waitlist_count ?? 0, sort: (e) => e.waitlist_count ?? 0 },
    { id: "meals", label: "Meals packed", width: 160, align: "right", defaultHidden: true, cell: (e) => (e.impact_meals ? `${e.impact_meals.toLocaleString()} · ${kidsFedForAYear(e.impact_meals)} kids` : "—"), sort: (e) => e.impact_meals ?? 0, exportValue: (e) => e.impact_meals ?? "" },
    {
      id: "link", label: "Public page", width: 240, defaultHidden: true,
      cell: (e) => (live(e) ? <span className="flex min-w-0 items-center gap-3"><ExtLink href={urlOf(e)}>/events/{e.slug}</ExtLink><CopyLink url={urlOf(e)} /></span> : <span className="text-[11px] text-muted-foreground">Not live</span>),
      exportValue: (e) => (live(e) ? urlOf(e) : ""),
    },
  ];

  return (
    <DataView<EventItem>
      storageKey="bookings-events"
      exportName="sig-events"
      noun={["event", "events"]}
      defaultView="list"
      items={events}
      getId={(e) => e.id}
      title={(e) => e.title}
      subtitle={(e) => `${e.event_type ? `${EVENT_TYPE_LABELS[e.event_type]} · ` : ""}${fmtDateTime(e.start_at, e.timezone)}${e.location_name ? ` · ${e.location_name}` : ""}`}
      badge={(e) => (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Pill status={e.status} />
          {isFull(e) ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Full</span> : null}
          {e.impact_meals ? <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:inline">{e.impact_meals.toLocaleString()} meals · {kidsFedForAYear(e.impact_meals)} kids</span> : null}
        </span>
      )}
      meta={(e) => regsButton(e)}
      columns={columns}
      searchText={(e) => [e.title, e.summary, e.series, e.location_name, e.location_address, e.host_name, e.office, e.event_type ? EVENT_TYPE_LABELS[e.event_type] : "", (e.speakers ?? []).map((s) => s.name).join(" ")].join(" ")}
      stats={[
        { label: "Live events", value: events.filter((e) => e.status === "published").length, icon: CalendarDays, hint: `${events.filter((e) => e.status === "draft").length} drafts` },
        { label: "Upcoming", value: events.filter((e) => endOf(e) >= nowIso && e.status !== "canceled").length, icon: CalendarClock },
        { label: "Registered", value: events.filter((e) => endOf(e) >= nowIso).reduce((s, e) => s + (e.registered_count ?? 0), 0), icon: Users, hint: "Across upcoming events" },
        { label: "Meals packed", value: meals.toLocaleString(), icon: HeartHandshake, hint: `≈ ${kidsFedForAYear(meals)} kids fed for a year` },
      ]}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "upcoming", label: "Upcoming", test: (e) => endOf(e) >= nowIso },
        { id: "past", label: "Past", test: (e) => endOf(e) < nowIso },
      ]}
      selectFilters={[
        { id: "type", label: "Type", options: types.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t as keyof typeof EVENT_TYPE_LABELS] ?? t })), get: (e) => e.event_type },
        { id: "status", label: "Status", options: EVENT_STATUS_OPTS.map((o) => ({ value: o.value, label: o.label })), get: (e) => e.status },
        { id: "audience", label: "Audience", options: EVENT_AUDIENCE_OPTS.map((o) => ({ value: o.value, label: o.label })), get: (e) => e.audience ?? "public" },
      ]}
      board={{
        lanes: EVENT_STATUS_OPTS.map((o) => ({ id: o.value, label: o.label })),
        get: (e) => e.status,
        onMove: (e, lane) => onStatus([e], lane as EventItem["status"]),
      }}
      date={(e) => e.start_at}
      add={{ label: "New event", onClick: onNew }}
      actions={[
        { label: "Registrations", icon: Users, single: true, run: (sel) => onRegs(sel[0]) },
        { label: "Edit", icon: Pencil, single: true, run: (sel) => onEdit(sel[0]) },
        { label: "Copy link", icon: Copy, single: true, show: (sel) => sel.length !== 1 || live(sel[0]), run: (sel) => copyText(urlOf(sel[0])) },
        { label: "Publish", icon: Send, show: (sel) => sel.some((e) => e.status !== "published"), run: (sel) => onStatus(sel, "published") },
        { label: "Mark completed", icon: CheckCircle2, show: (sel) => sel.some((e) => e.status !== "completed"), run: (sel) => onStatus(sel, "completed") },
        { label: "Cancel", icon: Ban, show: (sel) => sel.some((e) => e.status !== "canceled"), run: (sel) => onStatus(sel, "canceled") },
        { label: "Delete", icon: Trash2, destructive: true, run: (sel) => onDelete(sel) },
      ]}
      preview={(e, close) => (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <FieldSelect value={e.status} onChange={(v) => void onStatus([e], v as EventItem["status"])} options={EVENT_STATUS_OPTS} />
            </div>
            {isFull(e) ? <span className="mb-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Full</span> : null}
          </div>
          {e.summary ? <p className="text-sm text-muted-foreground">{e.summary}</p> : null}
          <Facts rows={[
            ["When", `${fmtDateTime(e.start_at, e.timezone)}${e.end_at ? ` – ${fmtDateTime(e.end_at, e.timezone)}` : ""}`],
            ["Type", e.event_type ? EVENT_TYPE_LABELS[e.event_type] : null],
            ["Series", e.series],
            ["Audience", EVENT_AUDIENCE_LABELS[e.audience ?? "public"]],
            ["Location", `${eventLocationLabel(e.location_type)}${e.location_name ? ` · ${e.location_name}` : ""}`],
            ["Address", e.location_address],
            ["Online", e.online_url ? <a className="break-all text-primary hover:underline" href={e.online_url} target="_blank" rel="noreferrer">{e.online_url}</a> : null],
            ["Host", e.host_name],
            ["Speakers", (e.speakers ?? []).map((s) => s.name).filter(Boolean).join(", ")],
            ["Registrations", regsText(e)],
            ["Impact", e.impact_meals ? `${e.impact_meals.toLocaleString()} meals · ≈ ${kidsFedForAYear(e.impact_meals)} kids fed for a year${e.impact_participants ? ` · ${e.impact_participants} volunteers` : ""}` : null],
            ["Public page", live(e) ? <span className="flex flex-wrap items-center gap-3"><ExtLink href={urlOf(e)}>/events/{e.slug}</ExtLink><CopyLink url={urlOf(e)} /></span> : "Not live (publish a public event to share it)"],
          ]} />
          <PreviewActions>
            <Button size="sm" onClick={() => { close(); onRegs(e); }}><Users className="h-4 w-4" /> Registrations</Button>
            <Button size="sm" variant="outline" onClick={() => { close(); onEdit(e); }}><Pencil className="h-4 w-4" /> Edit</Button>
            {live(e) ? <Button size="sm" variant="outline" onClick={() => copyText(urlOf(e))}><Copy className="h-4 w-4" /> Copy link</Button> : null}
            <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => void onDelete([e])}><Trash2 className="h-4 w-4" /> Delete</Button>
          </PreviewActions>
        </div>
      )}
      empty="No events yet. Create one to start taking registrations."
    />
  );
}

function EventEditor({ draft, onChange, onSave, onClose, staffOpts, isAdmin }: {
  draft: Partial<EventItem>; onChange: (d: Partial<EventItem>) => void;
  onSave: (d: Partial<EventItem>) => Promise<void>; onClose: () => void; staffOpts: FieldSelectOption[]; isAdmin: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const tz = draft.timezone || "America/Phoenix";
  const set = <K extends keyof EventItem>(k: K, v: EventItem[K]) => onChange({ ...draft, [k]: v });
  const startP = isoToParts(draft.start_at ?? null, tz);
  const endP = isoToParts(draft.end_at ?? null, tz);
  const closesP = isoToParts(draft.registration_closes_at ?? null, tz);

  async function submit() { setBusy(true); try { await onSave(draft); } finally { setBusy(false); } }

  return (
    <Modal title={draft.id ? "Edit event" : "New event"} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <SectionLabel>Event</SectionLabel>
        <Field label="Title" full><Input value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Caregivers Circle — Roundtable Event" /></Field>
        <Field label="Event type"><FieldSelect value={draft.event_type ?? "workshop"} onChange={(v) => set("event_type", v as EventItem["event_type"])} options={EVENT_TYPE_OPTS} /></Field>
        <Field label="Series (optional)"><Input value={draft.series ?? ""} onChange={(e) => set("series", e.target.value)} placeholder="e.g. SIG Private Roundtable Series" /></Field>
        <Field label="Who can attend?"><FieldSelect value={draft.audience ?? "public"} onChange={(v) => set("audience", v as EventItem["audience"])} options={EVENT_AUDIENCE_OPTS} /></Field>
        <Field label="Summary" full><Input value={draft.summary ?? ""} onChange={(e) => set("summary", e.target.value)} placeholder="One-line teaser" /></Field>
        <Field label="Description" full><Textarea className="min-h-[72px]" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Status"><FieldSelect value={draft.status ?? "draft"} onChange={(v) => set("status", v as EventItem["status"])} options={EVENT_STATUS_OPTS} /></Field>
        <Field label="Timezone"><FieldSelect value={tz} onChange={(v) => set("timezone", v)} options={tzOpts()} /></Field>
        <Field label="Start date"><DatePicker value={startP.date} onChange={(v) => set("start_at", partsToIso(v, startP.time || "09:00", tz))} allowClear={false} /></Field>
        <Field label="Start time"><FieldSelect value={startP.time || "09:00"} onChange={(v) => set("start_at", partsToIso(startP.date, v, tz))} options={TIME_OPTS} /></Field>
        <Field label="End date"><DatePicker value={endP.date} onChange={(v) => set("end_at", v ? partsToIso(v, endP.time || "10:00", tz) : null)} /></Field>
        <Field label="End time"><FieldSelect value={endP.time || ""} onChange={(v) => set("end_at", endP.date ? partsToIso(endP.date, v, tz) : null)} options={[{ value: "", label: "—" }, ...TIME_OPTS]} /></Field>
        <SectionLabel>Location</SectionLabel>
        <Field label="Office (optional)"><FieldSelect value={draft.office ?? ""} onChange={(v) => {
          const o = OFFICES.find((x) => x.name === v);
          onChange({ ...draft, office: v || null, ...(o ? { location_name: `SIG ${o.city} Office`, location_address: officeAddress(v), directions_url: o.directions } : {}) });
        }} options={OFFICE_OPTS} /></Field>
        <Field label="Location type"><FieldSelect value={draft.location_type ?? "in_person"} onChange={(v) => set("location_type", v as EventItem["location_type"])} options={EVENT_LOCATION_OPTS} /></Field>
        <Field label="Venue / location name"><Input value={draft.location_name ?? ""} onChange={(e) => set("location_name", e.target.value)} /></Field>
        <Field label="Address" full><Input value={draft.location_address ?? ""} onChange={(e) => set("location_address", e.target.value)} /></Field>
        <Field label="Directions URL"><Input value={draft.directions_url ?? ""} onChange={(e) => set("directions_url", e.target.value)} placeholder="Google Maps link" /></Field>
        <Field label="Arrival note"><Input value={draft.arrival_note ?? ""} onChange={(e) => set("arrival_note", e.target.value)} placeholder="Arrive 10 minutes early." /></Field>
        <Field label="Online URL (Teams / Zoom)"><Input value={draft.online_url ?? ""} onChange={(e) => set("online_url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Meeting ID / passcode"><Input value={draft.meeting_id ?? ""} onChange={(e) => set("meeting_id", e.target.value)} /></Field>
        <SectionLabel>Speakers</SectionLabel>
        <div className="sm:col-span-2"><SpeakersEditor value={(draft.speakers as EventSpeaker[]) ?? []} onChange={(v) => set("speakers", v)} /></div>
        <SectionLabel>Registration</SectionLabel>
        <Field label="Cover image URL"><Input value={draft.cover_image_url ?? ""} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Capacity (blank = unlimited)"><Input type="number" min={1} value={draft.capacity ?? ""} onChange={(e) => set("capacity", e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="Host display name"><Input value={draft.host_name ?? ""} onChange={(e) => set("host_name", e.target.value)} /></Field>
        {isAdmin && <Field label="Managed by (dashboard user)"><FieldSelect value={draft.host_staff_id ?? ""} onChange={(v) => set("host_staff_id", v || null)} options={staffOpts} /></Field>}
        <Field label="Max party size (incl. guests)"><Input type="number" min={1} max={50} value={draft.max_party_size ?? 4} onChange={(e) => set("max_party_size", Number(e.target.value) || 1)} /></Field>
        <Field label="Registration deadline"><DatePicker value={closesP.date} onChange={(v) => set("registration_closes_at", v ? partsToIso(v, closesP.time || "23:59", tz) : null)} /></Field>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <Toggle checked={draft.registration_required ?? true} onChange={(v) => set("registration_required", v)} label="Registration required" />
          <Toggle checked={draft.is_public ?? true} onChange={(v) => set("is_public", v)} label="Public event page" />
          <Toggle checked={draft.allow_guests ?? true} onChange={(v) => set("allow_guests", v)} label="Guests allowed" />
          <Toggle checked={draft.waitlist_enabled ?? true} onChange={(v) => set("waitlist_enabled", v)} label="Waitlist when full" />
        </div>
        <SectionLabel>Impact results (SIGCares)</SectionLabel>
        <Field label="Giving program"><FieldSelect value={draft.impact_program ?? ""} onChange={(v) => set("impact_program", v || null)} options={[{ value: "", label: "None" }, ...Object.entries(IMPACT_PROGRAMS).map(([value, label]) => ({ value, label }))]} /></Field>
        <Field label="Volunteers who attended"><Input type="number" min={0} value={draft.impact_participants ?? ""} onChange={(e) => set("impact_participants", e.target.value === "" ? null : Number(e.target.value))} /></Field>
        <Field label="Meals packed"><Input type="number" min={0} value={draft.impact_meals ?? ""} onChange={(e) => set("impact_meals", e.target.value === "" ? null : Number(e.target.value))} placeholder="Enter after the packing" /></Field>
        <Field label="Countries the meals went to"><Input value={(draft.impact_countries ?? []).join(", ")} onChange={(e) => set("impact_countries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="e.g. Cambodia, Philippines" /></Field>
        {draft.impact_meals ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            ≈ <span className="font-semibold text-foreground">{kidsFedForAYear(draft.impact_meals)}</span> kids fed for a year (meals ÷ 365). Totals on /sigcares update automatically.
          </p>
        ) : null}
        <div className="sm:col-span-2"><QuestionsEditor value={(draft.custom_fields as IntakeQuestion[]) ?? []} onChange={(q) => set("custom_fields", q)} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !String(draft.title ?? "").trim() || !draft.start_at}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
      </div>
    </Modal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 border-b border-border pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:col-span-2">{children}</p>;
}

function SpeakersEditor({ value, onChange }: { value: EventSpeaker[]; onChange: (v: EventSpeaker[]) => void }) {
  const update = (i: number, patch: Partial<EventSpeaker>) => onChange(value.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addTeam = (slug: string) => {
    const m = TEAM.find((x) => x.slug === slug);
    if (m) onChange([...value, { name: `${m.name}${m.credentials ? `, ${m.credentials}` : ""}`, title: m.title, team_slug: m.slug, photo_url: m.photo }]);
  };
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Speaker name" className="h-8" />
          <Input value={s.title ?? ""} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title / organization" className="h-8" />
          <button onClick={() => onChange(value.filter((_, k) => k !== i))} className="px-1 text-muted-foreground hover:text-destructive" aria-label="Remove speaker"><Trash2 className="h-3.5 w-3.5" /></button>
          <Textarea value={s.bio ?? ""} onChange={(e) => update(i, { bio: e.target.value })} placeholder="Short bio (optional)" className="min-h-[44px] sm:col-span-3" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange([...value, { name: "", title: "" }])}><Plus className="h-3.5 w-3.5" /> Guest speaker</Button>
        <div className="w-56"><FieldSelect value="" onChange={addTeam} options={[{ value: "", label: "+ Add SIG team member…" }, ...TEAM.map((m) => ({ value: m.slug, label: m.name }))]} className="h-8" /></div>
      </div>
    </div>
  );
}

// ── Registrations modal ─────────────────────────────────────────────────────────
function RegistrationsModal({ event, token, onClose }: { event: EventItem; token: string; onClose: () => void }) {
  const [regs, setRegs] = React.useState<EventRegistration[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/events/registrations?event_id=${event.id}`, { headers: { "x-sig-action-token": token } })
      .then((r) => r.json()).then((d) => setRegs(d.registrations ?? [])).finally(() => setLoading(false));
  }, [event.id, token]);
  React.useEffect(reload, [reload]);

  async function setStatus(r: EventRegistration, status: string) {
    setRegs((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: status as EventRegistration["status"] } : x)));
    await fetch(`/api/events/registrations/${r.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, actionToken: token }) });
  }
  async function remove(r: EventRegistration) {
    if (!window.confirm("Remove this registration?")) return;
    await fetch(`/api/events/registrations/${r.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: token }) });
    reload();
  }

  const csvHref = React.useMemo(() => {
    const rows = [["Name", "Email", "Phone", "Party", "Status", "Registered"], ...regs.map((r) => [r.name, r.email ?? "", r.phone ?? "", String(r.party_size), r.status, r.created_at ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [regs]);

  return (
    <Modal title={`Registrations — ${event.title}`} onClose={onClose} wide>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{regs.filter((r) => r.status !== "canceled").reduce((s, r) => s + r.party_size, 0)} attending{event.capacity != null ? ` of ${event.capacity}` : ""}</span>
        {regs.length > 0 && <a href={csvHref} download={`${event.slug}-registrations.csv`} className="inline-flex items-center gap-1 hover:text-primary"><ExternalLink className="h-3 w-3" /> Export CSV</a>}
      </div>
      {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div> : regs.length === 0 ? <Empty label="No registrations yet." /> : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="divide-y divide-border">
            {regs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}{r.party_size > 1 ? <span className="text-[11px] text-muted-foreground"> +{r.party_size - 1}</span> : ""}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email || r.phone || "no contact"}</div>
                </div>
                <div className="w-36"><FieldSelect value={r.status} onChange={(v) => setStatus(r, v)} options={REG_STATUS_OPTS} className="h-8" /></div>
                <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}
