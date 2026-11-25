import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/twilio/settings";

/**
 * Communications alerts → public.notifications (the dashboard feed).
 *
 * Rows follow lib/notifications/notify.ts (destination 'dashboard', status 'queued', user_id).
 * The dashboard migration adds optional `severity` and `category` columns; we write them when
 * present and silently retry without them when they aren't.
 */

export type CommsAlertType = "missed_call" | "sms_failed" | "sms_campaign_failed";
export type AlertSeverity = "info" | "warning" | "critical";

export type CommsAlert = {
  type: CommsAlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  /** Recipients. When empty, every active super admin / admin gets the alert. */
  userIds?: (string | null | undefined)[];
  metadata?: Record<string, unknown>;
  /** Skip if a notification of this type already carries this metadata key/value. */
  dedupe?: { key: string; value: string };
};

export async function activeAdminIds(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "admin"])
    .eq("status", "active")
    .limit(50);
  return (data ?? []).map((r) => r.id as string);
}

export async function createCommsAlert(alert: CommsAlert): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();

    if (alert.dedupe) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", alert.type)
        .contains("metadata", { [alert.dedupe.key]: alert.dedupe.value })
        .limit(1);
      if (existing && existing.length) return;
    }

    let userIds = [...new Set((alert.userIds ?? []).filter((x): x is string => Boolean(x)))];
    if (!userIds.length) userIds = await activeAdminIds();
    if (!userIds.length) return;

    const base = userIds.map((userId) => ({
      type: alert.type,
      title: alert.title,
      message: alert.message,
      destination: "dashboard",
      status: "queued",
      metadata: { ...(alert.metadata ?? {}), ...(alert.dedupe ? { [alert.dedupe.key]: alert.dedupe.value } : {}) },
      user_id: userId,
    }));

    const category = alert.type === "missed_call" ? "calls" : "sms";
    const withExtras = base.map((row) => ({ ...row, severity: alert.severity, category }));
    const first = await supabase.from("notifications").insert(withExtras);
    if (first.error) {
      if (isMissingRelation(first.error)) {
        const retry = await supabase.from("notifications").insert(base);
        if (retry.error) console.error("[comms-alert] insert failed", retry.error.message);
      } else {
        console.error("[comms-alert] insert failed", first.error.message);
      }
    }
  } catch (error) {
    console.error("[comms-alert] failed", error);
  }
}
