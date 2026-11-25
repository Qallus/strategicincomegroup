import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/user-management/auth";
import { logUserActivity } from "@/lib/user-management/repository";
import { actionTokenFrom, credentialError, noStore } from "@/lib/credentials/http";
import {
  CredentialInputError, DEFAULT_INSTANCE, deleteCredentials, getCredentialHistory, getCredentialsOverview, saveProviderValues,
} from "@/lib/credentials/server";

// SIG Credentials API — Super Admin only on every method.
//   GET                          catalog + status (masked; never a secret value)
//   GET ?history=<provider>&instance=<id>   audit entries for one provider
//   PUT  { provider, instance?, values }    save fields (blank secret = keep)
//   DELETE { provider, instance?, field? }  remove one field or a whole provider
// Audit entries name the provider and fields only, never values.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request, actionTokenFrom(request));
    const url = new URL(request.url);
    const history = url.searchParams.get("history");
    if (history) {
      const instance = url.searchParams.get("instance") || DEFAULT_INSTANCE;
      return NextResponse.json({ history: await getCredentialHistory(history, instance) }, noStore);
    }
    return NextResponse.json(await getCredentialsOverview(), noStore);
  } catch (error) {
    return credentialError(error, "Failed to load credentials.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const provider = String(body.provider ?? "");
    const instance = String(body.instance || DEFAULT_INSTANCE);
    if (!provider) throw new CredentialInputError("Choose a provider.");
    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) throw new CredentialInputError("Nothing to save.");
    const { changed, cleared } = await saveProviderValues({ provider, instance, values: body.values, actorId: actor.id });
    if (changed.length || cleared.length) {
      await logUserActivity({
        actorUserId: actor.id, action: "credential_updated", entityType: "credential",
        metadata: { provider, instance, fields: changed, cleared },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, changed, cleared, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Failed to save credentials.");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const provider = String(body.provider ?? "");
    const instance = String(body.instance || DEFAULT_INSTANCE);
    const field = body.field ? String(body.field) : undefined;
    if (!provider) throw new CredentialInputError("Choose a provider.");
    const { removed } = await deleteCredentials({ provider, instance, field });
    await logUserActivity({
      actorUserId: actor.id, action: "credential_removed", entityType: "credential",
      metadata: { provider, instance, fields: removed, scope: field ? "field" : "provider" },
    }).catch(() => {});
    return NextResponse.json({ ok: true, removed, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Failed to remove credentials.");
  }
}
