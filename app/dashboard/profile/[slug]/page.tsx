import { notFound, redirect } from "next/navigation";
import { SectionHeader } from "@/components/dashboard/section-header";
import { EmployeeProfileEditor } from "@/components/profile/employee-profile-editor";
import { TeamProfilePicker } from "@/components/profile/team-profile-picker";
import { getCurrentProfile } from "@/lib/auth/server";
import { displayName, toPickerItems } from "@/lib/team/fields";
import { isTeamAdmin, listEmployeeProfiles, TeamProfilesUnavailableError } from "@/lib/team/manage";

export const dynamic = "force-dynamic";

// Admins (Super Admin / Admin) edit any employee's team page here.
export default async function EditTeamProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/dashboard/profile/${slug}`)}`);
  if (!isTeamAdmin(profile.role) || profile.status !== "active") redirect("/dashboard/profile");

  let team;
  try {
    team = await listEmployeeProfiles();
  } catch (err) {
    if (err instanceof TeamProfilesUnavailableError) redirect("/dashboard/profile");
    throw err;
  }
  const row = team.find((r) => r.slug === slug);
  if (!row) notFound();
  if (row.profile_id === profile.id) redirect("/dashboard/profile");

  const name = displayName(row);
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Team profiles" title={name} description={`Editing ${name}'s public team page as an admin. Changes go live on the website when saved.`} />
      <EmployeeProfileEditor
        key={row.id}
        initial={row}
        mode="admin"
        isAdmin
        defaults={{ firstName: row.first_name ?? "", lastName: row.last_name ?? "", email: row.account_email ?? "" }}
        toolbar={<TeamProfilePicker items={toPickerItems(team, profile.id)} currentSlug={row.slug} editingOther />}
      />
    </div>
  );
}
