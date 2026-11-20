import { NextResponse } from "next/server";
import { errorResponse, requireEmployee } from "@/lib/team/api";
import { sanitizePatch } from "@/lib/team/fields";
import {
  createEmployeeProfileForUser,
  getEmployeeProfileForUser,
  syncAccountFromEmployee,
  updateEmployeeProfile,
} from "@/lib/team/manage";

export const dynamic = "force-dynamic";

// The signed-in employee's own team page (employee_profiles). GET links the row
// by email on first use; PATCH creates the row if they don't have one yet.
export async function GET(request: Request) {
  try {
    const me = await requireEmployee(request);
    const profile = await getEmployeeProfileForUser(me);
    return NextResponse.json({ profile });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const me = await requireEmployee(request);
    const body = (await request.json().catch(() => ({}))) as { patch?: Record<string, unknown> };
    const raw = body.patch && typeof body.patch === "object" ? body.patch : {};

    const existing = await getEmployeeProfileForUser(me);
    let profile;
    if (!existing) {
      profile = await createEmployeeProfileForUser(me, sanitizePatch(raw, { admin: me.admin }));
    } else {
      profile = (await updateEmployeeProfile(existing.id, raw, { admin: me.admin, updatedBy: me.id })).after;
    }

    const touchesAccount = ["first_name", "last_name", "full_name", "phone"].some((k) => k in raw);
    const photoChanged = "photo_url" in raw;
    if (touchesAccount || photoChanged) await syncAccountFromEmployee(me.id, profile, { avatar: photoChanged });

    return NextResponse.json({ profile });
  } catch (err) {
    return errorResponse(err);
  }
}
