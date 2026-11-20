// Public team roster for the website. Reads published rows from
// employee_profiles (edited in Dashboard → My Profile); if the table doesn't
// exist yet or the query fails, falls back to the static roster in
// lib/public-site/team.ts so the live site never breaks.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TEAM, type TeamMember } from "@/lib/public-site/team";
import { toTeamMember, type EmployeeProfile } from "./fields";

export const TEAM_CACHE_TAG = "team-profiles";

type Roster = { members: TeamMember[]; source: "db" | "static" };

const loadRoster = unstable_cache(
  async (): Promise<Roster> => {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("employee_profiles")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("full_name", { ascending: true });
      if (error) throw error;
      return { members: (data as EmployeeProfile[]).map(toTeamMember), source: "db" };
    } catch {
      return { members: TEAM, source: "static" };
    }
  },
  ["employee-profiles-published-v1"],
  { revalidate: 300, tags: [TEAM_CACHE_TAG] },
);

/** Every published team member, in website order. */
export const getPublishedTeam = cache(async (): Promise<TeamMember[]> => (await loadRoster()).members);

export const getTeamSource = cache(async () => (await loadRoster()).source);

export async function getPublishedTeamMember(slug: string): Promise<TeamMember | null> {
  return (await getPublishedTeam()).find((m) => m.slug === slug) ?? null;
}

export async function getPlanners() {
  return (await getPublishedTeam()).filter((m) => m.group === "planner");
}

export async function getAdminTeam() {
  return (await getPublishedTeam()).filter((m) => m.group === "admin");
}

/** The CEO card on /team — Michael if published, else the first leadership member. */
export async function getCeo(): Promise<TeamMember | null> {
  const team = await getPublishedTeam();
  return team.find((m) => m.slug === "michael-gauthier") ?? team.find((m) => m.group === "leadership") ?? null;
}
