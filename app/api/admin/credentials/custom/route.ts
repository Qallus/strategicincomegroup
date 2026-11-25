import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/user-management/auth";
import { logUserActivity } from "@/lib/user-management/repository";
import { actionTokenFrom, credentialError, noStore } from "@/lib/credentials/http";
import { CredentialInputError, createCustomProvider, deleteCustomProvider, getCredentialsOverview } from "@/lib/credentials/server";

// Custom providers ("Agents & harnesses" → Custom provider): any named service with its own
// fields. The definition is stored as provider 'custom:<slug>', field '__definition'.
//   POST   { name, description?, pingUrl?, fields: [{ label, secret }] }
//   DELETE { provider: 'custom:<slug>' }  removes the definition and every saved value

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const fields = Array.isArray(body.fields) ? body.fields.map((f: { label?: unknown; secret?: unknown }) => ({ label: String(f?.label ?? ""), secret: Boolean(f?.secret) })) : [];
    const provider = await createCustomProvider({ name: String(body.name ?? ""), description: body.description, pingUrl: body.pingUrl, fields, actorId: actor.id });
    await logUserActivity({
      actorUserId: actor.id, action: "credential_provider_added", entityType: "credential",
      metadata: { provider, instance: "default", fields: fields.map((f: { label: string }) => f.label) },
    }).catch(() => {});
    return NextResponse.json({ ok: true, provider, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Failed to add the provider.");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const provider = String(body.provider ?? "");
    if (!provider) throw new CredentialInputError("Choose a provider.");
    await deleteCustomProvider(provider);
    await logUserActivity({
      actorUserId: actor.id, action: "credential_provider_removed", entityType: "credential",
      metadata: { provider, instance: "default" },
    }).catch(() => {});
    return NextResponse.json({ ok: true, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Failed to remove the provider.");
  }
}
