import { NextRequest, NextResponse } from "next/server";
import { requireBookingManager } from "@/lib/booking/access";
import { linkPlannerProfile, loadPlannerLinks } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 400;
}

// Admin: which planner pages are linked to a dashboard login.
export async function GET(request: NextRequest) {
  try {
    const m = await requireBookingManager(request);
    if (!m.isAdmin) throw new Error("Permission required.");
    return NextResponse.json({ links: await loadPlannerLinks() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load planner links";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

// Admin: link (or unlink) a planner page to a dashboard login. Moves their booking pages
// and future bookings to that login.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const m = await requireBookingManager(request, body?.actionToken);
    if (!m.isAdmin) throw new Error("Permission required: only a SIG Admin can link planner logins.");
    const employeeProfileId = String(body?.employee_profile_id || "");
    if (!employeeProfileId) throw new Error("employee_profile_id is required.");
    await linkPlannerProfile(employeeProfileId, body?.profile_id ? String(body.profile_id) : null);
    return NextResponse.json({ ok: true, links: await loadPlannerLinks() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to link planner";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
