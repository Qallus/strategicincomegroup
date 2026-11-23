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
  | "booking_cancelled";

export async function createDashboardNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  participantId?: string;
  /** Dashboard user the notification is for (e.g. the booked planner). */
  userId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notifications").insert({
    type: input.type,
    title: input.title,
    message: input.message,
    participant_id: input.participantId ?? null,
    destination: "dashboard",
    status: "queued",
    metadata: input.metadata ?? {},
    ...(input.userId ? { user_id: input.userId } : {}),
    ...(input.actorUserId ? { actor_user_id: input.actorUserId } : {}),
  });

  if (error) {
    console.error("Notification insert failed", error);
  }
}
