import { NextRequest, NextResponse } from "next/server";
import { requireBookingManager } from "@/lib/booking/access";
import { loadBookingTypes, loadBookings } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function GET(request: NextRequest) {
  try {
    const m = await requireBookingManager(request);
    const upcomingOnly = request.nextUrl.searchParams.get("upcoming") === "1";
    const [bookings, types] = await Promise.all([loadBookings({ upcomingOnly }), m.isAdmin ? Promise.resolve([]) : loadBookingTypes()]);
    if (m.isAdmin) return NextResponse.json({ bookings });
    const mine = new Set(types.filter((t) => t.host_staff_id === m.profileId).map((t) => t.id));
    return NextResponse.json({ bookings: bookings.filter((b) => b.host_staff_id === m.profileId || mine.has(b.booking_type_id)) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load bookings";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
