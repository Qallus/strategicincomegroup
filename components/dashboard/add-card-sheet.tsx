"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, Rows3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, widgetsFor, type WidgetCategory, type WidgetDef } from "@/lib/dashboard/registry";
import { defaultSettingsFor } from "@/lib/dashboard/registry";
import type { DashboardLayout, DashboardViewer, WidgetInstance } from "@/lib/dashboard/types";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResponsiveSheet } from "./responsive-panel";
import { widgetComponent } from "./widgets";

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T | null>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** A live, scaled-down, non-interactive render of the widget. */
function Preview({ def }: { def: WidgetDef }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const Component = widgetComponent(def.kind);
  const widget = React.useMemo<WidgetInstance>(() => ({ id: `preview_${def.kind}`, kind: def.kind, size: def.defaultSize, settings: defaultSettingsFor(def.kind) }), [def]);
  return (
    <div ref={ref} className="relative h-36 overflow-hidden rounded-xl border border-border/60 bg-muted/30" aria-hidden>
      {inView && Component ? (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: "166.66%", transform: "scale(0.6)" }} inert>
          <div className="sig-dash-card">
            <Component widget={widget} def={def} preview />
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <def.icon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
    </div>
  );
}

export function AddCardSheet({
  open,
  onOpenChange,
  viewer,
  layout,
  targetRowId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  viewer: DashboardViewer;
  layout: DashboardLayout;
  targetRowId: string | null;
  onAdd: (kind: string, rowId: string | "new") => void;
}) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | WidgetCategory>("all");
  const [justAdded, setJustAdded] = React.useState<string | null>(null);
  const available = React.useMemo(() => widgetsFor(viewer), [viewer]);
  const present = React.useMemo(() => new Set(layout.rows.flatMap((r) => r.widgets.map((w) => w.kind))), [layout]);
  const cats = CATEGORIES.filter((c) => available.some((w) => w.category === c.id));
  const rows = layout.rows.filter((r) => r.kind !== "strip");
  const target = rows.find((r) => r.id === targetRowId) ?? rows.find((r) => r.kind === "cards") ?? rows[0] ?? null;

  const needle = q.trim().toLowerCase();
  const list = available.filter(
    (w) =>
      (cat === "all" || w.category === cat) &&
      (!needle || [w.title, w.description, ...(w.keywords ?? [])].join(" ").toLowerCase().includes(needle)),
  );

  const add = (kind: string, rowId: string | "new") => {
    onAdd(kind, rowId);
    setJustAdded(kind);
    setTimeout(() => setJustAdded((k) => (k === kind ? null : k)), 1600);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a card"
      description={target ? <>New cards go to <b className="font-semibold text-foreground">{target.title}</b> unless you pick another row.</> : "Pick a card to start a new row."}
      headerExtra={
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" className="h-9 pl-9" aria-label="Search cards" />
          </div>
          <Tabs value={cat} onValueChange={(v) => setCat(v as typeof cat)}>
            <TabsList className="h-9 w-full justify-start">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              {cats.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="text-xs">{c.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      }
    >
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No cards match “{q}”.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((def) => {
            const taken = def.singleton && present.has(def.kind);
            const added = justAdded === def.kind;
            return (
              <li key={def.kind} className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm transition hover:border-brand-gold/40">
                <Preview def={def} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <def.icon className="h-3.5 w-3.5 text-brand-gold" aria-hidden />
                    {def.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{def.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <span className="mr-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{def.sizes.map((s) => s.toUpperCase()).join(" · ")}</span>
                  {taken ? (
                    <span className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden /> On your dashboard</span>
                  ) : (
                    <div className="flex">
                      <button
                        type="button"
                        onClick={() => add(def.kind, target?.id ?? "new")}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-l-lg px-3 text-xs font-semibold transition",
                          added ? "bg-brand-sage text-white" : "bg-brand-navy text-white hover:bg-brand-navy/90 dark:bg-brand-gold dark:text-brand-navy-deep dark:hover:bg-brand-gold/90",
                        )}
                        aria-label={`Add ${def.title}${target ? ` to ${target.title}` : ""}`}
                      >
                        {added ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                        {added ? "Added" : "Add"}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="inline-flex h-8 items-center rounded-r-lg border-l border-white/20 bg-brand-navy px-1.5 text-white hover:bg-brand-navy/90 dark:border-brand-navy-deep/20 dark:bg-brand-gold dark:text-brand-navy-deep" aria-label={`Choose a row for ${def.title}`}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="text-xs">Add to row</DropdownMenuLabel>
                          {rows.map((r) => (
                            <DropdownMenuItem key={r.id} onSelect={() => add(def.kind, r.id)}>
                              <Rows3 className="text-muted-foreground" aria-hidden />
                              <span className="truncate">{r.title}</span>
                              {r.hidden ? <span className="ml-auto text-[10px] text-muted-foreground">hidden</span> : null}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => add(def.kind, "new")}>
                            <Plus aria-hidden /> New row
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ResponsiveSheet>
  );
}
