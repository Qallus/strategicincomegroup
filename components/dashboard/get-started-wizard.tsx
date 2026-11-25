"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Briefcase, Check, Headset, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, WIDGET_MAP, widgetsFor } from "@/lib/dashboard/registry";
import { WIZARD_FOCUS, layoutFromWizard, type WizardFocus } from "@/lib/dashboard/presets";
import type { DashboardLayout, DashboardViewer } from "@/lib/dashboard/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "./responsive-panel";

const FOCUS_ICON = { planner: Briefcase, service: Headset, admin: ShieldCheck } as const;
const STEPS = ["Focus", "Rows", "Cards", "Review"];

export function GetStartedWizard({ open, onOpenChange, viewer, onCreate }: { open: boolean; onOpenChange: (v: boolean) => void; viewer: DashboardViewer; onCreate: (layout: DashboardLayout) => void }) {
  const available = React.useMemo(() => new Set(widgetsFor(viewer).map((w) => w.kind)), [viewer]);
  const focusOptions = WIZARD_FOCUS.filter((f) => f.id !== "admin" || viewer.isAdmin);
  const [step, setStep] = React.useState(0);
  const [focus, setFocus] = React.useState<WizardFocus>(viewer.isAdmin ? "admin" : viewer.permissions.includes("manage_participants") ? "planner" : "planner");
  const focusDef = WIZARD_FOCUS.find((f) => f.id === focus)!;
  const rows = React.useMemo(
    () => focusDef.rows.map((r) => ({ ...r, widgets: r.widgets.filter((k) => available.has(k)) })).filter((r) => r.widgets.length),
    [focusDef, available],
  );
  const [rowKeys, setRowKeys] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  // New focus → every suggested row and its cards pre-selected.
  React.useEffect(() => {
    setRowKeys(new Set(rows.map((r) => r.key)));
    setSelected(new Set(rows.flatMap((r) => r.widgets)));
  }, [rows]);

  const toggleRow = (key: string, on: boolean) => {
    const r = rows.find((x) => x.key === key);
    setRowKeys((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    if (r) setSelected((s) => { const n = new Set(s); for (const k of r.widgets) { if (on) n.add(k); else n.delete(k); } return n; });
  };
  const toggleWidget = (kind: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(kind); else n.delete(kind); return n; });

  const chosenRows = rows.filter((r) => rowKeys.has(r.key));
  const extraKinds = [...selected].filter((k) => !chosenRows.some((r) => r.widgets.includes(k)));
  const preview = layoutFromWizard(chosenRows, extraKinds, selected);
  const total = preview.rows.reduce((t, r) => t + r.widgets.length, 0);

  const footer = (
    <div className="flex items-center gap-2">
      <ol className="mr-auto hidden items-center gap-1.5 sm:flex" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-1.5 text-xs", i === step ? "font-semibold text-foreground" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", i < step ? "bg-brand-sage text-white" : i === step ? "bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-navy-deep" : "bg-muted")}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {s}
            {i < STEPS.length - 1 ? <span className="mx-0.5 h-px w-4 bg-border" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <span className="mr-auto text-xs text-muted-foreground sm:hidden">Step {step + 1} of {STEPS.length}</span>
      {step > 0 ? (
        <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
      ) : null}
      {step < STEPS.length - 1 ? (
        <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={step === 2 && selected.size === 0}>
          Next <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" onClick={() => { onCreate(preview); onOpenChange(false); }} disabled={!total}>
          <Sparkles className="h-3.5 w-3.5" /> Create my dashboard
        </Button>
      )}
    </div>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Get started" description="Build a dashboard around how you work. You can change everything later." footer={footer}>
      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose a focus">
          {focusOptions.map((f) => {
            const Icon = FOCUS_ICON[f.id];
            const on = f.id === focus;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFocus(f.id)}
                className={cn(
                  "relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition",
                  on ? "border-brand-gold bg-brand-gold/10 shadow-md ring-1 ring-brand-gold/40" : "border-border hover:border-brand-gold/40",
                )}
              >
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", on ? "bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-navy-deep" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{f.description}</span>
                </span>
                {on ? <Check className="absolute right-3 top-3 h-4 w-4 text-brand-gold" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition", rowKeys.has(r.key) ? "border-brand-gold/60 bg-brand-gold/[0.06]" : "border-border hover:border-brand-gold/40")}>
                <Checkbox checked={rowKeys.has(r.key)} onCheckedChange={(v) => toggleRow(r.key, v)} wrapperClassName="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">{r.description}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {r.widgets.map((k) => (
                      <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{WIDGET_MAP[k]?.title}</span>
                    ))}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {CATEGORIES.map((c) => {
            const defs = widgetsFor(viewer).filter((w) => w.category === c.id);
            if (!defs.length) return null;
            return (
              <section key={c.id}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {defs.map((d) => (
                    <label key={d.kind} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition", selected.has(d.kind) ? "border-brand-gold/60 bg-brand-gold/[0.06]" : "border-border hover:border-brand-gold/40")}>
                      <Checkbox size="sm" checked={selected.has(d.kind)} onCheckedChange={(v) => toggleWidget(d.kind, v)} />
                      <d.icon className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{d.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{d.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm">
            <b>{preview.rows.length}</b> row{preview.rows.length === 1 ? "" : "s"} · <b>{total}</b> card{total === 1 ? "" : "s"}. This replaces your current dashboard layout.
          </p>
          <ol className="space-y-2">
            {preview.rows.map((r, i) => (
              <li key={r.id} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="text-xs font-semibold"><span className="mr-1.5 text-muted-foreground">{i + 1}.</span>{r.title}</p>
                <div className="mt-2 flex gap-1.5 overflow-x-auto sig-noscroll">
                  {r.widgets.map((w) => {
                    const d = WIDGET_MAP[w.kind];
                    return (
                      <span key={w.id} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px]">
                        {d ? <d.icon className="h-3 w-3 text-brand-gold" aria-hidden /> : null}
                        {d?.title}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
