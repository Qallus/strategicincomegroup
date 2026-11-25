// SIG Dashboard presets: STANDARD (the current home, rebuilt as rows of widgets),
// BLANK (an empty canvas + the Get Started wizard) and the wizard's three focus presets.
// Client-safe. Layouts are filtered by permission on the server before they are shown.

import { WIDGET_MAP, defaultSettingsFor } from "./registry";
import type { DashboardLayout, DashboardRow, RowKind, WidgetInstance, WidgetSize } from "./types";

export function uid(prefix = "w"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function makeWidget(kind: string, size?: WidgetSize, id?: string): WidgetInstance {
  const def = WIDGET_MAP[kind];
  return { id: id ?? uid("w"), kind, size: size ?? def?.defaultSize ?? "m", settings: defaultSettingsFor(kind) };
}

function row(id: string, kind: RowKind, title: string, widgets: (string | [string, WidgetSize])[]): DashboardRow {
  return {
    id,
    kind,
    title,
    hidden: false,
    collapsed: false,
    widgets: widgets.map((w, i) => {
      const [k, size] = Array.isArray(w) ? w : [w, undefined];
      return makeWidget(k, size, `${id}_${k}_${i}`);
    }),
  };
}

export const STANDARD_STAT_KINDS = [
  "stat_outbound", "stat_inbound", "stat_missed", "stat_monitored", "stat_recorded",
  "stat_sms", "stat_bookings", "stat_calendar",
  "stat_market", "stat_dow", "stat_nasdaq",
  "stat_notifications", "stat_messages", "stat_alerts", "stat_emails", "stat_files",
];

export function standardLayout(): DashboardLayout {
  return {
    version: 1,
    mode: "standard",
    view: "rows",
    rows: [
      row("std_get_started", "strip", "Get started", ["get_started"]),
      row("std_toolbar", "toolbar", "Toolbar", ["search", "clock", "weather", "markets"]),
      row("std_notifications", "cards", "Notifications", ["notifications", "next_up", "latest_transcript"]),
      row("std_tasks", "tasks", "My tasks", ["tasks_overdue", "tasks_today", "tasks_next7", "appointments"]),
      row("std_stats", "cards", "At a glance", STANDARD_STAT_KINDS),
      row("std_whats_new", "cards", "What's new", ["whats_new"]),
    ],
  };
}

export function blankLayout(): DashboardLayout {
  return { version: 1, mode: "blank", view: "rows", rows: [] };
}

// ── Get Started wizard ────────────────────────────────────────────────────────
export type WizardFocus = "planner" | "service" | "admin";

export type SuggestedRow = { key: string; kind: RowKind; title: string; description: string; widgets: string[] };

export const WIZARD_FOCUS: { id: WizardFocus; title: string; description: string; rows: SuggestedRow[] }[] = [
  {
    id: "planner",
    title: "Planner",
    description: "Appointments, tasks and client follow-up front and centre.",
    rows: [
      { key: "toolbar", kind: "toolbar", title: "Toolbar", description: "Search, date, weather and markets.", widgets: ["search", "clock", "weather", "markets"] },
      { key: "today", kind: "cards", title: "Today", description: "What's next and what's waiting for you.", widgets: ["next_up", "appointments", "notifications"] },
      { key: "tasks", kind: "tasks", title: "My tasks", description: "Overdue, due today and the week ahead.", widgets: ["tasks_overdue", "tasks_today", "tasks_next7", "task_list"] },
      { key: "calendar", kind: "cards", title: "Calendar", description: "Month view and today's agenda.", widgets: ["calendar", "agenda"] },
      { key: "stats", kind: "cards", title: "At a glance", description: "Bookings, calendar, messages and markets.", widgets: ["stat_bookings", "stat_calendar", "stat_messages", "stat_notifications", "stat_dow", "stat_nasdaq"] },
    ],
  },
  {
    id: "service",
    title: "Client service",
    description: "Calls, texts and inboxes for the front desk.",
    rows: [
      { key: "toolbar", kind: "toolbar", title: "Toolbar", description: "Search, date and weather.", widgets: ["search", "clock", "weather"] },
      { key: "phone", kind: "cards", title: "Phone", description: "Dialpad, call log and the latest transcript.", widgets: ["dialpad", "call_log", "latest_transcript"] },
      { key: "texts", kind: "cards", title: "Messages", description: "Send texts and keep up with replies.", widgets: ["sms_composer", "sms_inbox", "email_inbox", "direct_messages"] },
      { key: "stats", kind: "cards", title: "Call stats", description: "Outbound, inbound, missed and texts.", widgets: ["stat_outbound", "stat_inbound", "stat_missed", "stat_recorded", "stat_sms"] },
      { key: "alerts", kind: "cards", title: "Alerts", description: "Missed calls and failed sends.", widgets: ["alerts", "notifications"] },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    description: "Firm-wide numbers, alerts and team activity.",
    rows: [
      { key: "toolbar", kind: "toolbar", title: "Toolbar", description: "Search, date, weather and markets.", widgets: ["search", "clock", "weather", "markets"] },
      { key: "alerts", kind: "cards", title: "Alerts & updates", description: "Problems to fix and what's new.", widgets: ["alerts", "notifications", "whats_new"] },
      { key: "firm", kind: "cards", title: "Firm", description: "Contacts, leads, visitors and invitations.", widgets: ["stat_contacts", "stat_leads", "stat_visitors", "stat_invitations", "stat_emails", "stat_files"] },
      { key: "trends", kind: "cards", title: "Trends", description: "Calls, texts and bookings over time.", widgets: ["charts", "firm_overview"] },
      { key: "team", kind: "cards", title: "Team", description: "Invitations and direct messages.", widgets: ["invitations", "direct_messages"] },
    ],
  },
];

/** Build a layout from the wizard's choices. Unknown kinds are skipped. */
export function layoutFromWizard(rows: SuggestedRow[], extraWidgets: string[], selected: Set<string>): DashboardLayout {
  const out: DashboardRow[] = [];
  for (const r of rows) {
    const widgets = r.widgets.filter((k) => selected.has(k) && WIDGET_MAP[k]).map((k) => makeWidget(k));
    if (widgets.length) out.push({ id: uid("row"), kind: r.kind, title: r.title, hidden: false, collapsed: false, widgets });
  }
  const used = new Set(rows.flatMap((r) => r.widgets));
  const extras = extraWidgets.filter((k) => !used.has(k) && selected.has(k) && WIDGET_MAP[k]).map((k) => makeWidget(k));
  if (extras.length) out.push({ id: uid("row"), kind: "cards", title: "My cards", hidden: false, collapsed: false, widgets: extras });
  return { version: 1, mode: "blank", view: "rows", rows: out };
}
