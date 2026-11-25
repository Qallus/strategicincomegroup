import "server-only";
import { NextResponse } from "next/server";
import { CredentialsKeyError } from "./crypto";
import { CredentialInputError } from "./server";

// Shared bits for /api/admin/credentials/*. Every route calls requireSuperAdmin first.

export function credentialError(error: unknown, fallback: string) {
  const m = error instanceof Error ? error.message : fallback;
  const status =
    error instanceof CredentialInputError || error instanceof CredentialsKeyError ? 400
      : /authentication/i.test(m) ? 401
        : /permission|super admin|admin profile/i.test(m) ? 403
          : 500;
  return NextResponse.json({ error: m }, { status, headers: { "Cache-Control": "no-store" } });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };

export function actionTokenFrom(request: Request, body?: { actionToken?: unknown } | null): string | null {
  if (body && typeof body.actionToken === "string") return body.actionToken;
  return request.headers.get("x-sig-action-token");
}
