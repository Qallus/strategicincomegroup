import { NextRequest, NextResponse } from "next/server";
import { assertCanManageRegistration, requireBookingManager } from "@/lib/booking/access";
import { deleteRegistration, updateRegistration } from "@/lib/booking/data";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : 500;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const m = await requireBookingManager(request, body?.actionToken);
    await assertCanManageRegistration(m, id);
    await updateRegistration(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update registration";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const m = await requireBookingManager(request, body?.actionToken);
    await assertCanManageRegistration(m, id);
    await deleteRegistration(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete registration";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
