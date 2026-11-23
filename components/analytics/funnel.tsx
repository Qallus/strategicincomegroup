"use client";

import * as React from "react";
import { full, pct, rate } from "./format";

export type FunnelStep = { label: string; value: number; hint?: string };

/**
 * Visit → engaged → lead → booking. One series (one hue, no legend); each step is a
 * bar scaled to the first step with its count and the step-to-step rate printed, so
 * every number is readable without hover. Hover/focus adds the share of all visits.
 */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const first = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="sig-viz space-y-3" aria-label="Conversion funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const step = prev != null ? rate(s.value, prev) : null;
        const w = Math.max(s.value > 0 ? 1.5 : 0, (s.value / first) * 100);
        return (
          <li
            key={s.label}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                {s.label}
                {s.hint ? <span className="ml-1.5 text-xs text-muted-foreground">{s.hint}</span> : null}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{full(s.value)}</span>
                {step != null ? <span className="ml-1.5 text-xs text-muted-foreground">{pct(step)} of previous</span> : null}
              </span>
            </div>
            <div className="mt-1 h-3 w-full rounded-r-[4px] bg-[var(--viz-track)]" aria-hidden>
              <div className="h-full rounded-r-[4px]" style={{ width: `${w}%`, background: "var(--series-1)", filter: active === i ? "brightness(1.1)" : undefined }} />
            </div>
            {active === i ? (
              <div role="status" className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                <span className="font-semibold tabular-nums">{pct(rate(s.value, steps[0]?.value ?? 0))}</span> <span className="text-muted-foreground">of all visits</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
