import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { resolveRange } from "@/lib/analytics/dates";
import { conversionsCsv, getConversions } from "@/lib/analytics/server";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** CSV of conversions (with channel / source / campaign) for the selected range. View Reports only. */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!can(profile.role, PERMISSIONS.VIEW_REPORTS)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

  const url = new URL(request.url);
  const range = resolveRange(Object.fromEntries(url.searchParams.entries()));
  const { rows } = await getConversions(range, 5000);
  const csv = `﻿${conversionsCsv(rows)}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sig-conversions-${range.from}-to-${range.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
