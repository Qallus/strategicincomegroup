"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PILLARS } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

/** The live site's tabbed hero: Strategize · Invest · Give, auto-advancing until the visitor picks one. */
export function HomeHero() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const pillar = PILLARS[active];

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % PILLARS.length), 9000);
    return () => clearInterval(t);
  }, [auto]);

  const [h1, h2, accent, h3] = pillar.heading;

  return (
    <section className="sig-on-navy relative overflow-hidden bg-[hsl(225_95%_15%)] text-white dark:bg-[hsl(228_60%_5%)]">
      <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -right-48 top-0 h-[36rem] w-[36rem] rounded-full bg-[hsl(219_68%_54%/0.22)] blur-3xl" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-center lg:gap-16 lg:px-8">
        <div role="tablist" aria-label="Strategize, Invest, Give" className="order-2 grid gap-3 sm:grid-cols-3 lg:order-1 lg:grid-cols-1">
          {PILLARS.map((p, i) => {
            const on = i === active;
            return (
              <button
                key={p.key}
                role="tab"
                id={`hero-tab-${p.key}`}
                aria-selected={on}
                aria-controls="hero-panel"
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 text-left transition",
                  on
                    ? "border-brand-gold bg-white text-[hsl(225_45%_12%)] shadow-xl shadow-black/20 dark:bg-card dark:text-foreground"
                    : "border-white/15 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    on ? "bg-brand-gold/15 text-[hsl(36_55%_36%)] dark:text-brand-gold" : "bg-white/10 text-brand-gold",
                  )}
                >
                  {p.n}
                </span>
                <span>
                  <span className="block font-serif text-xl leading-tight">{p.title}</span>
                  <span className={cn("block text-xs", on ? "text-muted-foreground" : "text-white/60")}>{p.short}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div id="hero-panel" role="tabpanel" aria-labelledby={`hero-tab-${pillar.key}`} className="order-1 lg:order-2" key={pillar.key}>
          <p className="sig-pop inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">
            <span aria-hidden className="h-px w-10 bg-brand-gold" />
            {pillar.eyebrow}
          </p>
          <h1 className="sig-pop mt-6 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
            {h1}
            <br />
            {h2 ? `${h2} ` : ""}
            <em className="text-brand-gold">{accent}</em> {h3}
          </h1>
          <div className="mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-white/75 sm:text-lg">
            {pillar.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-8 max-w-xl border-l-2 border-brand-gold/70 pl-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-gold">{pillar.title}</p>
            <p className="mt-1.5 text-white/80">{pillar.callout}</p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={pillar.primary.href}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-[hsl(225_80%_10%)] shadow-lg shadow-brand-gold/25 transition hover:brightness-110"
            >
              {pillar.primary.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={pillar.secondary.href}
              className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {pillar.secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
