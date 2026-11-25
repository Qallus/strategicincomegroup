import { NextResponse } from "next/server";
import { requireParticipantManager } from "@/lib/user-management/auth";
import { redtailGet } from "@/lib/redtail/client";

// Redtail widget client lookup (read-only). GET ?q=name — staff who manage clients only.
// Response shapes vary between Redtail API versions, so fields are picked defensively.

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

function pickContacts(payload: unknown): Json[] {
  if (Array.isArray(payload)) return payload as Json[];
  if (payload && typeof payload === "object") {
    const p = payload as Json;
    for (const k of ["contacts", "Contacts", "data", "results"]) if (Array.isArray(p[k])) return p[k] as Json[];
  }
  return [];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function GET(request: Request) {
  try {
    await requireParticipantManager(request);
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ results: [] });
    const payload = await redtailGet("/contacts/search", { name: q, page: 1 });
    const results = pickContacts(payload)
      .slice(0, 8)
      .map((c) => {
        const first = str(c.first_name) ?? str(c.FirstName);
        const last = str(c.last_name) ?? str(c.LastName);
        const full = str(c.full_name) ?? str(c.name) ?? [first, last].filter(Boolean).join(" ");
        const emails = Array.isArray(c.emails) ? (c.emails as Json[]) : [];
        const phones = Array.isArray(c.phones) ? (c.phones as Json[]) : [];
        return {
          id: String(c.id ?? c.ContactID ?? full),
          name: full || "Unnamed contact",
          type: str(c.type) ?? str(c.contact_type) ?? null,
          status: str(c.status) ?? str(c.status_name) ?? null,
          email: str(emails[0]?.address) ?? str(c.email) ?? null,
          phone: str(phones[0]?.number) ?? str(c.phone) ?? null,
        };
      });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed.";
    if (/authentication|permission|profile required/i.test(message)) return NextResponse.json({ error: "You don't have access to the CRM lookup." }, { status: 403 });
    if (/not set|required for basic auth/i.test(message)) return NextResponse.json({ error: "Redtail isn't connected yet.", setup: true }, { status: 503 });
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 502 });
  }
}
