"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { Packing } from "@/lib/impact/fmsc";
import { cn } from "@/lib/utils";

// Charts follow the dataviz skill: categorical slots in fixed order (one color per
// packing, oldest first, so a packing keeps its color as new ones are added),
// legend always present, direct labels, hover/focus tooltips and a table view.
// Light-mode aqua/yellow are under 3:1 on white, so every mark is also labeled.

const SLOTS = 8;
const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Phoenix", month: "short", year: "numeric" });
const long = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Phoenix", month: "long", day: "numeric", year: "numeric" });
const n = (v: number) => v.toLocaleString("en-US");

/** Color per packing by chronological position; beyond 8 packings the oldest fold into "Earlier". */
function colorFor(recorded: Packing[], slug: string) {
  const i = recorded.findIndex((p) => p.slug === slug);
  const fold = Math.max(0, recorded.length - (SLOTS - 1));
  if (recorded.length > SLOTS && i < fold) return "var(--series-other)";
  const slot = recorded.length > SLOTS ? i - fold + 2 : i + 1;
  return `var(--series-${slot})`;
}

// ── Count-up number (respects reduced motion) ────────────────────────────────
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / 1200);
          setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span ref={ref} className={className} aria-label={n(value)}>
      {n(shown)}
    </span>
  );
}

// ── Kids fed grid: one figure per child fed for a year ───────────────────────
function Kid({ color, dim }: { color: string; dim: boolean }) {
  return (
    <svg viewBox="0 0 10 14" className={cn("h-[18px] w-[13px] transition-opacity sm:h-5 sm:w-[14px]", dim && "opacity-20")} aria-hidden>
      <circle cx="5" cy="3" r="2.6" fill={color} />
      <path d="M1.2 13.2V9.4a3.8 3.8 0 0 1 7.6 0v3.8a.8.8 0 0 1-.8.8H2a.8.8 0 0 1-.8-.8Z" fill={color} />
    </svg>
  );
}

export function KidsFedGrid({ recorded, compact = false }: { recorded: Packing[]; compact?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const total = recorded.reduce((s, p) => s + p.kids, 0);
  const activePacking = recorded.find((p) => p.slug === active) ?? null;

  return (
    <figure className="sig-viz">
      <div className="relative">
        <div
          role="img"
          aria-label={`${n(total)} figures, one for each child fed for a year: ${recorded.map((p) => `${short(p.date)} ${p.kids}`).join(", ")}.`}
          className={cn("flex flex-wrap gap-x-[3px] gap-y-1", compact && "max-h-[220px] overflow-hidden")}
        >
          {recorded.flatMap((p) =>
            Array.from({ length: p.kids }, (_, i) => (
              <span
                key={`${p.slug}-${i}`}
                onMouseEnter={() => setActive(p.slug)}
                onMouseLeave={() => setActive(null)}
                className="cursor-default p-px"
              >
                <Kid color={colorFor(recorded, p.slug)} dim={active !== null && active !== p.slug} />
              </span>
            )),
          )}
        </div>
        {activePacking ? (
          <div role="status" className="pointer-events-none absolute right-0 top-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-foreground">{long(activePacking.date)}</p>
            <p className="text-muted-foreground">
              {activePacking.kids} kids fed for a year · {n(activePacking.meals ?? 0)} meals
            </p>
            {activePacking.countries.length ? <p className="text-muted-foreground">To {activePacking.countries.join(" & ")}</p> : null}
          </div>
        ) : null}
      </div>
      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {recorded.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onMouseEnter={() => setActive(p.slug)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.slug)}
                onBlur={() => setActive(null)}
                className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: colorFor(recorded, p.slug) }} aria-hidden />
                <span className="text-foreground">{short(p.date)}</span>
                <span className="text-muted-foreground">{p.kids} kids</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Each figure is one child fed for a year (meals ÷ 365).</p>
      </figcaption>
    </figure>
  );
}

// ── Meals per packing: horizontal bars, one hue per packing ──────────────────
export function MealsByPacking({ packings, recorded, rsvpHref }: { packings: Packing[]; recorded: Packing[]; rsvpHref?: string | null }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...recorded.map((p) => p.meals ?? 0), 1);

  return (
    <figure className="sig-viz">
      <ul className="space-y-3">
        {packings.map((p) => {
          const pct = p.meals ? (p.meals / max) * 100 : 0;
          const tip = active === p.slug;
          return (
            <li key={p.slug} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
              <span className="text-right text-xs text-muted-foreground sm:text-sm">{short(p.date)}</span>
              {p.upcoming ? (
                <div className="flex h-10 items-center rounded-[4px] border-2 border-dashed border-primary/40 px-3 text-xs sm:text-sm">
                  <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-gold" />
                  <span className="min-w-0 truncate text-foreground"><span className="sm:hidden">Next: {short(p.date)}</span><span className="hidden sm:inline">{long(p.date)} — your RSVP adds the next bar</span></span>
                  {rsvpHref ? (
                    <Link href={rsvpHref} className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 font-semibold text-primary hover:underline">
                      RSVP <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div
                  className="relative flex h-10 min-w-0 items-center"
                  onMouseEnter={() => setActive(p.slug)}
                  onMouseLeave={() => setActive(null)}
                  tabIndex={0}
                  onFocus={() => setActive(p.slug)}
                  onBlur={() => setActive(null)}
                  aria-label={`${long(p.date)}: ${n(p.meals ?? 0)} meals, ${p.kids} kids fed for a year${p.countries.length ? `, to ${p.countries.join(" and ")}` : ""}`}
                >
                  <div className="h-full rounded-r-[4px] transition-opacity" style={{ width: `${pct}%`, background: colorFor(recorded, p.slug), opacity: active && !tip ? 0.35 : 1 }} />
                  <span className="ml-2 shrink-0 whitespace-nowrap text-xs font-medium text-foreground sm:text-sm">
                    {n(p.meals ?? 0)}
                    <span className="hidden font-normal text-muted-foreground sm:inline"> · {p.countries.join(" & ")}</span>
                  </span>
                  {tip ? (
                    <div role="status" className="pointer-events-none absolute -top-14 left-0 z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold">{long(p.date)}</p>
                      <p className="text-muted-foreground">
                        {n(p.meals ?? 0)} meals · {p.kids} kids fed for a year{p.participants ? ` · ${p.participants} volunteers` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 text-xs text-muted-foreground">Meals packed at each SIG packing with Feed My Starving Children, Tempe.</figcaption>
    </figure>
  );
}

/** Accessible table view of every packing (relief for the color-only reading). */
export function PackingTable({ recorded }: { recorded: Packing[] }) {
  const totalMeals = recorded.reduce((s, p) => s + (p.meals ?? 0), 0);
  const totalKids = recorded.reduce((s, p) => s + p.kids, 0);
  return (
    <details className="group mt-6 rounded-xl border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">View as table</summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Packing date</th>
              <th className="px-4 py-2 text-right font-medium">Volunteers</th>
              <th className="px-4 py-2 text-right font-medium">Meals packed</th>
              <th className="px-4 py-2 text-right font-medium">Kids fed for 1 year</th>
              <th className="px-4 py-2 font-medium">Where the meals went</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recorded.map((p) => (
              <tr key={p.slug}>
                <td className="px-4 py-2">{long(p.date)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.participants ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{n(p.meals ?? 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.kids}</td>
                <td className="px-4 py-2">{p.countries.join(" & ") || "—"}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2" />
              <td className="px-4 py-2 text-right tabular-nums">{n(totalMeals)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{totalKids}</td>
              <td className="px-4 py-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}
