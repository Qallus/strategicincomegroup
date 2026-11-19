// Auth for the Settings → AI Connectors API routes: the signed-in person (session
// cookie, Supabase bearer, or the dashboard action token), who must be allowed
// to use AI connectors at all. Every route only touches that person's own rows.
import { requireActiveProfile } from "@/lib/user-management/auth";
import { mcpAccessFor } from "./auth";

export async function requireConnectorUser(request: Request, actionToken?: string | null) {
  const profile = await requireActiveProfile(request, actionToken ?? request.headers.get("x-sig-action-token"));
  const access = mcpAccessFor({ id: profile.id as string, role: profile.role, status: (profile.status as string | null) ?? null });
  if (!access.allowed) throw new Error(`${access.reason} (permission required)`);
  return { id: profile.id as string, role: profile.role };
}

export function errorStatus(message: string): number {
  if (/authentication required/i.test(message)) return 401;
  if (/permission|required|active profile/i.test(message)) return 403;
  if (/not found|doesn't exist/i.test(message)) return 404;
  return 400;
}
