"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Team hero carousel for the alternative homepage (/home-2).
 * Built from concept t3 (3a desktop / 3b mobile) in docs/Heros: one slide per team
 * member on a "studio band" gradient, copy at left, glassy sample cards at shoulder
 * height, edge arrows and progress-pill dots with a pause control.
 *
 * The studio-band gradients are per-photo art direction, so they stay literal colors;
 * the hero looks the same in light and dark mode.
 */

const SLIDE_MS = 7000;

type Tone = "dark" | "light";

type Slide = {
  key: string;
  /** Short name for the dot label. */
  name: string;
  alt: string;
  image: string;
  /**
   * "cutout" = transparent-background portrait: the back card can tuck behind the person
   * (Stash-style layering). "studio" = photo with its own backdrop, feathered into the band.
   */
  frame: "cutout" | "studio";
  /** Background-free copy of a studio photo, same size, so the person can sit in front of the back card. */
  cutout?: string;
  tone: Tone;
  /** Gradient stops, center → edge. */
  stops: [string, string, string, string];
  /** Desktop ellipse center. */
  at: string;
  /** Color of the "Get Started" label on the white button (dark slides). */
  ink: string;
  headline: string[];
  body: { desktop: string; mobile?: string };
  link: { label: string; mobileLabel?: string; href: string };
  /** back = upper-left card (behind a cutout), front = right card overlapping the person. */
  desktopCards: { back: ReactNode; front: ReactNode };
  mobileCards: { back: ReactNode; front: ReactNode };
};

// ── Hero accent palette ──
// The hero is art-directed (same in light and dark mode), so these are literal colors.
// Gold is the brand gold used in the mega menu (--brand-gold, light); the rest are muted
// companions picked to sit with navy and gold without clashing:
//   gold  = emphasis / "on track" / progress     sage = success / growth
//   sky   = neutral data (info)                  slate = secondary data
const GOLD = "#c9a46c";
const GOLD_SOFT = "#e4cfa3";
const SAGE = "#86b89c";
const SKY = "#8fc3e3";
const SLATE = "#5d6f96";
const INK = "#0d1a3a";

// ── Glass cards (decorative sample UI — every one carries an "Illustrative example" label) ──

function Glass({
  className,
  tone = "dark",
  children,
  style,
  center,
}: {
  className?: string;
  tone?: Tone;
  children: ReactNode;
  style?: CSSProperties;
  center?: boolean;
}) {
  return (
    <div
      style={style}
      className={cn(
        "relative rounded-xl border backdrop-blur-[10px]",
        tone === "light"
          ? "border-white/80 bg-white/50 text-[#0d1a3a] shadow-[0_16px_40px_rgba(0,0,0,.16)]"
          : "border-white/40 bg-white/[0.12] text-white shadow-[0_16px_40px_rgba(0,0,0,.24)]",
        center && "text-center",
        className,
      )}
    >
      {children}
      <Illustrative tone={tone} center={center} />
    </div>
  );
}

function Illustrative({ tone = "dark", center }: { tone?: Tone; center?: boolean }) {
  return (
    <p
      className={cn(
        "mt-2 whitespace-nowrap text-[8px] font-medium uppercase leading-none tracking-[0.1em] lg:text-[9px] lg:tracking-[0.12em]",
        tone === "light" ? "text-[#0d1a3a]/65" : "text-white/65",
        center && "text-center",
      )}
    >
      Illustrative example
    </p>
  );
}

function OnTrackBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full font-semibold uppercase tracking-[0.14em]",
        small ? "-top-[8px] px-2 py-[2px] text-[7px]" : "-top-[9px] px-2.5 py-[3px] text-[8px]",
      )}
      style={{ background: GOLD, color: INK }}
    >
      On track
    </span>
  );
}

/** 1 · 2 · 3 with the middle step in gold, overlapping (and clipping) its neighbours. */
function PhasesCard({ title, note, small, className }: { title: string; note: ReactNode; small?: boolean; className?: string }) {
  const side = small ? "h-7 w-7 text-base" : "h-9 w-9 text-xl";
  const mid = small ? "h-9 w-9 text-[22px]" : "h-12 w-12 text-[28px]";
  return (
    <Glass center className={cn(small ? "px-2.5 pb-2.5 pt-4" : "px-3.5 pb-3 pt-5", className)}>
      <OnTrackBadge small={small} />
      <div className="flex items-center justify-center">
        <span className={cn("relative z-0 flex flex-none items-center justify-center rounded-full border border-white/40 bg-white/10 font-serif text-white/80", side, small ? "-mr-2" : "-mr-2.5")}>
          1
        </span>
        <span
          className={cn("relative z-10 flex flex-none items-center justify-center rounded-full font-serif shadow-[0_4px_14px_rgba(0,0,0,.25)]", mid)}
          style={{ background: GOLD, color: INK }}
        >
          2
        </span>
        <span className={cn("relative z-0 flex flex-none items-center justify-center rounded-full border border-white/25 bg-white/5 font-serif text-white/45", side, small ? "-ml-2" : "-ml-2.5")}>
          3
        </span>
      </div>
      <p className={cn("font-semibold leading-tight", small ? "mt-1.5 text-xs" : "mt-2 text-sm")}>{title}</p>
      <p className={cn("mt-0.5 leading-[1.35] text-white/85", small ? "text-[9px]" : "text-[11px]")}>{note}</p>
    </Glass>
  );
}

function StatCard({ eyebrow, value, note, small, className }: { eyebrow: string; value: string; note: string; small?: boolean; className?: string }) {
  return (
    <Glass className={cn(small ? "rounded-[10px] px-2.5 py-2.5 text-left" : "px-4 py-3", className)}>
      <p className={cn("uppercase tracking-[0.14em] text-white/80", small ? "text-[8px]" : "text-[10px]")}>
        {eyebrow}
      </p>
      <p className={cn("whitespace-nowrap font-serif leading-none", small ? "mb-0.5 mt-1 text-[22px]" : "mb-1 mt-1 text-[28px]")}>{value}</p>
      <p className={cn("leading-[1.35] text-white/85", small ? "text-[9px]" : "text-[11px]")}>{note}</p>
    </Glass>
  );
}

function GoalBarCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass className={cn(small ? "rounded-[10px] px-2.5 py-2.5 text-left" : "px-4 py-3", className)}>
      <p className={cn("whitespace-nowrap", small ? "mb-1.5 text-xs" : "mb-2 text-[15px]")}>
        <strong className="font-semibold">$6,000</strong> <span className="text-white/75">/ $7,500</span>
      </p>
      <div className={cn("overflow-hidden rounded-full bg-white/15", small ? "h-2.5" : "h-3")}>
        <div className="h-full w-[80%] rounded-full" style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
      </div>
    </Glass>
  );
}

function PortfolioCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass tone="light" className={cn(small ? "rounded-[10px] px-2.5 py-2.5 text-left" : "px-4 py-3", className)}>
      <p className={cn("font-medium", small ? "text-[11px]" : "text-[13px]")}>Managed portfolio</p>
      <p className={cn("whitespace-nowrap font-serif leading-none", small ? "mb-1 mt-0.5 text-[22px]" : "mb-1.5 mt-1 text-[28px]")}>$102.5k</p>
      <svg viewBox="0 0 200 44" width="100%" height={small ? 22 : 30} fill="none" stroke={SLATE} strokeWidth={small ? 3 : 2.5} strokeLinecap="round" aria-hidden>
        <path d="M0 40 C 30 36, 50 30, 80 28 S 130 20, 160 12 S 190 6, 200 4" />
      </svg>
    </Glass>
  );
}

function RetirementCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass tone="light" className={cn(small ? "px-2.5 py-2.5 text-left" : "px-3.5 py-3", className)}>
      <div className={cn("flex items-center", small ? "gap-2" : "gap-3")}>
        <span
          className={cn("flex flex-none items-center justify-center rounded-full", small ? "h-8 w-8 border-[3px]" : "h-10 w-10 border-4")}
          style={{ borderColor: SAGE, borderRightColor: "rgba(134,184,156,.3)" }}
        >
          {small ? null : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f5d46" strokeWidth="2" aria-hidden>
              <path d="M12 22V12M12 12c-4 0-7-3-7-6 3 0 7 2 7 6zm0 0c4 0 7-3 7-6-3 0-7 2-7 6z" />
            </svg>
          )}
        </span>
        <span className="flex flex-col gap-1">
          <span className={cn("font-medium", small ? "text-xs" : "text-sm")}>Retirement</span>
          <span
            className={cn("self-start whitespace-nowrap rounded-full font-semibold uppercase tracking-[0.1em]", small ? "px-1.5 py-[2px] text-[7px]" : "px-2 py-[3px] text-[9px]")}
            style={{ background: GOLD, color: INK }}
          >
            On track
          </span>
        </span>
      </div>
    </Glass>
  );
}

function GoalsCard({ small, className }: { small?: boolean; className?: string }) {
  const rows = [
    { label: "Retirement", value: "$307K / $1M", width: "42%", color: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` },
    { label: "Home", value: "$5.3K / $50K", width: "18%", color: SAGE },
  ];
  return (
    <Glass className={cn(small ? "rounded-[10px] px-2.5 py-2.5 text-left" : "px-4 py-3", className)}>
      <p className={cn("font-semibold", small ? "mb-1.5 text-[11px]" : "mb-2 text-[13px]")}>Your goals</p>
      {rows.map((r, i) => (
        <div key={r.label} className={i ? (small ? "mt-1.5" : "mt-2.5") : undefined}>
          <div className={cn("overflow-hidden rounded-full bg-white/15", small ? "h-2" : "h-2.5")}>
            <div className="h-full rounded-full" style={{ width: r.width, background: r.color }} />
          </div>
          <div className={cn("mt-1 flex justify-between gap-3", small ? "text-[9px]" : "text-[11px]")}>
            <span className="whitespace-nowrap">{r.label}</span>
            <span className="whitespace-nowrap text-white/80">{r.value}</span>
          </div>
        </div>
      ))}
    </Glass>
  );
}

/** Allocation legend sits directly above the ring (no chips floating over the chart). */
function StrategyCard({ className }: { className?: string }) {
  const slices = [
    { label: "US stocks", pct: 48, color: SKY },
    { label: "Bonds", pct: 22, color: SAGE },
    { label: "International", pct: 18, color: SLATE },
    { label: "Up & coming", pct: 12, color: GOLD },
  ];
  let acc = 0;
  const stops = slices
    .map((s) => {
      const from = acc;
      acc += s.pct;
      return `${s.color} ${from}% ${acc - 0.6}%, transparent ${acc - 0.6}% ${acc}%`;
    })
    .join(",");
  const ring: CSSProperties = {
    background: `conic-gradient(from 0deg, ${stops})`,
    mask: "radial-gradient(circle, transparent 27px, black 28px)",
    WebkitMask: "radial-gradient(circle, transparent 27px, black 28px)",
  };
  return (
    <Glass className={cn("px-4 py-3", className)}>
      <p className="text-[13px] font-semibold">Your strategy</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 whitespace-nowrap text-[10px]">
            <i className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: s.color }} />
            {s.label} <span className="text-white/65">{s.pct}%</span>
          </li>
        ))}
      </ul>
      <div className="relative mx-auto mt-2.5 h-[76px] w-[76px]">
        <div className="absolute inset-0 rounded-full" style={ring} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-[1.1]">
          <span className="text-[7px] font-semibold tracking-[0.12em] text-white/75">BALANCED</span>
          <span className="text-xs font-semibold">Moderate</span>
        </div>
      </div>
    </Glass>
  );
}

// ── Slides (copy from concept t3; names/titles from the team roster) ──
//
// Card recipe (same on every slide, "less is more"): two compact cards hugging the person.
//   back  = tucked behind the person, who clips a corner of it (upper left at the shoulder)
//   front = on top, overlapping the person's other side
// The back card sits between the studio photo and a background-free copy of the same
// photo (`cutout`), so the person appears in front of it while the backdrop stays behind.

const LEFT_CARD = "absolute hidden xl:block";
const RIGHT_CARD = "absolute";
// Default desktop positions for the standing studio portraits (subject spans ~59–77% of the stage).
const BACK_AT = "left-[47.6%] top-[250px] w-[184px]";
const FRONT_AT = "right-[9.5%] top-[392px] w-[196px]";

const SLIDES: Slide[] = [
  {
    key: "mike",
    name: "Mike",
    alt: "Mike Gauthier, CFP®, Founder and CEO of Strategic Income Group, seated in an office chair",
    image: "/team/hero/mike-gauthier-chair.webp",
    frame: "cutout",
    tone: "dark",
    stops: ["#2b418f", "#1a2a66", "#0e1a48", "#081030"],
    at: "62% 40%",
    ink: "#0e1a48",
    headline: ["Plan with purpose."],
    body: {
      desktop: "We’ll build the plan — from your foundation to your legacy — so you can live every phase of life with clarity and confidence.",
      mobile: "We’ll build the plan — from your foundation to your legacy — so your financial confidence can grow.",
    },
    link: { label: "Why SIG?", mobileLabel: "Learn about our approach", href: "/our-approach" },
    desktopCards: {
      back: <GoalBarCard className={cn(LEFT_CARD, "left-[46%] top-[206px] w-[196px]")} />,
      front: (
        <PhasesCard
          className={cn(RIGHT_CARD, "right-[8%] top-[404px] w-[196px]")}
          title="phases complete"
          note={
            <>
              Foundation set, now accumulating. <em>Great work.</em>
            </>
          }
        />
      ),
    },
    mobileCards: {
      back: <GoalBarCard small className="w-full" />,
      front: <PhasesCard small className="w-full" title="phases complete" note="Foundation set, now accumulating." />,
    },
  },
  {
    key: "bree",
    name: "Bree",
    alt: "Bree Sigler, Client Service Associate at Strategic Income Group, in a studio portrait",
    image: "/team/hero/bree-sigler.webp",
    cutout: "/team/hero/bree-sigler-cutout.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#2f6b45", "#1d4a2f", "#12301f", "#0a2015"],
    at: "62% 40%",
    ink: "#12301f",
    headline: ["Need guidance?", "We can help."],
    body: {
      desktop: "Certified Financial Planners with real Wall Street experience, now at your fingertips. Customized to you.",
      mobile: "Certified Financial Planners with real Wall Street experience, now at your fingertips.",
    },
    link: { label: "Book a review", href: "/book" },
    // Bree's hand is on her hip, so here the strategy card tucks behind her right side
    // (her arm clips its top-left corner) and the goals card overlaps her left shoulder.
    desktopCards: {
      back: <StrategyCard className={cn(RIGHT_CARD, "right-[4.4%] top-[392px] w-[214px]")} />,
      front: <GoalsCard className={cn(LEFT_CARD, "left-[47%] top-[214px] w-[200px]")} />,
    },
    mobileCards: {
      back: <GoalBarCard small className="w-full" />,
      front: <GoalsCard small className="w-full" />,
    },
  },
  {
    key: "chad",
    name: "Chad",
    alt: "Chad Manberg, CFP®, Certified Financial Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/chad-manberg.webp",
    cutout: "/team/hero/chad-manberg-cutout.webp",
    frame: "studio",
    tone: "light",
    stops: ["#dfe1e5", "#c3c6cd", "#aeb2ba", "#9a9ea8"],
    at: "40% 40%",
    ink: "#ffffff",
    headline: ["Invest with clarity."],
    body: {
      desktop: "Portfolios aligned to your plan, your income needs and your risk tolerance — managed for you, reviewed with you.",
      mobile: "Portfolios aligned to your plan, your income needs and your risk tolerance — managed for you.",
    },
    link: { label: "Investment management", href: "/investment-management" },
    desktopCards: {
      back: <PortfolioCard className={cn(LEFT_CARD, BACK_AT)} />,
      front: <RetirementCard className={cn(RIGHT_CARD, FRONT_AT)} />,
    },
    mobileCards: {
      back: <PortfolioCard small className="w-full" />,
      front: <RetirementCard small className="w-full" />,
    },
  },
  {
    key: "laurie",
    name: "Laurie",
    alt: "Laurie Simons, CFP®, CTFA®, Certified Financial Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/laurie-simons.webp",
    cutout: "/team/hero/laurie-simons-cutout.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#a8824f", "#7f5f34", "#56401f", "#382912"],
    at: "55% 40%",
    ink: "#56401f",
    headline: ["Planning that fits your life."],
    body: { desktop: "Laurie Simons, CFP®, CTFA® — retirement, trust and estate planning with the care of a Certified Financial Planner." },
    link: { label: "Meet Laurie", href: "/team/laurie-simons" },
    desktopCards: {
      back: <StatCard className={cn(LEFT_CARD, BACK_AT)} eyebrow="Trust & estate" value="Updated" note="Estate documents reviewed" />,
      front: <PhasesCard className={cn(RIGHT_CARD, FRONT_AT)} title="plan goals met" note="Your plan, kept current." />,
    },
    mobileCards: {
      back: <StatCard small className="w-full" eyebrow="Trust & estate" value="Updated" note="Estate documents reviewed" />,
      front: <PhasesCard small className="w-full" title="plan goals met" note="Your plan, kept current." />,
    },
  },
  {
    key: "keri",
    name: "Keri",
    alt: "Keri Alcos, CWS®, Wealth Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/keri-alcos.webp",
    cutout: "/team/hero/keri-alcos-cutout.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#3f6f6a", "#2a4f4c", "#1a3533", "#0f2322"],
    at: "55% 40%",
    ink: "#1a3533",
    headline: ["Advice built around you."],
    body: { desktop: "Keri Alcos, CWS®, Wealth Planner — strategy, investments and income planning tailored to your life." },
    link: { label: "Meet Keri", href: "/team/keri-alcos" },
    desktopCards: {
      back: <StatCard className={cn(LEFT_CARD, BACK_AT)} eyebrow="Retirement income" value="$8,450" note="projected monthly · age 65" />,
      front: <PhasesCard className={cn(RIGHT_CARD, FRONT_AT)} title="goals on track" note="Plan reviewed this quarter." />,
    },
    mobileCards: {
      back: <StatCard small className="w-full" eyebrow="Retirement income" value="$8,450" note="projected monthly · age 65" />,
      front: <PhasesCard small className="w-full" title="goals on track" note="Plan reviewed this quarter." />,
    },
  },
  {
    key: "mo",
    name: "Mo",
    alt: "Martha “Mo” Cortez, FPQP®, Senior Client Service Associate at Strategic Income Group, in a studio portrait",
    image: "/team/hero/martha-cortez.webp",
    cutout: "/team/hero/martha-cortez-cutout.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#8a3a52", "#612638", "#3e1724", "#260d15"],
    at: "55% 40%",
    ink: "#3e1724",
    headline: ["A team that knows you."],
    body: { desktop: "Martha “Mo” Cortez, FPQP®, Senior Client Service Associate — scheduling, paperwork and questions answered by a real person." },
    link: { label: "How we serve you", href: "/services" },
    desktopCards: {
      back: <StatCard className={cn(LEFT_CARD, BACK_AT)} eyebrow="Response time" value="Same day" note="reply to client requests" />,
      front: <PhasesCard className={cn(RIGHT_CARD, FRONT_AT)} title="requests handled" note="Nothing slips through." />,
    },
    mobileCards: {
      back: <StatCard small className="w-full" eyebrow="Response time" value="Same day" note="reply to client requests" />,
      front: <PhasesCard small className="w-full" title="requests handled" note="Nothing slips through." />,
    },
  },
  {
    key: "julie",
    name: "Julie",
    alt: "Julie Klodt, Executive Assistant to CEO Michael Gauthier, in a studio portrait",
    image: "/team/hero/julie-klodt.webp",
    cutout: "/team/hero/julie-klodt-cutout.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#6d7350", "#4b5136", "#303522", "#1d2015"],
    at: "55% 40%",
    ink: "#303522",
    headline: ["Your time, well kept."],
    body: { desktop: "Julie Klodt, Executive Assistant to Michael Gauthier, CEO — keeping meetings, follow-ups and introductions on schedule." },
    link: { label: "Schedule with Mike", href: "/book?planner=michael-gauthier" },
    desktopCards: {
      back: <StatCard className={cn(LEFT_CARD, BACK_AT)} eyebrow="Next opening" value="Thu · 2:00" note="with Michael Gauthier, CEO" />,
      front: <PhasesCard className={cn(RIGHT_CARD, FRONT_AT)} title="meetings this week" note="Calendar confirmed." />,
    },
    mobileCards: {
      back: <StatCard small className="w-full" eyebrow="Next opening" value="Thu · 2:00" note="with Michael Gauthier, CEO" />,
      front: <PhasesCard small className="w-full" title="meetings this week" note="Calendar confirmed." />,
    },
  },
];

// Photo feathering. Desktop: wide horizontal fade on both sides so the studio backdrop
// melts into the band with no visible seam. Mobile: fade on all four sides.
const MASK_DESKTOP = "linear-gradient(to right, transparent 0%, rgba(0,0,0,.18) 10%, rgba(0,0,0,.6) 22%, black 36%, black 66%, rgba(0,0,0,.6) 80%, rgba(0,0,0,.18) 91%, transparent 100%)";
// Fades the photo's bottom edge when the band is taller than the photo (lg widths just above 1024px).
const MASK_DESKTOP_Y = "linear-gradient(to bottom, black 72%, transparent 97%)";
const MASK_MOBILE_Y = "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.25) 6%, rgba(0,0,0,.7) 13%, black 20%, black 78%, transparent 100%)";
const MASK_MOBILE_X = "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)";

// Cutout portrait: fade only the bottom (chair base) into the band.
const MASK_CUTOUT_Y = "linear-gradient(to bottom, black 78%, transparent 98%)";
const MASK_CUTOUT_DY = "linear-gradient(to bottom, black 68%, transparent 82%)";

// Photo frames. Studio = feathered portrait with backdrop; solo = background-free portrait
// (Mike) that sits a little lower on mobile and a touch right of center so the back card reads.
const STUDIO_FRAME =
  "absolute left-1/2 top-0 h-full w-[340px] -translate-x-1/2 min-[400px]:w-[360px] sm:w-[420px] lg:left-auto lg:right-[6.25%] lg:top-[-20px] lg:aspect-[667/1000] lg:h-auto lg:w-[52.1%] lg:max-w-[667px] lg:translate-x-0";
const SOLO_FRAME =
  "absolute left-[calc(50%+14px)] top-[52px] h-[calc(100%-52px)] w-[270px] -translate-x-1/2 min-[400px]:w-[285px] sm:left-1/2 sm:w-[330px] lg:left-auto lg:right-[14%] lg:top-[40px] lg:aspect-[466/805] lg:h-[780px] lg:w-auto lg:translate-x-0";
const STUDIO_SIZES = "(min-width: 1280px) 667px, (min-width: 1024px) 52vw, (min-width: 640px) 420px, 360px";
const STUDIO_MASK_Y =
  "[mask-image:var(--hero-mask-y)] [-webkit-mask-image:var(--hero-mask-y)] lg:[mask-image:var(--hero-mask-dy)] lg:[-webkit-mask-image:var(--hero-mask-dy)]";
const STUDIO_MASK_VARS = { "--hero-mask-y": MASK_MOBILE_Y, "--hero-mask-dy": MASK_DESKTOP_Y } as unknown as CSSProperties;

/**
 * Mobile card slot, positioned against a box a little wider than the photo:
 * back = upper left at the shoulder (tucked behind the person), front = right side, lower.
 */
function MobileCard({ slot, solo, children }: { slot: "back" | "front"; solo: boolean; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[calc(100%-8px)] max-w-[400px] -translate-x-1/2 lg:hidden" aria-hidden>
      <div
        className={cn(
          "absolute",
          slot === "back"
            ? cn("left-0", solo ? "top-[16%] w-[140px] sm:w-[160px]" : "top-[30%] w-[126px] sm:w-[150px]")
            : cn("right-0 w-[150px] sm:w-[170px]", solo ? "top-[50%]" : "top-[54%]"),
        )}
      >
        {children}
      </div>
    </div>
  );
}

function gradient(s: Slide, mobile: boolean) {
  const [a, b, c, d] = s.stops;
  if (s.tone === "light") {
    return mobile
      ? `radial-gradient(ellipse 90% 60% at 50% 30%, ${a} 0%, ${b} 45%, ${d} 100%)`
      : `radial-gradient(ellipse 80% 90% at ${s.at}, ${a} 0%, ${b} 50%, ${d} 100%)`;
  }
  return mobile
    ? `radial-gradient(ellipse 90% 60% at 50% 30%, ${a} 0%, ${b} 45%, ${c} 80%, ${d} 100%)`
    : `radial-gradient(ellipse 70% 80% at ${s.at}, ${a} 0%, ${b} 40%, ${c} 75%, ${d} 100%)`;
}

export function HomeHeroCarousel() {
  const [active, setActive] = useState(0);
  // null = the default (autoplay unless the visitor prefers reduced motion); a boolean once they choose.
  const [auto, setAuto] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Only mount photos for slides that have been (or are about to be) shown.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));
  const touchX = useRef<number | null>(null);

  const total = SLIDES.length;
  const slide = SLIDES[active];
  const light = slide.tone === "light";
  const playing = auto ?? !reduced;
  const running = playing && !hovered && !focused;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setSeen((prev) => {
      const next = (active + 1) % total;
      if (prev.has(active) && prev.has(next)) return prev;
      return new Set([...prev, active, next]);
    });
  }, [active, total]);

  const goTo = useCallback((i: number, stop = true) => {
    setActive(((i % total) + total) % total);
    if (stop) setAuto(false);
  }, [total]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Meet the Strategic Income Group team"
      className={cn("relative overflow-hidden", light ? "text-[#0d1a3a]" : "text-white")}
      style={{ backgroundColor: slide.stops[3] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") goTo(active - 1);
        else if (e.key === "ArrowRight") goTo(active + 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || Math.abs(end - start) < 50) return;
        goTo(end < start ? active + 1 : active - 1);
      }}
    >
      <style>{`@keyframes sig-hero-progress{from{width:0%}to{width:100%}}@keyframes sig-hero-in{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}`}</style>

      <div className="grid" aria-live={playing ? "off" : "polite"}>
        {SLIDES.map((s, i) => {
          const on = i === active;
          const dark = s.tone === "dark";
          const Heading = on ? "h1" : "p";
          const solo = s.frame === "cutout";
          // The person on their own, drawn above the back card (Mike's photo is already background-free).
          const person = solo ? s.image : s.cutout;
          const layered = Boolean(person);
          return (
            <div
              key={s.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${total}: ${s.name}`}
              aria-hidden={!on}
              inert={!on}
              className={cn(
                "relative [grid-area:1/1] transition-[opacity,visibility] duration-500 motion-reduce:transition-none",
                on ? "visible opacity-100" : "invisible opacity-0",
                dark ? "text-white" : "text-[#0d1a3a]",
              )}
            >
              <div
                className="relative h-full overflow-hidden [background:var(--hero-bg-m)] lg:h-[660px] lg:[background:var(--hero-bg-d)]"
                style={{ "--hero-bg-m": gradient(s, true), "--hero-bg-d": gradient(s, false) } as CSSProperties}
              >
                <div className="relative mx-auto flex h-full max-w-[1280px] flex-col items-center px-[22px] pb-16 pt-10 text-center sm:px-8 lg:block lg:p-0 lg:text-left">
                  {/* Copy */}
                  <div
                    className={cn(
                      "relative z-10 flex max-w-[560px] flex-col items-center gap-5 lg:absolute lg:left-[7.5%] lg:top-1/2 lg:w-[36.7%] lg:max-w-[470px] lg:-translate-y-1/2 lg:items-start lg:gap-[22px]",
                      on && "motion-safe:animate-[sig-hero-in_.5s_ease_both]",
                    )}
                  >
                    <Heading className="m-0 font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.015em] [text-wrap:balance] min-[380px]:text-[44px] sm:text-[52px] lg:text-[56px] lg:leading-[1.02] lg:[text-wrap:wrap] xl:text-[68px]">
                      {s.headline.map((line, li) => (
                        <span key={line}>
                          {li ? <br /> : null}
                          {line}
                        </span>
                      ))}
                    </Heading>
                    <p className={cn("m-0 text-[17px] leading-[1.45] lg:max-w-[440px] lg:text-lg lg:leading-normal", dark ? "text-white" : "text-[#1f2328]")}>
                      {s.body.mobile ? (
                        <>
                          <span className="lg:hidden">{s.body.mobile}</span>
                          <span className="hidden lg:inline">{s.body.desktop}</span>
                        </>
                      ) : (
                        s.body.desktop
                      )}
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-5 lg:mt-2.5 lg:flex-row lg:gap-7">
                      <Link
                        href="/get-started"
                        className={cn(
                          "flex h-12 items-center justify-center rounded-full px-10 text-[15px] font-bold no-underline outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-transparent lg:h-[54px] lg:px-9",
                          dark ? "bg-white" : "bg-[#2d3135] text-white",
                        )}
                        style={dark ? { color: s.ink } : undefined}
                      >
                        Get Started
                      </Link>
                      <Link
                        href={s.link.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-sm text-base font-semibold underline underline-offset-[5px] outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-4 focus-visible:ring-offset-transparent lg:gap-2 lg:text-[15px]",
                          dark ? "text-white hover:text-brand-gold" : "text-[#0d1a3a] hover:text-[hsl(224_78%_23%)]",
                        )}
                      >
                        {s.link.mobileLabel ? (
                          <>
                            <span className="lg:hidden">{s.link.mobileLabel}</span>
                            <span className="hidden lg:inline">{s.link.label}</span>
                          </>
                        ) : (
                          s.link.label
                        )}
                        <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} aria-hidden />
                      </Link>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 lg:hidden" aria-hidden />

                  {/*
                    Photo + cards (Stash-style layering), bottom to top:
                      1. studio photo with its backdrop, feathered into the band (studio slides)
                      2. back card
                      3. the person alone (background-free copy, pixel-aligned with 1)
                      4. front card
                    Desktop cards are positioned against the 1280px stage; mobile cards against a
                    box the width of the photo.
                  */}
                  <div className="relative -mt-16 h-[420px] w-full flex-none min-[400px]:h-[440px] sm:h-[500px] lg:static lg:mt-0 lg:h-auto">
                    {solo ? null : (
                      <div
                        className={cn(
                          STUDIO_FRAME,
                          // Horizontal fade on the wrapper, vertical fade on the <img> (nested single-layer masks;
                          // a composited two-layer mask leaves a hairline at the photo edge in Chromium).
                          "[mask-image:var(--hero-mask-x)] [-webkit-mask-image:var(--hero-mask-x)]",
                          "lg:[mask-image:var(--hero-mask-d)] lg:[-webkit-mask-image:var(--hero-mask-d)]",
                        )}
                        style={{ "--hero-mask-x": MASK_MOBILE_X, "--hero-mask-d": MASK_DESKTOP } as unknown as CSSProperties}
                      >
                        {seen.has(i) ? (
                          <Image
                            src={s.image}
                            alt={s.alt}
                            fill
                            priority={i === 0}
                            sizes={STUDIO_SIZES}
                            className={cn("object-cover object-top", STUDIO_MASK_Y)}
                            style={STUDIO_MASK_VARS}
                          />
                        ) : null}
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
                      {layered ? s.desktopCards.back : null}
                    </div>
                    {layered ? <MobileCard slot="back" solo={solo}>{s.mobileCards.back}</MobileCard> : null}

                    {person ? (
                      <div className={solo ? SOLO_FRAME : STUDIO_FRAME}>
                        {seen.has(i) ? (
                          <Image
                            src={person}
                            alt={solo ? s.alt : ""}
                            fill
                            priority={i === 0}
                            sizes={solo ? "(min-width: 1024px) 452px, 330px" : STUDIO_SIZES}
                            className={cn(
                              "object-top",
                              solo
                                ? "object-cover [mask-image:var(--hero-mask-y)] [-webkit-mask-image:var(--hero-mask-y)] lg:object-contain lg:[mask-image:var(--hero-mask-dy)] lg:[-webkit-mask-image:var(--hero-mask-dy)]"
                                : cn("object-cover", STUDIO_MASK_Y),
                            )}
                            style={solo ? ({ "--hero-mask-y": MASK_CUTOUT_Y, "--hero-mask-dy": MASK_CUTOUT_DY } as unknown as CSSProperties) : STUDIO_MASK_VARS}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
                      {layered ? null : s.desktopCards.back}
                      {s.desktopCards.front}
                    </div>
                    {layered ? null : <MobileCard slot="back" solo={solo}>{s.mobileCards.back}</MobileCard>}
                    <MobileCard slot="front" solo={solo}>{s.mobileCards.front}</MobileCard>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edge arrows */}
      {(["prev", "next"] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => goTo(dir === "prev" ? active - 1 : active + 1)}
          aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
          className={cn(
            "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-current md:flex lg:top-[330px]",
            dir === "prev" ? "left-3 lg:left-7" : "right-3 lg:right-7",
            light ? "text-[#2d3135] hover:bg-black/5" : "text-white",
          )}
        >
          {dir === "prev" ? <ChevronLeft className="h-[26px] w-[26px]" strokeWidth={2.2} aria-hidden /> : <ChevronRight className="h-[26px] w-[26px]" strokeWidth={2.2} aria-hidden />}
        </button>
      ))}

      {/* Progress-pill dots + pause/play */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center lg:bottom-[18px]">
        <div role="group" aria-label="Choose a team member" className="flex items-center gap-1">
          {SLIDES.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1}: ${s.name}`}
                aria-current={on ? "true" : undefined}
                className="group flex h-6 items-center rounded-full px-1 outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <span
                  className={cn(
                    "block h-2.5 overflow-hidden rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                    on ? "w-[34px] bg-white/55" : cn("w-2.5", light ? "bg-[#2d3135] group-hover:bg-[#2d3135]/70" : "bg-white group-hover:bg-white/70"),
                  )}
                >
                  {on ? (
                    <span
                      key={`${active}-${playing}`}
                      className="block h-full rounded-full"
                      style={
                        playing
                          ? { background: GOLD, animation: `sig-hero-progress ${SLIDE_MS}ms linear forwards`, animationPlayState: running ? "running" : "paused" }
                          : { background: GOLD, width: "100%" }
                      }
                      onAnimationEnd={() => goTo(active + 1, false)}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setAuto(!playing)}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          className={cn(
            "ml-3 flex h-8 w-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-current",
            light ? "text-[#2d3135] hover:bg-black/5" : "text-white hover:bg-white/10",
          )}
        >
          {playing ? <Pause className="h-3.5 w-3.5 fill-current" aria-hidden /> : <Play className="h-3.5 w-3.5 fill-current" aria-hidden />}
        </button>
      </div>
    </section>
  );
}
