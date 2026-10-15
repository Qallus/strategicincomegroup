import { NextResponse } from "next/server";
import { requireParticipantManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createUserInvitation } from "@/lib/user-management/repository";
import { ROLES } from "@/lib/rbac/roles";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const actor = await requireParticipantManager(request, body.actionToken);
    const target = "profile" as const;

    const supabase = createSupabaseAdminClient();

    const { data: contact, error: fetchErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    if (contact.status === "converted") return NextResponse.json({ error: "Already converted." }, { status: 400 });

    const contactEmail = (contact.email ?? "").trim();

    if (target === "profile") {
      // A profile needs a Supabase Auth user (profiles.id → auth.users), so the old raw
      // profile insert always failed. The correct "convert to profile" is an account
      // invitation the contact accepts.
      if (!contactEmail) return NextResponse.json({ error: "This contact has no email — add one before converting to a profile." }, { status: 400 });
      const invitation = await createUserInvitation({ email: contactEmail, role: ROLES.TEAM_MEMBER, inviteMethod: "email", invitedBy: actor.id });

      await supabase.from("contacts").update({
        status: "converted",
        converted_at: new Date().toISOString(),
      }).eq("id", id);

      return NextResponse.json({ ok: true, target: "profile", invited: true, invitationId: invitation.id });
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Conversion failed.";
    return NextResponse.json({ error: msg }, { status: msg.includes("required") ? 403 : 500 });
  }
}
