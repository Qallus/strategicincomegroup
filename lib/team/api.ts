// Auth + error helpers shared by the team-profile API routes.
import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { isStaffRole, isTeamAdmin, TeamProfilesUnavailableError } from "./manage";

export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type TeamCaller = { id: string; email: string; role: string; admin: boolean };

/** Active staff member (any dashboard role except the self-serve participant/facilitator). */
export async function requireEmployee(request: Request): Promise<TeamCaller> {
  let me;
  try {
    me = await requireActiveProfile(request, request.headers.get("x-sig-action-token"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized.";
    throw new HttpError(msg, /authentication/i.test(msg) ? 401 : 403);
  }
  if (!isStaffRole(me.role)) throw new HttpError("Team profiles are for SIG employees.", 403);
  return { id: me.id as string, email: String(me.email ?? ""), role: me.role, admin: isTeamAdmin(me.role) };
}

export async function requireTeamAdmin(request: Request): Promise<TeamCaller> {
  const me = await requireEmployee(request);
  if (!me.admin) throw new HttpError("Only admins can edit other team members' profiles.", 403);
  return me;
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof TeamProfilesUnavailableError) return NextResponse.json({ error: err.message, code: "migration_pending" }, { status: 503 });
  const message = err instanceof Error ? err.message : "Something went wrong.";
  const status = /must be|too long|only an admin|doesn't look|accepts|already used|can hold/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
