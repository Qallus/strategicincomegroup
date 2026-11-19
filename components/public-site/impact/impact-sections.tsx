import Link from "next/link";
import { ArrowRight, Flag, Globe2, HeartHandshake, Package, Users } from "lucide-react";
import { CountUp } from "@/components/public-site/impact/impact-charts";
import type { FmscImpact } from "@/lib/impact/fmsc";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("en-US");
const compact = (v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}K`);

/** Headline numbers. `tone="navy"` for dark bands, default for page surfaces. */
export function ImpactCounters({ impact, tone = "default" }: { impact: FmscImpact; tone?: "default" | "navy" }) {
  const t = impact.totals;
  const tiles = [
    { icon: Package, value: t.meals, label: "meals packed" },
    { icon: HeartHandshake, value: t.kids, label: "kids fed for a year" },
    { icon: Users, value: t.packings, label: "SIG packing events" },
    { icon: Flag, value: t.countries, label: "countries reached" },
  ];
  const navy = tone === "navy";
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((s) => (
        <div key={s.label} className={cn("rounded-2xl border p-5", navy ? "border-white/10 bg-white/[0.05]" : "bg-card")}>
          <s.icon className={cn("h-5 w-5", navy ? "text-brand-gold" : "text-gold")} aria-hidden />
          <dd className="mt-3 font-serif text-4xl leading-none sm:text-5xl">
            <CountUp value={s.value} />
          </dd>
          <dt className={cn("mt-2 text-sm", navy ? "text-white/70" : "text-muted-foreground")}>{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * The journey, not a target: milestones past 100K toward 1M meals on a linear
 * scale (honest distances), with a "you are here" marker.
 */
export function MilestoneTrail({ impact, tone = "default" }: { impact: FmscImpact; tone?: "default" | "navy" }) {
  const meals = impact.totals.meals;
  const end = impact.milestones[impact.milestones.length - 1]?.value ?? 1_000_000;
  const pct = Math.min(100, (meals / end) * 100);
  const navy = tone === "navy";
  const toGo = impact.nextMilestone - meals;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className={navy ? "text-white/80" : "text-foreground"}>
          <span className="font-semibold">{n(meals)} meals</span> and counting
        </p>
        <p className={navy ? "text-white/60" : "text-muted-foreground"}>
          Next milestone: <span className={cn("font-semibold", navy ? "text-brand-gold" : "text-gold")}>{n(impact.nextMilestone)}</span> · {n(toGo)} to go
        </p>
      </div>
      <div className="relative mt-4 pb-8">
        <div className={cn("h-3 overflow-hidden rounded-full", navy ? "bg-white/10" : "bg-muted")}>
          <div className={cn("h-full rounded-full", navy ? "bg-brand-gold" : "bg-primary")} style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
        <div
          className={cn("absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-[3px]", navy ? "border-[hsl(225_95%_15%)] bg-brand-gold dark:border-[hsl(228_60%_5%)]" : "border-background bg-primary")}
          style={{ left: `${Math.max(pct, 1.5)}%` }}
          aria-hidden
        />
        {impact.milestones.map((m) => {
          const left = (m.value / end) * 100;
          return (
            <div key={m.value} className="absolute top-5 -translate-x-1/2 text-center" style={{ left: `${left}%` }}>
              <span className={cn("mx-auto block h-2 w-px", navy ? "bg-white/30" : "bg-border")} aria-hidden />
              <span className={cn("block whitespace-nowrap text-[11px] font-medium", m.value === end ? "-translate-x-1/3" : "", m.reached ? (navy ? "text-brand-gold" : "text-gold") : navy ? "text-white/50" : "text-muted-foreground")}>
                {compact(m.value)}
              </span>
            </div>
          );
        })}
      </div>
      <p className={cn("sr-only")}>
        {n(meals)} meals packed so far. Milestones: {impact.milestones.map((m) => `${n(m.value)}${m.reached ? " (reached)" : ""}`).join(", ")}.
      </p>
    </div>
  );
}

export function DestinationCards({ impact }: { impact: FmscImpact }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {impact.countries.map((c) => (
        <li key={c.name} className="rounded-xl border bg-card p-4">
          {/* Icon badge, not flag emoji: Windows has no flag glyphs and shows letter pairs instead. */}
          <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-gold" aria-hidden>
            <Globe2 className="h-5 w-5" />
          </span>
          <p className="mt-3 font-serif text-xl leading-tight">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.region}</p>
          <p className="mt-2 text-sm">
            {c.packings} {c.packings === 1 ? "packing" : "packings"}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Compact band for /events and other pages. */
export function ImpactBand({ impact }: { impact: FmscImpact }) {
  return (
    <section className="sig-on-navy relative overflow-hidden rounded-2xl bg-[hsl(225_95%_15%)] p-6 text-white dark:border dark:bg-[hsl(228_60%_5%)] sm:p-8">
      <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">SIGCares × Feed My Starving Children</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">Together, we’ve fed {n(impact.totals.kids)} kids for a year.</h2>
          </div>
          <Link href="/sigcares" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-gold hover:underline">
            See our impact <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6">
          <ImpactCounters impact={impact} tone="navy" />
        </div>
        <div className="mt-6">
          <MilestoneTrail impact={impact} tone="navy" />
        </div>
      </div>
    </section>
  );
}
