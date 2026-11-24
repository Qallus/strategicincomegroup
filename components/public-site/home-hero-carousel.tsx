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
  /** Mike's chair photo is framed taller (concept: 620x930 at -110px). */
  frame: "chair" | "studio";
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
  desktopCards: ReactNode;
  mobileCards: ReactNode;
};

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
          ? "border-white/80 bg-white/45 text-[#0d1a3a] shadow-[0_20px_50px_rgba(0,0,0,.18)]"
          : "border-white/45 bg-white/[0.12] text-white shadow-[0_20px_50px_rgba(0,0,0,.25)]",
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
        "mt-2 whitespace-nowrap text-[9px] font-medium uppercase leading-none tracking-[0.08em] lg:text-[10px] lg:tracking-[0.12em]",
        tone === "light" ? "text-[#0d1a3a]/70" : "text-white/70",
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
        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f2b43b] font-bold uppercase tracking-[0.14em] text-[#2d2210]",
        small ? "-top-[9px] px-2.5 py-[3px] text-[8px]" : "-top-2.5 px-3 py-[3px] text-[9px]",
      )}
    >
      ✦ On track ✦
    </span>
  );
}

function PhasesCard({ title, note, small, className }: { title: string; note: ReactNode; small?: boolean; className?: string }) {
  const ring = small ? "h-[34px] w-[34px] text-2xl" : "h-[52px] w-[52px] text-[30px]";
  const mid = small ? "h-[46px] w-[46px] text-[32px]" : "h-[66px] w-[66px] text-[40px]";
  return (
    <Glass center className={cn(small ? "px-3 pb-3 pt-[22px]" : "rounded-[14px] px-[18px] pb-4 pt-[30px]", className)}>
      <OnTrackBadge small={small} />
      <div className={cn("flex items-center justify-center", small ? "gap-1.5" : "gap-3")}>
        <span className={cn("flex flex-none items-center justify-center rounded-full border border-white/45 font-serif", ring)}>1</span>
        <span className={cn("flex flex-none items-center justify-center rounded-full border border-white/60 bg-white/[0.18] font-serif", mid)}>2</span>
        <span className={cn("flex flex-none items-center justify-center rounded-full border border-white/25 font-serif text-white/40", ring)}>3</span>
      </div>
      <p className={cn("font-semibold", small ? "mb-0.5 mt-2 text-[13px]" : "mb-1 mt-3 text-base")}>{title}</p>
      <p className={cn("leading-[1.4] text-white/90", small ? "text-[10px]" : "text-[11px]")}>{note}</p>
    </Glass>
  );
}

function StatCard({ eyebrow, value, note, small, className }: { eyebrow: string; value: string; note: string; small?: boolean; className?: string }) {
  return (
    <Glass className={cn(small ? "rounded-[10px] p-3 text-left" : "px-[18px] py-4", className)}>
      <p className={cn("uppercase tracking-[0.14em] text-white/85", small ? "text-[9px]" : "text-[11px]")}>{eyebrow}</p>
      <p className={cn("whitespace-nowrap font-serif leading-none", small ? "mb-1 mt-1.5 text-[26px]" : "mb-1 mt-1.5 text-[36px]")}>{value}</p>
      <p className={cn("leading-[1.4] text-white/90", small ? "text-[10px]" : "text-xs")}>{note}</p>
    </Glass>
  );
}

function GoalBarCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass className={cn(small ? "rounded-lg p-3 text-left" : "rounded-[10px] px-[18px] pb-4 pt-4", className)}>
      <p className={cn("whitespace-nowrap", small ? "mb-2 text-[13px]" : "mb-3 text-base")}>
        <strong className="font-semibold">$6,000</strong> <span className="text-white/80">/ $7,500</span>
      </p>
      <div className={cn("overflow-hidden rounded-full bg-[#0a2a44]", small ? "h-3.5" : "h-[22px]")}>
        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#7fd6ff] to-[#3ab6f0]" />
      </div>
    </Glass>
  );
}

function PortfolioCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass tone="light" className={cn(small ? "rounded-[10px] p-3 text-left" : "px-[18px] py-4", className)}>
      <p className={cn("font-medium", small ? "text-xs" : "text-sm")}>Managed portfolio</p>
      <p className={cn("whitespace-nowrap font-serif leading-none", small ? "mb-1.5 mt-0.5 text-[26px]" : "mb-2 mt-1 text-[34px]")}>$102.5k</p>
      <svg viewBox="0 0 200 44" width="100%" height={small ? 30 : 44} fill="none" stroke="#fff" strokeWidth={small ? 3 : 2.5} aria-hidden>
        <path d="M0 40 C 30 36, 50 30, 80 28 S 130 20, 160 12 S 190 6, 200 4" />
      </svg>
    </Glass>
  );
}

function RetirementCard({ small, className }: { small?: boolean; className?: string }) {
  return (
    <Glass tone="light" className={cn(small ? "p-3 text-left" : "rounded-[14px] p-[18px]", className)}>
      <div className={cn("flex items-center", small ? "gap-2.5" : "gap-3.5")}>
        <span
          className={cn(
            "flex flex-none items-center justify-center rounded-full border-[#3ab6f0] border-r-[rgba(58,182,240,.3)]",
            small ? "h-10 w-10 border-4" : "h-[54px] w-[54px] border-[5px]",
          )}
        >
          {small ? null : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d4f7a" strokeWidth="2" aria-hidden>
              <path d="M12 22V12M12 12c-4 0-7-3-7-6 3 0 7 2 7 6zm0 0c4 0 7-3 7-6-3 0-7 2-7 6z" />
            </svg>
          )}
        </span>
        <span className={cn("flex flex-col", small ? "gap-1" : "gap-1.5")}>
          <span className={cn("font-medium", small ? "text-[13px]" : "text-base")}>Retirement</span>
          <span
            className={cn(
              "self-start whitespace-nowrap rounded-full bg-white font-bold uppercase tracking-[0.1em]",
              small ? "px-2 py-[3px] text-[9px]" : "px-3 py-[5px] text-[11px]",
            )}
          >
            On track
          </span>
        </span>
      </div>
    </Glass>
  );
}

function GoalsCard({ className }: { className?: string }) {
  const rows = [
    { label: "Retirement", value: "$307K/$1M", width: "42%", grad: "from-[#6fb6ff] to-[#7fe3d6]" },
    { label: "Down Payment", value: "$5.3K/$50K", width: "18%", grad: "from-[#5fd3a8] to-[#8fe08f]" },
  ];
  return (
    <Glass className={cn("border-white/30 bg-[rgba(18,48,31,.35)] px-5 pb-4 pt-3.5", className)}>
      <p className="mb-2.5 text-center text-sm font-semibold">Your Goals:</p>
      {rows.map((r, i) => (
        <div key={r.label} className={i ? "mt-3" : undefined}>
          <div className="h-5 overflow-hidden rounded-full bg-[#1f3a66]">
            <div className={cn("h-full rounded-full bg-gradient-to-r", r.grad)} style={{ width: r.width }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span>{r.label}</span>
            <span>{r.value}</span>
          </div>
        </div>
      ))}
    </Glass>
  );
}

function StrategyCard({ className }: { className?: string }) {
  const chips = [
    { label: "Bonds", pct: "22%", dot: "#6fd3a8", pos: "left-1.5 -top-1" },
    { label: "US stocks", pct: "48%", dot: "#9ad8ff", pos: "-right-2 top-[50px]" },
    { label: "International", pct: "18%", dot: "#2c5f9e", pos: "-left-1.5 bottom-[34px]" },
    { label: "Up & Coming", pct: "12%", dot: "#f2a65a", pos: "right-0 -bottom-0.5" },
  ];
  const ring: CSSProperties = {
    background:
      "conic-gradient(from 200deg,#6fd3a8 0 22%,#9ad8ff 22% 70%,#2c5f9e 70% 88%,transparent 88% 90%,#f2a65a 90% 95%,transparent 95% 97%,#f2a65a 97% 100%)",
    mask: "radial-gradient(circle,transparent 36px,black 37px)",
    WebkitMask: "radial-gradient(circle,transparent 36px,black 37px)",
  };
  return (
    <Glass className={cn("border-white/30 bg-white/10 px-4 pb-3 pt-3.5 backdrop-blur-[16px]", className)}>
      <p className="text-center text-sm font-semibold">Your Strategy:</p>
      <div className="relative h-[144px]">
        <div className="absolute left-1/2 top-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={ring} />
        <div className="absolute left-1/2 top-1/2 flex h-[78px] w-[78px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center leading-[1.1]">
          <span className="text-[8px] font-semibold tracking-[0.12em]">BALANCED</span>
          <span className="text-[15px] font-semibold">Moderate</span>
        </div>
        {chips.map((c) => (
          <span
            key={c.label}
            className={cn(
              "absolute flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.92] px-[9px] py-[5px] text-[11px] font-medium text-[#1f2328]",
              c.pos,
            )}
          >
            <i className="h-[7px] w-[7px] rounded-full" style={{ background: c.dot }} />
            {c.label} <span className="text-[#8a909e]">{c.pct}</span>
          </span>
        ))}
      </div>
    </Glass>
  );
}

function ContributionChips({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-medium text-[#1f2328] shadow-[0_10px_30px_rgba(0,0,0,.25)]">
        <i className="inline-block h-[18px] w-[18px] rounded-full bg-[#0d2568]" />
        Roth IRA <span className="font-semibold text-[#1f8a4c]">+ $500</span>
      </span>
      <span className="ml-3 flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-medium text-[#1f2328] shadow-[0_10px_30px_rgba(0,0,0,.25)]">
        <i className="inline-block h-[18px] w-[18px] rounded-full bg-brand-gold" />
        403(b) <span className="font-semibold text-[#1f8a4c]">+ $350</span>
      </span>
      <span className="rounded-full bg-black/30 px-2 py-1">
        <Illustrative />
      </span>
    </div>
  );
}

function BalancedCard({ className }: { className?: string }) {
  return (
    <Glass className={cn("p-3 text-left", className)}>
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full"
          style={{ background: "conic-gradient(#3ab6f0 0 48%,#2fd1a6 48% 70%,#0d4f7a 70% 88%,#f2a65a 88% 100%)" }}
        >
          <div className="h-[30px] w-[30px] rounded-full bg-[#12301f]" />
        </div>
        <div className="text-[10px] leading-[1.4]">
          <strong className="block text-xs">Balanced</strong>
          48% stocks · 22% bonds
          <br />
          18% intl · 12% impact
        </div>
      </div>
    </Glass>
  );
}

// ── Slides (copy from concept t3; names/titles from the team roster) ──

const LEFT_CARD = "absolute hidden xl:block";
const RIGHT_CARD = "absolute";

const SLIDES: Slide[] = [
  {
    key: "mike",
    name: "Mike",
    alt: "Mike Gauthier, CFP®, Founder and CEO of Strategic Income Group, seated in a studio portrait",
    image: "/team/hero/mike-gauthier.webp",
    frame: "chair",
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
    desktopCards: (
      <>
        <GoalBarCard className={cn(LEFT_CARD, "left-[43.75%] top-[470px] w-[236px]")} />
        <PhasesCard
          className={cn(RIGHT_CARD, "right-[3.125%] top-[380px] w-[230px]")}
          title="phases complete"
          note={
            <>
              Foundation set, now accumulating. <em>Great work.</em>
            </>
          }
        />
      </>
    ),
    mobileCards: (
      <>
        <GoalBarCard small className="min-w-0 max-w-[175px] flex-1" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="phases complete" note="Foundation set, now accumulating." />
      </>
    ),
  },
  {
    key: "bree",
    name: "Bree",
    alt: "Bree Sigler, Client Service Associate at Strategic Income Group, in a studio portrait",
    image: "/team/hero/bree-sigler.webp",
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
    desktopCards: (
      <>
        <GoalsCard className={cn(RIGHT_CARD, "right-[9.6%] top-[90px] w-[232px] opacity-90")} />
        <StrategyCard className={cn(RIGHT_CARD, "right-[9.6%] top-[330px] w-[232px]")} />
      </>
    ),
    mobileCards: (
      <>
        <ContributionChips className="flex-none" />
        <BalancedCard className="min-w-0 max-w-[175px] flex-1" />
      </>
    ),
  },
  {
    key: "chad",
    name: "Chad",
    alt: "Chad Manberg, CFP®, Certified Financial Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/chad-manberg.webp",
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
    desktopCards: (
      <>
        <PortfolioCard className={cn(LEFT_CARD, "left-[40.6%] top-[400px] w-[200px]")} />
        <RetirementCard className={cn(RIGHT_CARD, "right-[2.3%] top-[400px] w-[250px]")} />
      </>
    ),
    mobileCards: (
      <>
        <PortfolioCard small className="min-w-0 max-w-[175px] flex-1" />
        <RetirementCard small className="min-w-0 max-w-[175px] flex-1" />
      </>
    ),
  },
  {
    key: "jeremy",
    name: "Jeremy",
    alt: "Jeremy Waters, Marketing Director at Strategic Income Group, in a studio portrait",
    image: "/team/hero/jeremy-waters.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#b48a52", "#8a6536", "#5e421f", "#3f2b12"],
    at: "55% 40%",
    ink: "#5e421f",
    headline: ["Leave a lasting legacy."],
    body: { desktop: "Generosity, family impact and charitable strategy — planned with the same care as your retirement." },
    link: { label: "Our mission", href: "/mission" },
    desktopCards: (
      <>
        <StatCard className={cn(LEFT_CARD, "left-[36.7%] top-[420px] w-[220px]")} eyebrow="Impact goal" value="$1B+" note="charitable & impact investing" />
        <PhasesCard
          className={cn(RIGHT_CARD, "right-[3.9%] top-[380px] w-[230px]")}
          title="year giving streak"
          note={
            <>
              Consistency builds a legacy. <em>Great work.</em>
            </>
          }
        />
      </>
    ),
    mobileCards: (
      <>
        <StatCard small className="min-w-0 max-w-[175px] flex-1" eyebrow="Impact goal" value="$1B+" note="charitable & impact investing" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="year giving streak" note="Consistency builds a legacy." />
      </>
    ),
  },
  {
    key: "laurie",
    name: "Laurie",
    alt: "Laurie Simons, CFP®, CTFA®, Certified Financial Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/laurie-simons.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#a8824f", "#7f5f34", "#56401f", "#382912"],
    at: "55% 40%",
    ink: "#56401f",
    headline: ["Planning that fits your life."],
    body: { desktop: "Laurie Simons, CFP®, CTFA® — retirement, trust and estate planning with the care of a Certified Financial Planner." },
    link: { label: "Meet Laurie", href: "/team/laurie-simons" },
    desktopCards: (
      <>
        <StatCard className={cn(LEFT_CARD, "left-[36.7%] top-[420px] w-[220px]")} eyebrow="Trust & estate" value="Updated" note="Estate documents reviewed with Laurie" />
        <PhasesCard
          className={cn(RIGHT_CARD, "right-[3.9%] top-[380px] w-[230px]")}
          title="plan goals met"
          note={
            <>
              Your plan, kept current. <em>Nicely done.</em>
            </>
          }
        />
      </>
    ),
    mobileCards: (
      <>
        <StatCard small className="min-w-0 max-w-[175px] flex-1" eyebrow="Trust & estate" value="Updated" note="Estate documents reviewed with Laurie" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="plan goals met" note="Your plan, kept current." />
      </>
    ),
  },
  {
    key: "keri",
    name: "Keri",
    alt: "Keri Alcos, CWS®, Wealth Planner at Strategic Income Group, in a studio portrait",
    image: "/team/hero/keri-alcos.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#3f6f6a", "#2a4f4c", "#1a3533", "#0f2322"],
    at: "55% 40%",
    ink: "#1a3533",
    headline: ["Advice built around you."],
    body: { desktop: "Keri Alcos, CWS®, Wealth Planner — strategy, investments and income planning tailored to your life." },
    link: { label: "Meet Keri", href: "/team/keri-alcos" },
    desktopCards: (
      <>
        <StatCard className={cn(LEFT_CARD, "left-[36.7%] top-[420px] w-[220px]")} eyebrow="Retirement income" value="$8,450" note="projected monthly · age 65" />
        <PhasesCard className={cn(RIGHT_CARD, "right-[3.9%] top-[380px] w-[230px]")} title="goals on track" note="Plan reviewed this quarter." />
      </>
    ),
    mobileCards: (
      <>
        <StatCard small className="min-w-0 max-w-[175px] flex-1" eyebrow="Retirement income" value="$8,450" note="projected monthly · age 65" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="goals on track" note="Plan reviewed this quarter." />
      </>
    ),
  },
  {
    key: "mo",
    name: "Mo",
    alt: "Martha “Mo” Cortez, FPQP®, Senior Client Service Associate at Strategic Income Group, in a studio portrait",
    image: "/team/hero/martha-cortez.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#8a3a52", "#612638", "#3e1724", "#260d15"],
    at: "55% 40%",
    ink: "#3e1724",
    headline: ["A team that knows you."],
    body: { desktop: "Martha “Mo” Cortez, FPQP®, Senior Client Service Associate — scheduling, paperwork and questions answered by a real person." },
    link: { label: "How we serve you", href: "/services" },
    desktopCards: (
      <>
        <StatCard className={cn(LEFT_CARD, "left-[36.7%] top-[420px] w-[220px]")} eyebrow="Response time" value="Same day" note="reply to client requests" />
        <PhasesCard className={cn(RIGHT_CARD, "right-[3.9%] top-[380px] w-[230px]")} title="requests handled" note="Nothing slips through the cracks." />
      </>
    ),
    mobileCards: (
      <>
        <StatCard small className="min-w-0 max-w-[175px] flex-1" eyebrow="Response time" value="Same day" note="reply to client requests" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="requests handled" note="Nothing slips through the cracks." />
      </>
    ),
  },
  {
    key: "julie",
    name: "Julie",
    alt: "Julie Klodt, Executive Assistant to CEO Michael Gauthier, in a studio portrait",
    image: "/team/hero/julie-klodt.webp",
    frame: "studio",
    tone: "dark",
    stops: ["#6d7350", "#4b5136", "#303522", "#1d2015"],
    at: "55% 40%",
    ink: "#303522",
    headline: ["Your time, well kept."],
    body: { desktop: "Julie Klodt, Executive Assistant to Michael Gauthier, CEO — keeping meetings, follow-ups and introductions on schedule." },
    link: { label: "Schedule with Mike", href: "/book?planner=michael-gauthier" },
    desktopCards: (
      <>
        <StatCard className={cn(LEFT_CARD, "left-[36.7%] top-[420px] w-[220px]")} eyebrow="Next opening" value="Thu · 2:00" note="with Michael Gauthier, CEO" />
        <PhasesCard
          className={cn(RIGHT_CARD, "right-[3.9%] top-[380px] w-[230px]")}
          title="meetings this week"
          note={
            <>
              Calendar confirmed. <em>See you soon.</em>
            </>
          }
        />
      </>
    ),
    mobileCards: (
      <>
        <StatCard small className="min-w-0 max-w-[175px] flex-1" eyebrow="Next opening" value="Thu · 2:00" note="with Michael Gauthier, CEO" />
        <PhasesCard small className="min-w-0 max-w-[175px] flex-1" title="meetings this week" note="Calendar confirmed." />
      </>
    ),
  },
];

// Photo feathering. Desktop: wide horizontal fade on both sides so the studio backdrop
// melts into the band with no visible seam. Mobile: fade on all four sides.
const MASK_DESKTOP = "linear-gradient(to right, transparent 0%, rgba(0,0,0,.18) 10%, rgba(0,0,0,.6) 22%, black 36%, black 66%, rgba(0,0,0,.6) 80%, rgba(0,0,0,.18) 91%, transparent 100%)";
// Fades the photo's bottom edge when the band is taller than the photo (lg widths just above 1024px).
const MASK_DESKTOP_Y = "linear-gradient(to bottom, black 72%, transparent 97%)";
const MASK_MOBILE_Y = "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.25) 6%, rgba(0,0,0,.7) 13%, black 20%, black 78%, transparent 100%)";
const MASK_MOBILE_X = "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)";

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

                  {/* Photo (+ desktop cards, positioned against the 1280px stage) */}
                  <div className="relative -mt-16 h-[420px] w-full flex-none min-[400px]:h-[440px] sm:h-[500px] lg:static lg:mt-0 lg:h-auto">
                    <div
                      className={cn(
                        "absolute left-1/2 top-0 h-full w-[340px] -translate-x-1/2 min-[400px]:w-[360px] sm:w-[420px] lg:left-auto lg:h-auto lg:translate-x-0",
                        // Horizontal fade on the wrapper, vertical fade on the <img> (nested single-layer masks;
                        // a composited two-layer mask leaves a hairline at the photo edge in Chromium).
                        "[mask-image:var(--hero-mask-x)] [-webkit-mask-image:var(--hero-mask-x)]",
                        "lg:[mask-image:var(--hero-mask-d)] lg:[-webkit-mask-image:var(--hero-mask-d)]",
                        s.frame === "chair"
                          ? "lg:right-[9.375%] lg:top-[-110px] lg:aspect-[620/930] lg:w-[48.4%] lg:max-w-[620px]"
                          : "lg:right-[6.25%] lg:top-[-20px] lg:aspect-[667/1000] lg:w-[52.1%] lg:max-w-[667px]",
                      )}
                      style={
                        {
                          "--hero-mask-y": MASK_MOBILE_Y,
                          "--hero-mask-x": MASK_MOBILE_X,
                          "--hero-mask-d": MASK_DESKTOP,
                          "--hero-mask-dy": MASK_DESKTOP_Y,
                        } as CSSProperties
                      }
                    >
                      {seen.has(i) ? (
                        <Image
                          src={s.image}
                          alt={s.alt}
                          fill
                          priority={i === 0}
                          sizes="(min-width: 1280px) 667px, (min-width: 1024px) 52vw, (min-width: 640px) 420px, 360px"
                          className="object-cover object-top [mask-image:var(--hero-mask-y)] [-webkit-mask-image:var(--hero-mask-y)] lg:[mask-image:var(--hero-mask-dy)] lg:[-webkit-mask-image:var(--hero-mask-dy)]"
                        />
                      ) : null}
                    </div>
                    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
                      {s.desktopCards}
                    </div>
                  </div>

                  {/* Mobile cards: a row over the faded bottom of the photo, clear of face and hands */}
                  <div className="relative z-10 -mt-10 flex w-[calc(100%+16px)] max-w-[420px] items-end justify-center gap-3 lg:hidden" aria-hidden>
                    {s.mobileCards}
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
                      className="block h-full rounded-full bg-[#3ab6f0]"
                      style={
                        playing
                          ? { animation: `sig-hero-progress ${SLIDE_MS}ms linear forwards`, animationPlayState: running ? "running" : "paused" }
                          : { width: "100%" }
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
