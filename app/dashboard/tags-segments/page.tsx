import { SectionHeader } from "@/components/dashboard/section-header";
import { TagsSegmentsDashboard, type ParticipantRow, type TagRow } from "@/components/tags-segments/tags-segments-dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Access is enforced by ./layout.tsx (manage_participants).
export default async function TagsSegmentsPage() {
  let tags: TagRow[] = [];
  let participants: ParticipantRow[] = [];
  let error: string | null = null;
  try {
    const sb = createSupabaseAdminClient();
    const [t, p] = await Promise.all([
      sb.from("tags").select("id, name, category, created_at, participant_tags(participant_id)").order("name"),
      sb
        .from("participants")
        .select("*, participant_tags(tags(id, name, category))")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    tags = (t.data ?? []) as unknown as TagRow[];
    participants = (p.data ?? []) as unknown as ParticipantRow[];
    error = t.error?.message ?? p.error?.message ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load tags.";
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tags & Segments"
        description="Organise participants with tags, then combine tags into a segment to preview who it reaches before emailing or following up."
      />
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <TagsSegmentsDashboard tags={tags} participants={participants} />
    </div>
  );
}
