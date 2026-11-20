import Link from "next/link";
import { ArrowRight, CalendarCheck, ChevronRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { bookingHref } from "@/lib/public-site/team";
import { CONTACT, OFFICES } from "@/lib/public-site/site-data";
import { getBlogSidebar } from "@/lib/site-notices/server";
import { safeHref, telHref } from "@/lib/site-notices/shared";
import { getPlanners } from "@/lib/team/data";

/** Sticky right rail on /resources/<slug>: planner booking card + the dashboard-managed Blog Sidebar Notification. */
export async function PostSidebar() {
  const [planners, sidebar] = await Promise.all([getPlanners().catch(() => []), getBlogSidebar()]);
  return (
    <div className="space-y-5">
      <PlannerCard planners={planners} />
      {sidebar.enabled ? <NoticeCard content={sidebar.content} /> : null}
    </div>
  );
}

type Planner = Awaited<ReturnType<typeof getPlanners>>[number];

function PlannerCard({ planners }: { planners: Planner[] }) {
  return (
    <section aria-labelledby="sidebar-planners" className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="sig-on-navy relative bg-[hsl(225_45%_12%)] px-5 py-4 text-white dark:bg-[hsl(225_40%_16%)]">
        <div className="sig-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">Your next step</p>
          <h2 id="sidebar-planners" className="mt-1.5 font-serif text-2xl leading-tight">Talk to a planner</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            Questions about this article? A SIG Financial Planner can help apply it to your plan.
          </p>
        </div>
      </div>

      {planners.length ? (
        <ul className="divide-y">
          {planners.map((p) => (
            <li key={p.slug}>
              <Link
                href={p.booking || bookingHref(p.slug)}
                className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full border-2 border-brand-gold/40 object-cover object-top" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-brand-gold/40 bg-muted font-serif text-lg">
                    {p.name.charAt(0)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.credentials, p.office?.replace(" Office", "")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center text-xs font-semibold text-primary">
                  Book <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2.5 border-t bg-muted/30 px-5 py-4">
        <Link
          href="/book"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden /> Schedule a meeting
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          Prefer to call?{" "}
          <a href={CONTACT.phoneHref} className="font-medium text-foreground hover:underline">
            {CONTACT.phone}
          </a>
        </p>
      </div>
    </section>
  );
}

function NoticeCard({ content }: { content: Awaited<ReturnType<typeof getBlogSidebar>>["content"] }) {
  const paragraphs = content.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const tel = telHref(content.phone);
  const cta = safeHref(content.cta_url);
  const external = cta ? /^https?:\/\//i.test(cta) : false;
  return (
    <section aria-labelledby="sidebar-notice" className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
      {content.eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{content.eyebrow}</p> : null}
      <h2 id="sidebar-notice" className="mt-1.5 font-serif text-xl leading-snug">{content.title}</h2>
      {paragraphs.length ? (
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
      ) : null}

      {content.phone || content.email || content.hours ? (
        <ul className="mt-4 space-y-1.5 border-t pt-4 text-sm">
          {content.phone ? (
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              {tel ? <a href={tel} className="font-medium hover:underline">{content.phone}</a> : <span className="font-medium">{content.phone}</span>}
            </li>
          ) : null}
          {content.email ? (
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              <a href={`mailto:${content.email}`} className="min-w-0 break-all font-medium hover:underline">{content.email}</a>
            </li>
          ) : null}
          {content.hours ? (
            <li className="flex items-center gap-2.5 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>{content.hours}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {content.show_offices ? (
        <ul className="mt-4 grid gap-2.5 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
          {OFFICES.map((o) => (
            <li key={o.name} className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>
                <span className="block font-medium leading-tight">
                  {o.name.replace(" Office", "")} <span className="font-normal text-muted-foreground">({o.city})</span>
                </span>
                <a href={o.directions} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                  {o.street}, {o.locality}
                </a>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {cta && content.cta_label ? (
        external ? (
          <a href={cta} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {content.cta_label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <Link href={cta} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {content.cta_label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )
      ) : null}
    </section>
  );
}
