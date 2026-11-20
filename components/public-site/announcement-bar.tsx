"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, TriangleAlert, X } from "lucide-react";
import { pickActiveAnnouncement, safeHref, type PublicAnnouncement } from "@/lib/site-notices/shared";
import { cn } from "@/lib/utils";

const TONES = {
  navy: "bg-[hsl(225_45%_12%)] text-white dark:border-b dark:border-border dark:bg-[hsl(225_40%_16%)]",
  gold: "bg-brand-gold text-[hsl(225_45%_12%)] dark:bg-[hsl(36_40%_32%)] dark:text-white",
  alert: "bg-red-700 text-white dark:bg-red-900",
} as const;

const LINK_TONES = {
  navy: "text-brand-gold hover:text-white",
  gold: "text-[hsl(225_45%_12%)] underline decoration-[hsl(225_45%_12%)]/40 underline-offset-4 hover:decoration-current dark:text-white dark:decoration-white/40",
  alert: "text-white underline decoration-white/50 underline-offset-4 hover:decoration-white",
} as const;

const dismissKey = (a: PublicAnnouncement) => `sig-announcement-dismissed:${a.id}:${a.updated_at}`;

function isDismissed(a: PublicAnnouncement) {
  if (!a.dismissible) return false;
  try {
    return window.localStorage.getItem(dismissKey(a)) === "1";
  } catch {
    return false;
  }
}

/**
 * Site-wide announcement bar above the main nav. The server passes every enabled,
 * not-yet-ended announcement plus the one live at render time; the client re-picks
 * against its own clock (so scheduled windows apply on cached pages) and honours
 * per-visitor dismissal.
 */
export function AnnouncementBar({ announcements, initialId }: { announcements: PublicAnnouncement[]; initialId: string | null }) {
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const pick = () => {
      const visible = announcements.filter((a) => !isDismissed(a));
      setActiveId(pickActiveAnnouncement(visible)?.id ?? null);
    };
    pick();
    const t = window.setInterval(pick, 60_000);
    return () => window.clearInterval(t);
  }, [announcements, dismissed]);

  const active = announcements.find((a) => a.id === activeId) ?? null;
  if (!active) return null;

  const href = safeHref(active.link_url);
  const external = href ? /^https?:\/\//i.test(href) : false;
  const Icon = active.tone === "alert" ? TriangleAlert : Megaphone;

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(active), "1");
    } catch {
      /* storage blocked — hide for this page view only */
    }
    setDismissed((s) => new Set(s).add(active.id));
    setActiveId(null);
  };

  return (
    <div role="region" aria-label="Site announcement" className={cn("w-full text-sm", TONES[active.tone] ?? TONES.navy)}>
      <div className="mx-auto flex min-h-10 w-full max-w-[1200px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Icon className="hidden h-4 w-4 shrink-0 opacity-80 sm:block" aria-hidden />
        <p className="min-w-0 flex-1 text-pretty leading-snug sm:text-center">
          <span>{active.message}</span>
          {href ? (
            <>
              {" "}
              {external ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 whitespace-nowrap font-semibold transition-colors", LINK_TONES[active.tone])}>
                  {active.link_label || "Learn more"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <Link href={href} className={cn("inline-flex items-center gap-1 whitespace-nowrap font-semibold transition-colors", LINK_TONES[active.tone])}>
                  {active.link_label || "Learn more"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </>
          ) : null}
        </p>
        {active.dismissible ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-80 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
