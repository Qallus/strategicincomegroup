import { loadPublicEvents } from "@/lib/booking/data";
import { getLiveJobs } from "@/lib/careers/server";
import { hasJobDetail, jobPath } from "@/lib/careers/shared";
import { getAllPosts } from "@/lib/public-site/posts";
import { abs, STATIC_PAGES } from "@/lib/public-site/seo";
import { CONTACT, OFFICES, SOLUTIONS } from "@/lib/public-site/site-data";
import { getPublishedTeam } from "@/lib/team/data";

// /llms.txt — a plain-markdown summary of SIG for AI assistants (llmstxt.org format):
// who SIG is, what it offers, the key pages and how to get in touch.

export const revalidate = 3600;

async function soft<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const line = (title: string, url: string, note?: string) => `- [${title}](${url})${note ? `: ${note}` : ""}`;
const az = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export async function GET() {
  const [posts, events, jobs, team] = await Promise.all([
    soft(getAllPosts, []),
    soft(loadPublicEvents, []),
    soft(getLiveJobs, []),
    soft(getPublishedTeam, []),
  ]);

  const key = (path: string) => STATIC_PAGES.find((p) => p.path === path);
  const pages = ["/", "/services", "/our-approach", "/team", "/resources", "/events", "/book", "/contact", "/get-started", "/join-our-team", "/sigcares"]
    .map(key)
    .filter(Boolean) as typeof STATIC_PAGES;

  const out: string[] = [
    "# Strategic Income Group",
    "",
    "> Strategic Income Group (SIG) is a financial planning firm in Arizona, with offices in Chandler (East Valley) and Peoria (West Valley). CERTIFIED FINANCIAL PLANNER™ professionals help individuals, families, retirees, business owners and churches with financial planning, investment management, estate planning, insurance planning, tax planning and 403(b) retirement plans, organised around SIG's Three Phases of Wealth: Foundation, Accumulating Wealth and Strategic Income.",
    "",
    "SIG is a faith-informed firm whose mission is to empower people to live their best lives and change their relationship with money. Information on this site is educational and is not individual investment, tax or legal advice; speak with a SIG planner about your situation.",
    "",
    "## Contact",
    "",
    `- Phone: ${CONTACT.phone} (${CONTACT.hours}, Arizona time)`,
    `- Email: ${CONTACT.email}`,
    ...OFFICES.map((o) => `- ${o.name}: ${o.street}, ${o.locality}`),
    `- Book a consultation online: ${abs("/book")}`,
    "",
    "## Services",
    "",
    ...SOLUTIONS.map((s) => line(s.title, abs(s.href), s.summary)),
    "",
    "## Key pages",
    "",
    ...pages.map((p) => line(p.title, abs(p.path), p.description)),
    "",
    "## The Three Phases of Wealth",
    "",
    ...["/phase-1-2", "/phase-2-2", "/phase-3-2"].map(key).filter(Boolean).map((p) => line(p!.title, abs(p!.path), p!.description)),
  ];

  const planners = team.filter((m) => m.group === "planner" || m.group === "leadership");
  if (planners.length) {
    out.push("", "## Planners and leadership", "", ...planners.map((m) => line(`${m.name}${m.credentials ? `, ${m.credentials}` : ""}`, abs(`/team/${m.slug}`), m.title)));
  }

  if (events.length) {
    out.push("", "## Upcoming events", "", ...events.slice(0, 15).map((e) => line(e.title, abs(`/events/${e.slug}`), `${az(e.start_at)}${e.summary ? ` — ${e.summary}` : ""}`)));
  }

  if (posts.length) {
    out.push("", "## Recent articles", "", ...posts.slice(0, 20).map((p) => line(p.title, abs(`/resources/${p.slug}`), p.excerpt.replace(/\s+/g, " ").slice(0, 180))));
  }

  const openJobs = jobs.filter(hasJobDetail);
  if (openJobs.length) {
    out.push("", "## Careers", "", ...openJobs.map((j) => line(j.title, abs(jobPath(j.slug)), j.summary.replace(/\s+/g, " ").slice(0, 160))));
  }

  out.push(
    "",
    "## Optional",
    "",
    line("Sitemap", abs("/sitemap.xml")),
    line("Privacy Policy", abs("/privacy-policy")),
    line("Terms of Service", abs("/terms-of-service")),
    line("Form ADV Part 2A", CONTACT.adv),
    line("Form CRS", CONTACT.crsPdf),
    "",
  );

  return new Response(out.join("\n"), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
