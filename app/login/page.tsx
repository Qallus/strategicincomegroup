import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentProfile, isActiveDashboardProfile } from "@/lib/auth/server";
import { ROLES } from "@/lib/rbac/roles";

export const metadata = {
  title: "Login",
};

/**
 * Where an already-signed-in visitor is sent.
 *
 * LoginForm already honours ?next=, but this server-side guard used to ignore
 * it and send everyone to /dashboard — so following a link like
 * /login?next=/dashboard/contacts while signed in silently dropped the
 * destination. Only same-origin paths are accepted: a value starting "//" or
 * containing a backslash can address another host and would turn this into an
 * open redirect.
 */
function safeNextPath(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const profile = await getCurrentProfile();
  const { next } = (await searchParams) ?? {};

  // Dashboard roles AND participants land on the dashboard (participants get a scoped,
  // sidebar dashboard — the layout + shell render their nav and ParticipantDashboard).
  if (profile?.status === "active" && (isActiveDashboardProfile(profile) || profile.role === ROLES.PARTICIPANT)) {
    redirect(safeNextPath(next));
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      description="Sign in to your Strategic Income Group account."
      footer={
        <>
          New client?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
