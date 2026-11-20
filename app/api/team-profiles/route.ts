import { NextResponse } from "next/server";
import { errorResponse, requireTeamAdmin } from "@/lib/team/api";
import { completeness, displayName } from "@/lib/team/fields";
import { listEmployeeProfiles } from "@/lib/team/manage";

export const dynamic = "force-dynamic";

// Admins: every team profile (published or hidden) for the profile picker.
export async function GET(request: Request) {
  try {
    await requireTeamAdmin(request);
    const rows = await listEmployeeProfiles();
    return NextResponse.json({
      profiles: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: displayName(r),
        job_title: r.job_title,
        photo_url: r.photo_url,
        team_group: r.team_group,
        is_published: r.is_published,
        linked: Boolean(r.profile_id),
        completeness: completeness(r).percent,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
