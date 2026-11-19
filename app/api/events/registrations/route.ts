import { NextRequest, NextResponse } from "next/server";
import { assertCanManageEvent, requireBookingManager } from "@/lib/booking/access";
import { loadEvents, loadRegistrations } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function GET(request: NextRequest) {
  try {
    const m = await requireBookingManager(request);
    const eventId = request.nextUrl.searchParams.get("event_id") || undefined;
    if (eventId) await assertCanManageEvent(m, eventId);
    const registrations = await loadRegistrations({ eventId });
    if (m.isAdmin || eventId) return NextResponse.json({ registrations });
    const mine = new Set((await loadEvents()).filter((e) => e.host_staff_id === m.profileId).map((e) => e.id));
    return NextResponse.json({ registrations: registrations.filter((r) => mine.has(r.event_id)) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load registrations";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
