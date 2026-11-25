// Dashboard → Credentials (Super Admin only — see layout.tsx). One organised place to add,
// update and remove the API keys, tokens and service URLs SIG's integrations use. Saved
// secrets are encrypted in the app and are write-only: this page only ever receives the
// last four characters. Every feature reads the dashboard value first and the Coolify
// env var second.
import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminActionToken } from "@/lib/auth/action-token";
import { getCurrentProfile } from "@/lib/auth/server";
import { getCredentialsOverview } from "@/lib/credentials/server";
import type { CredentialsOverview } from "@/lib/credentials/types";
import { CredentialsClient } from "./credentials-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credentials" };

export default async function CredentialsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard/credentials");
  const { tab } = await searchParams;

  let overview: CredentialsOverview | null = null;
  let loadError: string | null = null;
  try {
    overview = await getCredentialsOverview();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Couldn't load credentials.";
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Super Admin"
        title="Credentials"
        description="API keys, tokens and service URLs for every integration. Secrets are encrypted before they are stored and are never shown again — only their last four characters. A value saved here takes effect within a minute; anything not saved here keeps using its Coolify variable."
      />

      {loadError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : null}

      {overview?.migrationMissing ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
            The credentials store isn&apos;t set up yet. Run <code className="font-mono">supabase/migrations/202611250210_credentials.sql</code> in the Supabase SQL editor. Until then every feature keeps using its Coolify variables, shown below.
          </CardContent>
        </Card>
      ) : null}

      {overview && !overview.masterKeySet ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
            <span className="font-medium">CREDENTIALS_MASTER_KEY is not set.</span> Add it in Coolify (generate with <code className="font-mono">openssl rand -base64 32</code>), back it up somewhere safe, and redeploy before saving secrets here. URLs and IDs can be saved without it.
          </CardContent>
        </Card>
      ) : null}

      {overview ? <CredentialsClient initialOverview={overview} initialTab={tab ?? null} actionToken={createAdminActionToken(profile)} /> : null}
    </div>
  );
}
