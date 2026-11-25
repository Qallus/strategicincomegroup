import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";
import { toViewer } from "@/lib/dashboard/viewer";
import { getDashboardPrefs } from "@/lib/dashboard/layout";
import { runDataRequests } from "@/lib/dashboard/data";
import { widgetRequest } from "@/lib/dashboard/requests";
import type { WidgetDataRequest } from "@/lib/dashboard/types";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";

export const dynamic = "force-dynamic";

// Dashboard home: a thin server shell. Loads the viewer's saved layout (or the Standard
// preset) and preloads the first data for the visible cards; anything slower than the
// budget below is fetched by the cards themselves.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");

  const viewer = toViewer(profile);
  const prefs = await getDashboardPrefs(viewer);

  const requests = new Map<string, WidgetDataRequest>();
  for (const row of prefs.layout.rows) {
    if (row.hidden || row.collapsed) continue;
    for (const w of row.widgets) {
      const req = widgetRequest(w);
      if (req) requests.set(req.id, req);
    }
  }
  const seed = requests.size ? await runDataRequests(viewer, [...requests.values()], { timeoutMs: 1200 }).catch(() => ({})) : {};

  return <DashboardCanvas viewer={viewer} initialPrefs={prefs} seed={seed} />;
}
