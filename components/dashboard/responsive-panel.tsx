"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsDesktop } from "./dashboard-context";

/** A right-side Sheet on desktop, a vaul bottom sheet on mobile. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  headerExtra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className={cn("flex w-full flex-col gap-0 border-l-border/70 bg-background/95 p-0 backdrop-blur-xl sm:max-w-xl", className)}>
          <SheetHeader className="space-y-1 border-b border-border/70 px-6 pb-4 pt-6">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
            {headerExtra}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("h-[88dvh]", className)}>
        <DrawerHeader className="border-b border-border/70">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          {headerExtra}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

/** A centred Dialog on desktop, a full-height bottom Sheet on mobile. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl", className)}>
          <DialogHeader className="border-b border-border/70 px-6 pb-4 pt-6">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="border-t border-border/70 px-6 py-4">{footer}</div> : null}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("flex h-[94dvh] flex-col gap-0 rounded-t-2xl p-0", className)}>
        <SheetHeader className="border-b border-border/70 px-4 pb-3 pt-5">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-border/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onOpenChange(false); }}
            className={cn("inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium", destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
