import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireTeamAdmin } from "@/lib/team/api";
import { getEmployeeProfileBySlug, updateEmployeeProfile } from "@/lib/team/manage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Admins: read / edit any employee's team page by slug.
export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireTeamAdmin(request);
    const profile = await getEmployeeProfileBySlug((await params).slug);
    if (!profile) throw new HttpError("Team profile not found.", 404);
    return NextResponse.json({ profile });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const me = await requireTeamAdmin(request);
    const current = await getEmployeeProfileBySlug((await params).slug);
    if (!current) throw new HttpError("Team profile not found.", 404);
    const body = (await request.json().catch(() => ({}))) as { patch?: Record<string, unknown> };
    const raw = body.patch && typeof body.patch === "object" ? body.patch : {};
    const { after } = await updateEmployeeProfile(current.id, raw, { admin: true, updatedBy: me.id });
    return NextResponse.json({ profile: after });
  } catch (err) {
    return errorResponse(err);
  }
}
