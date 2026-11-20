"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The bar every dashboard list shows at the bottom of the screen once rows are
 * ticked: how many are selected, "Select all", the page's bulk actions, clear.
 * Actions scroll sideways when they don't fit (phones).
 */
export function QuickActionBar({
  count,
  total,
  onSelectAll,
  onClear,
  message,
  children,
}: {
  count: number;
  total?: number;
  onSelectAll?: () => void;
  onClear: () => void;
  message?: { text: string; error?: boolean } | null;
  children: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <div className="sig-pop fixed inset-x-3 bottom-4 z-40 mx-auto max-w-4xl sm:bottom-6">
      <div className="flex items-center gap-2 rounded-2xl border bg-popover/95 p-2 pl-4 text-popover-foreground shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/40">
        <span className="shrink-0 text-sm font-semibold tabular-nums">{count} selected</span>
        {onSelectAll && total != null && count < total ? (
          <button type="button" onClick={onSelectAll} className="hidden shrink-0 text-sm text-primary hover:underline sm:inline">
            Select all {total}
          </button>
        ) : null}
        <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">{children}</div>
        <button type="button" aria-label="Clear selection" onClick={onClear} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      {message ? (
        <p role="status" className={cn("mt-1.5 rounded-lg border bg-popover px-3 py-1.5 text-sm shadow", message.error ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
