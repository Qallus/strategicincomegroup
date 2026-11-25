import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

// Audience builder options: contact tags (contacts.tags) and participant tags (Tags & Segments).
export async function GET(request: Request) {
  try {
    await requireAdminManager(request);
    const supabase = createSupabaseAdminClient();
    const [contacts, tags, links] = await Promise.all([
      supabase.from("contacts").select("tags, type").neq("status", "archived").not("phone", "is", null).limit(10_000),
      supabase.from("tags").select("id, name, category").order("name"),
      supabase.from("participant_tags").select("tag_id").limit(50_000),
    ]);

    const contactTags = new Map<string, number>();
    let contactCount = 0;
    let leadCount = 0;
    for (const c of (contacts.data ?? []) as { tags: string[] | null; type: string }[]) {
      if (c.type === "lead") leadCount++;
      else contactCount++;
      for (const t of c.tags ?? []) if (t) contactTags.set(t, (contactTags.get(t) ?? 0) + 1);
    }
    const tagCounts = new Map<string, number>();
    for (const l of (links.data ?? []) as { tag_id: string }[]) tagCounts.set(l.tag_id, (tagCounts.get(l.tag_id) ?? 0) + 1);

    return NextResponse.json({
      contactTags: [...contactTags.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count })),
      contactCount,
      leadCount,
      participantTags: ((tags.data ?? []) as { id: string; name: string; category: string }[]).map((t) => ({ ...t, count: tagCounts.get(t.id) ?? 0 })),
    });
  } catch (error) {
    return commsError(error, "Failed to load audience options.");
  }
}
