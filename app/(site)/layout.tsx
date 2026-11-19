import { SiteShell } from "@/components/public-site/site-shell";

/** Every public marketing page shares the header (mega menus), footer and help FAB. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
