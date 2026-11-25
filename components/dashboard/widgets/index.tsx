"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { WidgetProps } from "./shell";

// kind → lazily loaded widget component (one file per widget family).

const loading = () => <div className="h-full min-h-[8rem] p-4"><div className="sig-skeleton h-full min-h-[6rem]" /></div>;
const d = (loader: () => Promise<{ default: ComponentType<WidgetProps> }>) => dynamic(loader, { loading });

const Stat = d(() => import("./stat"));
const Tasks = d(() => import("./tasks"));
const Inbox = d(() => import("./inbox"));
const Calendar = d(() => import("./calendar"));
const Markets = d(() => import("./markets"));

export const WIDGET_COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  get_started: d(() => import("./get-started")),
  search: d(() => import("./search")),
  clock: d(() => import("./clock")),
  weather: d(() => import("./weather")),
  markets: Markets,
  ticker: d(() => import("./ticker")),
  notifications: d(() => import("./notifications")),
  alerts: d(() => import("./alerts")),
  next_up: d(() => import("./next-up")),
  latest_transcript: d(() => import("./latest-transcript")),
  tasks_overdue: Tasks,
  tasks_today: Tasks,
  tasks_next7: Tasks,
  task_list: Tasks,
  appointments: d(() => import("./appointments")),
  calendar: Calendar,
  agenda: Calendar,
  dialpad: dynamic(() => import("./dialpad"), { ssr: false, loading }),
  call_log: d(() => import("./call-log")),
  sms_composer: d(() => import("./sms-composer")),
  sms_inbox: Inbox,
  email_inbox: Inbox,
  direct_messages: d(() => import("./direct-messages")),
  notepad: d(() => import("./notepad")),
  recorder: dynamic(() => import("./recorder"), { ssr: false, loading }),
  quick_links: d(() => import("./quick-links")),
  feature_grid: d(() => import("./feature-grid")),
  charts: d(() => import("./charts")),
  whats_new: d(() => import("./whats-new")),
  firm_overview: d(() => import("./firm-overview")),
  redtail: d(() => import("./redtail")),
  invitations: d(() => import("./invitations")),
};

export function widgetComponent(kind: string): ComponentType<WidgetProps> | null {
  if (kind.startsWith("stat_")) return Stat;
  return WIDGET_COMPONENTS[kind] ?? null;
}
