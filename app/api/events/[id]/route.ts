import { NextRequest, NextResponse } from "next/server";
import { assertCanManageEvent, requireBookingManager } from "@/lib/booking/access";
import { deleteEvent } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const m = await requireBookingManager(request, body?.actionToken);
    await assertCanManageEvent(m, id);
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
