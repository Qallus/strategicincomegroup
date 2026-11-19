// Who may use which SIG tools. Mirrors the guards on the dashboard's own API
// routes (lib/user-management/auth.ts) so an AI client can never do more than
// the same person could do by clicking:
//   contacts, bookings, events, form submissions → requireParticipantManager
//   blog posts                                   → requireContentManager
//   website pages (Frontend Editor)              → Super Admin (MANAGE_CMS)
import { ROLES, normalizeAppRole, type AppRole } from "@/lib/rbac/roles";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export type Area = "contacts" | "bookings" | "events" | "forms" | "blog" | "website" | "admin";

const AREA_ROLES: Record<Exclude<Area, "website">, readonly AppRole[]> = {
  contacts: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  bookings: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  events: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  forms: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  blog: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CONTENT_REVIEWER],
  admin: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
};

export function canUseArea(role: string | null | undefined, area: Area): boolean {
  const r = normalizeAppRole(role);
  if (!r) return false;
  if (area === "website") return can(r, PERMISSIONS.MANAGE_CMS);
  return AREA_ROLES[area].includes(r);
}

export function areasFor(role: string | null | undefined): Area[] {
  return (["contacts", "bookings", "events", "forms", "blog", "website", "admin"] as Area[]).filter((a) => canUseArea(role, a));
}

/** Shrink tool arguments for the audit log: no long text, no secrets. */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (/token|secret|password|api[_-]?key/i.test(k)) { out[k] = "[redacted]"; continue; }
    if (typeof v === "string") out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    else if (v && typeof v === "object") out[k] = JSON.stringify(v).length > 500 ? "[object]" : v;
    else out[k] = v;
  }
  return out;
}
