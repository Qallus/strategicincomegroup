import { NextResponse } from "next/server";
import { requireUserManager } from "@/lib/user-management/auth";
import { listAccounts, saveAccount } from "@/lib/social-media/data";
import { CredentialInputError, getSocialCredentialStatus } from "@/lib/credentials/server";
import { logUserActivity } from "@/lib/user-management/repository";

function errStatus(m: string) { return /authentication/i.test(m) ? 401 : /permission|required/i.test(m) ? 403 : 500; }

const cleanCredentials = (raw: unknown): Record<string, string> | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  return out;
};

export async function GET(request: Request) {
  try {
    await requireUserManager(request);
    const accounts = await listAccounts();
    // Masked status only (last 4 of secrets); tokens never leave the server.
    return NextResponse.json({ accounts, credentialStatus: await getSocialCredentialStatus(accounts) });
  } catch (error) {
    const m = error instanceof Error ? error.message : "Failed to load accounts.";
    return NextResponse.json({ error: m }, { status: errStatus(m) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await requireUserManager(request, body.actionToken);
    if (!body.platform || !body.display_name) throw new Error("Platform and display name are required.");
    const credentials = cleanCredentials(body.credentials);
    const account = await saveAccount({
      id: body.id, platform: body.platform, display_name: body.display_name, profile_url: body.profile_url,
      external_id: body.external_id, status: body.status, is_active: body.is_active, credentials,
      actorUserId: actor.id,
    });
    const changed = Object.entries(credentials ?? {}).filter(([, v]) => v.trim()).map(([k]) => k);
    if (changed.length) {
      await logUserActivity({ actorUserId: actor.id, action: "credential_updated", entityType: "credential", metadata: { provider: `social:${account.platform}`, instance: account.id, fields: changed, via: "social_settings" } }).catch(() => {});
    }
    const credentialStatus = await getSocialCredentialStatus([account]);
    return NextResponse.json({ ok: true, account, credentialStatus: credentialStatus[account.id] ?? {} });
  } catch (error) {
    const m = error instanceof Error ? error.message : "Failed to save account.";
    return NextResponse.json({ error: m }, { status: error instanceof CredentialInputError ? 400 : errStatus(m) });
  }
}
