import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { blankLayout, standardLayout } from "./presets";
import { sanitizeLayout } from "./sanitize";
import type { DashboardLayout, DashboardMode, DashboardPrefs, DashboardViewer } from "./types";

// Per-user dashboard layout + dashboard prefs, stored in
// user_preferences.dashboard_preferences (read-merge-write, like lib/dashboard/section-seen.ts):
//   dashboard_layout       the DashboardLayout
//   whats_new_dismissed    string[] of whats_new ids the user hid
//   get_started_dismissed  boolean

type PrefsBlob = Record<string, unknown>;

async function readBlob(userId: string): Promise<{ id: string | null; prefs: PrefsBlob }> {
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from("user_preferences").select("id, dashboard_preferences").eq("user_id", userId).maybeSingle();
  const prefs = data?.dashboard_preferences && typeof data.dashboard_preferences === "object" ? (data.dashboard_preferences as PrefsBlob) : {};
  return { id: (data?.id as string | undefined) ?? null, prefs };
}

async function mergeBlob(userId: string, patch: PrefsBlob): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { id, prefs } = await readBlob(userId);
  const merged = { ...prefs, ...patch };
  if (id) {
    const { error } = await sb.from("user_preferences").update({ dashboard_preferences: merged, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("user_preferences").insert({ user_id: userId, dashboard_preferences: merged });
    if (error) throw new Error(error.message);
  }
}

export function presetFor(mode: DashboardMode): DashboardLayout {
  return mode === "blank" ? blankLayout() : standardLayout();
}

export async function getDashboardPrefs(viewer: DashboardViewer): Promise<DashboardPrefs> {
  let blob: PrefsBlob = {};
  try {
    blob = (await readBlob(viewer.id)).prefs;
  } catch {
    /* fall back to the standard layout */
  }
  const saved = blob.dashboard_layout;
  const dismissed = Array.isArray(blob.whats_new_dismissed) ? (blob.whats_new_dismissed as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return {
    layout: sanitizeLayout(saved, viewer, standardLayout),
    whatsNewDismissed: dismissed.slice(-500),
    getStartedDismissed: blob.get_started_dismissed === true,
    customized: Boolean(saved),
  };
}

export async function getLayout(viewer: DashboardViewer): Promise<DashboardLayout> {
  return (await getDashboardPrefs(viewer)).layout;
}

export async function saveLayout(viewer: DashboardViewer, layout: unknown): Promise<DashboardLayout> {
  const clean = sanitizeLayout(layout, viewer, standardLayout);
  await mergeBlob(viewer.id, { dashboard_layout: clean });
  return clean;
}

export async function resetLayout(viewer: DashboardViewer, mode: DashboardMode = "standard"): Promise<DashboardLayout> {
  const clean = sanitizeLayout(presetFor(mode), viewer, standardLayout);
  await mergeBlob(viewer.id, { dashboard_layout: clean, ...(mode === "standard" ? { get_started_dismissed: false } : {}) });
  return clean;
}

export async function setWhatsNewDismissed(userId: string, id: string, dismissed: boolean): Promise<string[]> {
  const { prefs } = await readBlob(userId);
  const current = new Set(Array.isArray(prefs.whats_new_dismissed) ? (prefs.whats_new_dismissed as string[]) : []);
  if (dismissed) current.add(id);
  else current.delete(id);
  const list = [...current].slice(-500);
  await mergeBlob(userId, { whats_new_dismissed: list });
  return list;
}

export async function setGetStartedDismissed(userId: string, dismissed: boolean): Promise<void> {
  await mergeBlob(userId, { get_started_dismissed: dismissed });
}

export async function getWhatsNewDismissed(userId: string): Promise<string[]> {
  try {
    const { prefs } = await readBlob(userId);
    return Array.isArray(prefs.whats_new_dismissed) ? (prefs.whats_new_dismissed as string[]) : [];
  } catch {
    return [];
  }
}
