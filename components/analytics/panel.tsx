import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CircleDashed, Clock3, PlugZap, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Titled chart / table card. */
export function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? <CardDescription className="mt-1 text-xs">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-4 pt-2">{children}</CardContent>
    </Card>
  );
}

export type Column<T> = { key: string; label: string; align?: "left" | "right"; className?: string; render: (row: T) => React.ReactNode };

/** Plain data table with a built-in empty state. Numbers right-aligned in tabular figures. */
export function DataTable<T>({ columns, rows, rowKey, empty = "Nothing recorded for this period yet.", maxHeight }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T, i: number) => string; empty?: string; maxHeight?: number }) {
  if (!rows.length) return <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-auto rounded-md border" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-[480px] text-sm">
        <thead className="sticky top-0 z-[1] bg-muted text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("whitespace-nowrap px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-t align-top">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pre-data / pre-migration notice shown above a tab. */
export function Notice({ icon: Icon = Clock3, title, children, tone = "info" }: { icon?: LucideIcon; title: string; children?: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm", tone === "warn" ? "border-amber-500/40 bg-amber-500/10" : "bg-muted/40")}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-primary")} aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

/** "Not connected yet — here's what SIG needs to do" for Phase 2–4 tabs. */
export function NotConnected({
  icon: Icon,
  title,
  description,
  phase,
  steps,
  preview,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: number;
  steps: string[];
  preview: string[];
}) {
  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_1fr] md:p-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2.5 text-primary">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <PlugZap className="h-3.5 w-3.5" aria-hidden /> Not connected yet · Phase {phase}
            </span>
          </div>
          <h2 className="mt-4 text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What this tab will show</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {preview.map((p) => (
              <li key={p} className="flex gap-2">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-semibold">What SIG needs to do</p>
          <ol className="mt-3 space-y-3 text-sm">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                <span className="pt-0.5 leading-6">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusPill({ status }: { status: "live" | "waiting" | "needs_setup" | "error" }) {
  const map = {
    live: { label: "Live", icon: CheckCircle2, cls: "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" },
    waiting: { label: "Waiting for data", icon: Clock3, cls: "border-border bg-muted text-muted-foreground" },
    needs_setup: { label: "Needs setup", icon: PlugZap, cls: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
    error: { label: "Error", icon: TriangleAlert, cls: "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300" },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", map.cls)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {map.label}
    </span>
  );
}
