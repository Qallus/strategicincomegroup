import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/user-management/auth";
import { logUserActivity } from "@/lib/user-management/repository";
import { actionTokenFrom, credentialError, noStore } from "@/lib/credentials/http";
import { getCredentialsOverview, migrateSocialPlaintext } from "@/lib/credentials/server";

// POST — one-time move of plain-text social_accounts.credentials into the encrypted store
// (Credentials → Social → "Encrypt saved social tokens"). Each account's values are
// encrypted first; its plain-text column is cleared only once all of them are saved.
// Safe to run again. Returns counts only.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const result = await migrateSocialPlaintext(actor.id);
    await logUserActivity({
      actorUserId: actor.id, action: "credential_social_migrated", entityType: "credential",
      metadata: { provider: "social", instance: "all", accounts: result.accounts, fieldCount: result.fields, failed: result.failed.length },
    }).catch(() => {});
    return NextResponse.json({ ok: result.failed.length === 0, ...result, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Failed to move social tokens.");
  }
}
