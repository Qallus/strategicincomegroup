"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronRight, Mail, MessageCircle, Send, Sparkles, Users, X } from "lucide-react";
import { CONTACT } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

type Msg = { from: "siggy" | "you"; text: string; link?: { href: string; label: string } };

const MENU = [
  { key: "siggy", icon: Sparkles, title: "Talk to Siggy", copy: "Our SIG guide — ask about planning and services" },
  { key: "planner", icon: Users, title: "Talk to a Planner", copy: "Meet a CFP® professional or Wealth Advisor", href: "/team" },
  { key: "schedule", icon: CalendarDays, title: "Schedule Online", copy: "Book a consultation in a couple of clicks", href: "/book" },
  { key: "contact", icon: Mail, title: "Contact Us", copy: `Questions? Call ${CONTACT.phone}`, href: "/contact" },
] as const;

const SUGGESTIONS = ["What services do you offer?", "What are the Three Phases of Wealth?", "Where are your offices?", "How do I get started?"];

// Siggy's preview answers come from the site's own pages. When the SIG AI agent
// (Phase 8) is live, swap `answer()` for a call to its public chat endpoint.
const ANSWERS: { match: RegExp; text: string; link?: Msg["link"] }[] = [
  {
    match: /service|offer|solution|help with/i,
    text: "We offer Financial Planning, Investment Management, Estate Planning, Insurance Planning, Tax Planning and faith-based 403(b) plans for churches.",
    link: { href: "/services", label: "View all solutions" },
  },
  {
    match: /phase|three|process|approach/i,
    text: "The Three Phases of Wealth, developed by Michael Gauthier, CFP®, gives order to your goals: Phase I builds your Foundation, Phase II Accumulates Wealth, and Phase III turns it into Strategic Income and legacy.",
    link: { href: "/our-approach", label: "Explore our approach" },
  },
  {
    match: /office|where|location|address|chandler|peoria/i,
    text: "We have two offices: East Valley at 2330 W Ray Rd. #3, Chandler, AZ 85224, and West Valley at 20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382.",
    link: { href: "/contact", label: "Directions & contact" },
  },
  {
    match: /start|begin|consult|schedule|book|appointment|meet/i,
    text: "The easiest first step is a free consultation with one of our planners — in person or over the phone.",
    link: { href: "/get-started", label: "Get started" },
  },
  {
    match: /estate|trust|will|power of attorney/i,
    text: "Estate planning is the third step of our Foundation Phase. We offer will- and trust-based plans, document reviews and deed transfers.",
    link: { href: "/estate-planning", label: "Estate planning services" },
  },
  {
    match: /insurance|life|disability/i,
    text: "We help transfer risk away from your family with tailored, cost-effective coverage — and review your home and auto policies too.",
    link: { href: "/insurance-planning", label: "Insurance planning" },
  },
  {
    match: /invest|portfolio|impact|retire/i,
    text: "Our investment management balances risk, return and impact through our Avoid, Amplify & Advance framework.",
    link: { href: "/investment-management", label: "Investment management" },
  },
  {
    match: /403|church|ministry|pastor/i,
    text: "Our Kingdom Stewardship 403(b) plans help churches and nonprofits give staff tax-advantaged, values-aligned retirement savings.",
    link: { href: "/403b-plan", label: "403(b) plans" },
  },
  {
    match: /job|career|hiring|work at|intern/i,
    text: "We’re always looking for high-character professionals who see their work as a calling.",
    link: { href: "/join-our-team", label: "See careers" },
  },
  {
    match: /hour|open|phone|call|email/i,
    text: `We're open ${CONTACT.hours}. Call ${CONTACT.phone} or email ${CONTACT.email}.`,
  },
];

function answer(q: string): Msg {
  const hit = ANSWERS.find((a) => a.match.test(q));
  if (hit) return { from: "siggy", text: hit.text, link: hit.link };
  return {
    from: "siggy",
    text: `Good question — that's one for a planner. You can call ${CONTACT.phone} or book a time that suits you.`,
    link: { href: "/book", label: "Schedule online" },
  };
}

/** Floating help button on every public page: Siggy (SIG AI guide), planners, scheduling and contact. */
export function SiteFab() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "chat">("menu");
  const [messages, setMessages] = useState<Msg[]>([
    { from: "siggy", text: "Hi, I’m Siggy, Strategic Income Group’s guide. Ask me about our services, the Three Phases of Wealth, or how to get started." },
  ]);
  const [input, setInput] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // The header search's "Ask Siggy" opens the chat with the visitor's question.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = String((e as CustomEvent).detail ?? "").trim();
      setView("chat");
      setOpen(true);
      if (q) setMessages((m) => [...m, { from: "you", text: q }, answer(q)]);
    };
    window.addEventListener("sig:ask-siggy", onAsk);
    return () => window.removeEventListener("sig:ask-siggy", onAsk);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, view]);

  function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "you", text }, answer(text)]);
    setInput("");
  }

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-[45] flex flex-col items-end gap-3 print:hidden sm:bottom-6 sm:right-6">
      {open ? (
        <div className="sig-pop flex max-h-[min(560px,calc(100vh-7rem))] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl shadow-black/10 dark:shadow-black/50">
          {view === "menu" ? (
            <>
              <div className="border-b px-5 pb-4 pt-5">
                <p className="font-serif text-2xl">Siggy</p>
                <p className="mt-1 text-sm text-muted-foreground">Your guide to planning a financial life of purpose.</p>
              </div>
              <ul className="divide-y overflow-y-auto">
                {MENU.map((item) => {
                  const inner = (
                    <>
                      <item.icon className="h-5 w-5 shrink-0 text-brand-gold" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.copy}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </>
                  );
                  const cls = "group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-muted";
                  return (
                    <li key={item.key}>
                      {"href" in item ? (
                        <Link href={item.href} className={cls} onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        <button type="button" className={cls} onClick={() => setView("chat")}>
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-3 py-3">
                <button type="button" aria-label="Back" onClick={() => setView("menu")} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Siggy</p>
                  <p className="text-[11px] text-muted-foreground">SIG AI guide · preview</p>
                </div>
              </div>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        m.from === "you" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                      )}
                    >
                      {m.text}
                      {m.link ? (
                        <Link href={m.link.href} onClick={() => setOpen(false)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                          {m.link.label} <ChevronRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
                {messages.length === 1 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-primary/50 hover:bg-muted">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                }}
                className="flex items-center gap-2 border-t p-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Siggy a question…"
                  aria-label="Message Siggy"
                  className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button type="submit" aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="px-4 pb-3 text-[10px] leading-snug text-muted-foreground">
                Siggy shares general information only, not personalized financial advice.
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {!open ? (
          <button
            type="button"
            onClick={() => {
              setView("menu");
              setOpen(true);
            }}
            className="hidden rounded-full border bg-background/95 px-4 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur transition hover:border-primary/40 sm:block"
          >
            Need help? <span className="font-semibold text-[hsl(36_60%_42%)] dark:text-brand-gold">Contact us</span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={open ? "Close help menu" : "Open help menu"}
          aria-expanded={open}
          onClick={() => {
            setView("menu");
            setOpen((v) => !v);
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(225_45%_12%)] text-white shadow-xl shadow-black/20 transition hover:scale-105 dark:bg-brand-gold dark:text-[hsl(225_80%_10%)]"
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
