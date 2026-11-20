import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight, MapPin, Phone } from "lucide-react";
import { getPlanners } from "@/lib/team/data";
import { CONTACT, PHASES } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

// Server-rendered building blocks shared by the public pages.

export const CONTAINER = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(CONTAINER, className)}>{children}</div>;
}

type Action = { label: string; href: string; variant?: "primary" | "outline" | "gold" | "light" };

export function ButtonLink({ label, href, variant = "primary", className }: Action & { className?: string }) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  const cls = cn(
    "group inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition",
    variant === "primary" && "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
    variant === "outline" && "border border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted",
    variant === "gold" && "bg-brand-gold text-[hsl(225_80%_10%)] shadow-lg shadow-brand-gold/20 hover:brightness-110",
    variant === "light" && "border border-white/25 text-white hover:bg-white/10",
    className,
  );
  const inner = (
    <>
      {label}
      {variant === "primary" || variant === "gold" ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
    </>
  );
  return external ? (
    <a href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold", className)}>
      <span aria-hidden className="h-px w-8 bg-current opacity-70" />
      {children}
    </p>
  );
}

/**
 * Page hero. `tone="navy"` is the brand band from the live site (navy in light
 * mode, near-black in dark mode); `tone="plain"` sits on the page background.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  description,
  actions,
  breadcrumb,
  aside,
  tone = "navy",
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Word(s) of the title rendered in gold italic. */
  accent?: string;
  description?: React.ReactNode;
  actions?: Action[];
  breadcrumb?: { label: string; href?: string }[];
  aside?: React.ReactNode;
  tone?: "navy" | "plain";
  children?: React.ReactNode;
}) {
  const navy = tone === "navy";
  const parts = accent && title.includes(accent) ? title.split(accent) : [title];
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        navy ? "sig-on-navy bg-[hsl(225_95%_15%)] text-white dark:bg-[hsl(228_60%_5%)]" : "border-b bg-muted/40",
      )}
    >
      {navy ? (
        <>
          <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[hsl(219_68%_54%/0.18)] blur-3xl" aria-hidden />
        </>
      ) : null}
      <div className={cn(CONTAINER, "relative grid gap-10 py-16 md:py-20", aside ? "lg:grid-cols-[1.25fr_1fr] lg:items-center" : "")}>
        <div className="max-w-3xl">
          {breadcrumb?.length ? (
            <nav aria-label="Breadcrumb" className={cn("mb-6 flex flex-wrap items-center gap-1 text-xs", navy ? "text-white/60" : "text-muted-foreground")}>
              <Link href="/" className="hover:underline">Home</Link>
              {breadcrumb.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  {b.href ? <Link href={b.href} className="hover:underline">{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                </span>
              ))}
            </nav>
          ) : null}
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="mt-5 text-balance font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {parts.length > 1 ? (
              <>
                {parts[0]}
                <em className="text-gold">{accent}</em>
                {parts[1]}
              </>
            ) : (
              title
            )}
          </h1>
          {description ? (
            <div className={cn("mt-6 max-w-2xl text-lg leading-relaxed", navy ? "text-white/75" : "text-muted-foreground")}>{description}</div>
          ) : null}
          {actions?.length ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {actions.map((a, i) => (
                <ButtonLink key={a.href + a.label} {...a} variant={a.variant ?? (navy ? (i === 0 ? "gold" : "light") : i === 0 ? "primary" : "outline")} />
              ))}
            </div>
          ) : null}
          {children}
        </div>
        {aside ? <div className="relative">{aside}</div> : null}
      </div>
    </section>
  );
}

export function Section({
  id,
  className,
  tone = "default",
  children,
}: {
  id?: string;
  className?: string;
  tone?: "default" | "muted" | "navy";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-16 md:py-24",
        tone === "muted" && "border-y bg-muted/40",
        tone === "navy" && "sig-on-navy overflow-hidden bg-[hsl(225_95%_15%)] text-white dark:bg-[hsl(228_60%_5%)]",
        className,
      )}
    >
      {tone === "navy" ? <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden /> : null}
      <div className={cn(CONTAINER, "relative")}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  invert,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  invert?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <Eyebrow className={align === "center" ? "justify-center" : undefined}>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-4 text-balance font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {description ? (
        <div className={cn("mt-4 text-base leading-relaxed sm:text-lg", invert ? "text-white/70" : "text-muted-foreground")}>{description}</div>
      ) : null}
    </div>
  );
}

export function CheckList({ items, className, columns = 1 }: { items: readonly string[]; className?: string; columns?: 1 | 2 }) {
  return (
    <ul className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Schedule Online" — the three planners with booking links, as on the live site. */
export async function PlannerGrid({
  title = "Schedule Online",
  description = "Meet with a Certified Financial Planner or Wealth Advisor—schedule your appointment in just a couple of clicks.",
  eyebrow = "Book a review",
  tone = "muted",
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  tone?: "default" | "muted";
}) {
  const PLANNERS = await getPlanners();
  return (
    <Section tone={tone}>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <ButtonLink label="Meet our entire team" href="/team" variant="outline" />
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLANNERS.map((p) => (
          <article key={p.slug} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
            <Link href={`/team/${p.slug}`} className="block aspect-[4/3] overflow-hidden bg-gradient-to-b from-muted to-background">
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo} alt={p.name} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif text-6xl text-muted-foreground/60">{p.name.charAt(0)}</span>
              )}
            </Link>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl">
                    <Link href={`/team/${p.slug}`} className="hover:underline">{p.name}</Link>
                  </h3>
                  <p className="text-sm text-gold">{p.credentials}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {p.office?.replace(" Office", "")}
                </span>
              </div>
              <div className="mt-5 flex gap-2">
                <Link
                  href={p.booking ?? "/book"}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <CalendarDays className="h-4 w-4" /> Schedule
                </Link>
                <Link href={`/team/${p.slug}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted">
                  Profile
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

/** Closing call-to-action band used at the bottom of most pages. */
export function CtaBand({
  title = "Contact us, we're here Monday through Friday",
  description = "Contact us to schedule a consultation – either in-person or over the phone. Let us put our knowledge, expertise, and services to work for you today!",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="py-16 md:py-20">
      <div className={CONTAINER}>
        <div className="sig-on-navy relative overflow-hidden rounded-2xl bg-[hsl(225_95%_15%)] px-6 py-12 text-white dark:border dark:bg-card sm:px-12">
          <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
              <p className="mt-3 text-white/70 dark:text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink label="Schedule Free Consultation" href="/get-started" variant="gold" />
              <a href={CONTACT.phoneHref} className="inline-flex h-11 items-center gap-2 rounded-md border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10 dark:border-border dark:text-foreground dark:hover:bg-muted">
                <Phone className="h-4 w-4" /> {CONTACT.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The three-phase cards (Foundation / Accumulating Wealth / Strategic Income). */
export function PhaseCards({ current }: { current?: string }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {PHASES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={current === p.href ? "page" : undefined}
          className={cn(
            "group relative flex flex-col rounded-xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
            current === p.href && "border-primary/50 ring-1 ring-primary/30",
          )}
        >
          <span className="font-serif text-5xl text-gold">{p.n}</span>
          <span className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phase {p.n} · {p.short}</span>
          <span className="mt-2 font-serif text-2xl leading-snug">{p.tagline}</span>
          <span className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{p.teaser}</span>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            More Info <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function NumberedSteps({ steps }: { steps: { title: string; body: React.ReactNode; label?: string }[] }) {
  return (
    <ol className="relative space-y-6 border-l pl-8 sm:pl-10">
      {steps.map((s, i) => (
        <li key={s.title} className="relative">
          <span className="absolute -left-[calc(2rem+1px)] flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background font-serif text-base text-gold sm:-left-[calc(2.5rem+1px)]">
            {i + 1}
          </span>
          <div className="rounded-xl border bg-card p-6">
            {s.label ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p> : null}
            <h3 className="mt-1 font-serif text-2xl">{s.title}</h3>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
