import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/user-management/auth";
import { logUserActivity } from "@/lib/user-management/repository";
import { actionTokenFrom, credentialError, noStore } from "@/lib/credentials/http";
import { CredentialInputError, DEFAULT_INSTANCE, getCredentialsOverview, invalidateCredentialCache, recordTestResult } from "@/lib/credentials/server";
import { isTestable, runCredentialTest } from "@/lib/credentials/tests";
import { raiseAlert } from "@/lib/notifications/alerts";

// POST { provider, instance? } — run the provider's read-only connection test (10 s limit)
// with the values the app would use right now (dashboard, then Coolify) and store the result.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, actionTokenFrom(request, body));
    const provider = String(body.provider ?? "");
    const instance = String(body.instance || DEFAULT_INSTANCE);
    if (!provider || !isTestable(provider)) throw new CredentialInputError("No connection test for this provider.");
    invalidateCredentialCache(); // test exactly what is saved now
    const result = await runCredentialTest(provider, instance);
    await recordTestResult({ provider, instance, ok: result.ok, message: result.message, actorId: actor.id });
    if (!result.ok) {
      // Alerts feed. Email and phone providers going dark is critical (web push too).
      const critical = ["resend", "smtp", "twilio"].includes(provider);
      await raiseAlert({
        severity: critical ? "critical" : "warning",
        category: "credentials",
        title: `Connection test failed: ${provider}`,
        message: result.message,
        audience: "super_admins",
        href: "/dashboard/credentials",
        dedupeKey: `credential_test_${provider}_${instance}`,
        dedupeHours: 6,
      });
    }
    await logUserActivity({
      actorUserId: actor.id, action: "credential_tested", entityType: "credential",
      metadata: { provider, instance, result: result.ok ? "passed" : "failed" },
    }).catch(() => {});
    return NextResponse.json({ ...result, overview: await getCredentialsOverview() }, noStore);
  } catch (error) {
    return credentialError(error, "Test failed.");
  }
}
