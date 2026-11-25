import { NextResponse } from "next/server";
import { requireParticipantManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchCallPrice } from "@/lib/twilio/client";
import { isMissedCall } from "@/lib/twilio/missed-calls";
import { formatPhone, phoneKey, smsDirectoryByPhone } from "@/lib/sms/contacts";
import { commsError } from "@/lib/twilio/http";

// Cap how many missing prices we backfill per request to keep the list fast.
const PRICE_BACKFILL_LIMIT = 10;
const TOTALS_CAP = 10_000;

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Row = Record<string, any>;

/**
 * Call log.
 *   ?limit&offset            paging (limit ≤ 100)
 *   ?direction=inbound|outbound
 *   ?kind=missed|voicemail|recording|transcript
 *   ?from=ISO&to=ISO         started window (created_at)
 *   ?q=                      number digits or a contact name
 *   ?voicemail=true          (legacy) same as kind=voicemail
 * Returns { calls, totals } — totals cover the date window + search across every matching
 * call (not just this page): counts per tab, talk time (sum of duration_seconds) and cost.
 */
export async function GET(request: Request) {
  try {
    await requireParticipantManager(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50") || 50, 100);
    const offset = parseInt(searchParams.get("offset") ?? "0") || 0;
    const direction = searchParams.get("direction");
    const kind = searchParams.get("voicemail") === "true" ? "voicemail" : searchParams.get("kind");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = (searchParams.get("q") ?? "").trim();

    const supabase = createSupabaseAdminClient();
    const directory = await smsDirectoryByPhone().catch(() => new Map());
    const numberFilter = buildNumberFilter(q, directory);
    if (numberFilter === null) return NextResponse.json({ calls: [], totals: emptyTotals(), total: 0 });

    const scope = <T extends { gte: any; lte: any; or: any }>(query: T): T => {
      let out = query;
      if (from) out = out.gte("created_at", from);
      if (to) out = out.lte("created_at", to);
      if (numberFilter) out = out.or(numberFilter);
      return out;
    };

    let query = scope(
      supabase
        .from("calls")
        .select(
          `
        id, twilio_call_sid, direction, from_number, to_number,
        status, duration_seconds, recording_url, recording_duration,
        transcription_text, transcription_status, voicemail_url, voicemail_transcription,
        price, price_unit, notes, started_at, answered_at, ended_at, created_at,
        participant_id, profile_id, handled_by,
        participants(first_name, last_name, email),
        profiles(full_name, email),
        handled_by_profile:profiles!calls_handled_by_fkey(full_name)
      `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    );

    if (direction === "inbound" || direction === "outbound") query = query.eq("direction", direction);
    if (kind === "voicemail") query = query.not("voicemail_url", "is", null);
    else if (kind === "recording") query = query.not("recording_url", "is", null);
    else if (kind === "transcript") query = query.or("transcription_text.not.is.null,voicemail_transcription.not.is.null");
    else if (kind === "missed") query = query.or("status.in.(no-answer,busy),and(direction.eq.inbound,answered_at.is.null,ended_at.not.is.null)");

    const [{ data, error, count }, totals] = await Promise.all([query, loadTotals(supabase, scope, direction, kind)]);
    if (error) throw error;

    const calls = (data ?? []) as Row[];
    await backfillMissingPrices(supabase, calls);

    for (const c of calls) {
      const number = c.direction === "inbound" ? c.from_number : c.to_number;
      const match = directory.get(phoneKey(number));
      c.contact = match ? { name: match.name, kind: match.kind, id: match.id } : null;
      c.number_display = formatPhone(number);
    }

    return NextResponse.json({ calls, totals, total: count ?? calls.length });
  } catch (error) {
    return commsError(error, "Failed to fetch calls.");
  }
}

/** PostgREST or-filter for ?q: digits match either number; a name matches known contacts. */
function buildNumberFilter(q: string, directory: Map<string, { name: string | null; phoneKey: string }>): string | "" | null {
  if (!q) return "";
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && !/[a-z]/i.test(q)) {
    const d = digits.length > 10 ? digits.slice(-10) : digits;
    return `from_number.ilike.%${d}%,to_number.ilike.%${d}%`;
  }
  const needle = q.toLowerCase();
  const keys = [...directory.values()].filter((c) => c.name?.toLowerCase().includes(needle)).map((c) => c.phoneKey).filter((k) => /^\d{4,15}$/.test(k)).slice(0, 25);
  if (!keys.length) return null;
  return keys.flatMap((k) => [`from_number.ilike.%${k}`, `to_number.ilike.%${k}`]).join(",");
}

function emptyTotals() {
  return { all: 0, inbound: 0, outbound: 0, missed: 0, voicemails: 0, recordings: 0, transcripts: 0, talkSeconds: 0, filteredTalkSeconds: 0, cost: 0, costUnit: "USD", capped: false };
}

async function loadTotals(supabase: Admin, scope: <T extends { gte: any; lte: any; or: any }>(q: T) => T, direction: string | null, kind: string | null) {
  const rows: Row[] = [];
  for (let start = 0; start < TOTALS_CAP; start += 1000) {
    const { data, error } = await scope(
      supabase
        .from("calls")
        .select("direction, status, answered_at, ended_at, duration_seconds, price, price_unit, recording_url, voicemail_url, transcription_text, voicemail_transcription")
        .order("created_at", { ascending: false })
        .range(start, start + 999),
    );
    if (error || !data) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const t = emptyTotals();
  t.capped = rows.length >= TOTALS_CAP;
  for (const c of rows) {
    t.all++;
    if (c.direction === "inbound") t.inbound++;
    if (c.direction === "outbound") t.outbound++;
    const missed = isMissedCall(c);
    if (missed) t.missed++;
    if (c.voicemail_url) t.voicemails++;
    if (c.recording_url) t.recordings++;
    if (c.transcription_text || c.voicemail_transcription) t.transcripts++;
    const secs = Number(c.duration_seconds) || 0;
    t.talkSeconds += secs;
    t.cost += Number(c.price) || 0;
    if (c.price_unit) t.costUnit = c.price_unit;

    const inFilter =
      (!direction || c.direction === direction) &&
      (!kind ||
        (kind === "missed" && missed) ||
        (kind === "voicemail" && c.voicemail_url) ||
        (kind === "recording" && c.recording_url) ||
        (kind === "transcript" && (c.transcription_text || c.voicemail_transcription)));
    if (inFilter) t.filteredTalkSeconds += secs;
  }
  t.cost = Math.round(t.cost * 10000) / 10000;
  return t;
}

// Twilio only finalizes call price a short time after the call ends, so the
// status webhook frequently gets null. Backfill any ended calls still missing a
// price (and not too old) by fetching from Twilio, capped per request.
async function backfillMissingPrices(supabase: Admin, calls: Row[]) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const pending = calls
    .filter((c) => c.twilio_call_sid && c.price == null && c.ended_at && new Date(c.ended_at).getTime() > dayAgo)
    .slice(0, PRICE_BACKFILL_LIMIT);

  if (pending.length === 0) return;

  await Promise.all(
    pending.map(async (c) => {
      const info = await fetchCallPrice(c.twilio_call_sid);
      if (!info) return;
      c.price = info.price;
      c.price_unit = info.priceUnit;
      await supabase
        .from("calls")
        .update({ price: info.price, price_unit: info.priceUnit, updated_at: new Date().toISOString() })
        .eq("id", c.id);
    }),
  );
}
