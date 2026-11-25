// SIG Dashboard — shared, client-safe types for the customizable home.
// The layout is saved per user in user_preferences.dashboard_preferences.dashboard_layout.

import type { Permission } from "@/lib/rbac/permissions";
import type { AppRole } from "@/lib/rbac/roles";

export type WidgetSize = "s" | "m" | "l";
export type DashboardView = "rows" | "grid";
export type DashboardMode = "standard" | "blank";

/** How a row is drawn. "cards" is the default slidable row. */
export type RowKind = "cards" | "toolbar" | "strip" | "tasks";

export type WidgetSettings = Record<string, string | number | boolean | null>;

export type WidgetInstance = {
  id: string;
  kind: string;
  size: WidgetSize;
  settings: WidgetSettings;
};

export type DashboardRow = {
  id: string;
  kind: RowKind;
  title: string;
  hidden: boolean;
  collapsed: boolean;
  widgets: WidgetInstance[];
};

export type DashboardLayout = {
  version: 1;
  mode: DashboardMode;
  view: DashboardView;
  rows: DashboardRow[];
};

/** Who is looking at the dashboard — computed on the server, passed to the client. */
export type DashboardViewer = {
  id: string;
  email: string;
  firstName: string;
  name: string;
  role: AppRole;
  permissions: Permission[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Not a self-serve role (participant / facilitator). */
  isStaff: boolean;
};

/** Everything else the dashboard keeps in dashboard_preferences. */
export type DashboardPrefs = {
  layout: DashboardLayout;
  whatsNewDismissed: string[];
  getStartedDismissed: boolean;
  /** True once the user has saved a layout of their own. */
  customized: boolean;
};

/** One request in the batched data API. */
export type WidgetDataRequest = { id: string; key: string; params?: Record<string, unknown> };
export type WidgetDataResult = { ok: true; data: unknown } | { ok: false; error: string; status: number };
