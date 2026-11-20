import { AnnouncementBar } from "@/components/public-site/announcement-bar";
import { getPublicAnnouncements } from "@/lib/site-notices/server";
import { pickActiveAnnouncement } from "@/lib/site-notices/shared";

/** Server wrapper: loads scheduled/live announcements (Dashboard → Site Notices). Renders nothing on any error. */
export async function SiteAnnouncement() {
  const list = await getPublicAnnouncements().catch(() => []);
  if (!list.length) return null;
  const initial = pickActiveAnnouncement(list);
  return <AnnouncementBar announcements={list} initialId={initial?.id ?? null} />;
}
