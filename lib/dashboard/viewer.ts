import "server-only";

import { PERMISSIONS, can, type Permission } from "@/lib/rbac/permissions";
import { ROLES, normalizeAppRole, type AppRole } from "@/lib/rbac/roles";
import { isSelfServeRole } from "@/lib/user-management/self-registration";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardViewer } from "./types";

type ProfileLike = { id: string; email?: string | null; role?: string | null; firstName?: string; lastName?: string };

/** Build the dashboard viewer (role flags + permissions) from a profile. */
export function toViewer(profile: ProfileLike): DashboardViewer {
  const role = (normalizeAppRole(profile.role) ?? ROLES.PARTICIPANT) as AppRole;
  const permissions = (Object.values(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return {
    id: profile.id,
    email: (profile.email ?? "").toLowerCase(),
    firstName: profile.firstName ?? "",
    name,
    role,
    permissions,
    isAdmin: role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN,
    isSuperAdmin: role === ROLES.SUPER_ADMIN,
    isStaff: !isSelfServeRole(role),
  };
}

/** Viewer for an API route profile (requireActiveProfile returns id/role/email only). */
export async function viewerFromApiProfile(profile: { id: string; role: string; email?: string | null }): Promise<DashboardViewer> {
  let firstName = "";
  let lastName = "";
  try {
    const { data } = await createSupabaseAdminClient().from("profiles").select("first_name,last_name").eq("id", profile.id).maybeSingle();
    firstName = (data?.first_name as string | null) ?? "";
    lastName = (data?.last_name as string | null) ?? "";
  } catch {
    /* names are cosmetic */
  }
  return toViewer({ id: profile.id, email: profile.email, role: profile.role, firstName, lastName });
}

/** Firm-wide data only for admins who asked for it; everyone else is scoped to themselves. */
export function wantsFirm(viewer: DashboardViewer, params: Record<string, unknown> | undefined): boolean {
  return viewer.isAdmin && params?.scope !== "mine";
}
