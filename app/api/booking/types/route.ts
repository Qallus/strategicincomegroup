import { NextRequest, NextResponse } from "next/server";
import { assertCanManageType, requireBookingManager, scopePayload } from "@/lib/booking/access";
import { loadBookingTypes, saveBookingType } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function GET(request: NextRequest) {
  try {
    const m = await requireBookingManager(request);
    const types = await loadBookingTypes();
    return NextResponse.json({ bookingTypes: m.isAdmin ? types : types.filter((t) => t.host_staff_id === m.profileId) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load booking types";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const m = await requireBookingManager(request, body?.actionToken);
    if (!String(body?.name || "").trim()) throw new Error("A name is required.");
    if (body?.id) await assertCanManageType(m, String(body.id));
    scopePayload(m, body);
    const bookingType = await saveBookingType(body);
    return NextResponse.json({ bookingType });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save booking type";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
