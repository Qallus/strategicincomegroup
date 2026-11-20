import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeProfileEditor } from "@/components/profile/employee-profile-editor";
import { ProfileForm } from "@/components/profile/profile-form";
import { TeamProfilePicker } from "@/components/profile/team-profile-picker";
import { AvatarUploader } from "@/components/user-management/avatar-uploader";
import { getCurrentProfile, type DashboardProfile } from "@/lib/auth/server";
import { ROLE_LABELS } from "@/lib/rbac/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toPickerItems, type EmployeeProfile } from "@/lib/team/fields";
import {
  getEmployeeProfileForUser, isStaffRole, isTeamAdmin, listEmployeeProfiles, TeamProfilesUnavailableError,
} from "@/lib/team/manage";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard/profile");

  // getCurrentProfile omits phone / created_at — load them directly.
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("profiles").select("phone,created_at").eq("id", profile.id).maybeSingle();
  const memberSince = data?.created_at
    ? new Date(data.created_at).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })
    : null;

  if (!isStaffRole(profile.role)) {
    return <AccountOnly profile={profile} phone={data?.phone ?? ""} memberSince={memberSince} />;
  }

  let mine: EmployeeProfile | null = null;
  let team: EmployeeProfile[] = [];
  try {
    mine = await getEmployeeProfileForUser({ id: profile.id, email: profile.email });
    if (isTeamAdmin(profile.role)) team = await listEmployeeProfiles();
  } catch (err) {
    if (err instanceof TeamProfilesUnavailableError) {
      return <AccountOnly profile={profile} phone={data?.phone ?? ""} memberSince={memberSince} notice={err.message} />;
    }
    throw err;
  }

  const admin = isTeamAdmin(profile.role);
  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Profile"
        description="Your public team page on strategicincomegroup.com — photo, story, contact details and schedule. Nothing here is required."
      />
      <EmployeeProfileEditor
        key="self"
        initial={mine}
        mode="self"
        isAdmin={admin}
        defaults={{ firstName: profile.firstName, lastName: profile.lastName, email: profile.email }}
        account={{ email: profile.email, roleLabel: ROLE_LABELS[profile.role], memberSince }}
        toolbar={admin && team.length ? <TeamProfilePicker items={toPickerItems(team, profile.id)} currentSlug={mine?.slug ?? null} editingOther={false} /> : null}
      />
    </div>
  );
}

/** Non-employees (participants, facilitators) — and everyone while the migration is pending. */
function AccountOnly({ profile, phone, memberSince, notice }: { profile: DashboardProfile; phone: string; memberSince: string | null; notice?: string }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="My Profile" description="Update your photo, name, and contact details." />
      {notice ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>{notice} Your account details below still work.</p>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="space-y-5 p-5">
            <AvatarUploader firstName={profile.firstName} lastName={profile.lastName} email={profile.email} avatarUrl={profile.avatarUrl} />
            <div className="space-y-2 border-t pt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Signed in as</p>
                <p className="break-all font-medium">{profile.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Role</p>
                <p className="font-medium">{ROLE_LABELS[profile.role]}</p>
              </div>
              {memberSince ? (
                <div>
                  <p className="text-muted-foreground">Member since</p>
                  <p className="font-medium">{memberSince}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <ProfileForm initial={{ firstName: profile.firstName, lastName: profile.lastName, phone }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
