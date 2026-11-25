"use client";

import * as React from "react";
import { featuresFor, groupFeatures } from "@/lib/dashboard/features";
import { useOptionalDashboard } from "../dashboard-context";
import { FeatureTile } from "./quick-links";
import { WidgetShell, type WidgetProps } from "./shell";

export default function FeatureGridWidget({ def }: WidgetProps) {
  const dash = useOptionalDashboard();
  const groups = React.useMemo(() => groupFeatures(featuresFor(dash?.viewer.permissions ?? [])), [dash?.viewer.permissions]);
  return (
    <WidgetShell icon={def.icon} title={def.title} bodyClassName="max-h-[26rem] overflow-y-auto sig-noscroll">
      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.group}>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((f) => <FeatureTile key={f.href} f={f} compact />)}
            </div>
          </section>
        ))}
      </div>
    </WidgetShell>
  );
}
