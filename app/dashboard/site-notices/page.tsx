import { SectionHeader } from "@/components/dashboard/section-header";
import { SiteNoticesManager } from "@/components/site-notices/site-notices-manager";
import { requirePagePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getBlogSidebarForAdmin, listAnnouncements } from "@/lib/site-notices/server";
import { DEFAULT_BLOG_SIDEBAR_BLOCK, type SiteAnnouncement } from "@/lib/site-notices/shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Site Notices — SIG Dashboard" };

export default async function SiteNoticesPage() {
  await requirePagePermission(PERMISSIONS.MANAGE_SETTINGS, "/dashboard/site-notices");

  let announcements: SiteAnnouncement[] = [];
  let sidebar = DEFAULT_BLOG_SIDEBAR_BLOCK;
  let sidebarSaved = false;
  let loadError: string | null = null;
  try {
    const [list, block] = await Promise.all([listAnnouncements(), getBlogSidebarForAdmin()]);
    announcements = list;
    sidebar = block.block;
    sidebarSaved = block.exists;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    loadError = /site_(announcements|blocks)|schema cache|does not exist/i.test(msg)
      ? "The site notices tables aren't in the database yet. Apply supabase/migrations/202611190170_site_notices.sql, then reload. Until then the website shows no announcement bar and the default blog sidebar."
      : msg;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Website"
        title="Site Notices"
        description="The announcement bar shown above the main menu on every public page, and the notification card in the sidebar of every blog post. Times are Arizona time."
      />
      {loadError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : null}
      <SiteNoticesManager announcements={announcements} sidebar={sidebar} sidebarSaved={sidebarSaved} disabled={Boolean(loadError)} />
    </div>
  );
}
