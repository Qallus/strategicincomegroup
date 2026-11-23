"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { full } from "./format";

export type BarItem = {
  key: string;
  label: string;
  value: number;
  /** Mark color (entity slot). Defaults to series 1. */
  color?: string;
  /** Extra tooltip lines, e.g. "12 conversions". */
  extra?: string[];
  /** Short text after the value, e.g. "38%". */
  note?: string;
};

/**
 * Ranked horizontal bars (magnitude by category). 10px bars with a 4px rounded data
 * end, square at the baseline; value at the tip in text ink; each row is a hover /
 * focus target with its own tooltip. Every value is printed, so no table view is needed.
 */
export function BarList({ items, valueName, max: maxProp, className, emptyText = "No data for this period yet." }: { items: BarItem[]; valueName: string; max?: number; className?: string; emptyText?: string }) {
  const [active, setActive] = React.useState<string | null>(null);
  const max = Math.max(1, maxProp ?? Math.max(0, ...items.map((i) => i.value)));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className={cn("sig-viz space-y-2", className)} aria-label={valueName}>
      {items.map((it) => {
        const w = Math.max(it.value > 0 ? 1.5 : 0, (it.value / max) * 100);
        const isActive = active === it.key;
        return (
          <li
            key={it.key}
            tabIndex={0}
            onPointerEnter={() => setActive(it.key)}
            onPointerLeave={() => setActive((a) => (a === it.key ? null : a))}
            onFocus={() => setActive(it.key)}
            onBlur={() => setActive((a) => (a === it.key ? null : a))}
            className="group relative rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate" title={it.label}>{it.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{full(it.value)}</span>
                {it.note ? <span className="ml-1.5 text-xs text-muted-foreground">{it.note}</span> : null}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full" aria-hidden>
              <div
                className={cn("h-full rounded-r-[4px] transition-[filter]", isActive && "brightness-110")}
                style={{ width: `${w}%`, background: it.color ?? "var(--series-1)" }}
              />
            </div>
            {isActive && it.extra?.length ? (
              <div role="status" className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                <p>
                  <span className="font-semibold tabular-nums">{full(it.value)}</span> <span className="text-muted-foreground">{valueName}</span>
                </p>
                {it.extra.map((e) => (
                  <p key={e} className="text-muted-foreground">{e}</p>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
