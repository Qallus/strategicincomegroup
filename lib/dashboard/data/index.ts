import "server-only";

import type { DashboardViewer, WidgetDataRequest, WidgetDataResult } from "@/lib/dashboard/types";
import { getFeed } from "@/lib/notifications/feed";
import { loadStat } from "./stats";
import { loadAppointments, loadCalendarItems, loadNextUp, loadTasks } from "./calendar";
import { loadCallLog, loadDirectMessages, loadEmailInbox, loadLatestTranscript, loadSmsInbox } from "./comms";
import { loadCharts, loadFirmOverview, loadGetStarted, loadInvitations, loadWhatsNew } from "./insights";
import { loadMarkets, loadRedtailStatus, loadWeather } from "./external";
import { clampInt } from "./util";

// One loader per dataKey. Every loader checks the viewer's access itself (throwing
// DataForbidden → 403 for that key) and scopes data to the viewer unless they are an
// admin asking for firm-wide numbers.

type Loader = (viewer: DashboardViewer, params: Record<string, unknown>) => Promise<unknown>;

export const LOADERS: Record<string, Loader> = {
  stat: loadStat,
  tasks: (v) => loadTasks(v),
  appointments: loadAppointments,
  calendar: loadCalendarItems,
  next_up: (v) => loadNextUp(v),
  notifications: (v, p) => getFeed(v, { limit: clampInt(p.limit, 1, 30, 6), unreadOnly: p.unreadOnly === true }),
  alerts: (v, p) =>
    getFeed(v, {
      limit: clampInt(p.limit, 1, 30, 6),
      alertsOnly: true,
      minSeverity: p.severity === "warning" || p.severity === "critical" ? p.severity : undefined,
    }),
  latest_transcript: loadLatestTranscript,
  call_log: loadCallLog,
  sms_inbox: loadSmsInbox,
  email_inbox: loadEmailInbox,
  direct_messages: (v) => loadDirectMessages(v),
  charts: loadCharts,
  firm_overview: (v) => loadFirmOverview(v),
  invitations: (v) => loadInvitations(v),
  whats_new: (v) => loadWhatsNew(v),
  get_started: (v) => loadGetStarted(v),
  weather: loadWeather,
  markets: loadMarkets,
  redtail: (v) => loadRedtailStatus(v),
};

const MAX_REQUESTS = 60;

async function runOne(viewer: DashboardViewer, req: WidgetDataRequest): Promise<WidgetDataResult> {
  const loader = LOADERS[req.key];
  if (!loader) return { ok: false, error: "Unknown data key.", status: 400 };
  try {
    const params = req.params && typeof req.params === "object" && !Array.isArray(req.params) ? req.params : {};
    return { ok: true, data: await loader(viewer, params) };
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403 || status === 400) return { ok: false, error: (e as Error).message, status };
    console.error(`[dashboard-data] ${req.key} failed`, e instanceof Error ? e.message : e);
    return { ok: false, error: "This card couldn't load.", status: 500 };
  }
}

/** Run a batch. With `timeoutMs`, slow keys are left out (the client fetches them itself). */
export async function runDataRequests(
  viewer: DashboardViewer,
  requests: WidgetDataRequest[],
  opts: { timeoutMs?: number } = {},
): Promise<Record<string, WidgetDataResult>> {
  const unique = new Map<string, WidgetDataRequest>();
  for (const r of requests.slice(0, MAX_REQUESTS)) if (r && typeof r.id === "string" && typeof r.key === "string") unique.set(r.id, r);
  const out: Record<string, WidgetDataResult> = {};
  await Promise.all(
    [...unique.values()].map(async (r) => {
      const job = runOne(viewer, r);
      if (!opts.timeoutMs) {
        out[r.id] = await job;
        return;
      }
      const res = await Promise.race([job, new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.timeoutMs))]);
      if (res) out[r.id] = res;
    }),
  );
  return out;
}
