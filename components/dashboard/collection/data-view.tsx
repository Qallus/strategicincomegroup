"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Columns3, Download, Eye, EyeOff,
  KanbanSquare, LayoutGrid, List, Loader2, Plus, Search, SlidersHorizontal, Table2, Upload, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QuickActionBar } from "./quick-action-bar";
import { downloadCsv, parseCsv, toCsv } from "./csv";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * DataView — the one layout every SIG dashboard list uses.
 *
 *   stat cards (hide / reveal) → search + filters → views (list · table · cards · board · calendar)
 *   → export · import · add → rows with checkboxes → quick-action bar at the bottom.
 *
 * Table view: click a header to sort, drag a header edge to resize, "Columns" to show/hide.
 * Preferences (view, hidden columns, widths, stats hidden) are remembered per page in this browser.
 * Board appears when the page passes `board`, calendar when it passes `date`.
 */

export type DataColumn<T> = {
  id: string;
  label: string;
  cell: (row: T) => React.ReactNode;
  /** Makes the header sortable. */
  sort?: (row: T) => string | number | null | undefined;
  /** Value written to CSV exports (defaults to `sort`). */
  exportValue?: (row: T) => string | number | null | undefined;
  /** Starting width in px (table view). */
  width?: number;
  /** Hidden until the user turns it on in "Columns". */
  defaultHidden?: boolean;
  /** Can't be hidden (e.g. the name column). */
  required?: boolean;
  align?: "left" | "right" | "center";
};

export type DataFilter<T> = { id: string; label: string; test: (row: T) => boolean };

/** A dropdown filter, e.g. Status → Active / Archived. */
export type DataSelectFilter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string | string[] | null | undefined;
};

export type DataAction<T> = {
  label: string;
  icon: LucideIcon;
  /**
   * Return a string to show it as a success message (e.g. "Link copied"). Return `false`
   * when the user backed out (e.g. cancelled a confirm) so a destructive action keeps the selection.
   */
  run: (rows: T[]) => unknown;
  destructive?: boolean;
  /** Only when exactly one row is ticked. */
  single?: boolean;
  show?: (rows: T[]) => boolean;
};

export type DataStat = { label: string; value: React.ReactNode; icon?: LucideIcon; hint?: string; onClick?: () => void; active?: boolean };

type View = "list" | "table" | "cards" | "board" | "calendar";

export type DataViewProps<T> = {
  items: T[];
  getId: (row: T) => string;
  title: (row: T) => string;
  subtitle?: (row: T) => React.ReactNode;
  media?: (row: T) => React.ReactNode;
  /** Large cover image URL for cards view (blog featured images, media thumbnails). */
  cardImage?: (row: T) => string | null | undefined;
  badge?: (row: T) => React.ReactNode;
  meta?: (row: T) => React.ReactNode;
  columns: DataColumn<T>[];
  searchText: (row: T) => string;
  /** Chip filters (first one is the default, usually "All"). */
  filters?: DataFilter<T>[];
  selectFilters?: DataSelectFilter<T>[];
  stats?: DataStat[];
  actions?: DataAction<T>[];
  /** Kanban board grouped by a field; `onMove` makes cards draggable between lanes. */
  board?: { lanes: { id: string; label: string }[]; get: (row: T) => string; onMove?: (row: T, lane: string) => unknown };
  /** ISO date/datetime per row → calendar view. */
  date?: (row: T) => string | null | undefined;
  preview?: (row: T, close: () => void) => React.ReactNode;
  onOpen?: (row: T) => void;
  add?: { label: string; onClick: () => void };
  /** CSV import: receives parsed rows (header → value). Return a message to show. */
  onImport?: (rows: Record<string, string>[]) => Promise<string | void> | string | void;
  /** File name stem for exports. */
  exportName?: string;
  toolbar?: React.ReactNode;
  storageKey: string;
  defaultView?: View;
  views?: View[];
  noun?: [string, string];
  empty?: React.ReactNode;
  loading?: boolean;
};

const VIEW_META: Record<View, { label: string; icon: LucideIcon }> = {
  list: { label: "List", icon: List },
  table: { label: "Table", icon: Table2 },
  cards: { label: "Cards", icon: LayoutGrid },
  board: { label: "Board", icon: KanbanSquare },
  calendar: { label: "Calendar", icon: CalendarDays },
};

type Prefs = { view?: View; hidden?: string[]; widths?: Record<string, number>; statsHidden?: boolean };

function usePrefs(key: string) {
  const storageKey = `sig.dataview.${key}`;
  const [prefs, setPrefs] = useState<Prefs>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPrefs(JSON.parse(raw) as Prefs);
    } catch {
      /* storage blocked */
    }
  }, [storageKey]);
  const update = useCallback(
    (patch: Prefs) =>
      setPrefs((p) => {
        const next = { ...p, ...patch };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* storage blocked — prefs last for this visit */
        }
        return next;
      }),
    [storageKey],
  );
  return [prefs, update] as const;
}

function Check({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <Checkbox
      checked={checked}
      indeterminate={Boolean(indeterminate)}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
    />
  );
}

export function DataView<T>(p: DataViewProps<T>) {
  const [prefs, setPrefs] = usePrefs(p.storageKey);
  const views = useMemo<View[]>(() => {
    const base = p.views ?? (["list", "table", "cards"] as View[]);
    const extra: View[] = [];
    if (p.board && !base.includes("board")) extra.push("board");
    if (p.date && !base.includes("calendar")) extra.push("calendar");
    return [...base, ...extra];
  }, [p.views, p.board, p.date]);
  const view: View = prefs.view && views.includes(prefs.view) ? prefs.view : p.defaultView && views.includes(p.defaultView) ? p.defaultView : "table";

  const [q, setQ] = useState("");
  const [chip, setChip] = useState(p.filters?.[0]?.id ?? "");
  const [selects, setSelects] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [one, many] = p.noun ?? ["item", "items"];
  const fileRef = useRef<HTMLInputElement>(null);

  const hidden = useMemo(
    () => new Set(prefs.hidden ?? p.columns.filter((c) => c.defaultHidden).map((c) => c.id)),
    [prefs.hidden, p.columns],
  );
  const columns = p.columns.filter((c) => c.required || !hidden.has(c.id));

  const rows = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const f = p.filters?.find((x) => x.id === chip);
    const out = p.items.filter((r) => {
      if (f && !f.test(r)) return false;
      for (const sf of p.selectFilters ?? []) {
        const want = selects[sf.id];
        if (!want?.length) continue;
        const v = sf.get(r);
        const vals = Array.isArray(v) ? v : v == null ? [] : [v];
        if (!vals.some((x) => want.includes(x))) return false;
      }
      if (words.length) {
        const hay = p.searchText(r).toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const col = sort ? p.columns.find((c) => c.id === sort.id) : undefined;
    if (!sort || !col?.sort) return out;
    return [...out].sort((x, y) => {
      const a = col.sort!(x);
      const b = col.sort!(y);
      const cmp =
        a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [p, q, chip, selects, sort]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShown = rows.length > 0 && rows.every((r) => selected.has(p.getId(r)));
  const someShown = !allShown && rows.some((r) => selected.has(p.getId(r)));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      rows.forEach((r) => (allShown ? n.delete(p.getId(r)) : n.add(p.getId(r))));
      return n;
    });
  const picked = p.items.filter((r) => selected.has(p.getId(r)));
  const onSort = (id: string) => setSort((s) => (s?.id === id ? (s.dir === "asc" ? { id, dir: "desc" } : null) : { id, dir: "asc" }));
  const open = (r: T) => (p.onOpen ? p.onOpen(r) : p.preview ? setOpenId(p.getId(r)) : undefined);
  const current = openId ? p.items.find((r) => p.getId(r) === openId) ?? null : null;
  const activeFilters = Object.values(selects).reduce((n, v) => n + v.length, 0) + (chip && chip !== p.filters?.[0]?.id ? 1 : 0);

  function exportRows(list: T[]) {
    const cols = p.columns.filter((c) => c.exportValue || c.sort);
    const csv = toCsv(
      cols.map((c) => c.label),
      list.map((r) => cols.map((c) => (c.exportValue ?? c.sort)!(r) ?? "")),
    );
    downloadCsv(`${p.exportName ?? p.storageKey}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setMessage({ text: `Exported ${list.length} ${list.length === 1 ? one : many}.` });
  }

  async function onFile(file: File) {
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length) throw new Error("That file has no rows.");
      const result = await p.onImport?.(parsed);
      setMessage({ text: result || `Imported ${parsed.length} ${parsed.length === 1 ? one : many}.` });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Import failed.", error: true });
    }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const vp = { ...p, rows, columns, selected, toggle, open };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {p.stats?.length ? (
        <div>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setPrefs({ statsHidden: !prefs.statsHidden })}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {prefs.statsHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {prefs.statsHidden ? "Show stats" : "Hide stats"}
            </button>
          </div>
          {!prefs.statsHidden ? (
            <div className="grid grid-flow-col auto-cols-[minmax(160px,78%)] gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {p.stats.map((s) => {
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{s.label}</p>
                      {s.icon ? <s.icon className="h-4 w-4 text-muted-foreground" /> : null}
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{s.value}</p>
                    {s.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p> : null}
                  </>
                );
                const cls = cn("rounded-xl border bg-card p-4 text-left transition-colors", s.active && "border-primary/50 ring-1 ring-primary/30");
                return s.onClick ? (
                  <button key={s.label} type="button" onClick={s.onClick} className={cn(cls, "hover:border-primary/40")}>
                    {body}
                  </button>
                ) : (
                  <div key={s.label} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${many}…`} className="h-9 pl-8 pr-8" aria-label={`Search ${many}`} />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {p.selectFilters?.map((sf) => {
          const on = selects[sf.id] ?? [];
          return (
            <DropdownMenu key={sf.id}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9", on.length && "border-primary/50 text-primary")}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {sf.label}
                  {on.length ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{on.length}</span> : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{sf.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sf.options.map((o) => (
                  <DropdownMenuCheckboxItem
                    key={o.value}
                    checked={on.includes(o.value)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => setSelects((s) => ({ ...s, [sf.id]: c ? [...on, o.value] : on.filter((x) => x !== o.value) }))}
                  >
                    {o.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {on.length ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setSelects((s) => ({ ...s, [sf.id]: [] }))}>Clear</DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div role="tablist" aria-label="View" className="flex items-center rounded-lg border bg-card p-0.5">
            {views.map((v) => {
              const M = VIEW_META[v];
              return (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  title={M.label}
                  onClick={() => setPrefs({ view: v })}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors", view === v ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  <M.icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{M.label}</span>
                </button>
              );
            })}
          </div>

          {view === "table" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Columns3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {p.columns.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    disabled={c.required}
                    checked={c.required || !hidden.has(c.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) => {
                      const next = new Set(hidden);
                      if (on) next.delete(c.id);
                      else next.add(c.id);
                      setPrefs({ hidden: [...next] });
                    }}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPrefs({ hidden: undefined, widths: undefined })}>Reset columns</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button variant="outline" size="sm" className="h-9" onClick={() => exportRows(rows)} title={`Export ${rows.length} shown`}>
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
          </Button>
          {p.onImport ? (
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Import</span>
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onFile(f);
                }}
              />
            </>
          ) : null}
          {p.toolbar}
          {p.add ? (
            <Button size="sm" className="h-9" onClick={p.add.onClick}>
              <Plus className="h-3.5 w-3.5" /> {p.add.label}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Chip filters */}
      {p.filters && p.filters.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {p.filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setChip(f.id)}
              className={cn("shrink-0 rounded-full border px-3 py-1 text-sm transition-colors", chip === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
            >
              {f.label} <span className="tabular-nums opacity-70">{p.items.filter(f.test).length}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Result line */}
      <div className="flex min-h-5 flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {view !== "table" && view !== "calendar" && rows.length > 0 && p.actions?.length ? (
          <label className="flex cursor-pointer items-center gap-2">
            <Check checked={allShown} indeterminate={someShown} onChange={toggleAll} label="Select all shown" /> Select all {rows.length}
          </label>
        ) : null}
        <span className="tabular-nums">
          {rows.length} of {p.items.length} {p.items.length === 1 ? one : many}
        </span>
        {q || activeFilters ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setChip(p.filters?.[0]?.id ?? "");
              setSelects({});
            }}
            className="text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
        {p.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      </div>

      {/* Body */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q || activeFilters ? `No ${many} match these filters.` : p.empty ?? `No ${many} yet.`}
        </div>
      ) : view === "list" ? (
        <ListView {...vp} />
      ) : view === "cards" ? (
        <CardsView {...vp} />
      ) : view === "board" && p.board ? (
        <BoardView {...vp} board={p.board} />
      ) : view === "calendar" && p.date ? (
        <CalendarView {...vp} date={p.date} />
      ) : (
        <TableView
          {...vp}
          sort={sort}
          onSort={onSort}
          allShown={allShown}
          someShown={someShown}
          toggleAll={toggleAll}
          widths={prefs.widths ?? {}}
          setWidth={(id, w) => setPrefs({ widths: { ...(prefs.widths ?? {}), [id]: w } })}
        />
      )}

      {/* Bulk actions */}
      <QuickActionBar count={picked.length} total={rows.length} onSelectAll={toggleAll} onClear={() => setSelected(new Set())} message={picked.length ? message : null}>
        <Button size="sm" variant="outline" onClick={() => exportRows(picked)}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        {(p.actions ?? [])
          .filter((a) => !a.show || a.show(picked))
          .map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.destructive ? "destructive" : "outline"}
              disabled={pending || (a.single && picked.length !== 1)}
              title={a.single && picked.length !== 1 ? `Select one ${one}` : undefined}
              onClick={() =>
                start(async () => {
                  try {
                    const result = await a.run(picked);
                    if (result === false) return; // backed out (cancelled confirm)
                    if (typeof result === "string" && result) setMessage({ text: result });
                    if (a.destructive) setSelected(new Set());
                  } catch (e) {
                    setMessage({ text: e instanceof Error ? e.message : `${a.label} failed.`, error: true });
                  }
                })
              }
            >
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </Button>
          ))}
      </QuickActionBar>
      {message && !picked.length ? (
        <p role="status" className={cn("fixed inset-x-3 bottom-4 z-40 mx-auto w-fit max-w-md rounded-lg border bg-popover px-4 py-2 text-sm shadow-lg sm:bottom-6", message.error ? "border-destructive/40 text-destructive" : "text-foreground")}>
          {message.text}
        </p>
      ) : null}

      {/* Preview sheet */}
      {p.preview ? (
        <Sheet open={Boolean(current)} onOpenChange={(o) => !o && setOpenId(null)}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
            {current ? (
              <>
                <SheetHeader className="border-b p-5 text-left">
                  <div className="flex items-center gap-3">
                    {p.media?.(current)}
                    <div className="min-w-0">
                      <SheetTitle className="truncate">{p.title(current)}</SheetTitle>
                      {p.subtitle ? <SheetDescription className="truncate">{p.subtitle(current)}</SheetDescription> : null}
                    </div>
                  </div>
                </SheetHeader>
                <div className="flex-1 p-5">{p.preview(current, () => setOpenId(null))}</div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────

type ViewProps<T> = DataViewProps<T> & { rows: T[]; columns: DataColumn<T>[]; selected: Set<string>; toggle: (id: string) => void; open: (row: T) => void };

function Pick<T>({ p, row }: { p: ViewProps<T>; row: T }) {
  const id = p.getId(row);
  return <Check checked={p.selected.has(id)} onChange={() => p.toggle(id)} label={`Select ${p.title(row)}`} />;
}

const clickable = <T,>(p: ViewProps<T>, row: T) =>
  p.onOpen || p.preview
    ? { role: "button" as const, tabIndex: 0, onClick: () => p.open(row), onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && p.open(row) }
    : {};

function ListView<T>(p: ViewProps<T>) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {p.rows.map((r) => {
        const id = p.getId(r);
        return (
          <li key={id} {...clickable(p, r)} className={cn("flex items-center gap-3 px-3 py-3 transition-colors sm:px-4", (p.onOpen || p.preview) && "cursor-pointer hover:bg-muted/50", p.selected.has(id) && "bg-primary/5")}>
            <Pick p={p} row={r} />
            {p.media?.(r)}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium">{p.title(r)}</p>
                {p.badge?.(r)}
              </div>
              {p.subtitle ? <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p> : null}
            </div>
            {p.meta ? <div className="hidden min-w-0 max-w-[40%] truncate text-xs text-muted-foreground md:block">{p.meta(r)}</div> : null}
            {p.onOpen || p.preview ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function CardsView<T>(p: ViewProps<T>) {
  const extra = p.columns.filter((c) => !c.required).slice(0, 3);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-6">
      {p.rows.map((r) => {
        const id = p.getId(r);
        return (
          <div key={id} {...clickable(p, r)} className={cn("flex flex-col overflow-hidden rounded-xl border bg-card p-4 transition", (p.onOpen || p.preview) && "cursor-pointer hover:border-primary/40 hover:shadow-md", p.selected.has(id) && "border-primary/50 ring-1 ring-primary/30")}>
            {p.cardImage ? (
              <div className="-mx-4 -mt-4 mb-4 aspect-[16/9] overflow-hidden border-b bg-muted">
                {p.cardImage(r) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cardImage(r)!} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <Pick p={p} row={r} />
              {p.media?.(r)}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title(r)}</p>
                {p.subtitle ? <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p> : null}
              </div>
              {p.badge?.(r)}
            </div>
            {extra.length ? (
              <dl className="mt-3 grid gap-1.5 border-t pt-3 text-xs">
                {extra.map((c) => (
                  <div key={c.id} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">{c.label}</dt>
                    <dd className="min-w-0 truncate text-right">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {p.meta ? <div className="mt-3 text-xs text-muted-foreground">{p.meta(r)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function TableView<T>(
  p: ViewProps<T> & {
    sort: { id: string; dir: "asc" | "desc" } | null;
    onSort: (id: string) => void;
    allShown: boolean;
    someShown: boolean;
    toggleAll: () => void;
    widths: Record<string, number>;
    setWidth: (id: string, w: number) => void;
  },
) {
  const [live, setLive] = useState<Record<string, number>>({});
  const widthOf = (c: DataColumn<T>) => live[c.id] ?? p.widths[c.id] ?? c.width ?? 180;

  function startResize(e: React.PointerEvent, c: DataColumn<T>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(c);
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.max(72, Math.min(800, startW + ev.clientX - startX));
      setLive((s) => ({ ...s, [c.id]: w }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      p.setWidth(c.id, w);
      setLive((s) => {
        const n = { ...s };
        delete n[c.id];
        return n;
      });
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const total = 44 + p.columns.reduce((s, c) => s + widthOf(c), 0);
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="table-fixed border-collapse text-sm" style={{ width: `max(100%, ${total}px)` }}>
        <colgroup>
          <col style={{ width: 44 }} />
          {p.columns.map((c) => (
            <col key={c.id} style={{ width: widthOf(c) }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted/60 text-left text-xs text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-3 py-2.5">
              <Check checked={p.allShown} indeterminate={p.someShown} onChange={p.toggleAll} label="Select all shown" />
            </th>
            {p.columns.map((c) => {
              const on = p.sort?.id === c.id;
              const Icon = !on ? ArrowUpDown : p.sort!.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.id}
                  aria-sort={on ? (p.sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("group relative select-none px-3 py-2.5 font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center")}
                >
                  {c.sort ? (
                    <button type="button" onClick={() => p.onSort(c.id)} className={cn("inline-flex max-w-full items-center gap-1 truncate hover:text-foreground", on && "text-foreground")}>
                      <span className="truncate">{c.label}</span>
                      <Icon className={cn("h-3 w-3 shrink-0", !on && "opacity-0 group-hover:opacity-50")} />
                    </button>
                  ) : (
                    <span className="truncate">{c.label}</span>
                  )}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${c.label}`}
                    onPointerDown={(e) => startResize(e, c)}
                    onDoubleClick={() => p.setWidth(c.id, c.width ?? 180)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none after:absolute after:right-0.5 after:top-1/4 after:h-1/2 after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary"
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {p.rows.map((r) => {
            const id = p.getId(r);
            return (
              <tr key={id} {...clickable(p, r)} className={cn("transition-colors", (p.onOpen || p.preview) && "cursor-pointer hover:bg-muted/40", p.selected.has(id) && "bg-primary/5")}>
                <td className="px-3 py-2.5">
                  <Pick p={p} row={r} />
                </td>
                {p.columns.map((c) => (
                  <td key={c.id} className={cn("truncate px-3 py-2.5", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center")}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BoardView<T>(p: ViewProps<T> & { board: NonNullable<DataViewProps<T>["board"]> }) {
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  async function move(row: T, lane: string) {
    setError(null);
    try {
      await p.board.onMove?.(row, lane);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t move that item.");
    }
  }
  return (
    <div>
    {error ? (
      <p role="alert" className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
    ) : null}
    <div className="flex gap-3 overflow-x-auto pb-2">
      {p.board.lanes.map((lane) => {
        const items = p.rows.filter((r) => p.board.get(r) === lane.id);
        return (
          <section
            key={lane.id}
            onDragOver={(e) => {
              if (!p.board.onMove) return;
              e.preventDefault();
              setOver(lane.id);
            }}
            onDragLeave={() => setOver((o) => (o === lane.id ? null : o))}
            onDrop={() => {
              setOver(null);
              const row = p.items.find((r) => p.getId(r) === dragId.current);
              if (row && p.board.get(row) !== lane.id) void move(row, lane.id);
            }}
            className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 sm:w-80", over === lane.id && "border-primary/50 bg-primary/5")}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold">{lane.label}</span>
              <span className="rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
            </header>
            <div className="flex min-h-24 flex-col gap-2 p-2 pt-0">
              {items.map((r) => {
                const id = p.getId(r);
                return (
                  <div
                    key={id}
                    draggable={Boolean(p.board.onMove)}
                    onDragStart={() => (dragId.current = id)}
                    {...clickable(p, r)}
                    className={cn("rounded-lg border bg-card p-3 shadow-sm transition", (p.onOpen || p.preview) && "cursor-pointer hover:border-primary/40", p.board.onMove && "active:cursor-grabbing", p.selected.has(id) && "border-primary/50 ring-1 ring-primary/30")}
                  >
                    <div className="flex items-start gap-2">
                      <Pick p={p} row={r} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title(r)}</p>
                        {p.subtitle ? <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p> : null}
                      </div>
                    </div>
                    {p.meta ? <div className="mt-2 text-xs text-muted-foreground">{p.meta(r)}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
    </div>
  );
}

function CalendarView<T>(p: ViewProps<T> & { date: (row: T) => string | null | undefined }) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const byDay = useMemo(() => {
    const m = new Map<string, T[]>();
    for (const r of p.rows) {
      const iso = p.date(r);
      if (!iso) continue;
      // Date-only values ("2026-12-02") are calendar days, not UTC midnight — parse them locally
      // so they don't land a day early west of UTC (Arizona).
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(iso);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return m;
  }, [p]);
  const start = new Date(anchor);
  start.setDate(1 - anchor.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = new Date().toDateString();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="font-semibold">{anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const items = byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <div key={d.toISOString()} className={cn("min-h-20 border-b border-r p-1.5 text-xs sm:min-h-28", !inMonth && "bg-muted/30 text-muted-foreground")}>
              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full tabular-nums", d.toDateString() === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((r) => (
                  <button key={p.getId(r)} type="button" onClick={() => p.open(r)} className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/20">
                    {p.title(r)}
                  </button>
                ))}
                {items.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} more</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
