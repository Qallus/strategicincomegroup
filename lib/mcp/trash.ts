// AI "delete" = trash. Every record an AI client removes through MCP lands in
// mcp_trash and can be restored (sig_restore, or Settings → AI Connectors).
// How each kind is trashed is TRASH_POLICY in ./safety. Server-only.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordLabel, trashRuleFor } from "./safety";

export class TrashError extends Error {}

export type TrashRow = {
  id: string;
  entity: string;
  record_id: string;
  label: string | null;
  method: string;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
};

type Snapshot = { row: Record<string, unknown>; children?: Record<string, Record<string, unknown>[]> };

const human = (entity: string) => entity.replace(/_/g, " ");

/** Read a record (and the children its rule lists) without changing anything. */
export async function peekRecord(entity: string, recordId: string): Promise<{ label: string; row: Record<string, unknown>; childCounts: Record<string, number> }> {
  const rule = trashRuleFor(entity);
  if (!rule) throw new TrashError(`${human(entity)} records can't be deleted through AI.`);
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase.from(rule.table).select("*").eq("id", recordId).maybeSingle();
  if (error) throw new TrashError(error.message);
  if (!row) throw new TrashError(`No ${human(entity)} with id ${recordId}.`);
  const childCounts: Record<string, number> = {};
  if (rule.method === "snapshot") {
    for (const child of rule.children ?? []) {
      const { count } = await supabase.from(child.table).select("id", { count: "exact", head: true }).eq(child.fk, recordId);
      childCounts[child.table] = count ?? 0;
    }
  }
  return { label: recordLabel(row as Record<string, unknown>, `${entity} ${recordId}`), row: row as Record<string, unknown>, childCounts };
}

/** Move one record to the trash. Returns the trash row id and what it was. */
export async function trashRecord(
  entity: string,
  recordId: string,
  actor: { id: string },
): Promise<{ trashId: string; label: string; before: Record<string, unknown> }> {
  const rule = trashRuleFor(entity);
  if (!rule) throw new TrashError(`${human(entity)} records can't be deleted through AI.`);
  const supabase = createSupabaseAdminClient();
  const { data: row, error: readErr } = await supabase.from(rule.table).select("*").eq("id", recordId).maybeSingle();
  if (readErr) throw new TrashError(readErr.message);
  if (!row) throw new TrashError(`No ${human(entity)} with id ${recordId}.`);
  const before = row as Record<string, unknown>;
  const label = recordLabel(before, `${entity} ${recordId}`);
  const snapshot: Snapshot = { row: before };

  if (rule.method === "archive") {
    if (before[rule.column]) throw new TrashError(`${label} is already deleted.`);
    const patch: Record<string, unknown> = { [rule.column]: new Date().toISOString(), ...(rule.extra ?? {}) };
    const { error } = await supabase.from(rule.table).update(patch).eq("id", recordId);
    if (error) throw new TrashError(error.message);
  } else if (rule.method === "status") {
    if (before[rule.column] === rule.value) throw new TrashError(`${label} is already ${rule.value}.`);
    const patch: Record<string, unknown> = { [rule.column]: rule.value, ...(rule.extra ?? {}) };
    if (rule.table === "blog_posts") patch.deleted_at = new Date().toISOString();
    const { error } = await supabase.from(rule.table).update(patch).eq("id", recordId);
    if (error) throw new TrashError(error.message);
  } else {
    // Snapshot the children first: deleting the parent cascades them away.
    const children: Record<string, Record<string, unknown>[]> = {};
    for (const child of rule.children ?? []) {
      const { data, error } = await supabase.from(child.table).select("*").eq(child.fk, recordId);
      if (error) throw new TrashError(error.message);
      children[child.table] = (data ?? []) as Record<string, unknown>[];
    }
    snapshot.children = children;
  }

  // Record the trash entry before a snapshot delete, so a failed delete leaves
  // an extra trash row rather than a lost record.
  const { data: trash, error: trashErr } = await supabase
    .from("mcp_trash")
    .insert({ entity, record_id: recordId, label, method: rule.method, snapshot, deleted_by: actor.id, deleted_via: "mcp" })
    .select("id")
    .single();
  if (trashErr || !trash) throw new TrashError(trashErr?.message ?? "Couldn't record the trash entry.");

  if (rule.method === "snapshot") {
    const { error } = await supabase.from(rule.table).delete().eq("id", recordId);
    if (error) {
      await supabase.from("mcp_trash").delete().eq("id", trash.id);
      throw new TrashError(error.message);
    }
  }
  return { trashId: trash.id as string, label, before };
}

/** Put a trashed record (and its snapshotted children) back exactly as it was. */
export async function restoreRecord(trashId: string, actor: { id: string }): Promise<{ entity: string; recordId: string; label: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: t } = await supabase.from("mcp_trash").select("*").eq("id", trashId).maybeSingle();
  if (!t) throw new TrashError("That trash entry doesn't exist.");
  if (t.restored_at) throw new TrashError(`${t.label ?? "That record"} was already restored.`);
  const rule = trashRuleFor(t.entity as string);
  if (!rule) throw new TrashError(`Can't restore ${t.entity} records.`);
  const snapshot = (t.snapshot ?? {}) as Snapshot;
  const row = snapshot.row ?? {};

  if (rule.method === "archive") {
    const patch: Record<string, unknown> = { [rule.column]: null };
    for (const key of Object.keys(rule.extra ?? {})) patch[key] = row[key] ?? null;
    const { error } = await supabase.from(rule.table).update(patch).eq("id", t.record_id);
    if (error) throw new TrashError(error.message);
  } else if (rule.method === "status") {
    const previous = (row[rule.column] as string | null) ?? "draft";
    const patch: Record<string, unknown> = { [rule.column]: previous };
    if (rule.table === "blog_posts") patch.deleted_at = null;
    const { error } = await supabase.from(rule.table).update(patch).eq("id", t.record_id);
    if (error) throw new TrashError(error.message);
  } else {
    const { error } = await supabase.from(rule.table).upsert(row, { onConflict: "id" });
    if (error) throw new TrashError(`Couldn't restore: ${error.message}`);
    for (const child of rule.children ?? []) {
      const rows = snapshot.children?.[child.table] ?? [];
      if (!rows.length) continue;
      const { error: childErr } = await supabase.from(child.table).upsert(rows, { onConflict: "id" });
      if (childErr) throw new TrashError(`Restored the ${human(t.entity as string)}, but not its ${child.table.replace(/_/g, " ")}: ${childErr.message}`);
    }
  }

  await supabase.from("mcp_trash").update({ restored_at: new Date().toISOString(), restored_by: actor.id }).eq("id", trashId);
  return { entity: t.entity as string, recordId: t.record_id as string, label: (t.label as string) ?? (t.record_id as string) };
}

export async function listTrash(opts: { limit?: number; includeRestored?: boolean; entities?: string[] } = {}): Promise<TrashRow[]> {
  let q = createSupabaseAdminClient()
    .from("mcp_trash")
    .select("id, entity, record_id, label, method, deleted_by, deleted_at, restored_at")
    .order("deleted_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 200));
  if (!opts.includeRestored) q = q.is("restored_at", null);
  if (opts.entities) q = q.in("entity", opts.entities);
  const { data } = await q;
  return (data ?? []) as TrashRow[];
}
