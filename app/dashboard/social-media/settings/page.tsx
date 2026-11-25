import { SectionHeader } from "@/components/dashboard/section-header";
import { SocialTabs } from "@/components/social-media/social-tabs";
import { SocialSettings } from "@/components/social-media/social-settings";
import { listAccounts } from "@/lib/social-media/data";
import { getSocialCredentialStatus } from "@/lib/credentials/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Social Media — SIG" };

export default async function SocialSettingsPage() {
  // Accounts without tokens + a masked status (last 4 only). Tokens never reach the browser.
  const accounts = await listAccounts();
  const credentialStatus = await getSocialCredentialStatus(accounts);
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Social Media" title="Settings" description="Connect your platforms — enter credentials, profile URLs, and mark accounts active so you can publish to them." />
      <SocialTabs active="settings" />
      <SocialSettings initialAccounts={accounts} initialCredentialStatus={credentialStatus} />
    </div>
  );
}
