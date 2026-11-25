"use client";

import * as React from "react";
import { widgetRequest } from "@/lib/dashboard/requests";
import type { DashboardInvitation } from "@/lib/user-management/repository";
import { InvitationStats } from "@/components/dashboard/invitation-stats";
import { useWidgetData } from "../use-widget-data";
import { WidgetError, WidgetShell, WidgetSkeleton, type WidgetProps } from "./shell";

type Data = { counts: { sent: number; pending: number; accepted: number; total: number }; invitations: DashboardInvitation[] };

export default function InvitationsWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : 5 * 60_000 });
  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/user-management" hrefLabel="Manage">
      {loading && !data ? <WidgetSkeleton lines={3} /> : error || !data ? <WidgetError error={error} status={status} onRetry={refresh} /> : <InvitationStats counts={data.counts} invitations={data.invitations} />}
    </WidgetShell>
  );
}
