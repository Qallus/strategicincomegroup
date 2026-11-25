"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { featuresFor, groupFeatures, type Feature } from "@/lib/dashboard/features";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useOptionalDashboard } from "../dashboard-context";
import { WidgetShell, type WidgetProps } from "./shell";

export function FeatureTile({ f, compact = false }: { f: Feature; compact?: boolean }) {
  const Icon = f.icon;
  return (
    <Link
      href={f.href}
      className={cn(
        "group flex flex-col items-start gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5 transition hover:-translate-y-0.5 hover:border-brand-gold/50 hover:shadow-md motion-reduce:hover:translate-y-0",
        compact && "flex-row items-center",
      )}
      title={f.description}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy/[0.07] text-brand-navy transition group-hover:bg-brand-gold/20 dark:bg-brand-gold/10 dark:text-brand-gold">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{f.label}</span>
        {!compact ? <span className="line-clamp-1 text-[11px] text-muted-foreground">{f.description}</span> : null}
      </span>
    </Link>
  );
}

export default function QuickLinksWidget({ widget, def, preview, onSettingsChange }: WidgetProps) {
  const dash = useOptionalDashboard();
  const available = React.useMemo(() => featuresFor(dash?.viewer.permissions ?? []), [dash?.viewer.permissions]);
  const chosen = String(widget.settings.links ?? "").split(",").filter(Boolean);
  const links = chosen.map((h) => available.find((f) => f.href === h)).filter((f): f is Feature => Boolean(f));
  const toggle = (href: string, on: boolean) => {
    const next = on ? [...chosen, href] : chosen.filter((h) => h !== href);
    onSettingsChange?.({ links: next.slice(0, 16).join(",") });
  };

  return (
    <WidgetShell
      icon={def.icon}
      title={def.title}
      actions={
        !preview ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3 w-3" aria-hidden /> Edit
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[60vh] w-72 overflow-y-auto p-2">
              {groupFeatures(available).map((g) => (
                <div key={g.group} className="py-1">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
                  {g.items.map((f) => {
                    const on = chosen.includes(f.href);
                    return (
                      <label key={f.href} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted">
                        <Checkbox size="sm" checked={on} onCheckedChange={(v) => toggle(f.href, v)} />
                        <f.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span className="flex-1 truncate">{f.label}</span>
                        {on ? <Check className="h-3 w-3 text-brand-gold" aria-hidden /> : null}
                      </label>
                    );
                  })}
                </div>
              ))}
            </PopoverContent>
          </Popover>
        ) : null
      }
    >
      {links.length ? (
        <div className={cn("grid gap-2", widget.size === "l" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
          {links.map((f) => <FeatureTile key={f.href} f={f} />)}
        </div>
      ) : (
        <button type="button" onClick={() => dash?.openFeatures()} className="flex h-full min-h-[6rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-brand-gold/50">
          <Plus className="h-4 w-4" aria-hidden /> Choose shortcuts with Edit
        </button>
      )}
    </WidgetShell>
  );
}
