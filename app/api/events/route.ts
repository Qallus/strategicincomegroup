import { NextRequest, NextResponse } from "next/server";
import { assertCanManageEvent, requireBookingManager, scopePayload } from "@/lib/booking/access";
import { loadEvents, saveEvent } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function GET(request: NextRequest) {
  try {
    const m = await requireBookingManager(request);
    const events = await loadEvents();
    return NextResponse.json({ events: m.isAdmin ? events : events.filter((e) => e.host_staff_id === m.profileId) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load events";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const m = await requireBookingManager(request, body?.actionToken);
    if (!String(body?.title || "").trim()) throw new Error("A title is required.");
    if (body?.id) await assertCanManageEvent(m, String(body.id));
    scopePayload(m, body);
    if (!String(body?.start_at || "").trim()) throw new Error("A start date/time is required.");
    const event = await saveEvent(body);
    return NextResponse.json({ event });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save event";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
