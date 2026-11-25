import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import { ROLES } from "@/lib/rbac/roles";

// Credentials is Super-Admin-only. Guard layers: nav permission (MANAGE_CREDENTIALS, granted
// to no other role), this layout, requireSuperAdmin on every /api/admin/credentials route,
// and service-role-only RLS on the tables.
export default async function CredentialsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== ROLES.SUPER_ADMIN) {
    redirect("/access-restricted");
  }
  return <>{children}</>;
}
