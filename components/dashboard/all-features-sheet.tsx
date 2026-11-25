"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { featuresFor, groupFeatures } from "@/lib/dashboard/features";
import type { Permission } from "@/lib/rbac/permissions";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "./responsive-panel";

export function AllFeaturesSheet({ open, onOpenChange, permissions }: { open: boolean; onOpenChange: (v: boolean) => void; permissions: Permission[] }) {
  const [q, setQ] = React.useState("");
  const all = React.useMemo(() => featuresFor(permissions), [permissions]);
  const needle = q.trim().toLowerCase();
  const groups = groupFeatures(all.filter((f) => !needle || [f.label, f.description, f.group, ...(f.keywords ?? [])].join(" ").toLowerCase().includes(needle)));

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="All features"
      description={`${all.length} features you can open.`}
      headerExtra={
        <div className="relative pt-2">
          <Search className="pointer-events-none absolute left-3 top-[1.15rem] h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter features" className="h-9 pl-9" aria-label="Filter features" />
        </div>
      }
    >
      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.group}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {g.items.map((f) => (
                  <li key={f.href}>
                    <Link
                      href={f.href}
                      onClick={() => onOpenChange(false)}
                      className="group flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-border hover:bg-muted/50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/[0.07] text-brand-navy transition group-hover:bg-brand-gold/20 dark:bg-brand-gold/10 dark:text-brand-gold">
                        <f.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {f.label}
                          <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{f.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ResponsiveSheet>
  );
}
