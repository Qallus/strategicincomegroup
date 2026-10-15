import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DmPerson = { id: string; name: string; email: string };

const personName = (p: any) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || p?.email || "Unknown";

// SIG: every active staff member may message every other active staff member.
export async function getGroupPeople(profile: { id: string; role: string; email: string | null }): Promise<DmPerson[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, email").eq("status", "active").neq("id", profile.id);
  return (data ?? [])
    .map((p: any) => ({ id: p.id as string, name: personName(p), email: (p.email as string) ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroupMemberIds(profile: { id: string; role: string; email: string | null }): Promise<Set<string>> {
  return new Set((await getGroupPeople(profile)).map((p) => p.id));
}
