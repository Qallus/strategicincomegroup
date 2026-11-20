"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/server";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Tag + participant-tag writes for Tags & Segments. Same gate as the page (manage_participants).

type Result = { ok: true } | { ok: false; error: string };

async function guard() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !can(profile.role, PERMISSIONS.MANAGE_PARTICIPANTS)) {
    throw new Error("Participant management permission required.");
  }
  return createSupabaseAdminClient();
}

async function run(fn: (sb: ReturnType<typeof createSupabaseAdminClient>) => PromiseLike<{ error: { message: string } | null }>): Promise<Result> {
  try {
    const sb = await guard();
    const res = await fn(sb);
    if (res.error) throw new Error(res.error.message);
    revalidatePath("/dashboard/tags-segments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That didn't work." };
  }
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const ids = (list: string[]) => list.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));

export async function createTag(name: string, category: string): Promise<Result> {
  if (!clean(name)) return { ok: false, error: "Give the tag a name." };
  return run((sb) => sb.from("tags").insert({ name: clean(name), category: clean(category).toLowerCase().replace(/\s+/g, "_") || "general" }));
}

export async function updateTag(id: string, patch: { name?: string; category?: string }): Promise<Result> {
  const next: Record<string, string> = {};
  if (patch.name !== undefined) {
    if (!clean(patch.name)) return { ok: false, error: "Tag name can't be empty." };
    next.name = clean(patch.name);
  }
  if (patch.category !== undefined) next.category = clean(patch.category).toLowerCase().replace(/\s+/g, "_") || "general";
  return run((sb) => sb.from("tags").update(next).in("id", ids([id])));
}

export async function setTagsCategory(tagIds: string[], category: string): Promise<Result> {
  const value = clean(category).toLowerCase().replace(/\s+/g, "_") || "general";
  return run((sb) => sb.from("tags").update({ category: value }).in("id", ids(tagIds)));
}

export async function deleteTags(tagIds: string[]): Promise<Result> {
  return run((sb) => sb.from("tags").delete().in("id", ids(tagIds)));
}

export async function tagParticipants(tagIds: string[], participantIds: string[]): Promise<Result> {
  const rows = ids(participantIds).flatMap((participant_id) => ids(tagIds).map((tag_id) => ({ participant_id, tag_id })));
  if (!rows.length) return { ok: false, error: "Pick at least one tag." };
  return run((sb) => sb.from("participant_tags").upsert(rows, { onConflict: "participant_id,tag_id", ignoreDuplicates: true }));
}

export async function untagParticipants(tagIds: string[], participantIds: string[]): Promise<Result> {
  if (!ids(tagIds).length) return { ok: false, error: "Pick at least one tag." };
  return run((sb) => sb.from("participant_tags").delete().in("tag_id", ids(tagIds)).in("participant_id", ids(participantIds)));
}
