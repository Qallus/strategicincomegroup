// Validate a dashboard layout against the widget registry and the viewer's access.
// Pure (no server code) so the client can run the same rules before saving.

import { ROW_KINDS, WIDGET_MAP, hasAccess } from "./registry";
import type { DashboardLayout, DashboardRow, DashboardViewer, RowKind, WidgetInstance, WidgetSettings, WidgetSize } from "./types";

const MAX_ROWS = 30;
const MAX_WIDGETS_PER_ROW = 40;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function cleanSettings(raw: unknown): WidgetSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: WidgetSettings = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 24 || !/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 1000);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean" || v === null) out[k] = v;
    else continue;
    n += 1;
  }
  return out;
}

export function sanitizeLayout(
  raw: unknown,
  viewer: Pick<DashboardViewer, "permissions" | "isAdmin" | "isSuperAdmin" | "isStaff">,
  fallback: () => DashboardLayout,
): DashboardLayout {
  if (!raw || typeof raw !== "object") return sanitizeLayout(fallback(), viewer, () => ({ version: 1, mode: "blank", view: "rows", rows: [] }));
  const r = raw as Partial<DashboardLayout>;
  if (r.version !== 1 || !Array.isArray(r.rows)) return sanitizeLayout(fallback(), viewer, () => ({ version: 1, mode: "blank", view: "rows", rows: [] }));

  const seen = new Set<string>();
  const singletons = new Set<string>();
  const rows: DashboardRow[] = [];
  const hadWidgets: boolean[] = [];
  for (const rowRaw of r.rows.slice(0, MAX_ROWS)) {
    if (!rowRaw || typeof rowRaw !== "object") continue;
    const row = rowRaw as Partial<DashboardRow>;
    const id = typeof row.id === "string" && ID_RE.test(row.id) && !seen.has(row.id) ? row.id : null;
    if (!id) continue;
    seen.add(id);
    const widgets: WidgetInstance[] = [];
    for (const wRaw of Array.isArray(row.widgets) ? row.widgets.slice(0, MAX_WIDGETS_PER_ROW) : []) {
      if (!wRaw || typeof wRaw !== "object") continue;
      const w = wRaw as Partial<WidgetInstance>;
      const def = typeof w.kind === "string" ? WIDGET_MAP[w.kind] : undefined;
      if (!def || !hasAccess(viewer, def.access)) continue;
      if (typeof w.id !== "string" || !ID_RE.test(w.id) || seen.has(w.id)) continue;
      if (def.singleton) {
        if (singletons.has(def.kind)) continue;
        singletons.add(def.kind);
      }
      seen.add(w.id);
      const size: WidgetSize = def.sizes.includes(w.size as WidgetSize) ? (w.size as WidgetSize) : def.defaultSize;
      widgets.push({ id: w.id, kind: def.kind, size, settings: { ...(def.defaultSettings ?? {}), ...cleanSettings(w.settings) } });
    }
    hadWidgets.push(Array.isArray(row.widgets) && row.widgets.length > 0);
    rows.push({
      id,
      kind: ROW_KINDS.includes(row.kind as RowKind) ? (row.kind as RowKind) : "cards",
      title: typeof row.title === "string" ? row.title.trim().slice(0, 60) || "Untitled row" : "Untitled row",
      hidden: row.hidden === true,
      collapsed: row.collapsed === true,
      widgets,
    });
  }
  // Rows emptied only by permission filtering are dropped; rows the user emptied on purpose
  // (no widgets saved at all) are kept so they can add cards to them.
  const keptRows = rows.filter((row, i) => row.widgets.length > 0 || !hadWidgets[i]);

  return {
    version: 1,
    mode: r.mode === "blank" ? "blank" : "standard",
    view: r.view === "grid" ? "grid" : "rows",
    rows: keptRows,
  };
}
