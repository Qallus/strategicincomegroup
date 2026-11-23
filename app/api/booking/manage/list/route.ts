import { NextRequest, NextResponse } from "next/server";
import { consumeAccessLink } from "@/lib/booking/manage";

// PUBLIC: consume a single-use "my appointments" link (POST, so email link scanners that
// prefetch GET URLs can't burn it) and return the client's appointments.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || "");
  try {
    const res = await consumeAccessLink(token);
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason }, { status: 410 });
    return NextResponse.json({ ok: true, items: res.items });
  } catch (e) {
    console.error("[booking-manage] list failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 500 });
  }
}
