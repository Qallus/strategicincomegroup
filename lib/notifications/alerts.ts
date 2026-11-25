import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/web-push";
import { ROLES } from "@/lib/rbac/roles";
import { createDashboardNotification, type NotificationSeverity, type NotificationType } from "./notify";

// Alerts = notifications with a severity. raiseAlert() writes one row per recipient so
// each user has their own read state, de-duplicates repeats (same dedupeKey while an
// earlier one is still unread and recent), and sends web push for critical alerts.
// Never throws — an alert must never break the flow that raised it.

export type AlertAudience = "admins" | "super_admins" | { userIds: string[] };

export type AlertInput = {
  severity: NotificationSeverity;
  category: string;
  title: string;
  message: string;
  audience: AlertAudience;
  href?: string;
  /** Skip if an unread alert with this key was raised within `dedupeHours`. */
  dedupeKey?: string;
  dedupeHours?: number;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
};

async function recipients(audience: AlertAudience): Promise<string[]> {
  if (typeof audience === "object") return [...new Set(audience.userIds.filter(Boolean))];
  const roles = audience === "super_admins" ? [ROLES.SUPER_ADMIN] : [ROLES.SUPER_ADMIN, ROLES.ADMIN];
  const { data } = await createSupabaseAdminClient().from("profiles").select("id").in("role", roles).eq("status", "active").limit(50);
  return (data ?? []).map((p) => p.id as string);
}

async function recentlyRaised(userId: string, key: string, hours: number): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await createSupabaseAdminClient()
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .is("read_at", null)
    .gte("created_at", since)
    .eq("metadata->>dedupe_key", key)
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

export async function raiseAlert(input: AlertInput): Promise<number> {
  try {
    const ids = await recipients(input.audience);
    let raised = 0;
    for (const userId of ids) {
      if (input.dedupeKey && (await recentlyRaised(userId, input.dedupeKey, input.dedupeHours ?? 6))) continue;
      await createDashboardNotification({
        type: input.type ?? "system_alert",
        title: input.title.slice(0, 200),
        message: input.message.slice(0, 1000),
        userId,
        severity: input.severity,
        category: input.category,
        metadata: { ...(input.metadata ?? {}), ...(input.href ? { href: input.href } : {}), ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}) },
      });
      raised += 1;
      if (input.severity === "critical") {
        await sendPushToUser(userId, { title: input.title, body: input.message.slice(0, 180), url: input.href ?? "/dashboard", tag: input.dedupeKey ?? `alert-${input.category}` }).catch(() => 0);
      }
    }
    return raised;
  } catch (e) {
    console.error("[alerts] raiseAlert failed", e instanceof Error ? e.message : e);
    return 0;
  }
}
