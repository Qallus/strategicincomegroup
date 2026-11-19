// Site-wide search index for the header search dropdown. Pages, planners and
// careers are static here; articles are added at runtime from /api/public/search.

import { JOBS } from "./careers";
import { TEAM } from "./team";

export type SearchCategory = "planning" | "investing" | "retirement" | "insurance" | "planners" | "resources" | "about" | "contact";

export type SearchEntry = {
  title: string;
  description: string;
  href: string;
  category: SearchCategory;
  icon: string;
  keywords?: string;
  popular?: boolean;
};

export const SEARCH_CATEGORIES: { key: "all" | SearchCategory; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "globe" },
  { key: "planning", label: "Planning", icon: "dollar" },
  { key: "investing", label: "Investing", icon: "chart" },
  { key: "retirement", label: "Retirement", icon: "sunset" },
  { key: "insurance", label: "Insurance", icon: "shield" },
  { key: "planners", label: "Planners", icon: "users" },
  { key: "resources", label: "Resources", icon: "book" },
  { key: "contact", label: "Contact", icon: "phone" },
];

export const STATIC_INDEX: SearchEntry[] = [
  // Planning
  { title: "Financial Planning", description: "The Three Phases of Wealth process for your whole financial life", href: "/financial-planning", category: "planning", icon: "dollar", keywords: "plan budget fiduciary cfp", popular: true },
  { title: "Estate Planning", description: "Will and trust based plans, powers of attorney and pricing", href: "/estate-planning", category: "planning", icon: "map", keywords: "trust will living trust power of attorney deed probate", popular: true },
  { title: "Phase I — The Foundation Phase", description: "Budget, insurance, estate plan, debt payoff and emergency fund", href: "/phase-1-2", category: "planning", icon: "layers", keywords: "budget emergency fund debt snowball foundation" },
  { title: "Our Approach", description: "How the Three Phases of Wealth give order to your goals", href: "/our-approach", category: "planning", icon: "compass", keywords: "three phases wealth process" },
  { title: "Tax Planning", description: "Tax-efficient strategies that keep more of what you earn", href: "/contact?topic=tax", category: "planning", icon: "receipt", keywords: "tax loss harvesting roth conversion cpa" },
  { title: "All Solutions", description: "Every service designed for greater financial security", href: "/services", category: "planning", icon: "grid", keywords: "services solutions" },

  // Investing
  { title: "Investment Management", description: "Diversified public and private portfolios managed for you", href: "/investment-management", category: "investing", icon: "chart", keywords: "portfolio wealth management private equity alternatives", popular: true },
  { title: "Impact Investing — Avoid, Amplify & Advance", description: "Aligning investments with your values and the communities you love", href: "/investment-management", category: "investing", icon: "sparkles", keywords: "faith based values esg impact biblical" },
  { title: "Phase II — Accumulating Wealth", description: "Flexible, tax-efficient growth with every dollar given a purpose", href: "/phase-2-2", category: "investing", icon: "trending", keywords: "accumulate grow wealth" },

  // Retirement
  { title: "Phase III — Strategic Income", description: "Turn your wealth into reliable retirement income and legacy", href: "/phase-3-2", category: "retirement", icon: "sunset", keywords: "retirement income bucket strategy qcd social security pension", popular: true },
  { title: "403(b) Plans for Churches", description: "Faith-based retirement plans for pastors and ministry staff", href: "/403b-plan", category: "retirement", icon: "church", keywords: "403b church nonprofit ministry pastor retirement plan", popular: true },
  { title: "Charitable Giving & QCDs", description: "Donor-Advised Funds and Qualified Charitable Distributions", href: "/investment-management", category: "retirement", icon: "heart", keywords: "giving charity donor advised fund qcd tithe legacy" },

  // Insurance
  { title: "Insurance Planning", description: "Tailored, cost-effective coverage that protects your family", href: "/insurance-planning", category: "insurance", icon: "shield", keywords: "life disability umbrella home auto coverage", popular: true },
  { title: "Life & Disability Insurance", description: "Stack policies so you get the coverage you need for less", href: "/insurance-planning", category: "insurance", icon: "heart", keywords: "life insurance disability term stacking" },
  { title: "Medicare guidance", description: "Keri Alcos, CWS®, is a licensed Medicare specialist", href: "/team/keri-alcos", category: "insurance", icon: "user", keywords: "medicare health" },

  // About
  { title: "Mission & Values", description: "Empowering individuals to live their best lives", href: "/mission", category: "about", icon: "award", keywords: "mission core values impact goal bhag faith" },
  { title: "Meet our CEO", description: "Michael Gauthier, CFP®, founder of Strategic Income Group", href: "/team/michael-gauthier", category: "about", icon: "user", keywords: "mike gauthier founder ceo" },
  { title: "Careers", description: "Work that is more than just a job—it’s a calling", href: "/join-our-team", category: "about", icon: "briefcase", keywords: "jobs hiring careers apply internship", popular: true },
  { title: "Events", description: "Roundtables, workshops and community service events", href: "/events", category: "about", icon: "calendar", keywords: "event rsvp seminar workshop food packing" },

  // Resources
  { title: "SIGCares — Feed My Starving Children", description: "Meals packed, kids fed and countries reached by SIG volunteers", href: "/sigcares", category: "resources", icon: "heart", keywords: "fmsc feed my starving children meals volunteer impact giving charity packing sigcares community", popular: true },
  { title: "Resources & Strategic Insights", description: "Monthly market commentary and planning articles", href: "/resources", category: "resources", icon: "book", keywords: "blog articles newsletter insights", popular: true },
  { title: "Privacy Policy", description: "How we collect, use and protect your information", href: "/privacy-policy", category: "resources", icon: "file", keywords: "privacy legal" },
  { title: "Terms of Service", description: "Terms that govern our website and services", href: "/terms-of-service", category: "resources", icon: "file", keywords: "terms legal sms" },
  { title: "Communication Policy", description: "Phone, SMS and email consent and opt-out", href: "/communication-policy", category: "resources", icon: "file", keywords: "sms opt out stop communication" },

  // Contact
  { title: "Schedule Online", description: "Book a consultation with a CFP® professional", href: "/book", category: "contact", icon: "calendar", keywords: "book appointment schedule meeting consultation", popular: true },
  { title: "Contact Us", description: "Call (480) 466-7070 or send us a message", href: "/contact", category: "contact", icon: "phone", keywords: "contact phone email message office" },
  { title: "Get Started", description: "Talk to an expert planner today", href: "/get-started", category: "contact", icon: "rocket", keywords: "start new client free consultation" },
  { title: "East Valley Office — Chandler", description: "2330 W Ray Rd. #3, Chandler, AZ 85224", href: "/contact", category: "contact", icon: "pin", keywords: "chandler east valley office directions address" },
  { title: "West Valley Office — Peoria", description: "20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382", href: "/contact", category: "contact", icon: "pin", keywords: "peoria west valley office directions address" },
  { title: "Client & Employee Login", description: "Sign in to your Strategic Income Group account", href: "/login", category: "contact", icon: "lock", keywords: "login sign in portal account" },

  // Planners & team
  ...TEAM.map<SearchEntry>((m) => ({
    title: `${m.name}${m.credentials ? `, ${m.credentials}` : ""}`,
    description: `${m.title}${m.office ? ` · ${m.office}` : ""}`,
    href: `/team/${m.slug}`,
    category: "planners",
    icon: m.group === "planner" ? "users" : "user",
    keywords: `${m.group === "planner" ? "planner advisor cfp schedule" : "team staff"} ${m.history.join(" ").slice(0, 300)}`,
    popular: m.group === "planner",
  })),
  { title: "Our Team", description: "Meet our financial planners and administrative team", href: "/team", category: "planners", icon: "users", keywords: "team planners advisors staff" },

  // Careers
  ...JOBS.map<SearchEntry>((j) => ({
    title: j.title,
    description: `Careers · ${j.type}`,
    href: `/join-our-team/${j.slug}`,
    category: "about",
    icon: "briefcase",
    keywords: "job career hiring apply",
  })),
];

/** Simple ranked match: title hits beat description/keyword hits; every term must match somewhere. */
export function searchEntries(entries: SearchEntry[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries
    .map((e) => {
      const title = e.title.toLowerCase();
      const rest = `${e.description} ${e.keywords ?? ""}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (title.startsWith(t)) score += 6;
        else if (title.includes(t)) score += 4;
        else if (rest.includes(t)) score += 1;
        else return null;
      }
      return { e, score };
    })
    .filter((x): x is { e: SearchEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}
