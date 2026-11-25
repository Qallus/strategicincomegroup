import { NextResponse } from "next/server";
import { requireParticipantManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissedCall } from "@/lib/twilio/missed-calls";
import { formatPhone, phoneKey, smsDirectoryByPhone } from "@/lib/sms/contacts";
import { commsError } from "@/lib/twilio/http";

const CAP = 5_000;

/**
 * Call history grouped by the other party — one row per phone number, resolved to a
 * profile / participant / contact where we know them.
 *   ?from=ISO&to=ISO   window (created_at)   ?q= name or digits
 */
export async function GET(request: Request) {
  try {
    await requireParticipantManager(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const supabase = createSupabaseAdminClient();
    const rows: Record<string, any>[] = [];
    for (let start = 0; start < CAP; start += 1000) {
      let query = supabase
        .from("calls")
        .select("id, direction, from_number, to_number, status, duration_seconds, answered_at, ended_at, started_at, created_at, recording_url, voicemail_url, transcription_text, voicemail_transcription")
        .order("created_at", { ascending: false })
        .range(start, start + 999);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const directory = await smsDirectoryByPhone().catch(() => new Map());
    type Group = {
      key: string; phone: string; phoneDisplay: string; name: string | null; kind: string | null; contactId: string | null;
      calls: number; inbound: number; outbound: number; missed: number; talkSeconds: number;
      voicemails: number; recordings: number; transcripts: number; lastAt: string | null; lastStatus: string | null; lastDirection: string | null;
    };
    const groups = new Map<string, Group>();
    for (const c of rows) {
      const number = c.direction === "inbound" ? c.from_number : c.to_number;
      if (!number || String(number).startsWith("client:")) continue;
      const key = phoneKey(number) || number;
      let g = groups.get(key);
      if (!g) {
        const match = directory.get(key);
        g = {
          key, phone: number, phoneDisplay: formatPhone(number), name: match?.name ?? null, kind: match?.kind ?? null, contactId: match?.id ?? null,
          calls: 0, inbound: 0, outbound: 0, missed: 0, talkSeconds: 0, voicemails: 0, recordings: 0, transcripts: 0,
          lastAt: c.started_at ?? c.created_at, lastStatus: c.status, lastDirection: c.direction,
        };
        groups.set(key, g);
      }
      g.calls++;
      if (c.direction === "inbound") g.inbound++;
      else g.outbound++;
      if (isMissedCall(c)) g.missed++;
      g.talkSeconds += Number(c.duration_seconds) || 0;
      if (c.voicemail_url) g.voicemails++;
      if (c.recording_url) g.recordings++;
      if (c.transcription_text || c.voicemail_transcription) g.transcripts++;
    }

    let list = [...groups.values()];
    if (q) {
      const digits = q.replace(/\D/g, "");
      list = list.filter((g) => g.name?.toLowerCase().includes(q) || (digits.length >= 3 && g.key.includes(digits)));
    }
    list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

    return NextResponse.json({ groups: list.slice(0, 500), totalGroups: list.length, capped: rows.length >= CAP });
  } catch (error) {
    return commsError(error, "Failed to load call history.");
  }
}
