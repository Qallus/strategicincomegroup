// Single source of truth for the public site navigation.
//
// Two renderers consume this: renderSiteHeader() in static-pages.ts (for the server-rendered
// HTML pages and the main/*.html marketing pages) and <SiteNav /> in
// components/public-site/site-nav.tsx (for the React app pages such as /book-waitlist).
// Change the nav here and both follow.

export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href?: string; children?: NavChild[] };

/**
 * @param siteUrl the marketing site origin (NEXT_PUBLIC_SITE_URL)
 * @param appUrl  this app's origin — login, register and the book waitlist live here.
 *                Pass "" from inside the app so those become relative paths ("/login") and
 *                Next can soft-navigate to them.
 */
export function publicNavItems(siteUrl: string, appUrl: string): NavItem[] {
  // Mirrors strategicincomegroup.com. Step 2 builds each of these pages in the app.
  return [
    { label: "Home", href: `${siteUrl}/` },
    {
      label: "About Us",
      children: [
        { label: "Our Team", href: `${siteUrl}/team` },
        { label: "Mission & Values", href: `${siteUrl}/mission` },
        { label: "Meet our CEO", href: `${siteUrl}/team/michael-gauthier` },
        { label: "Careers", href: `${siteUrl}/careers` },
      ],
    },
    {
      label: "Solutions",
      href: `${siteUrl}/services`,
      children: [
        { label: "Financial Planning", href: `${siteUrl}/financial-planning` },
        { label: "Investment Management", href: `${siteUrl}/investment-management` },
        { label: "Estate Planning", href: `${siteUrl}/estate-planning` },
        { label: "Insurance Planning", href: `${siteUrl}/insurance-planning` },
        { label: "403(b)", href: `${siteUrl}/403b-plan` },
      ],
    },
    { label: "Resources", href: `${siteUrl}/resources` },
    { label: "Events", href: `${appUrl}/events` },
    { label: "Contact", href: `${siteUrl}/contact` },
    {
      label: "Account",
      children: [
        { label: "Employee Login", href: `${appUrl}/login` },
      ],
    },
  ];
}

/** The primary public CTA. */
export function joinJourneyHref(siteUrl: string) {
  return `${siteUrl}/contact`;
}

export const ACCOUNT_LABEL = "Account";
export const RESOURCES_LABEL = "Resources";
