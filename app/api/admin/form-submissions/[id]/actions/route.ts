import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireParticipantManager } from "@/lib/user-management/auth";

const STATUSES = new Set(["received", "in_progress", "done", "spam"]);

// Dashboard actions on a public form submission: visibility (show/hide/remove/delete),
// workflow status (new → in progress → done / spam) and assignment to a team member.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const actor = await requireParticipantManager(request, body.actionToken);
    const action = String(body.action ?? "");
    const now = new Date().toISOString();

    let updates: Record<string, unknown> | null = null;
    if (action === "show") updates = { hidden_at: null, removed_at: null, deleted_at: null, action_reason: "shown" };
    else if (action === "hide") updates = { hidden_at: now, action_reason: "hidden" };
    else if (action === "remove") updates = { removed_at: now, action_reason: "removed" };
    else if (action === "delete") updates = { deleted_at: now, action_reason: "deleted" };
    else if (action === "status" && STATUSES.has(String(body.status))) updates = { status: String(body.status), action_reason: `status:${body.status}` };
    else if (action === "assign") updates = { assigned_to: body.assignedTo ? String(body.assignedTo) : null, action_reason: "assigned" };

    if (!updates) return NextResponse.json({ error: "Unknown form submission action." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("form_submissions")
      .update({ ...updates, actioned_by: actor.id, updated_at: now })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, submission: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form submission action failed.";
    return NextResponse.json({ error: message }, { status: /permission|required/i.test(message) ? 403 : 500 });
  }
}
