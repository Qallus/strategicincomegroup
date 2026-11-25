"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Lock, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetDef } from "@/lib/dashboard/registry";
import type { WidgetInstance, WidgetSettings } from "@/lib/dashboard/types";

export type WidgetProps = {
  widget: WidgetInstance;
  def: WidgetDef;
  /** Rendered as a non-interactive preview tile (Add Card). */
  preview?: boolean;
  onSettingsChange?: (patch: WidgetSettings) => void;
};

/** Standard widget body: header (icon, title, actions/link), content, optional footer. */
export function WidgetShell({
  icon: Icon,
  title,
  subtitle,
  href,
  hrefLabel = "Open",
  actions,
  children,
  footer,
  className,
  bodyClassName,
  tone = "gold",
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "gold" | "navy" | "sky" | "sage" | "red";
}) {
  const toneCls = {
    gold: "bg-brand-gold/15 text-[hsl(30_55%_38%)] dark:text-brand-gold",
    navy: "bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20",
    sky: "bg-brand-sky/10 text-brand-sky",
    sage: "bg-brand-sage/15 text-brand-sage",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-start gap-2.5 px-4 pb-2 pt-4">
        {Icon ? (
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneCls)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {href ? (
            <Link
              href={href}
              className="inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={`${hrefLabel}: ${typeof title === "string" ? title : ""}`}
            >
              {hrefLabel}
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 px-4 pb-4", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export function WidgetSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5 py-1", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="sig-skeleton h-4" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function WidgetError({ error, status, onRetry }: { error: string | null; status?: number | null; onRetry?: () => void }) {
  if (status === 403) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center text-xs text-muted-foreground">
        <Lock className="h-5 w-5" aria-hidden />
        You don&apos;t have access to this card.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center text-xs text-muted-foreground">
      <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />
      <span>{error || "This card couldn't load."}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-foreground hover:bg-muted">
          <RefreshCw className="h-3 w-3" aria-hidden /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function WidgetEmpty({ icon: Icon, children, action }: { icon?: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 px-3 py-5 text-center text-xs text-muted-foreground">
      {Icon ? <Icon className="h-5 w-5 text-brand-gold" aria-hidden /> : null}
      <div>{children}</div>
      {action}
    </div>
  );
}

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) if (abs >= ms) return rtf ? rtf.format(Math.round(diff / ms), unit) : `${Math.round(abs / ms)} ${unit}s`;
  return "just now";
}

export function formatPhone(n: string | null | undefined): string {
  if (!n) return "";
  const d = n.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return n;
}

/** Re-render on an interval (for relative times and live clocks). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMounted(): boolean {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
}
