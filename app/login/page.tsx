import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getCurrentProfile, isActiveDashboardProfile } from "@/lib/auth/server";
import { ROLES } from "@/lib/rbac/roles";

export const metadata = {
  title: "Employee Login",
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
    <main className="grid min-h-screen bg-background px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:p-0">
      <div className="fixed right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <section className="relative hidden overflow-hidden bg-brand-navy-deep text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-brand-sky/10 blur-3xl" aria-hidden />
        <span className="relative block h-12 w-60">
          <img src="/brand/sig-logo-white.png" alt="Strategic Income Group" className="h-full w-full object-contain object-left" />
        </span>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">Team workspace</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight">
            Strategize. Invest. <span className="italic text-brand-gold">Give.</span>
          </h1>
          <p className="mt-4 text-white/70">
            Clients, appointments, communications, and projects for the Strategic Income Group team, behind secure sign-in.
          </p>
        </div>
        <p className="relative text-xs text-white/50">Chandler &middot; Peoria &middot; (480) 466-7070</p>
      </section>
      <section className="flex items-center justify-center">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
