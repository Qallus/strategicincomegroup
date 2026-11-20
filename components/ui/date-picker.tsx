"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Branded, theme-aware date picker (no native browser calendar).
// value / onChange use "YYYY-MM-DD".
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function parse(s?: string) { if (!s) return null; const d = new Date(`${s}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }

export function DatePicker({
  value, onChange, placeholder = "Pick a date", className, allowClear = true,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; up: boolean } | null>(null);
  // Inside a modal Dialog/Sheet the portal must stay within it, or the modal
  // treats calendar clicks as "outside" and blocks/dismisses them.
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const selected = parse(value);
  const [cursor, setCursor] = React.useState(() => {
    const d = selected ?? new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });

  React.useEffect(() => {
    const d = parse(value);
    if (d) setCursor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }, [value]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) { document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onEsc); }
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  // The calendar renders in a portal with fixed positioning so cards with
  // overflow-hidden (or scroll containers) can never clip it. It opens below
  // the field, or above it when there isn't room.
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 272, H = 320, gap = 4;
      const up = r.bottom + gap + H > window.innerHeight && r.top - gap - H > 0;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      setPos({ top: up ? r.top - gap : r.bottom + gap, left, up });
    };
    setHost((wrapRef.current?.closest('[role="dialog"]') as HTMLElement | null) ?? document.body);
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  const year = cursor.getUTCFullYear();
  const mon = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, mon, 1));
  const gridStart = new Date(first); gridStart.setUTCDate(1 - first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, k) => { const d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + k); return d; });
  const todayYmd = ymd(new Date());
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from(new Set([...Array.from({ length: 71 }, (_, i) => thisYear + 10 - i), year])).sort((a, b) => b - a);
  const label = selected ? selected.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span>{label || placeholder}</span>
        <CalendarIcon className="h-4 w-4 opacity-50" />
      </button>

      {open && pos && host && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose a date"
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }}
          className="z-[200] w-[272px] rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between">
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon - 1, 1)))} className="rounded p-1 hover:bg-accent hover:text-accent-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-1">
              <select
                aria-label="Month"
                value={mon}
                onChange={(e) => setCursor(new Date(Date.UTC(year, Number(e.target.value), 1)))}
                className="h-7 rounded border border-input bg-background px-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>{new Date(Date.UTC(2000, m, 1)).toLocaleDateString([], { month: "short", timeZone: "UTC" })}</option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={year}
                onChange={(e) => setCursor(new Date(Date.UTC(Number(e.target.value), mon, 1)))}
                className="h-7 rounded border border-input bg-background px-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon + 1, 1)))} className="rounded p-1 hover:bg-accent hover:text-accent-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const inMonth = d.getUTCMonth() === mon;
              const cy = ymd(d);
              const isSel = value === cy;
              const isToday = cy === todayYmd;
              return (
                <button
                  key={cy}
                  type="button"
                  onClick={() => { onChange(cy); setOpen(false); }}
                  className={cn(
                    "h-7 rounded text-xs transition-colors",
                    isSel ? "bg-primary text-primary-foreground" : isToday ? "border border-primary text-primary" : inMonth ? "hover:bg-accent hover:text-accent-foreground" : "text-muted-foreground/50 hover:bg-accent",
                  )}
                >
                  {d.getUTCDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between px-1 text-xs">
            {allowClear ? (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-muted-foreground hover:text-foreground">Clear</button>
            ) : <span />}
            <button type="button" onClick={() => { onChange(todayYmd); setOpen(false); }} className="font-medium text-primary hover:underline">Today</button>
          </div>
        </div>,
        host,
      )}
    </div>
  );
}
