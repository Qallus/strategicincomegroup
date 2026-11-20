import Link from "next/link";
import { SiteAnnouncement } from "@/components/public-site/site-announcement";
import { SiteHeader } from "@/components/public-site/site-header";
import { SiteFooter } from "@/components/public-site/site-footer";
import { SiteFab } from "@/components/public-site/site-fab";
import type { NavItem } from "@/lib/public-site/nav-items";

/**
 * Public page chrome: header with mega menus, footer + sub-footer and the help FAB.
 *
 * The app/(site) route group wraps its pages in this through its layout. CMS pages
 * (app/[...slug]) and the Frontend Editor's draft preview render it directly.
 * `navItems`/`footerLinks` are accepted for those callers but the code-owned
 * navigation is used everywhere so every page shares one menu.
 */
export function SiteShell({
  children,
  contentClassName,
  footerNote,
}: {
  children: React.ReactNode;
  contentClassName?: string;
  navItems?: NavItem[];
  footerLinks?: { label: string; href: string }[];
  footerNote?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <SiteAnnouncement />
      <SiteHeader />
      <main id="main" className={contentClassName ?? "flex-1"}>
        {children}
      </main>
      {footerNote ? <p className="bg-muted px-4 py-3 text-center text-xs text-muted-foreground">{footerNote}</p> : null}
      <SiteFooter />
      <SiteFab />
    </div>
  );
}

/** The page-content box that lines up with the header. */
export const SITE_CONTENT_BOX = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

/** Simple centred hero kept for older callers; new pages use PageHero from ./blocks. */
export function SiteHero({
  eyebrow,
  title,
  description,
  cta,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
  align?: "center" | "left";
  children?: React.ReactNode;
}) {
  return (
    <section className={`${SITE_CONTENT_BOX} py-12 text-center md:py-16`}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">{eyebrow}</p> : null}
      <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight">{title}</h1>
      {description ? <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p> : null}
      {cta ? (
        <Link href={cta.href} className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-6 font-medium text-primary-foreground">
          {cta.label}
        </Link>
      ) : null}
      {children}
    </section>
  );
}
