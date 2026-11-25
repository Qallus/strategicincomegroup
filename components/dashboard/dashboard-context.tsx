"use client";

import * as React from "react";
import type { DashboardViewer, WidgetInstance, WidgetSettings } from "@/lib/dashboard/types";

export type DashboardActions = {
  viewer: DashboardViewer;
  customizing: boolean;
  openWizard: () => void;
  openAddCard: (rowId?: string) => void;
  openPostUpdate: () => void;
  openSearch: () => void;
  openFeatures: () => void;
  updateWidget: (id: string, patch: Partial<Pick<WidgetInstance, "size">>) => void;
  updateSettings: (id: string, patch: WidgetSettings) => void;
  removeWidget: (id: string) => void;
  dismissGetStarted: () => void;
  /** Bumped after a post / dismissal so dependent cards refetch. */
  whatsNewVersion: number;
  bumpWhatsNew: () => void;
};

const Ctx = React.createContext<DashboardActions | null>(null);

export function DashboardActionsProvider({ value, children }: { value: DashboardActions; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardActions {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDashboard needs <DashboardActionsProvider>");
  return v;
}

/** Like useDashboard, but returns null outside a dashboard (e.g. Add Card previews). */
export function useOptionalDashboard(): DashboardActions | null {
  return React.useContext(Ctx);
}

export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = React.useState(initial);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)", true);
}
