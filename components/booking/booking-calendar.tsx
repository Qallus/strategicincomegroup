"use client";

// Month calendar + time column, shared by the public booking flow and the reschedule
// flows (client /book/manage and the staff dashboard). Keyboard: arrow keys move by
// day/week, Home/End to week start/end, PageUp/PageDown by month, Enter/Space picks.

import * as React from "react";
import { AlertCircle, CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupSlotsByDate, utcToZonedDate } from "@/lib/booking/availability";
import type { Slot } from "@/lib/booking/types";
import { addDaysStr, addMonths, dateLabel, dowOf, fmtTime, monthStart, prefersReducedMotion, tzLabel } from "./format";

const WEEKDAYS = [["Su", "Sunday"], ["Mo", "Monday"], ["Tu", "Tuesday"], ["We", "Wednesday"], ["Th", "Thursday"], ["Fr", "Friday"], ["Sa", "Saturday"]] as const;

export type BookingCalendarProps = {
  slots: Slot[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Timezone the calendar and times are shown in. */
  timezone: string;
  maxAdvanceDays?: number;
  selected: Slot | null;
  onSelect: (slot: Slot | null) => void;
  /** Shown when there are no open times at all. */
  empty?: React.ReactNode;
  /** Optional control rendered beside the timezone note (e.g. a "your time" toggle). */
  tzControl?: React.ReactNode;
  className?: string;
  idPrefix?: string;
};

export function BookingCalendar({
  slots, loading, error, onRetry, timezone, maxAdvanceDays = 60, selected, onSelect, empty, tzControl, className, idPrefix = "bc",
}: BookingCalendarProps) {
  const today = React.useMemo(() => utcToZonedDate(new Date(), timezone), [timezone]);
  const lastDay = addDaysStr(today, maxAdvanceDays);
  const [monthAnchor, setMonthAnchor] = React.useState(() => monthStart(today));
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [focusDate, setFocusDate] = React.useState<string | null>(null);

  const byDate = React.useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const g of groupSlotsByDate(slots, timezone)) map.set(g.date, g.slots);
    return map;
  }, [slots, timezone]);

  // Land on the selected slot's day, else the first open day, whenever availability arrives.
  React.useEffect(() => {
    if (loading) return;
    const want = selected ? utcToZonedDate(new Date(selected.start), timezone) : null;
    const pick = want && byDate.has(want) ? want : selectedDate && byDate.has(selectedDate) ? selectedDate : slots.length ? utcToZonedDate(new Date(slots[0].start), timezone) : null;
    if (pick) {
      setSelectedDate(pick);
      setFocusDate((f) => f ?? pick);
      setMonthAnchor(monthStart(pick));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, slots, timezone]);

  const grid = React.useMemo(() => {
    const start = addDaysStr(monthAnchor, -dowOf(monthAnchor));
    const daysInMonth = Number(addDaysStr(addMonths(monthAnchor, 1), -1).slice(8, 10));
    const weeks = Math.ceil((dowOf(monthAnchor) + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, k) => addDaysStr(start, k));
  }, [monthAnchor]);
  const monthTitle = dateLabel(monthAnchor, { month: "long", year: "numeric" });
  const canPrev = monthAnchor > monthStart(today);
  const canNext = addMonths(monthAnchor, 1) <= monthStart(lastDay);
  const monthHasSlots = grid.some((d) => d.slice(0, 7) === monthAnchor.slice(0, 7) && (byDate.get(d)?.length ?? 0) > 0);
  const nextOpenDay = React.useMemo(() => {
    const end = addDaysStr(addMonths(monthAnchor, 1), -1);
    for (const k of byDate.keys()) if (k > end) return k;
    return null;
  }, [byDate, monthAnchor]);
  const daySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  // Exactly one tabbable day in the visible month (roving tabindex).
  const focusKey = [focusDate, selectedDate, today].find((d) => d && d.slice(0, 7) === monthAnchor.slice(0, 7) && d >= today) ?? (monthAnchor >= today ? monthAnchor : today);

  // Roving focus.
  const dayRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const calendarHasFocus = React.useRef(false);
  React.useEffect(() => {
    if (focusDate && calendarHasFocus.current) dayRefs.current.get(focusDate)?.focus();
  }, [focusDate, monthAnchor]);
  function moveFocus(to: string) {
    if (to < today || to > lastDay) return;
    setFocusDate(to);
    if (monthStart(to) !== monthAnchor) setMonthAnchor(monthStart(to));
  }
  function onDayKey(e: React.KeyboardEvent, day: string) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) { e.preventDefault(); moveFocus(addDaysStr(day, map[e.key])); }
    else if (e.key === "Home") { e.preventDefault(); moveFocus(addDaysStr(day, -dowOf(day))); }
    else if (e.key === "End") { e.preventDefault(); moveFocus(addDaysStr(day, 6 - dowOf(day))); }
    else if (e.key === "PageUp") { e.preventDefault(); moveFocus(addMonths(day, -1)); }
    else if (e.key === "PageDown") { e.preventDefault(); moveFocus(addMonths(day, 1)); }
  }
  const timesRef = React.useRef<HTMLDivElement>(null);
  function pickDay(day: string) {
    setSelectedDate(day);
    setFocusDate(day);
    if (selected && utcToZonedDate(new Date(selected.start), timezone) !== day) onSelect(null);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches && (byDate.get(day)?.length ?? 0) > 0) {
      requestAnimationFrame(() => timesRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }));
    }
  }

  if (!loading && !error && slots.length === 0) {
    return <div className={className}>{empty ?? <Empty icon={CalendarDays} title="No times are available" body="There are no open times right now. Please check back soon." />}</div>;
  }

  return (
    <div className={cn("grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,250px)] md:gap-6", className)}>
      {/* Calendar */}
      <div className="rounded-2xl border bg-card p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={!canPrev || loading} aria-label="Previous month" onClick={() => setMonthAnchor((a) => addMonths(a, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold sm:text-base" aria-live="polite" id={`${idPrefix}-month`}>{monthTitle}</p>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={!canNext || loading} aria-label="Next month" onClick={() => setMonthAnchor((a) => addMonths(a, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
          {WEEKDAYS.map(([s, l]) => <div key={l} className="py-1.5">{s}</div>)}
        </div>
        {loading ? (
          <div className="grid grid-cols-7 gap-1" aria-busy="true" aria-label="Loading availability">
            {Array.from({ length: 35 }, (_, i) => <div key={i} className="sig-book-skeleton aspect-square rounded-xl" />)}
          </div>
        ) : (
          <div
            role="group"
            aria-labelledby={`${idPrefix}-month`}
            className="grid grid-cols-7 gap-1"
            onFocus={() => { calendarHasFocus.current = true; }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) calendarHasFocus.current = false; }}
          >
            {grid.map((day) => {
              const inMonth = day.slice(0, 7) === monthAnchor.slice(0, 7);
              if (!inMonth) return <div key={day} aria-hidden className="aspect-square" />;
              const count = byDate.get(day)?.length ?? 0;
              const has = count > 0;
              const isSel = day === selectedDate;
              const isToday = day === today;
              const outOfRange = day < today || day > lastDay;
              const tabbable = day === focusKey;
              return (
                <button
                  key={day}
                  ref={(el) => { if (el) dayRefs.current.set(day, el); else dayRefs.current.delete(day); }}
                  type="button"
                  tabIndex={tabbable ? 0 : -1}
                  disabled={outOfRange}
                  aria-pressed={isSel}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${dateLabel(day, { weekday: "long", month: "long", day: "numeric" })}${has ? `, ${count} time${count === 1 ? "" : "s"} available` : ", no times available"}`}
                  onClick={() => pickDay(day)}
                  onKeyDown={(e) => onDayKey(e, day)}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                    isSel && has
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm ring-2 ring-primary/25 ring-offset-2 ring-offset-card"
                      : isSel
                        ? "bg-muted font-semibold text-foreground ring-1 ring-border"
                        : has
                          ? "font-semibold text-foreground hover:bg-primary/10"
                          : "text-muted-foreground/45 hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent",
                  )}
                >
                  {Number(day.slice(8, 10))}
                  {has && !isSel ? <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary/70" /> : null}
                  {isToday && !has ? <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-gold" /> : null}
                </button>
              );
            })}
          </div>
        )}
        {!loading && !error && !monthHasSlots ? (
          <p className="mt-3 px-1 text-sm text-muted-foreground">
            No openings in {dateLabel(monthAnchor, { month: "long" })}.{" "}
            {nextOpenDay ? (
              <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => { setMonthAnchor(monthStart(nextOpenDay)); pickDay(nextOpenDay); }}>
                Jump to {dateLabel(nextOpenDay, { month: "short", day: "numeric" })} →
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Times */}
      <div ref={timesRef} className="min-w-0 scroll-mt-24">
        {loading ? (
          <div className="space-y-2" aria-hidden>
            <div className="sig-book-skeleton h-5 w-40 rounded" />
            <div className="sig-book-skeleton h-3.5 w-48 rounded" />
            <div className="grid grid-cols-3 gap-2 pt-2 md:grid-cols-1">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="sig-book-skeleton h-11 rounded-xl" />)}
            </div>
          </div>
        ) : error ? (
          <Empty icon={AlertCircle} title="We couldn’t load times" body="Check your connection and try again.">
            {onRetry ? <Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Try again</Button> : null}
          </Empty>
        ) : !selectedDate ? (
          <Empty icon={CalendarDays} title="Pick a day" body="Days with a dot have openings." />
        ) : (
          <div key={`${selectedDate}-${timezone}`} className="sig-book-in">
            <p className="font-semibold">{dateLabel(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> Times in {tzLabel(timezone)}
            </p>
            {tzControl ? <div className="mt-2">{tzControl}</div> : null}
            {daySlots.length === 0 ? (
              <Empty icon={CalendarX2} title="No times are available" body="Choose another day — days with a dot have openings." className="mt-3 min-h-[9rem]" />
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:max-h-[25rem] md:grid-cols-1 md:overflow-y-auto md:p-0.5" aria-label={`Available times on ${dateLabel(selectedDate, { weekday: "long", month: "long", day: "numeric" })}`}>
                {daySlots.map((s) => {
                  const sel = selected?.start === s.start;
                  return (
                    <li key={s.start}>
                      <button
                        type="button"
                        aria-pressed={sel}
                        onClick={() => onSelect(sel ? null : s)}
                        className={cn(
                          "h-11 w-full rounded-xl border text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          sel
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "bg-card text-foreground hover:border-primary/60 hover:bg-primary/5",
                        )}
                      >
                        {fmtTime(s.start, timezone)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Empty({ icon: EIcon, title, body, children, className }: { icon: typeof CalendarDays; title: string; body: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center", className)}>
      <EIcon className="h-6 w-6 text-gold" aria-hidden />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-[17rem] text-xs text-muted-foreground">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
