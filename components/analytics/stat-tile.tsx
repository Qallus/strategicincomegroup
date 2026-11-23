import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pct } from "./format";

/**
 * Stat tile (dataviz contract): label · value · optional signed delta vs a named
 * period (direction × whether up is good, always with an arrow + text) · optional
 * sparkline in the de-emphasis hue with the latest point in the accent.
 */
export function StatTile({
  label,
  value,
  delta,
  upIsGood = true,
  comparison,
  detail,
  spark,
}: {
  label: string;
  value: string;
  delta?: number | null;
  upIsGood?: boolean;
  comparison?: string;
  detail?: string;
  spark?: number[];
}) {
  const has = delta != null && Number.isFinite(delta);
  const flat = has && Math.abs(delta!) < 0.5;
  const up = has && delta! > 0;
  const good = has && !flat && up === upIsGood;
  const Icon = !has || flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="sig-viz">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold leading-none">{value}</p>
          {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
        </div>
        <p className="flex min-h-5 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {has ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                flat ? "text-muted-foreground" : good ? "text-emerald-700 dark:text-emerald-400" : "text-destructive dark:text-red-400",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {up ? "+" : ""}
              {pct(delta, Math.abs(delta!) < 10 ? 1 : 0)}
              <span className="sr-only">{flat ? "(no change)" : good ? "(better)" : "(worse)"}</span>
            </span>
          ) : comparison ? (
            <span className="inline-flex items-center gap-0.5">
              <Minus className="h-3.5 w-3.5" aria-hidden /> No baseline
            </span>
          ) : null}
          {comparison ? <span>{comparison}</span> : null}
          {detail ? <span className="w-full">{detail}</span> : null}
        </p>
      </CardContent>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 24;
  const max = Math.max(...values, 1);
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--series-other)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--series-1)" stroke="hsl(var(--card))" strokeWidth={1.5} />
    </svg>
  );
}
