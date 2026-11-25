// SIG Dashboard — widget registry. Client-safe metadata only: every widget's kind,
// title, description, icon, category, sizes, access rule, settings and data key. The
// components themselves are lazy-loaded from components/dashboard/widgets/<kind>.tsx
// (see components/dashboard/widgets/index.tsx). Saved layouts are validated against
// this list; unknown kinds are dropped and widgets the viewer can't use are filtered out.

import {
  AlarmClock,
  AppWindow,
  Bell,
  BellRing,
  BookOpenText,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartLine,
  Clock,
  CloudSun,
  FileStack,
  Grid2x2,
  Inbox,
  LayoutList,
  LineChart,
  ListTodo,
  Mail,
  MailCheck,
  MessageSquare,
  MessageSquareText,
  MessagesSquare,
  Mic,
  NotebookPen,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Rocket,
  Search,
  Send,
  Sparkles,
  Headphones,
  Disc3,
  TrendingUp,
  UserPlus,
  UsersRound,
  Globe,
  TriangleAlert,
  Contact,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import type { DashboardViewer, RowKind, WidgetSettings, WidgetSize } from "./types";

export type WidgetCategory = "stats" | "communications" | "calendar" | "markets" | "tools" | "insights" | "crm" | "admin";

export const CATEGORIES: { id: WidgetCategory; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "communications", label: "Communications" },
  { id: "calendar", label: "Calendar & tasks" },
  { id: "markets", label: "Markets & weather" },
  { id: "tools", label: "Tools" },
  { id: "insights", label: "Content & insights" },
  { id: "crm", label: "CRM" },
  { id: "admin", label: "Admin" },
];

/** "staff" = any non self-serve role; "admin" = admin + super admin. */
export type Access = "all" | "staff" | "admin" | "super_admin" | Permission;

export function hasAccess(viewer: Pick<DashboardViewer, "permissions" | "isAdmin" | "isSuperAdmin" | "isStaff">, access: Access | undefined): boolean {
  if (!access || access === "all") return true;
  if (access === "staff") return viewer.isStaff;
  if (access === "admin") return viewer.isAdmin;
  if (access === "super_admin") return viewer.isSuperAdmin;
  return viewer.permissions.includes(access);
}

export type SettingOption = { value: string; label: string };
export type SettingDef =
  | { key: string; label: string; type: "select"; options: SettingOption[]; help?: string; adminOnly?: boolean }
  | { key: string; label: string; type: "slider"; min: number; max: number; step: number; unit?: string; help?: string; adminOnly?: boolean }
  | { key: string; label: string; type: "switch"; help?: string; adminOnly?: boolean }
  | { key: string; label: string; type: "text"; placeholder?: string; maxLength?: number; help?: string; adminOnly?: boolean };

export type WidgetDef = {
  kind: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: WidgetCategory;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  access?: Access;
  defaultSettings?: WidgetSettings;
  settings?: SettingDef[];
  /** Server loader in lib/dashboard/data (permission-checked per key). */
  dataKey?: string;
  /** Only one per dashboard (e.g. the Dialpad registers a phone device). */
  singleton?: boolean;
  /** Search keywords for Add Card. */
  keywords?: string[];
};

// ── Shared settings ───────────────────────────────────────────────────────────
const PERIOD: SettingDef = {
  key: "period", label: "Period", type: "select",
  options: [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "month", label: "This month" },
  ],
};
const SCOPE: SettingDef = {
  key: "scope", label: "Scope", type: "select", adminOnly: true,
  options: [{ value: "firm", label: "Firm" }, { value: "mine", label: "Mine" }],
  help: "Firm totals, or only your own activity.",
};
const REFRESH: SettingDef = { key: "refresh", label: "Refresh every", type: "slider", min: 15, max: 600, step: 15, unit: "s" };
const LIMIT = (max = 15): SettingDef => ({ key: "limit", label: "Items shown", type: "slider", min: 3, max, step: 1 });

const statDefaults = (extra: WidgetSettings = {}): WidgetSettings => ({ period: "month", refresh: 60, ...extra });

function stat(kind: string, title: string, description: string, icon: LucideIcon, access: Access, opts: Partial<WidgetDef> & { metric: string; noPeriod?: boolean; noScope?: boolean }): WidgetDef {
  const settings: SettingDef[] = [];
  if (!opts.noPeriod) settings.push(PERIOD);
  if (!opts.noScope) settings.push(SCOPE);
  settings.push(REFRESH);
  return {
    kind, title, description, icon, access,
    category: opts.category ?? "stats",
    sizes: ["s", "m"],
    defaultSize: "s",
    dataKey: "stat",
    defaultSettings: statDefaults({ metric: opts.metric }),
    settings,
    keywords: opts.keywords,
  };
}

const COMMS: Access = PERMISSIONS.MANAGE_PARTICIPANTS;

export const WIDGETS: WidgetDef[] = [
  // ── Toolbar / onboarding ──
  {
    kind: "get_started", title: "Get started", description: "A short checklist to set up your dashboard and tools.", icon: Rocket,
    category: "tools", sizes: ["l"], defaultSize: "l", dataKey: "get_started", keywords: ["checklist", "onboarding", "setup"],
  },
  {
    kind: "search", title: "Search & features", description: "Search features, contacts, bookings and posts, and open the full feature list.", icon: Search,
    category: "tools", sizes: ["m", "l"], defaultSize: "m", singleton: true, keywords: ["command", "find", "all features"],
  },
  {
    kind: "clock", title: "Date & time", description: "Today's date and a live clock.", icon: Clock,
    category: "tools", sizes: ["s", "m"], defaultSize: "s",
    defaultSettings: { seconds: false, hour12: true },
    settings: [{ key: "seconds", label: "Show seconds", type: "switch" }, { key: "hour12", label: "12-hour clock", type: "switch" }],
  },
  {
    kind: "weather", title: "Weather", description: "Current conditions and a short forecast for your office.", icon: CloudSun,
    category: "markets", sizes: ["s", "m"], defaultSize: "s", dataKey: "weather",
    defaultSettings: { location: "auto" },
    settings: [{
      key: "location", label: "Location", type: "select",
      options: [{ value: "auto", label: "My office" }, { value: "chandler", label: "Chandler" }, { value: "peoria", label: "Peoria" }, { value: "phoenix", label: "Phoenix" }],
    }],
    keywords: ["forecast", "temperature"],
  },
  {
    kind: "markets", title: "Markets", description: "Dow, NASDAQ and S&P 500 through their tracking funds.", icon: TrendingUp,
    category: "markets", sizes: ["m", "l"], defaultSize: "m", dataKey: "markets", keywords: ["stocks", "dow", "nasdaq", "s&p", "finnhub"],
  },
  {
    kind: "ticker", title: "Stock ticker", description: "Any single symbol, refreshed during market hours.", icon: ChartLine,
    category: "markets", sizes: ["s", "m"], defaultSize: "s", dataKey: "markets",
    defaultSettings: { symbol: "AAPL" },
    settings: [{ key: "symbol", label: "Symbol", type: "text", placeholder: "AAPL", maxLength: 10 }],
    keywords: ["stock", "quote", "symbol"],
  },

  // ── Notifications row ──
  {
    kind: "notifications", title: "Notifications", description: "Your notifications, unread first. Mark them read as you go.", icon: Bell,
    category: "insights", sizes: ["m", "l"], defaultSize: "m", dataKey: "notifications",
    defaultSettings: { limit: 6, unreadOnly: false, refresh: 60 },
    settings: [LIMIT(20), { key: "unreadOnly", label: "Unread only", type: "switch" }, REFRESH],
  },
  {
    kind: "alerts", title: "Alerts", description: "Missed calls, failed sends, cancellations and system problems.", icon: TriangleAlert,
    category: "insights", sizes: ["m", "l"], defaultSize: "m", dataKey: "alerts",
    defaultSettings: { limit: 6, severity: "all", refresh: 60 },
    settings: [
      LIMIT(20),
      { key: "severity", label: "Severity", type: "select", options: [{ value: "all", label: "All" }, { value: "warning", label: "Warning and up" }, { value: "critical", label: "Critical only" }] },
      REFRESH,
    ],
  },
  {
    kind: "next_up", title: "Next up", description: "Your next appointment, event or task due.", icon: AlarmClock,
    category: "calendar", sizes: ["m", "l"], defaultSize: "m", dataKey: "next_up", defaultSettings: { refresh: 60 },
  },
  {
    kind: "latest_transcript", title: "Latest call transcript", description: "The most recent transcribed call, with its recording.", icon: Headphones,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", dataKey: "latest_transcript", access: COMMS,
    defaultSettings: { refresh: 60 }, settings: [SCOPE, REFRESH],
  },

  // ── My tasks ──
  {
    kind: "tasks_overdue", title: "Overdue tasks", description: "Project Manager tasks past their due date.", icon: TriangleAlert,
    category: "calendar", sizes: ["s", "m"], defaultSize: "m", dataKey: "tasks", keywords: ["my tasks", "project manager"],
  },
  {
    kind: "tasks_today", title: "Due today", description: "Project Manager tasks due today.", icon: CalendarClock,
    category: "calendar", sizes: ["s", "m"], defaultSize: "m", dataKey: "tasks", keywords: ["my tasks", "project manager"],
  },
  {
    kind: "tasks_next7", title: "Next 7 days", description: "Project Manager tasks due in the next week.", icon: CalendarDays,
    category: "calendar", sizes: ["s", "m"], defaultSize: "m", dataKey: "tasks", keywords: ["my tasks", "project manager"],
  },
  {
    kind: "task_list", title: "My task list", description: "Every open task assigned to you, soonest first.", icon: ListTodo,
    category: "calendar", sizes: ["m", "l"], defaultSize: "m", dataKey: "tasks", defaultSettings: { limit: 6 }, settings: [LIMIT(20)],
  },
  {
    kind: "appointments", title: "Upcoming appointments", description: "Your next client appointments (the firm's when you have none).", icon: CalendarClock,
    category: "calendar", sizes: ["m", "l"], defaultSize: "m", dataKey: "appointments",
    defaultSettings: { limit: 5 }, settings: [LIMIT(10), SCOPE],
  },
  {
    kind: "calendar", title: "Calendar", description: "Month view and agenda of bookings, events and task due dates.", icon: CalendarRange,
    category: "calendar", sizes: ["m", "l"], defaultSize: "l", dataKey: "calendar", settings: [SCOPE],
  },

  // ── Stat cards ──
  stat("stat_outbound", "Outbound calls", "Calls placed from the dialer.", PhoneOutgoing, COMMS, { metric: "calls_outbound", keywords: ["dialer", "phone"] }),
  stat("stat_inbound", "Inbound calls", "Calls received on SIG numbers.", PhoneIncoming, COMMS, { metric: "calls_inbound", keywords: ["dialer", "phone"] }),
  stat("stat_missed", "Missed calls", "Inbound calls that went unanswered.", PhoneMissed, COMMS, { metric: "calls_missed", keywords: ["dialer", "phone", "voicemail"] }),
  stat("stat_monitored", "Monitored calls", "Live calls an admin listened to, coached or joined.", Headphones, COMMS, { metric: "calls_monitored", keywords: ["listen", "whisper", "barge"] }),
  stat("stat_recorded", "Recorded calls", "Calls with a recording, plus total talk time.", Disc3, COMMS, { metric: "calls_recorded", keywords: ["talk time", "recording"] }),
  stat("stat_sms", "Text messages", "SMS sent and received.", MessageSquare, COMMS, { metric: "sms", keywords: ["sms", "texts"] }),
  stat("stat_bookings", "Bookings", "Appointments booked in the period.", CalendarClock, "all", { metric: "bookings" }),
  stat("stat_calendar", "Calendar", "Appointments, events and tasks on your calendar this week.", CalendarDays, "all", { metric: "calendar", noPeriod: true }),
  stat("stat_market", "Stock market", "Whether markets are up or down today (S&P 500 via SPY).", TrendingUp, "all", { metric: "market", noPeriod: true, noScope: true, category: "markets" }),
  stat("stat_dow", "Dow (DIA)", "Dow Jones through the DIA tracking fund.", LineChart, "all", { metric: "dow", noPeriod: true, noScope: true, category: "markets" }),
  stat("stat_nasdaq", "NASDAQ (QQQ)", "NASDAQ-100 through the QQQ tracking fund.", LineChart, "all", { metric: "nasdaq", noPeriod: true, noScope: true, category: "markets" }),
  stat("stat_sp500", "S&P 500 (SPY)", "S&P 500 through the SPY tracking fund.", LineChart, "all", { metric: "sp500", noPeriod: true, noScope: true, category: "markets" }),
  stat("stat_notifications", "Notifications", "Unread notifications.", Bell, "all", { metric: "notifications", noPeriod: true, noScope: true }),
  stat("stat_messages", "Messages", "Unread direct messages.", MessageSquareText, "all", { metric: "messages", noPeriod: true, noScope: true }),
  stat("stat_alerts", "Alerts", "Unread alerts.", BellRing, "all", { metric: "alerts", noPeriod: true, noScope: true }),
  stat("stat_emails", "Emails", "Emails sent from the app.", MailCheck, PERMISSIONS.MANAGE_SETTINGS, { metric: "emails" }),
  stat("stat_files", "Files", "Media library files.", FileStack, "staff", { metric: "files", noScope: true }),
  stat("stat_contacts", "Contacts", "Active CRM contacts.", UsersRound, "staff", { metric: "contacts", noPeriod: true, noScope: true }),
  stat("stat_leads", "Leads", "Open leads.", UserPlus, "staff", { metric: "leads", noPeriod: true, noScope: true }),
  stat("stat_invitations", "Invitations", "Team invitations waiting for a response.", Contact, PERMISSIONS.MANAGE_USERS, { metric: "invitations", noPeriod: true, noScope: true, category: "admin" }),
  stat("stat_visitors", "Website visitors", "Unique visitors to the public site.", Globe, PERMISSIONS.VIEW_REPORTS, { metric: "visitors", noScope: true, keywords: ["analytics", "traffic"] }),

  // ── Communications ──
  {
    kind: "dialpad", title: "Dialpad", description: "Place and answer calls from the browser phone.", icon: Phone,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", access: COMMS, singleton: true, keywords: ["dialer", "softphone", "call"],
  },
  {
    kind: "call_log", title: "Call log", description: "Recent calls with talk time, filters and history per number.", icon: PhoneCall,
    category: "communications", sizes: ["m", "l"], defaultSize: "l", access: COMMS, dataKey: "call_log",
    defaultSettings: { limit: 8, filter: "all", refresh: 30 },
    settings: [
      { key: "filter", label: "Show", type: "select", options: [{ value: "all", label: "All calls" }, { value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }, { value: "missed", label: "Missed" }, { value: "recorded", label: "Recorded" }] },
      SCOPE, LIMIT(25), REFRESH,
    ],
  },
  {
    kind: "sms_composer", title: "Send a text", description: "Send a single SMS, or start a bulk campaign.", icon: Send,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", access: COMMS, keywords: ["sms", "text", "bulk", "campaign"],
  },
  {
    kind: "sms_inbox", title: "SMS inbox", description: "Latest text conversations.", icon: MessagesSquare,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", access: COMMS, dataKey: "sms_inbox",
    defaultSettings: { limit: 5, refresh: 30 }, settings: [LIMIT(15), REFRESH],
  },
  {
    kind: "email_inbox", title: "Email inbox", description: "Latest messages in the shared inbox.", icon: Inbox,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", access: PERMISSIONS.MANAGE_SETTINGS, dataKey: "email_inbox",
    defaultSettings: { limit: 5, refresh: 120 }, settings: [LIMIT(15), REFRESH],
  },
  {
    kind: "direct_messages", title: "Direct messages", description: "Unread messages, open threads and who's waiting on you.", icon: MessageSquareText,
    category: "communications", sizes: ["m", "l"], defaultSize: "m", dataKey: "direct_messages", defaultSettings: { refresh: 60 },
  },

  // ── Tools ──
  {
    kind: "notepad", title: "Notepad", description: "Personal notes that save as you type.", icon: NotebookPen,
    category: "tools", sizes: ["m", "l"], defaultSize: "m", keywords: ["notes", "scratch"],
  },
  {
    kind: "recorder", title: "Voice memo", description: "Record a voice memo, play it back and transcribe it.", icon: Mic,
    category: "tools", sizes: ["s", "m"], defaultSize: "m", keywords: ["recorder", "audio", "transcribe"],
  },
  {
    kind: "quick_links", title: "Quick links", description: "Shortcuts to the features you use most.", icon: Grid2x2,
    category: "tools", sizes: ["m", "l"], defaultSize: "m",
    defaultSettings: { links: "/dashboard/contacts,/dashboard/bookings,/dashboard/project-manager,/dashboard/direct-messages,/dashboard/plans,/dashboard/preferences" },
  },

  // ── Content & insights ──
  {
    kind: "charts", title: "Trends", description: "Calls, texts and bookings over time.", icon: ChartLine,
    category: "insights", sizes: ["m", "l"], defaultSize: "l", dataKey: "charts", access: "staff",
    defaultSettings: { days: 30, calls: true, sms: true, bookings: true },
    settings: [
      { key: "days", label: "Days shown", type: "slider", min: 7, max: 90, step: 1, unit: "d" },
      { key: "calls", label: "Calls", type: "switch" },
      { key: "sms", label: "Texts", type: "switch" },
      { key: "bookings", label: "Bookings", type: "switch" },
      SCOPE,
    ],
  },
  {
    kind: "whats_new", title: "What's new", description: "Updates from the SIG team. Hide the ones you've read.", icon: Sparkles,
    category: "insights", sizes: ["m", "l"], defaultSize: "l", dataKey: "whats_new", keywords: ["updates", "announcements"],
  },
  {
    kind: "firm_overview", title: "Firm at a glance", description: "Contacts, leads, appointments, texts, calls and emails.", icon: Building2,
    category: "insights", sizes: ["m", "l"], defaultSize: "l", access: "staff", dataKey: "firm_overview",
  },

  // ── CRM ──
  {
    kind: "redtail", title: "Redtail CRM", description: "Connection status and a quick client lookup.", icon: BookOpenText,
    category: "crm", sizes: ["m", "l"], defaultSize: "m", access: COMMS, dataKey: "redtail", keywords: ["crm", "clients"],
  },

  // ── Admin ──
  {
    kind: "invitations", title: "Team invitations", description: "Invitation counts and the latest invites.", icon: Mail,
    category: "admin", sizes: ["m", "l"], defaultSize: "l", access: PERMISSIONS.MANAGE_USERS, dataKey: "invitations",
  },
  {
    kind: "feature_grid", title: "All features", description: "Every dashboard feature you can open, grouped.", icon: AppWindow,
    category: "tools", sizes: ["l"], defaultSize: "l", keywords: ["menu", "navigation"],
  },
  {
    kind: "agenda", title: "Today's agenda", description: "Everything on your calendar today.", icon: LayoutList,
    category: "calendar", sizes: ["m", "l"], defaultSize: "m", dataKey: "calendar", defaultSettings: { agendaOnly: true },
  },
];

export const WIDGET_MAP: Record<string, WidgetDef> = Object.fromEntries(WIDGETS.map((w) => [w.kind, w]));

export function widgetsFor(viewer: Pick<DashboardViewer, "permissions" | "isAdmin" | "isSuperAdmin" | "isStaff">): WidgetDef[] {
  return WIDGETS.filter((w) => hasAccess(viewer, w.access));
}

export function defaultSettingsFor(kind: string): WidgetSettings {
  return { ...(WIDGET_MAP[kind]?.defaultSettings ?? {}) };
}

export const ROW_KINDS: RowKind[] = ["cards", "toolbar", "strip", "tasks"];
