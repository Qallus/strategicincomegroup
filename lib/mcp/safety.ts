// The MCP safety rules that don't need the database: risk tiers, tool
// annotations, when a pending action may still be confirmed, and how each kind
// of SIG record goes to the trash. Pure (no imports).

/** read runs at once; write runs at once and is snapshotted; high needs preview + sig_confirm. */
export type Risk = "read" | "write" | "high";
export const RISKS: readonly Risk[] = ["read", "write", "high"];

export function tierAllowed(risk: Risk, allowedTiers: readonly string[]): boolean {
  return allowedTiers.includes(risk);
}

/** MCP tool annotations, from the risk. Clients use these to decide when to ask first. */
export function annotationsFor(risk: Risk, opts: { title: string; openWorld?: boolean; idempotent?: boolean }) {
  return {
    title: opts.title,
    readOnlyHint: risk === "read",
    destructiveHint: risk === "high",
    idempotentHint: risk === "read" ? true : !!opts.idempotent,
    openWorldHint: !!opts.openWorld,
  };
}

export const PENDING_TTL_MS = 15 * 60_000;

export type PendingRow = { profile_id: string; status: string; expires_at: string; client_id?: string | null };

/** Why this pending action can't be confirmed by this caller now, or null if it can. */
export function pendingProblem(row: PendingRow | null, caller: { profileId: string; clientId: string }, now = Date.now()): string | null {
  if (!row) return "That confirmation id doesn't exist.";
  if (row.profile_id !== caller.profileId) return "That confirmation belongs to someone else.";
  if (row.client_id && row.client_id !== caller.clientId) return "That confirmation was started from a different app or token. Start again here.";
  if (row.status === "confirmed") return "That action was already confirmed. Nothing was run twice.";
  if (row.status === "cancelled") return "That action was cancelled.";
  if (row.status !== "pending") return `That action is ${row.status}.`;
  if (new Date(row.expires_at).getTime() <= now) return "That confirmation expired (15 minutes). Ask again to get a fresh preview.";
  return null;
}

/**
 * How each kind of SIG record is "deleted" through AI. Nothing is ever
 * removed without a way back:
 *  - archive: set a timestamp column the dashboard already hides on.
 *  - status:  set a status value the dashboard already treats as gone; the
 *             previous status is kept in the trash row and put back on restore.
 *  - snapshot: copy the row (and the child rows listed) into mcp_trash, then
 *             delete it. Restore puts the same rows back.
 */
export type TrashChild = { table: string; fk: string };
export type TrashRule =
  | { method: "archive"; table: string; column: string; extra?: Record<string, unknown> }
  | { method: "status"; table: string; column: "status"; value: string; extra?: Record<string, unknown> }
  | { method: "snapshot"; table: string; children?: TrashChild[] };

export const TRASH_POLICY: Record<string, TrashRule> = {
  blog_post: { method: "status", table: "blog_posts", column: "status", value: "deleted" },
  job_posting: { method: "snapshot", table: "job_postings" },
  contact: { method: "status", table: "contacts", column: "status", value: "archived" },
  form_submission: { method: "archive", table: "form_submissions", column: "deleted_at", extra: { action_reason: "deleted" } },
  booking: { method: "snapshot", table: "bookings" },
  booking_type: {
    method: "snapshot", table: "booking_types",
    children: [
      { table: "booking_availability", fk: "booking_type_id" },
      { table: "booking_date_overrides", fk: "booking_type_id" },
      { table: "bookings", fk: "booking_type_id" },
    ],
  },
  booking_date_override: { method: "snapshot", table: "booking_date_overrides" },
  event: { method: "snapshot", table: "events", children: [{ table: "event_registrations", fk: "event_id" }] },
  event_registration: { method: "snapshot", table: "event_registrations" },
};

export function trashRuleFor(entity: string): TrashRule | null {
  return TRASH_POLICY[entity] ?? null;
}

/** A readable name for a record, for previews and the trash list. */
export function recordLabel(row: Record<string, unknown> | null | undefined, fallback: string): string {
  if (!row) return fallback;
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  const pick = row.title ?? row.name ?? row.invitee_name ?? row.subject ?? (name || null) ?? row.email ?? row.reference;
  if (pick) return String(pick).slice(0, 120);
  const text = [row.message, row.notes, row.description].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (text) { const t = text.trim().replace(/\s+/g, " "); return t.length > 60 ? `${t.slice(0, 60)}…` : t; }
  return fallback;
}
