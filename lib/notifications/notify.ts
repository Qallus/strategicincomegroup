import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "check_in_completed"
  | "general_survey_completed"
  | "pastor_elder_survey_completed"
  | "inner_circle_submitted"
  | "follow_up_requested"
  | "story_permission_granted"
  | "church_interest"
  | "form_submission_error"
  | "email_journey_issue"
  | "resource_shared"
  | "energy_audit_completed"
  | "book_waitlist_request"
  | "booking_created"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "system_alert";

/** Alert severity. Leave unset for an ordinary notification (not shown in the Alerts feed). */
export type NotificationSeverity = "info" | "warning" | "critical";

function isMissingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* (does not exist|could not find)|schema cache/i.test(error.message ?? "");
}

export async function createDashboardNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  participantId?: string;
  /** Dashboard user the notification is for (e.g. the booked planner). */
  userId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  /** Makes this an alert (202611250220_dashboard.sql). Ignored before that migration runs. */
  severity?: NotificationSeverity;
  /** e.g. bookings, calls, sms, email, analytics, credentials. */
  category?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const base = {
    type: input.type,
    title: input.title,
    message: input.message,
    participant_id: input.participantId ?? null,
    destination: "dashboard",
    status: "queued",
    metadata: input.metadata ?? {},
    ...(input.userId ? { user_id: input.userId } : {}),
    ...(input.actorUserId ? { actor_user_id: input.actorUserId } : {}),
  };
  const alert = {
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.category ? { category: input.category.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) } : {}),
  };

  let { error } = await supabase.from("notifications").insert({ ...base, ...alert });
  if (error && Object.keys(alert).length && isMissingColumn(error)) {
    // Dashboard migration not applied yet — keep the notification, drop the alert fields.
    ({ error } = await supabase.from("notifications").insert(base));
  }

  if (error) {
    console.error("Notification insert failed", error);
  }
}
