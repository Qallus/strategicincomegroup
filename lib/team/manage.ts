// Server-side reads/writes of employee_profiles for the dashboard, the API
// routes and the MCP tools. Callers do their own auth; this module enforces
// which fields a non-admin may change (sanitizePatch) and keeps the public
// pages fresh after a save.
import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROLES, canAccessDashboard, normalizeAppRole } from "@/lib/rbac/roles";
import { isSelfServeRole } from "@/lib/user-management/self-registration";
import { TEAM_CACHE_TAG } from "./data";
import { displayName, sanitizePatch, slugify, type EmployeePatch, type EmployeeProfile } from "./fields";

const sb = () => createSupabaseAdminClient();

export class TeamProfilesUnavailableError extends Error {
  constructor() {
    super("Team profiles aren't set up yet — the employee_profiles migration (202611190150) hasn't been applied.");
  }
}

function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || (/employee_profiles/.test(error.message ?? "") && /does not exist|schema cache/i.test(error.message ?? ""))) {
    throw new TeamProfilesUnavailableError();
  }
  if (error.code === "23505") throw new Error("That slug is already used by another team member.");
  throw new Error(error.message || "Database error.");
}

/** Employees = active staff (everyone with dashboard access except the self-serve roles). */
export function isStaffRole(role: string | null | undefined) {
  return canAccessDashboard(role) && !isSelfServeRole(role);
}

/** Admins can edit anyone's team page. */
export function isTeamAdmin(role: string | null | undefined) {
  const r = normalizeAppRole(role);
  return r === ROLES.SUPER_ADMIN || r === ROLES.ADMIN;
}

export async function listEmployeeProfiles(): Promise<EmployeeProfile[]> {
  const { data, error } = await sb().from("employee_profiles").select("*").order("sort_order").order("full_name");
  check(error);
  return (data ?? []) as EmployeeProfile[];
}

export async function getEmployeeProfileBySlug(slug: string): Promise<EmployeeProfile | null> {
  const { data, error } = await sb().from("employee_profiles").select("*").eq("slug", slug.trim().toLowerCase()).maybeSingle();
  check(error);
  return (data as EmployeeProfile) ?? null;
}

export async function getEmployeeProfileById(id: string): Promise<EmployeeProfile | null> {
  const { data, error } = await sb().from("employee_profiles").select("*").eq("id", id).maybeSingle();
  check(error);
  return (data as EmployeeProfile) ?? null;
}

/**
 * The signed-in user's team profile. If none is linked yet, links the row whose
 * account_email matches theirs (seeded for Mike, Julie, Bree, Jeremy).
 */
export async function getEmployeeProfileForUser(user: { id: string; email: string }): Promise<EmployeeProfile | null> {
  const { data, error } = await sb().from("employee_profiles").select("*").eq("profile_id", user.id).maybeSingle();
  check(error);
  if (data) return data as EmployeeProfile;

  const email = user.email.trim().toLowerCase();
  if (!email) return null;
  const match = await sb()
    .from("employee_profiles")
    .select("*")
    .is("profile_id", null)
    .ilike("account_email", email.replace(/[%_\\]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  check(match.error);
  if (!match.data) return null;

  const { data: linked, error: linkErr } = await sb()
    .from("employee_profiles")
    .update({ profile_id: user.id })
    .eq("id", (match.data as EmployeeProfile).id)
    .is("profile_id", null)
    .select("*")
    .maybeSingle();
  check(linkErr);
  return (linked as EmployeeProfile) ?? (match.data as EmployeeProfile);
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "team-member";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data, error } = await sb().from("employee_profiles").select("id").eq("slug", candidate).maybeSingle();
    check(error);
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Create a team profile for a dashboard user who doesn't have one yet. It
 * starts hidden from the website until they (or an admin) turn on "Show on website".
 */
export async function createEmployeeProfileForUser(
  user: { id: string; email: string; firstName?: string; lastName?: string },
  patch: EmployeePatch = {},
): Promise<EmployeeProfile> {
  const first = patch.first_name ?? user.firstName ?? "";
  const last = patch.last_name ?? user.lastName ?? "";
  const name = patch.full_name ?? `${first} ${last}`.trim();
  const slug = await uniqueSlug(name || user.email.split("@")[0]);
  const { data: last1 } = await sb().from("employee_profiles").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const row = {
    is_published: false,
    ...patch,
    slug,
    profile_id: user.id,
    account_email: user.email.trim().toLowerCase() || null,
    first_name: first || null,
    last_name: last || null,
    full_name: name || null,
    team_group: "admin",
    sort_order: ((last1?.sort_order as number | undefined) ?? 0) + 10,
    updated_by: user.id,
  };
  const { data, error } = await sb().from("employee_profiles").insert(row).select("*").single();
  check(error);
  revalidateTeam([slug]);
  return data as EmployeeProfile;
}

/** Apply a sanitized patch. Returns the row before and after. */
export async function updateEmployeeProfile(
  id: string,
  rawPatch: Record<string, unknown>,
  opts: { admin: boolean; updatedBy: string },
): Promise<{ before: EmployeeProfile; after: EmployeeProfile; changed: string[] }> {
  const before = await getEmployeeProfileById(id);
  if (!before) throw new Error("Team profile not found.");
  const patch = sanitizePatch(rawPatch, { admin: opts.admin });

  // Keep full_name in step when only first/last change and full_name was the plain combination.
  if ((patch.first_name !== undefined || patch.last_name !== undefined) && patch.full_name === undefined) {
    const oldCombined = [before.first_name, before.last_name].filter(Boolean).join(" ");
    if (!before.full_name || before.full_name === oldCombined) {
      const first = patch.first_name !== undefined ? patch.first_name : before.first_name;
      const last = patch.last_name !== undefined ? patch.last_name : before.last_name;
      patch.full_name = [first, last].filter(Boolean).join(" ") || null;
    }
  }

  const changed = Object.keys(patch).filter(
    (k) => JSON.stringify((patch as Record<string, unknown>)[k]) !== JSON.stringify((before as Record<string, unknown>)[k]),
  );
  if (!changed.length) return { before, after: before, changed };

  const { data, error } = await sb()
    .from("employee_profiles")
    .update({ ...patch, updated_by: opts.updatedBy })
    .eq("id", id)
    .select("*")
    .single();
  check(error);
  const after = data as EmployeeProfile;
  revalidateTeam([before.slug, after.slug]);
  return { before, after, changed };
}

/** Mirror name / phone onto the dashboard account (profiles) — the old My Profile behaviour. */
export async function syncAccountFromEmployee(profileId: string, row: EmployeeProfile, opts: { avatar?: boolean } = {}) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (row.first_name) update.first_name = row.first_name;
  if (row.last_name !== null) update.last_name = row.last_name ?? "";
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ") || displayName(row);
  if (full) update.full_name = full;
  update.phone = row.phone;
  if (opts.avatar) update.avatar_url = row.photo_url;
  await sb().from("profiles").update(update).eq("id", profileId);
}

export function revalidateTeam(slugs: (string | null | undefined)[] = []) {
  try {
    revalidateTag(TEAM_CACHE_TAG);
    revalidatePath("/team");
    for (const s of new Set(slugs.filter(Boolean))) revalidatePath(`/team/${s}`);
  } catch {
    /* outside a request (scripts) — the 5-minute revalidate catches up */
  }
}
