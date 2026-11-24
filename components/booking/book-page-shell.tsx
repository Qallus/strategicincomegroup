import Link from "next/link";
import { CalendarDays, ChevronRight, Globe, Lock, Phone, Users } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";

// Server-rendered frame around the booking flow: compact header (breadcrumb, eyebrow, title,
// Arizona-time chip) and the help + privacy lines underneath. Shared by /book and /book/[slug].

export function BookPageShell({ title, subtitle, breadcrumb, children }: {
  title: string;
  subtitle: string;
  breadcrumb: { label: string; href?: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-t bg-muted/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-gold/[0.07] to-transparent" aria-hidden />
      <Container className="relative max-w-6xl py-6 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3" aria-hidden />
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground hover:underline">{b.label}</Link>
              ) : (
                <span aria-current="page" className="text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Schedule online</p>
            <h1 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl md:text-[2.75rem]">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>
          </div>
          <p className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm sm:self-auto">
            <Globe className="h-3.5 w-3.5 text-gold" aria-hidden /> Arizona time · MST
          </p>
        </header>

        {children}

        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-muted-foreground">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <span>
              <span className="block font-semibold text-foreground">Not sure who to meet with?</span>
              Tell us a little about what you need and we’ll match you with the right planner.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/contact" className="inline-flex h-10 items-center rounded-md border bg-background px-4 text-sm font-semibold hover:bg-muted">
              Send a message
            </Link>
            <a href={CONTACT.phoneHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Phone className="h-4 w-4" aria-hidden /> {CONTACT.phone}
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> Your details go only to your planner and the Strategic Income Group team.
          </p>
          <Link href="/book/manage" className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline">
            <CalendarDays className="h-3.5 w-3.5 text-gold" aria-hidden /> Already booked? Manage your appointments
          </Link>
        </div>
      </Container>
    </div>
  );
}
