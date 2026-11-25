"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIDGET_MAP } from "@/lib/dashboard/registry";
import type { DashboardRow, DashboardView, DashboardViewer, RowKind, WidgetInstance, WidgetSettings, WidgetSize } from "@/lib/dashboard/types";
import { Carousel, CarouselArrows, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { WidgetFrame } from "./widget-frame";

// One dashboard row. Rows view = a single swipeable Embla track (arrows, edge fades, hide
// eye); Grid view = the same widgets wrapped into a responsive grid; Customize = the grid
// layout with @dnd-kit sortable handles (rows + widgets, within and between rows).

export function slideBasis(kind: RowKind, size: WidgetSize): string {
  if (kind === "strip") return "basis-full";
  if (kind === "toolbar") {
    return { s: "basis-[48%] sm:basis-[31%] lg:basis-[17%]", m: "basis-[88%] sm:basis-[62%] lg:basis-[33%]", l: "basis-full lg:basis-1/2" }[size];
  }
  // m = 3.5 cards visible on wide screens (My Tasks), s = 5.5 (stat cards).
  return {
    s: "basis-[64%] sm:basis-[38%] lg:basis-[24%] xl:basis-[18.18%]",
    m: "basis-[86%] sm:basis-[56%] lg:basis-[40%] xl:basis-[28.57%]",
    l: "basis-[92%] sm:basis-[82%] lg:basis-[66%] xl:basis-1/2",
  }[size];
}

export function gridSpan(kind: RowKind, size: WidgetSize): string {
  if (kind === "strip") return "col-span-2 sm:col-span-6 lg:col-span-12";
  return {
    s: "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-2",
    m: "col-span-2 sm:col-span-3 lg:col-span-4",
    l: "col-span-2 sm:col-span-6 lg:col-span-6",
  }[size];
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-6 sm:gap-4 lg:grid-cols-12";

export type RowOps = {
  rename: (rowId: string, title: string) => void;
  setHidden: (rowId: string, hidden: boolean) => void;
  setCollapsed: (rowId: string, collapsed: boolean) => void;
  remove: (rowId: string) => void;
  addCard: (rowId: string) => void;
  widgetSize: (id: string, size: WidgetSize) => void;
  widgetSettings: (id: string, patch: WidgetSettings) => void;
  widgetRemove: (id: string) => void;
};

function SortableWidget({ widget, row, viewer, index, ops }: { widget: WidgetInstance; row: DashboardRow; viewer: DashboardViewer; index: number; ops: RowOps }) {
  const def = WIDGET_MAP[widget.kind];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, data: { type: "widget", rowId: row.id } });
  if (!def) return null;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(gridSpan(row.kind, widget.size), "min-w-0")}>
      <WidgetFrame
        widget={widget}
        def={def}
        viewer={viewer}
        customizing
        index={index}
        dragging={isDragging}
        handle={{ attributes: attributes as unknown as React.HTMLAttributes<HTMLElement>, listeners: listeners as unknown as Record<string, (e: unknown) => void>, setActivatorNodeRef }}
        onSize={(s) => ops.widgetSize(widget.id, s)}
        onSettings={(p) => ops.widgetSettings(widget.id, p)}
        onRemove={() => ops.widgetRemove(widget.id)}
      />
    </div>
  );
}

function RowDropZone({ row, children }: { row: DashboardRow; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${row.id}`, data: { type: "rowdrop", rowId: row.id } });
  return (
    <div ref={setNodeRef} className={cn("min-h-[5rem] rounded-2xl p-2 transition", isOver ? "bg-brand-gold/10 ring-2 ring-brand-gold/50" : "bg-muted/30 ring-1 ring-border/70")}>
      {children}
    </div>
  );
}

export function DashboardRowView({
  row,
  view,
  viewer,
  customizing,
  ops,
  rowIndex,
}: {
  row: DashboardRow;
  view: DashboardView;
  viewer: DashboardViewer;
  customizing: boolean;
  ops: RowOps;
  rowIndex: number;
}) {
  const sortable = useSortable({ id: `row:${row.id}`, data: { type: "row" }, disabled: !customizing });
  const style = customizing ? { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition } : undefined;
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(row.title);
  React.useEffect(() => setTitle(row.title), [row.title]);
  const headingId = `row-h-${row.id}`;
  const quiet = row.kind === "toolbar" || row.kind === "strip";

  if (row.hidden && !customizing) return null;

  // ── Customize mode ──
  if (customizing) {
    return (
      <section ref={sortable.setNodeRef} style={style} aria-labelledby={headingId} className={cn("space-y-2", sortable.isDragging && "opacity-40", row.hidden && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label={`Move row ${row.title}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {editing ? (
            <Input
              autoFocus
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { ops.rename(row.id, title.trim() || row.title); setEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { ops.rename(row.id, title.trim() || row.title); setEditing(false); }
                if (e.key === "Escape") { setTitle(row.title); setEditing(false); }
              }}
              className="h-8 w-56 text-sm font-semibold"
              aria-label="Row name"
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} id={headingId} className="rounded-md px-1.5 py-1 text-sm font-semibold hover:bg-muted" title="Rename row">
              {row.title}
            </button>
          )}
          <span className="text-xs text-muted-foreground">{row.widgets.length} card{row.widgets.length === 1 ? "" : "s"}</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => ops.addCard(row.id)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add card
            </button>
            <button
              type="button"
              onClick={() => ops.setHidden(row.id, !row.hidden)}
              className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium hover:bg-muted", row.hidden ? "text-brand-gold" : "text-muted-foreground hover:text-foreground")}
              aria-pressed={row.hidden}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden /> {row.hidden ? "Hidden" : "Hide"}
            </button>
            <button type="button" onClick={() => ops.remove(row.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete row ${row.title}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <RowDropZone row={row}>
          <SortableContext items={row.widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            {row.widgets.length ? (
              <div className={GRID}>
                {row.widgets.map((w, i) => <SortableWidget key={w.id} widget={w} row={row} viewer={viewer} index={i} ops={ops} />)}
              </div>
            ) : (
              <button type="button" onClick={() => ops.addCard(row.id)} className="flex h-20 w-full items-center justify-center gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" aria-hidden /> Drop cards here or add one
              </button>
            )}
          </SortableContext>
        </RowDropZone>
      </section>
    );
  }

  const frames = row.widgets.map((w, i) => {
    const def = WIDGET_MAP[w.kind];
    if (!def) return null;
    return {
      w,
      el: (
        <WidgetFrame
          widget={w}
          def={def}
          viewer={viewer}
          customizing={false}
          index={rowIndex * 2 + i}
          onSize={(s) => ops.widgetSize(w.id, s)}
          onSettings={(p) => ops.widgetSettings(w.id, p)}
          onRemove={() => ops.widgetRemove(w.id)}
        />
      ),
    };
  });

  const header = (arrows: React.ReactNode) =>
    quiet ? (
      <h2 id={headingId} className="sr-only">{row.title}</h2>
    ) : (
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => ops.setCollapsed(row.id, !row.collapsed)}
          className="group flex min-w-0 items-center gap-1.5 rounded-md text-left"
          aria-expanded={!row.collapsed}
          aria-controls={`row-b-${row.id}`}
        >
          <h2 id={headingId} className="truncate text-base font-semibold tracking-tight sm:text-lg">{row.title}</h2>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", row.collapsed && "-rotate-90")} aria-hidden />
        </button>
        <span className="hidden text-xs text-muted-foreground sm:inline">{row.widgets.length}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {!row.collapsed ? arrows : null}
          <button
            type="button"
            onClick={() => ops.setHidden(row.id, true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={`Hide the ${row.title} row`}
            title="Hide row"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );

  const quietHide = quiet ? (
    <button
      type="button"
      onClick={() => ops.setHidden(row.id, true)}
      className="absolute -top-2 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
      aria-label={`Hide the ${row.title} row`}
      title="Hide row"
    >
      <EyeOff className="h-3 w-3" />
    </button>
  ) : null;

  if (!row.widgets.length) {
    return (
      <section aria-labelledby={headingId} className="group/row relative">
        {header(null)}
        {!row.collapsed ? (
          <button type="button" onClick={() => ops.addCard(row.id)} className="flex h-24 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition hover:border-brand-gold/50 hover:text-foreground">
            <Plus className="h-4 w-4" aria-hidden /> Add a card to this row
          </button>
        ) : null}
      </section>
    );
  }

  if (view === "grid") {
    return (
      <section aria-labelledby={headingId} className="group/row relative">
        {header(null)}
        {quietHide}
        {!row.collapsed ? (
          <div id={`row-b-${row.id}`} className={GRID}>
            {frames.map((f) => (f ? <div key={f.w.id} className={cn(gridSpan(row.kind, f.w.size), "min-w-0")}>{f.el}</div> : null))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <Carousel aria-labelledby={headingId} className="group/row" tabIndex={-1}>
      <section aria-labelledby={headingId} className="relative">
        {header(<CarouselArrows label={`${row.title} cards`} />)}
        {quietHide}
        {!row.collapsed ? (
          <div id={`row-b-${row.id}`}>
            <CarouselContent>
              {frames.map((f) => (f ? <CarouselItem key={f.w.id} className={slideBasis(row.kind, f.w.size)}>{f.el}</CarouselItem> : null))}
            </CarouselContent>
          </div>
        ) : null}
      </section>
    </Carousel>
  );
}
