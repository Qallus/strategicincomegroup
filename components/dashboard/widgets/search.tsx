"use client";

import { LayoutGrid, Search } from "lucide-react";
import { useOptionalDashboard } from "../dashboard-context";
import { useMounted, type WidgetProps } from "./shell";

export default function SearchWidget({ preview }: WidgetProps) {
  const dash = useOptionalDashboard();
  const mounted = useMounted();
  const isMac = mounted && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="flex h-full min-h-[7.5rem] flex-col justify-center gap-3 p-4">
      <button
        type="button"
        disabled={preview}
        onClick={() => dash?.openSearch()}
        className="group flex h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-background/70 px-3.5 text-left text-sm text-muted-foreground shadow-inner transition hover:border-brand-gold/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Search features, contacts, bookings and posts"
      >
        <Search className="h-4 w-4 shrink-0 text-brand-gold transition group-hover:scale-110" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Search features, contacts, bookings…</span>
        <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground sm:inline">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <button
        type="button"
        disabled={preview}
        onClick={() => dash?.openFeatures()}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-brand-gold dark:text-brand-navy-deep dark:hover:bg-brand-gold/90"
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        All features
      </button>
    </div>
  );
}
