"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldSelect } from "@/components/ui/field-select";
import { Switch } from "@/components/ui/switch";
import { RANGE_PRESETS, resolveRange } from "@/lib/analytics/dates";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/analytics", label: "Overview" },
  { href: "/dashboard/analytics/acquisition", label: "Acquisition" },
  { href: "/dashboard/analytics/search", label: "Search" },
  { href: "/dashboard/analytics/ai", label: "AI" },
  { href: "/dashboard/analytics/content", label: "Content" },
  { href: "/dashboard/analytics/email-sms", label: "Email & SMS" },
  { href: "/dashboard/analytics/social", label: "Social" },
  { href: "/dashboard/analytics/conversions", label: "Conversions" },
  { href: "/dashboard/analytics/connections", label: "Connections" },
] as const;

const PendingContext = React.createContext(false);

/** URL-driven tabs + one filter row scoping every chart below it. */
export function AnalyticsShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div className="space-y-5">{children}</div>}>
      <ShellInner>{children}</ShellInner>
    </React.Suspense>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const query = sp.toString();
  const params = Object.fromEntries(sp.entries());
  const range = resolveRange(params);
  const isConnections = pathname.startsWith("/dashboard/analytics/connections");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  }

  return (
    <PendingContext.Provider value={pending}>
      <div className="space-y-5">
        <nav aria-label="Analytics sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <ul className="inline-flex min-w-max items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
            {TABS.map((t) => {
              const active = t.href === "/dashboard/analytics" ? pathname === t.href : pathname.startsWith(t.href);
              return (
                <li key={t.href}>
                  <Link
                    href={`${t.href}${query ? `?${query}` : ""}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isConnections ? (
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filters">
            <FieldSelect
              aria-label="Date range"
              className="h-9 w-[170px]"
              value={range.preset}
              onChange={(v) => update({ range: v === "30d" ? null : v, ...(v === "custom" ? { from: range.from, to: range.to } : { from: null, to: null }) })}
              options={RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
            {range.preset === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker value={range.from} onChange={(v) => v && update({ from: v })} allowClear={false} className="w-[160px]" />
                <span className="text-sm text-muted-foreground">to</span>
                <DatePicker value={range.to} onChange={(v) => v && update({ to: v })} allowClear={false} className="w-[160px]" />
              </div>
            ) : null}
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={range.compare} onCheckedChange={(c) => update({ compare: c ? null : "0" })} aria-label="Compare to previous period" />
              Compare to previous period
            </label>
            <span className="text-xs text-muted-foreground sm:ml-auto">Arizona time · {range.days} day{range.days === 1 ? "" : "s"}</span>
          </div>
        ) : null}

        {/* Refetch keeps the frame: hold the previous render at reduced opacity. */}
        <div className={cn("space-y-6 transition-opacity", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
          {children}
        </div>
      </div>
    </PendingContext.Provider>
  );
}
