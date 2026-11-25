"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Check,
  CloudOff,
  Eye,
  LayoutGrid,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Rows3,
  Sparkles,
  SquareDashed,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { WIDGET_MAP } from "@/lib/dashboard/registry";
import { blankLayout, makeWidget, standardLayout, uid } from "@/lib/dashboard/presets";
import { sanitizeLayout } from "@/lib/dashboard/sanitize";
import type { DashboardLayout, DashboardPrefs, DashboardRow, DashboardView, DashboardViewer, WidgetDataResult, WidgetSettings, WidgetSize } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardDataProvider } from "./use-widget-data";
import { DashboardActionsProvider, type DashboardActions } from "./dashboard-context";
import { DashboardRowView, type RowOps } from "./dashboard-row";
import { AddCardSheet } from "./add-card-sheet";
import { GetStartedWizard } from "./get-started-wizard";
import { AllFeaturesSheet } from "./all-features-sheet";
import { CommandSearch } from "./command-search";
import { PostUpdateDialog } from "./post-update-dialog";
import { ConfirmDialog } from "./responsive-panel";

type SaveState = "idle" | "saving" | "saved" | "error";

function greeting(name: string, hour: number | null) {
  const part = hour == null ? "Welcome back" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : "Dashboard overview";
}

function findRowOf(layout: DashboardLayout, widgetId: string): DashboardRow | undefined {
  return layout.rows.find((r) => r.widgets.some((w) => w.id === widgetId));
}

export function DashboardCanvas({ viewer, initialPrefs, seed }: { viewer: DashboardViewer; initialPrefs: DashboardPrefs; seed: Record<string, WidgetDataResult> }) {
  return (
    <DashboardDataProvider seed={seed}>
      <Canvas viewer={viewer} initialPrefs={initialPrefs} />
    </DashboardDataProvider>
  );
}

function Canvas({ viewer, initialPrefs }: { viewer: DashboardViewer; initialPrefs: DashboardPrefs }) {
  const token = useDashboardActionToken();
  const [layout, setLayout] = React.useState<DashboardLayout>(initialPrefs.layout);
  const [customizing, setCustomizing] = React.useState(false);
  const [save, setSave] = React.useState<SaveState>("idle");
  const [addCard, setAddCard] = React.useState<{ open: boolean; rowId: string | null }>({ open: false, rowId: null });
  const [wizard, setWizard] = React.useState(false);
  const [features, setFeatures] = React.useState(false);
  const [search, setSearch] = React.useState(false);
  const [postUpdate, setPostUpdate] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | { kind: "reset" | "blank" } | { kind: "delete_row"; rowId: string }>(null);
  const [whatsNewVersion, setWhatsNewVersion] = React.useState(0);
  const [hour, setHour] = React.useState<number | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<{ type: "row" | "widget"; id: string } | null>(null);

  React.useEffect(() => setHour(new Date().getHours()), []);

  // ── Persistence (debounced PUT) ──
  const dirty = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = React.useRef(layout);
  latest.current = layout;

  const flush = React.useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    setSave("saving");
    try {
      const res = await fetch("/api/me/dashboard-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-sig-action-token": token },
        body: JSON.stringify({ layout: latest.current, actionToken: token }),
        keepalive: true,
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
  }, [token]);

  const update = React.useCallback(
    (fn: (l: DashboardLayout) => DashboardLayout, opts: { immediate?: boolean } = {}) => {
      setLayout((prev) => {
        const next = fn(prev);
        if (next === prev) return prev;
        dirty.current = true;
        return next;
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), opts.immediate ? 50 : 800);
    },
    [flush],
  );

  React.useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  React.useEffect(() => {
    if (save !== "saved") return;
    const t = setTimeout(() => setSave("idle"), 1800);
    return () => clearTimeout(t);
  }, [save]);

  // ⌘K / Ctrl+K opens search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Layout operations ──
  const mapWidgets = (l: DashboardLayout, fn: (w: DashboardRow["widgets"][number]) => DashboardRow["widgets"][number] | null): DashboardLayout => ({
    ...l,
    rows: l.rows.map((r) => ({ ...r, widgets: r.widgets.map(fn).filter((w): w is NonNullable<typeof w> => Boolean(w)) })),
  });

  const ops: RowOps = React.useMemo(
    () => ({
      rename: (rowId, title) => update((l) => ({ ...l, rows: l.rows.map((r) => (r.id === rowId ? { ...r, title: title.slice(0, 60) } : r)) })),
      setHidden: (rowId, hidden) => update((l) => ({ ...l, rows: l.rows.map((r) => (r.id === rowId ? { ...r, hidden } : r)) })),
      setCollapsed: (rowId, collapsed) => update((l) => ({ ...l, rows: l.rows.map((r) => (r.id === rowId ? { ...r, collapsed } : r)) })),
      remove: (rowId) => {
        const row = latest.current.rows.find((r) => r.id === rowId);
        if (row && row.widgets.length) setConfirm({ kind: "delete_row", rowId });
        else update((l) => ({ ...l, rows: l.rows.filter((r) => r.id !== rowId) }));
      },
      addCard: (rowId) => setAddCard({ open: true, rowId }),
      widgetSize: (id, size: WidgetSize) => update((l) => mapWidgets(l, (w) => (w.id === id ? { ...w, size } : w))),
      widgetSettings: (id, patch: WidgetSettings) => update((l) => mapWidgets(l, (w) => (w.id === id ? { ...w, settings: { ...w.settings, ...patch } } : w))),
      widgetRemove: (id) => update((l) => mapWidgets(l, (w) => (w.id === id ? null : w))),
    }),
    [update],
  );

  const addWidget = (kind: string, rowId: string | "new") => {
    const def = WIDGET_MAP[kind];
    if (!def) return;
    const w = makeWidget(kind);
    update(
      (l) => {
        if (rowId === "new" || !l.rows.some((r) => r.id === rowId)) {
          return { ...l, rows: [...l.rows, { id: uid("row"), kind: "cards", title: def.category === "stats" ? "Stats" : "My cards", hidden: false, collapsed: false, widgets: [w] }] };
        }
        return { ...l, rows: l.rows.map((r) => (r.id === rowId ? { ...r, hidden: false, collapsed: false, widgets: [...r.widgets, w] } : r)) };
      },
      { immediate: true },
    );
  };

  const applyLayout = (next: DashboardLayout) => {
    const clean = sanitizeLayout(next, viewer, standardLayout);
    update(() => clean, { immediate: true });
  };

  const dismissGetStarted = React.useCallback(() => {
    update((l) => ({ ...l, rows: l.rows.map((r) => ({ ...r, widgets: r.widgets.filter((w) => w.kind !== "get_started") })).filter((r) => r.widgets.length || r.kind !== "strip") }), { immediate: true });
    void fetch("/api/me/dashboard-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sig-action-token": token },
      body: JSON.stringify({ action: "dismiss_get_started", actionToken: token }),
    }).catch(() => {});
  }, [update, token]);

  const actions: DashboardActions = React.useMemo(
    () => ({
      viewer,
      customizing,
      openWizard: () => setWizard(true),
      openAddCard: (rowId?: string) => setAddCard({ open: true, rowId: rowId ?? null }),
      openPostUpdate: () => setPostUpdate(true),
      openSearch: () => setSearch(true),
      openFeatures: () => setFeatures(true),
      updateWidget: (id, patch) => patch.size && ops.widgetSize(id, patch.size),
      updateSettings: ops.widgetSettings,
      removeWidget: ops.widgetRemove,
      dismissGetStarted,
      whatsNewVersion,
      bumpWhatsNew: () => setWhatsNewVersion((v) => v + 1),
    }),
    [viewer, customizing, ops, dismissGetStarted, whatsNewVersion],
  );

  // ── Drag and drop ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collision: CollisionDetection = React.useCallback((args) => {
    const type = args.active.data.current?.type;
    const containers = args.droppableContainers.filter((c) => (type === "row" ? c.data.current?.type === "row" : c.data.current?.type !== "row"));
    const scoped = { ...args, droppableContainers: containers };
    if (type === "row") return closestCenter(scoped);
    const within = pointerWithin(scoped);
    if (within.length) {
      const widgets = within.filter((c) => containers.find((x) => x.id === c.id)?.data.current?.type === "widget");
      return widgets.length ? widgets : within;
    }
    return closestCenter(scoped);
  }, []);

  const onDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type === "row" ? "row" : "widget";
    setActiveDrag({ type, id: String(e.active.id) });
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "widget") return;
    const activeId = String(active.id);
    const targetRowId = over.data.current?.type === "rowdrop" ? String(over.data.current.rowId) : over.data.current?.type === "widget" ? String(over.data.current.rowId) : null;
    if (!targetRowId) return;
    setLayout((l) => {
      const from = findRowOf(l, activeId);
      if (!from || from.id === targetRowId) return l;
      const widget = from.widgets.find((w) => w.id === activeId)!;
      const to = l.rows.find((r) => r.id === targetRowId);
      if (!to) return l;
      const overIndex = over.data.current?.type === "widget" ? to.widgets.findIndex((w) => w.id === over.id) : to.widgets.length;
      const insertAt = overIndex < 0 ? to.widgets.length : overIndex;
      dirty.current = true;
      return {
        ...l,
        rows: l.rows.map((r) => {
          if (r.id === from.id) return { ...r, widgets: r.widgets.filter((w) => w.id !== activeId) };
          if (r.id === to.id) return { ...r, widgets: [...r.widgets.slice(0, insertAt), widget, ...r.widgets.slice(insertAt)] };
          return r;
        }),
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) {
      if (dirty.current) update((l) => l);
      return;
    }
    if (active.data.current?.type === "row") {
      const a = String(active.id).replace(/^row:/, "");
      const b = String(over.id).replace(/^row:/, "");
      update((l) => {
        const i = l.rows.findIndex((r) => r.id === a);
        const j = l.rows.findIndex((r) => r.id === b);
        if (i < 0 || j < 0 || i === j) return l;
        return { ...l, rows: arrayMove(l.rows, i, j) };
      });
      return;
    }
    const activeId = String(active.id);
    update((l) => {
      const row = findRowOf(l, activeId);
      if (!row || over.data.current?.type !== "widget" || over.data.current.rowId !== row.id) return { ...l };
      const i = row.widgets.findIndex((w) => w.id === activeId);
      const j = row.widgets.findIndex((w) => w.id === over.id);
      if (i < 0 || j < 0 || i === j) return { ...l };
      return { ...l, rows: l.rows.map((r) => (r.id === row.id ? { ...r, widgets: arrayMove(r.widgets, i, j) } : r)) };
    });
  };

  const dragLabel = (() => {
    if (!activeDrag) return null;
    if (activeDrag.type === "row") return layout.rows.find((r) => `row:${r.id}` === activeDrag.id)?.title ?? "Row";
    const w = layout.rows.flatMap((r) => r.widgets).find((x) => x.id === activeDrag.id);
    return w ? WIDGET_MAP[w.kind]?.title ?? "Card" : "Card";
  })();
  const DragIcon = (() => {
    if (!activeDrag || activeDrag.type === "row") return Rows3;
    const w = layout.rows.flatMap((r) => r.widgets).find((x) => x.id === activeDrag.id);
    return (w && WIDGET_MAP[w.kind]?.icon) || SquareDashed;
  })();

  const visibleRows = layout.rows;
  const hiddenRows = layout.rows.filter((r) => r.hidden);
  const empty = layout.rows.every((r) => r.widgets.length === 0);
  const firstName = viewer.firstName;

  const setView = (view: DashboardView) => update((l) => ({ ...l, view }), { immediate: true });

  return (
    <DashboardActionsProvider value={actions}>
      <div className="relative space-y-6 pb-10 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy dark:text-brand-gold">Strategic Income Group</p>
            <h1 className="mt-1 truncate font-serif text-[1.75rem] leading-tight tracking-tight sm:text-4xl">{greeting(firstName, hour)}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex min-w-[4.5rem] items-center justify-end gap-1 text-[11px] text-muted-foreground" aria-live="polite">
              {save === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving</> : save === "saved" ? <><Check className="h-3 w-3 text-brand-sage" aria-hidden /> Saved</> : save === "error" ? <><CloudOff className="h-3 w-3 text-destructive" aria-hidden /> Not saved</> : null}
            </span>
            <ToggleGroup type="single" value={layout.view} onValueChange={(v) => v && setView(v as DashboardView)} aria-label="Dashboard view">
              <ToggleGroupItem value="rows" aria-label="Rows view"><Rows3 /> <span className="hidden sm:inline">Rows</span></ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid /> <span className="hidden sm:inline">Grid</span></ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant={customizing ? "default" : "outline"}
              size="sm"
              onClick={() => { if (customizing) void flush(); setCustomizing((v) => !v); }}
              aria-pressed={customizing}
              className={cn("rounded-lg", customizing && "bg-brand-gold text-brand-navy-deep hover:bg-brand-gold/90")}
            >
              {customizing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {customizing ? "Done" : "Customize"}
            </Button>
            <Button size="sm" onClick={() => setAddCard({ open: true, rowId: null })} className="rounded-lg">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add card</span><span className="sm:hidden">Add</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Dashboard options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Layout</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset" })}><Sparkles aria-hidden /> Standard layout</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConfirm({ kind: "blank" })}><SquareDashed aria-hidden /> Blank canvas</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setWizard(true)}><Wand2 aria-hidden /> Get started wizard</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFeatures(true)}><LayoutGrid aria-hidden /> All features</DropdownMenuItem>
                {viewer.isSuperAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setPostUpdate(true)}><Megaphone aria-hidden /> Post an update</DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset" })} className="text-destructive focus:text-destructive"><RotateCcw aria-hidden /> Reset to Standard</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {customizing ? (
          <div className="sig-pop sticky top-[4.5rem] z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-gold/40 bg-background/85 px-3 py-2.5 shadow-lg backdrop-blur-xl sm:px-4">
            <Pencil className="h-4 w-4 text-brand-gold" aria-hidden />
            <p className="mr-auto text-xs sm:text-sm"><b>Customizing.</b> <span className="text-muted-foreground">Drag the handles to move rows and cards. Changes save automatically.</span></p>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => update((l) => ({ ...l, rows: [...l.rows, { id: uid("row"), kind: "cards", title: "New row", hidden: false, collapsed: false, widgets: [] }] }), { immediate: true })}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setConfirm({ kind: "reset" })}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Standard
            </Button>
            <Button size="sm" className="rounded-lg bg-brand-gold text-brand-navy-deep hover:bg-brand-gold/90" onClick={() => { void flush(); setCustomizing(false); }}>
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          </div>
        ) : null}

        {empty && !customizing ? (
          <div className="sig-dash-card sig-dash-hero sig-card-in flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-white shadow-lg dark:bg-brand-gold dark:text-brand-navy-deep">
              <Wand2 className="h-6 w-6" aria-hidden />
            </span>
            <div className="max-w-md space-y-1.5">
              <h2 className="font-serif text-2xl">A blank canvas</h2>
              <p className="text-sm text-muted-foreground">Answer three quick questions and we&apos;ll build a dashboard around how you work — or add cards one at a time.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setWizard(true)} className="rounded-lg"><Wand2 className="h-4 w-4" /> Start the wizard</Button>
              <Button variant="outline" onClick={() => setAddCard({ open: true, rowId: null })} className="rounded-lg"><Plus className="h-4 w-4" /> Add a card</Button>
              <Button variant="ghost" onClick={() => applyLayout(standardLayout())} className="rounded-lg"><Sparkles className="h-4 w-4" /> Use Standard</Button>
            </div>
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
          <SortableContext items={visibleRows.map((r) => `row:${r.id}`)} strategy={verticalListSortingStrategy}>
            <div className={cn("space-y-7 sm:space-y-9", customizing && "space-y-5 sm:space-y-6")}>
              {visibleRows.map((row, i) => (
                <DashboardRowView key={row.id} row={row} view={layout.view} viewer={viewer} customizing={customizing} ops={ops} rowIndex={i} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            {activeDrag ? (
              <div className="sig-lift flex items-center gap-2.5 rounded-xl border border-brand-gold/60 bg-background/95 px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur">
                <DragIcon className="h-4 w-4 text-brand-gold" aria-hidden />
                {dragLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {hiddenRows.length && !customizing ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <span>Hidden rows:</span>
            {hiddenRows.map((r) => (
              <button key={r.id} type="button" onClick={() => ops.setHidden(r.id, false)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-medium text-foreground transition hover:border-brand-gold/50">
                <Eye className="h-3 w-3" aria-hidden /> {r.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <AddCardSheet open={addCard.open} onOpenChange={(v) => setAddCard((s) => ({ ...s, open: v }))} viewer={viewer} layout={layout} targetRowId={addCard.rowId} onAdd={addWidget} />
      <GetStartedWizard open={wizard} onOpenChange={setWizard} viewer={viewer} onCreate={applyLayout} />
      <AllFeaturesSheet open={features} onOpenChange={setFeatures} permissions={viewer.permissions} />
      <CommandSearch
        open={search}
        onOpenChange={setSearch}
        permissions={viewer.permissions}
        onAction={(a) => (a === "add_card" ? setAddCard({ open: true, rowId: null }) : a === "wizard" ? setWizard(true) : setFeatures(true))}
      />
      {viewer.isSuperAdmin ? <PostUpdateDialog open={postUpdate} onOpenChange={setPostUpdate} onPosted={() => setWhatsNewVersion((v) => v + 1)} /> : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.kind === "delete_row" ? "Delete this row?" : confirm?.kind === "blank" ? "Start from a blank canvas?" : "Reset to the Standard layout?"}
        description={
          confirm?.kind === "delete_row"
            ? "The row and its cards are removed from your dashboard. You can add them back from Add card."
            : confirm?.kind === "blank"
              ? "Every row is removed so you can build your own with the Get Started wizard."
              : "Your rows, cards and settings are replaced with the Standard dashboard."
        }
        confirmLabel={confirm?.kind === "delete_row" ? "Delete row" : confirm?.kind === "blank" ? "Clear dashboard" : "Reset"}
        destructive
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "delete_row") update((l) => ({ ...l, rows: l.rows.filter((r) => r.id !== confirm.rowId) }), { immediate: true });
          else if (confirm.kind === "blank") { applyLayout({ ...blankLayout(), view: layout.view }); setWizard(true); }
          else applyLayout({ ...standardLayout(), view: layout.view });
        }}
      />
    </DashboardActionsProvider>
  );
}
