// Events (workshops, roundtables, webinars…) and their registrations. Reuses
// lib/booking/data.ts. Same access as the dashboard's events API
// (requireParticipantManager): Super Admin, Admin, Team Member.
//
// Event columns added after this file was written (event_type, speakers,
// office, audience, waitlist_enabled…) pass through: anything outside the
// core list is written with a follow-up update.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadRegistrations, saveEvent, updateRegistration } from "@/lib/booking/data";
import type { EventItem } from "@/lib/booking/types";
import { peekRecord, trashRecord } from "./trash";
import {
  anyObj, bool, clamp, ilikeSafe, int, need, obj, opt, pickDefined, s, str, strArr, strEnum, type Json, type McpTool,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_STATUSES = ["draft", "published", "canceled", "completed"] as const;
const REG_STATUSES = ["registered", "waitlisted", "canceled", "attended"] as const;

const EVENT_CORE = [
  "slug", "title", "summary", "description", "status", "start_at", "end_at", "timezone",
  "location_type", "location_name", "location_address", "online_url", "cover_image_url",
  "capacity", "registration_required", "registration_closes_at", "price_cents", "currency",
  "host_staff_id", "host_name", "is_public", "custom_fields",
] as const;
const EVENT_OPTIONAL = [
  "event_type", "series", "speakers", "office", "directions_url", "audience", "waitlist_enabled",
  "allow_guests", "max_party_size", "arrival_note", "meeting_id",
] as const;
const NEVER_WRITE = new Set(["id", "created_at", "updated_at", "registered_count", "waitlist_count"]);

const sb = () => createSupabaseAdminClient();

async function decorate(ev: Record<string, unknown>): Promise<EventItem & Json> {
  const { data } = await sb().from("event_registrations").select("status, party_size").eq("event_id", ev.id as string).neq("status", "canceled");
  let registered = 0;
  let waitlisted = 0;
  for (const r of data ?? []) {
    const size = Number(r.party_size) || 1;
    if (r.status === "waitlisted") waitlisted += size;
    else registered += size;
  }
  return { ...(ev as unknown as EventItem), registered_count: registered, waitlist_count: waitlisted, event_url: `/events/${ev.slug}` } as EventItem & Json;
}

async function findEvent(ref: string): Promise<EventItem & Json> {
  const q = UUID.test(ref) ? sb().from("events").select("*").eq("id", ref) : sb().from("events").select("*").eq("slug", ref.replace(/^\/?(events\/)?/, ""));
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No event matches "${ref}". Use sig_events_list.`);
  return decorate(data as Record<string, unknown>);
}

function splitEventArgs(a: Json) {
  const core = pickDefined(a, EVENT_CORE);
  const extras: Json = { ...pickDefined(a, EVENT_OPTIONAL), ...((a.extra as Json) ?? {}) };
  for (const k of EVENT_CORE) if (k in extras) { core[k] = extras[k]; delete extras[k]; }
  for (const k of Object.keys(extras)) if (NEVER_WRITE.has(k)) delete extras[k];
  return { core, extras };
}

async function writeExtras(eventId: string, extras: Json): Promise<string | null> {
  if (!Object.keys(extras).length) return null;
  const { error } = await sb().from("events").update(extras).eq("id", eventId);
  return error ? `Saved, but these extra fields were not: ${Object.keys(extras).join(", ")} (${error.message}).` : null;
}

async function setStatus(ev: EventItem, status: string) {
  const patch: Json = { status, updated_at: new Date().toISOString() };
  if (status === "published" && !ev.published_at) patch.published_at = new Date().toISOString();
  const { error } = await sb().from("events").update(patch).eq("id", ev.id);
  if (error) throw new Error(error.message);
}

async function findRegistration(idValue: string): Promise<Record<string, unknown>> {
  const { data, error } = await sb().from("event_registrations").select("*, event:events(id, title, slug)").eq("id", idValue).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No registration with id ${idValue}. Use sig_event_registrations_list.`);
  return data as Record<string, unknown>;
}

const EVENT_FIELDS = {
  title: str("Event title"),
  slug: str("URL slug (event page is /events/<slug>); generated from the title if omitted"),
  summary: str("One-line summary"),
  description: str("Full description (HTML or text)"),
  start_at: str("Start, ISO date/time with offset, e.g. 2026-12-03T11:30:00-07:00"),
  end_at: str("End, ISO date/time"),
  timezone: str("IANA timezone (default America/Phoenix)"),
  location_type: strEnum(["in_person", "online", "hybrid"], "In person, online or hybrid"),
  location_name: str("Venue name"),
  location_address: str("Venue address"),
  online_url: str("Webinar / meeting link"),
  cover_image_url: str("Cover image URL"),
  capacity: int("Seats (omit for unlimited)", 1, 100000),
  registration_required: bool("Registration required"),
  registration_closes_at: str("ISO date/time registration closes"),
  host_name: str("Host / presenter display name"),
  host_staff_id: str("Host's profile id"),
  is_public: bool("Listed on the public events page"),
  custom_fields: { type: "array", description: "Extra registration questions [{key,label,type,required,options?}]", items: { type: "object", additionalProperties: true } },
  event_type: strEnum(["roundtable", "workshop", "luncheon", "webinar", "community_service", "client_appreciation", "church", "other"], "Kind of event — if that column exists"),
  series: str("Series name — if that column exists"),
  speakers: { type: "array", description: "Speakers [{name, title?, bio?, image_url?}] — if that column exists", items: { type: "object", additionalProperties: true } },
  office: str("Office, e.g. 'West Valley Office' — if that column exists"),
  directions_url: str("Map/directions link — if that column exists"),
  audience: strEnum(["public", "clients", "clients_and_guests", "invite_only"], "Audience — if that column exists"),
  waitlist_enabled: bool("Waitlist when full — if that column exists"),
  allow_guests: bool("Registrants may bring guests — if that column exists"),
  max_party_size: int("Max party size — if that column exists", 1, 50),
  arrival_note: str("Arrival note — if that column exists"),
  meeting_id: str("Online meeting id — if that column exists"),
  extra: anyObj("Any other events columns to set (pass-through)"),
};

const REG_FIELDS = {
  name: str("Registrant name"),
  email: str("Email"),
  phone: str("Phone"),
  party_size: int("Party size", 1, 50),
  notes: str("Internal notes"),
};

export function eventTools(): McpTool[] {
  return [
    {
      name: "sig_events_list",
      title: "List events",
      description: "List SIG events with status, dates, capacity and registration counts. Upcoming only by default.",
      risk: "read",
      area: "events",
      inputSchema: obj({ status: strEnum(EVENT_STATUSES, "Only this status"), include_past: bool("Include past events"), search: str("Words in the title or summary"), limit: int("Max rows (default 50)") }),
      run: async (a) => {
        let q = sb().from("events").select("*").order("start_at", { ascending: true }).limit(clamp(a.limit, 50, 200));
        if (opt(a.status)) q = q.eq("status", s(a.status));
        if (a.include_past !== true) q = q.gte("start_at", new Date(Date.now() - 86_400_000).toISOString());
        const term = ilikeSafe(s(a.search));
        if (term) q = q.or(`title.ilike.%${term}%,summary.ilike.%${term}%,slug.ilike.%${term}%`);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const events = await Promise.all((data ?? []).map((e) => decorate(e as Record<string, unknown>)));
        return { result: { events: events.map((e) => ({ id: e.id, title: e.title, slug: e.slug, status: e.status, start_at: e.start_at, end_at: e.end_at, location_type: e.location_type, location_name: e.location_name, capacity: e.capacity, registered_count: e.registered_count, waitlist_count: e.waitlist_count, is_public: e.is_public, event_type: e.event_type ?? null, event_url: e.event_url })) } };
      },
    },
    {
      name: "sig_event_get",
      title: "Read an event",
      description: "One event in full (all fields including speakers/office when present) with registration counts.",
      risk: "read",
      area: "events",
      inputSchema: obj({ event: str("Event id or slug") }, ["event"]),
      run: async (a) => ({ result: await findEvent(need(a, "event")) }),
    },
    {
      name: "sig_event_create",
      title: "Create an event (draft)",
      description: "Create an event as a DRAFT (not on the public site). Publish it afterwards with sig_event_publish once the person approves.",
      risk: "write",
      area: "events",
      inputSchema: obj(EVENT_FIELDS, ["title", "start_at"]),
      run: async (a) => {
        const { core, extras } = splitEventArgs(a);
        if (Number.isNaN(Date.parse(need(a, "start_at")))) throw new Error("start_at must be an ISO date/time.");
        if (!core.timezone) core.timezone = "America/Phoenix";
        const saved = await saveEvent({ ...core, title: need(a, "title"), status: "draft" });
        const warning = await writeExtras(saved.id, extras);
        const ev = await findEvent(saved.id);
        return { result: { created: true, ...ev, warning }, summary: `Created event draft "${ev.title}"`, entity: "event", recordId: ev.id, after: ev };
      },
    },
    {
      name: "sig_event_update",
      title: "Edit an event",
      description: "Change an event's details. Only the fields you pass change; status is changed with sig_event_publish / sig_event_cancel. Editing a PUBLISHED event changes the live page, so for those it returns a preview + confirmation_id first.",
      risk: "write",
      area: "events",
      inputSchema: obj({ event: str("Event id or slug"), ...EVENT_FIELDS }, ["event"]),
      escalate: async (a) => {
        const ev = await findEvent(need(a, "event"));
        if (ev.status !== "published") return null;
        const changed = Object.keys(EVENT_FIELDS).filter((k) => a[k] !== undefined);
        return { summary: `Edit the LIVE event "${ev.title}" (${changed.join(", ") || "no fields"}). Registrants and visitors see the change immediately.`, details: { id: ev.id, url: ev.event_url, registered: ev.registered_count }, entity: "event", recordId: ev.id };
      },
      run: async (a) => {
        const current = await findEvent(need(a, "event"));
        const { core, extras } = splitEventArgs(a);
        delete core.status;
        const saved = await saveEvent({ ...pickDefined(current, EVENT_CORE), ...core, id: current.id, status: current.status, published_at: current.published_at });
        const warning = await writeExtras(saved.id, extras);
        const ev = await findEvent(current.id);
        return { result: { updated: true, ...ev, warning }, summary: `Edited event "${ev.title}"`, entity: "event", recordId: ev.id, before: current, after: ev };
      },
    },
    {
      name: "sig_event_publish",
      title: "Publish an event",
      description: "Publish an event so it shows on the public events page and accepts registrations. High risk: returns a preview first.",
      risk: "high",
      area: "events",
      openWorld: true,
      inputSchema: obj({ event: str("Event id or slug") }, ["event"]),
      preview: async (a) => {
        const ev = await findEvent(need(a, "event"));
        if (ev.status === "published") throw new Error(`"${ev.title}" is already published.`);
        return { summary: `Publish "${ev.title}" (${ev.start_at}) to the public events page and open registration.`, details: { id: ev.id, url: ev.event_url, is_public: ev.is_public, capacity: ev.capacity }, entity: "event", recordId: ev.id };
      },
      execute: async (a) => {
        const ev = await findEvent(need(a, "event"));
        await setStatus(ev, "published");
        return { result: { published: true, id: ev.id, url: ev.event_url }, summary: `Published event "${ev.title}"`, entity: "event", recordId: ev.id, before: { status: ev.status }, after: { status: "published" } };
      },
    },
    {
      name: "sig_event_unpublish",
      title: "Unpublish an event",
      description: "Move a published event back to draft (off the public page; registrations are kept). High risk: returns a preview first.",
      risk: "high",
      area: "events",
      openWorld: true,
      inputSchema: obj({ event: str("Event id or slug") }, ["event"]),
      preview: async (a) => {
        const ev = await findEvent(need(a, "event"));
        if (ev.status !== "published") throw new Error(`"${ev.title}" isn't published.`);
        return { summary: `Take "${ev.title}" off the public events page (back to draft). ${ev.registered_count} registration(s) are kept.`, details: { id: ev.id }, entity: "event", recordId: ev.id };
      },
      execute: async (a) => {
        const ev = await findEvent(need(a, "event"));
        await setStatus(ev, "draft");
        return { result: { unpublished: true, id: ev.id }, summary: `Unpublished event "${ev.title}"`, entity: "event", recordId: ev.id, before: { status: ev.status }, after: { status: "draft" } };
      },
    },
    {
      name: "sig_event_cancel",
      title: "Cancel an event",
      description: "Mark an event canceled (shown as canceled; no new registrations). No emails are sent to registrants. High risk: returns a preview first.",
      risk: "high",
      area: "events",
      openWorld: true,
      inputSchema: obj({ event: str("Event id or slug") }, ["event"]),
      preview: async (a) => {
        const ev = await findEvent(need(a, "event"));
        if (ev.status === "canceled") throw new Error(`"${ev.title}" is already canceled.`);
        return { summary: `Cancel "${ev.title}" on ${ev.start_at}. ${ev.registered_count} registered and ${ev.waitlist_count} waitlisted people are NOT notified automatically.`, details: { id: ev.id, url: ev.event_url }, entity: "event", recordId: ev.id };
      },
      execute: async (a) => {
        const ev = await findEvent(need(a, "event"));
        await setStatus(ev, "canceled");
        return { result: { canceled: true, id: ev.id }, summary: `Canceled event "${ev.title}"`, entity: "event", recordId: ev.id, before: { status: ev.status }, after: { status: "canceled" } };
      },
    },
    {
      name: "sig_event_delete",
      title: "Delete an event",
      description: "Delete an event and its registrations (kept in the trash; restorable with sig_restore). Prefer sig_event_cancel for real events. High risk: returns a preview first.",
      risk: "high",
      area: "events",
      inputSchema: obj({ event: str("Event id or slug") }, ["event"]),
      preview: async (a) => {
        const ev = await findEvent(need(a, "event"));
        const { childCounts } = await peekRecord("event", ev.id);
        return { summary: `Delete event "${ev.title}" and its ${childCounts.event_registrations ?? 0} registration record(s). Restorable from the trash.`, details: { id: ev.id, status: ev.status, start_at: ev.start_at }, entity: "event", recordId: ev.id };
      },
      execute: async (a, c) => {
        const ev = await findEvent(need(a, "event"));
        const { trashId, label, before } = await trashRecord("event", ev.id, c.profile);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted event "${label}"`, entity: "event", recordId: ev.id, before };
      },
    },

    // ── Registrations ──
    {
      name: "sig_event_registrations_list",
      title: "List event registrations",
      description: "Registrations for one event (or all events), newest first, with status and party size.",
      risk: "read",
      area: "events",
      inputSchema: obj({ event: str("Event id or slug (optional)"), status: strEnum(REG_STATUSES, "Only this status"), search: str("Name or email"), limit: int("Max rows (default 100)", 1, 500) }),
      run: async (a) => {
        const eventId = opt(a.event) ? (await findEvent(s(a.event))).id : undefined;
        let rows = await loadRegistrations({ eventId, limit: clamp(a.limit, 100, 500) });
        if (opt(a.status)) rows = rows.filter((r) => r.status === s(a.status));
        const term = s(a.search).toLowerCase();
        if (term) rows = rows.filter((r) => `${r.name} ${r.email ?? ""}`.toLowerCase().includes(term));
        return { result: { count: rows.length, registrations: rows } };
      },
    },
    {
      name: "sig_event_registration_add",
      title: "Register someone for an event",
      description: "Add a registration to an event on someone's behalf (staff-entered; no confirmation email). Goes on the waitlist when the event is full.",
      risk: "write",
      area: "events",
      inputSchema: obj({ event: str("Event id or slug"), status: strEnum(["registered", "waitlisted"], "Default: registered, or waitlisted when full"), answers: anyObj("Answers to the event's questions"), ...REG_FIELDS }, ["event", "name"]),
      run: async (a) => {
        const ev = await findEvent(need(a, "event"));
        const size = Math.max(1, Number(a.party_size) || 1);
        const full = ev.capacity != null && (ev.registered_count ?? 0) + size > ev.capacity;
        const status = opt(a.status) ?? (full ? "waitlisted" : "registered");
        const row = { event_id: ev.id, name: need(a, "name"), email: opt(a.email) ?? null, phone: opt(a.phone) ?? null, party_size: size, status, answers: (a.answers as Json) ?? {}, notes: opt(a.notes) ?? null, source: "mcp" };
        const { data, error } = await sb().from("event_registrations").insert(row).select("*").single();
        if (error) throw new Error(error.message);
        return { result: { added: true, registration: data, waitlisted: status === "waitlisted" }, summary: `Registered ${row.name} for "${ev.title}" (${status})`, entity: "event_registration", recordId: data.id as string, after: data };
      },
    },
    {
      name: "sig_event_registration_update",
      title: "Update a registration",
      description: "Change a registration's status (registered, waitlisted, canceled, attended), party size, contact details or notes.",
      risk: "write",
      area: "events",
      inputSchema: obj({ registration_id: str("Registration id"), status: strEnum(REG_STATUSES, "New status"), ...REG_FIELDS }, ["registration_id"]),
      run: async (a) => {
        const reg = await findRegistration(need(a, "registration_id"));
        const patch = pickDefined(a, ["status", ...Object.keys(REG_FIELDS)]);
        if (!Object.keys(patch).length) throw new Error("Nothing to change.");
        await updateRegistration(String(reg.id), patch);
        const after = await findRegistration(String(reg.id));
        return { result: { updated: true, registration: after }, summary: `Updated registration for ${reg.name} (${Object.keys(patch).join(", ")})`, entity: "event_registration", recordId: String(reg.id), before: reg, after };
      },
    },
    {
      name: "sig_event_check_in",
      title: "Check in attendees",
      description: "Mark one or more registrations as attended at the event (or undo with attended=false → registered).",
      risk: "write",
      area: "events",
      inputSchema: obj({ registration_ids: strArr("Registration ids to check in"), attended: bool("Default true; false undoes the check-in") }, ["registration_ids"]),
      run: async (a) => {
        const ids = Array.isArray(a.registration_ids) ? (a.registration_ids as unknown[]).map((v) => s(v)).filter(Boolean) : [];
        if (!ids.length) throw new Error("registration_ids is required.");
        if (ids.length > 200) throw new Error("Check in at most 200 at a time.");
        const status = a.attended === false ? "registered" : "attended";
        const { data, error } = await sb().from("event_registrations").update({ status, updated_at: new Date().toISOString() }).in("id", ids).select("id, name, status");
        if (error) throw new Error(error.message);
        return { result: { updated: data?.length ?? 0, registrations: data ?? [] }, summary: `${status === "attended" ? "Checked in" : "Undid check-in for"} ${data?.length ?? 0} registration(s)`, entity: "event_registration", recordId: ids.length === 1 ? ids[0] : null, after: data };
      },
    },
    {
      name: "sig_event_registration_delete",
      title: "Delete a registration",
      description: "Delete a registration record (kept in the trash; restorable with sig_restore). Usually set status canceled instead. High risk: returns a preview first.",
      risk: "high",
      area: "events",
      inputSchema: obj({ registration_id: str("Registration id") }, ["registration_id"]),
      preview: async (a) => {
        const reg = await findRegistration(need(a, "registration_id"));
        const ev = reg.event as { title?: string } | null;
        return { summary: `Delete ${reg.name}'s registration for "${ev?.title ?? "an event"}". Restorable from the trash.`, details: { id: reg.id, email: reg.email, status: reg.status, party_size: reg.party_size }, entity: "event_registration", recordId: String(reg.id) };
      },
      execute: async (a, c) => {
        const { trashId, label, before } = await trashRecord("event_registration", need(a, "registration_id"), c.profile);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted registration for ${label}`, entity: "event_registration", recordId: s(a.registration_id), before };
      },
    },
  ];
}
