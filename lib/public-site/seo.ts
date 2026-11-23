// Canonical site URL + schema.org JSON-LD builders for the public site
// (robots.ts, sitemap.ts, llms.txt and the <JsonLd> component).
import { CONTACT, OFFICES } from "./site-data";

export const PRODUCTION_SITE_URL = "https://strategicincomegroup.com";

/** Absolute public-site origin, no trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_SITE_URL).replace(/\/$/, "");
}

export const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`);

/** Code-owned public pages for the sitemap and llms.txt. */
export const STATIC_PAGES: { path: string; title: string; description: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", title: "Home", description: "Comprehensive financial planning for every phase of life.", priority: 1, changeFrequency: "weekly" },
  { path: "/services", title: "All Solutions", description: "Every service Strategic Income Group offers.", priority: 0.9, changeFrequency: "monthly" },
  { path: "/financial-planning", title: "Financial Planning", description: "The Three Phases of Wealth process for your whole financial life.", priority: 0.9, changeFrequency: "monthly" },
  { path: "/investment-management", title: "Investment Management", description: "Diversified public and private portfolios, including impact investing.", priority: 0.9, changeFrequency: "monthly" },
  { path: "/estate-planning", title: "Estate Planning", description: "Will and trust based plans, powers of attorney and pricing.", priority: 0.9, changeFrequency: "monthly" },
  { path: "/insurance-planning", title: "Insurance Planning", description: "Life, disability and other coverage that protects your family.", priority: 0.8, changeFrequency: "monthly" },
  { path: "/403b-plan", title: "403(b) Plans for Churches", description: "Faith-based retirement plans for pastors and ministry staff.", priority: 0.8, changeFrequency: "monthly" },
  { path: "/our-approach", title: "Our Approach", description: "How the Three Phases of Wealth give order to your goals.", priority: 0.8, changeFrequency: "monthly" },
  { path: "/phase-1-2", title: "Phase I — The Foundation Phase", description: "Budget, insurance, estate plan, debt payoff and emergency fund.", priority: 0.7, changeFrequency: "monthly" },
  { path: "/phase-2-2", title: "Phase II — Accumulating Wealth", description: "Flexible, tax-efficient growth with every dollar given a purpose.", priority: 0.7, changeFrequency: "monthly" },
  { path: "/phase-3-2", title: "Phase III — Strategic Income", description: "Turning wealth into reliable retirement income and legacy.", priority: 0.7, changeFrequency: "monthly" },
  { path: "/team", title: "Our Team", description: "Financial planners and administrative team.", priority: 0.8, changeFrequency: "monthly" },
  { path: "/mission", title: "Mission & Values", description: "Why Strategic Income Group exists and what guides it.", priority: 0.6, changeFrequency: "yearly" },
  { path: "/resources", title: "Resources & Strategic Insights", description: "Market commentary and planning articles.", priority: 0.8, changeFrequency: "weekly" },
  { path: "/events", title: "Events", description: "Roundtables, workshops and community service events.", priority: 0.7, changeFrequency: "weekly" },
  { path: "/sigcares", title: "SIGCares", description: "SIG's community giving and Feed My Starving Children packings.", priority: 0.6, changeFrequency: "monthly" },
  { path: "/join-our-team", title: "Careers", description: "Open roles at Strategic Income Group.", priority: 0.6, changeFrequency: "weekly" },
  { path: "/book", title: "Schedule Online", description: "Book a consultation with a CFP® professional.", priority: 0.8, changeFrequency: "weekly" },
  { path: "/contact", title: "Contact Us", description: "Call (480) 466-7070 or send a message.", priority: 0.8, changeFrequency: "yearly" },
  { path: "/get-started", title: "Get Started", description: "Talk to an expert planner today.", priority: 0.7, changeFrequency: "yearly" },
  { path: "/privacy-policy", title: "Privacy Policy", description: "How SIG collects, uses and protects information.", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms-of-service", title: "Terms of Service", description: "Terms for the website and services.", priority: 0.2, changeFrequency: "yearly" },
  { path: "/communication-policy", title: "Communication Policy", description: "Phone, SMS and email consent and opt-out.", priority: 0.2, changeFrequency: "yearly" },
];

type Json = Record<string, unknown>;

const ORG_ID = () => `${siteUrl()}/#organization`;

/** Organization + FinancialService (one node per office). */
export function organizationJsonLd(): Json {
  const phone = "+1-480-466-7070";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "FinancialService"],
        "@id": ORG_ID(),
        name: "Strategic Income Group",
        url: siteUrl(),
        logo: abs("/icons/apple-touch-icon.png"),
        description:
          "Fee-based financial planning, investment management, estate planning, insurance planning and 403(b) plans for families, retirees and churches. CERTIFIED FINANCIAL PLANNER™ professionals in Chandler and Peoria, Arizona.",
        telephone: phone,
        email: CONTACT.email,
        areaServed: { "@type": "State", name: "Arizona" },
        sameAs: [CONTACT.facebook, CONTACT.linkedin],
        openingHours: "Mo-Fr 09:00-17:00",
        address: OFFICES.map((o) => postal(o.street, o.locality)),
        department: OFFICES.map((o) => ({
          "@type": "FinancialService",
          name: `Strategic Income Group — ${o.name}`,
          telephone: phone,
          address: postal(o.street, o.locality),
          hasMap: o.directions,
          parentOrganization: { "@id": ORG_ID() },
        })),
      },
      { "@type": "WebSite", "@id": `${siteUrl()}/#website`, url: siteUrl(), name: "Strategic Income Group", publisher: { "@id": ORG_ID() } },
    ],
  };
}

function postal(street: string, locality: string): Json {
  const m = /^(.*),\s*([A-Z]{2})\s+(\d{5})$/.exec(locality);
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: m?.[1] ?? locality,
    addressRegion: m?.[2] ?? "AZ",
    postalCode: m?.[3],
    addressCountry: "US",
  };
}

export function articleJsonLd(post: { slug: string; title: string; date: string; excerpt: string; image: string | null; author?: string | null }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title.slice(0, 110),
    description: post.excerpt.slice(0, 300),
    datePublished: post.date,
    mainEntityOfPage: abs(`/resources/${post.slug}`),
    image: post.image ? [abs(post.image)] : undefined,
    author: post.author ? { "@type": "Person", name: post.author } : { "@id": ORG_ID(), "@type": "Organization", name: "Strategic Income Group" },
    publisher: { "@id": ORG_ID(), "@type": "Organization", name: "Strategic Income Group", logo: { "@type": "ImageObject", url: abs("/icons/apple-touch-icon.png") } },
  };
}

export function eventJsonLd(e: {
  slug: string;
  title: string;
  summary: string | null;
  start_at: string;
  end_at: string | null;
  location_type: string;
  location_name: string | null;
  location_address: string | null;
  online_url: string | null;
  cover_image_url: string | null;
  price_cents: number;
  currency: string;
  status: string;
}): Json {
  const place = e.location_name || e.location_address ? { "@type": "Place", name: e.location_name ?? undefined, address: e.location_address ?? undefined } : undefined;
  const virtual = { "@type": "VirtualLocation", url: abs(`/events/${e.slug}`) };
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.summary ?? undefined,
    startDate: e.start_at,
    endDate: e.end_at ?? undefined,
    eventStatus: e.status === "canceled" || e.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode:
      e.location_type === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : e.location_type === "hybrid"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    location: e.location_type === "online" ? virtual : e.location_type === "hybrid" ? [place, virtual].filter(Boolean) : place,
    image: e.cover_image_url ? [abs(e.cover_image_url)] : undefined,
    url: abs(`/events/${e.slug}`),
    organizer: { "@id": ORG_ID(), "@type": "Organization", name: "Strategic Income Group", url: siteUrl() },
    offers: {
      "@type": "Offer",
      url: abs(`/events/${e.slug}`),
      price: (e.price_cents / 100).toFixed(2),
      priceCurrency: (e.currency || "usd").toUpperCase(),
      availability: "https://schema.org/InStock",
    },
  };
}

export function jobPostingJsonLd(j: {
  slug: string;
  title: string;
  summary: string;
  intro: string | null;
  employment_type: string;
  location: string | null;
  publish_at: string | null;
  created_at: string | null;
  close_at: string | null;
}): Json {
  const type: Record<string, string> = { full_time: "FULL_TIME", part_time: "PART_TIME", internship: "INTERN", contract: "CONTRACTOR", temporary: "TEMPORARY" };
  const office = OFFICES.find((o) => j.location && j.location.toLowerCase().includes(o.city.toLowerCase())) ?? OFFICES[0];
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: [j.summary, j.intro].filter(Boolean).join("\n\n") || j.title,
    datePosted: (j.publish_at || j.created_at || new Date().toISOString()).slice(0, 10),
    validThrough: j.close_at ?? undefined,
    employmentType: type[j.employment_type] ?? "OTHER",
    hiringOrganization: { "@type": "Organization", "@id": ORG_ID(), name: "Strategic Income Group", sameAs: siteUrl() },
    jobLocation: { "@type": "Place", address: postal(office.street, office.locality) },
    url: abs(`/join-our-team/${j.slug}`),
  };
}

export function personJsonLd(m: { slug: string; name: string; credentials?: string; title: string; photo?: string; linkedin?: string; history?: string[] }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: m.name,
    honorificSuffix: m.credentials || undefined,
    jobTitle: m.title,
    description: m.history?.[0]?.slice(0, 300),
    image: m.photo ? abs(m.photo) : undefined,
    url: abs(`/team/${m.slug}`),
    sameAs: m.linkedin ? [m.linkedin] : undefined,
    worksFor: { "@type": "Organization", "@id": ORG_ID(), name: "Strategic Income Group" },
  };
}
