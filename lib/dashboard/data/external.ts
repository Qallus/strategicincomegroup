import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { DashboardViewer } from "@/lib/dashboard/types";
import { getWeather, locationForOffice, type WeatherLocationId } from "@/lib/weather/open-meteo";
import { getQuotes, normalizeSymbol } from "@/lib/markets/finnhub";
import { getProviderConfig } from "@/lib/credentials/server";
import { resolveRedtail } from "@/lib/redtail/env";
import { DataForbidden } from "./util";

async function officeLocation(viewer: DashboardViewer): Promise<WeatherLocationId> {
  try {
    const { data } = await createSupabaseAdminClient().from("employee_profiles").select("office").eq("profile_id", viewer.id).maybeSingle();
    return locationForOffice((data?.office as string | null) ?? null);
  } catch {
    return "phoenix";
  }
}

export async function loadWeather(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  const requested = params.location;
  const id: WeatherLocationId =
    requested === "chandler" || requested === "peoria" || requested === "phoenix" ? requested : await officeLocation(viewer);
  return getWeather(id);
}

export async function loadMarkets(_viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  const symbol = normalizeSymbol(params.symbol);
  return getQuotes(symbol ? [symbol] : []);
}

/** Redtail connection status (from Credentials) — the lookup itself is /api/dashboard/redtail. */
export async function loadRedtailStatus(viewer: DashboardViewer) {
  if (!viewer.permissions.includes(PERMISSIONS.MANAGE_PARTICIPANTS)) throw new DataForbidden();
  const cfg = await getProviderConfig("redtail").catch(() => ({}) as Record<string, string | undefined>);
  const r = resolveRedtail(cfg);
  const configured = Boolean(r.apiKey && r.userKey);
  let lastTest: { ok: boolean; message: string | null; testedAt: string } | null = null;
  try {
    const { data } = await createSupabaseAdminClient().from("credential_tests").select("ok, message, tested_at").eq("provider", "redtail").eq("instance", "default").maybeSingle();
    if (data) lastTest = { ok: Boolean(data.ok), message: (data.message as string | null) ?? null, testedAt: String(data.tested_at) };
  } catch {
    /* credentials migration not applied */
  }
  return { configured, hasApiKey: Boolean(r.apiKey), lastTest, sandbox: r.environment === "development", canManage: viewer.isSuperAdmin };
}
