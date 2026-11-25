import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { wantsFirm } from "@/lib/dashboard/viewer";
import type { DashboardViewer } from "@/lib/dashboard/types";
import { isMissedCall, loadCalls, summarizeCalls } from "@/lib/voice/stats";
import { listConversations } from "@/lib/direct-messages/data";
import { DataForbidden, clampInt, periodRange } from "./util";

const requireComms = (viewer: DashboardViewer) => {
  if (!viewer.permissions.includes(PERMISSIONS.MANAGE_PARTICIPANTS)) throw new DataForbidden();
};

export type CallLogItem = {
  id: string;
  direction: "inbound" | "outbound";
  number: string;
  name: string | null;
  status: string;
  missed: boolean;
  duration: number;
  recordingUrl: string | null;
  voicemailUrl: string | null;
  transcript: string | null;
  createdAt: string;
};

type RawCall = {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  voicemail_url: string | null;
  transcription_text: string | null;
  voicemail_transcription: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
  participants: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

const CALL_SELECT =
  "id, direction, from_number, to_number, status, duration_seconds, recording_url, voicemail_url, transcription_text, voicemail_transcription, answered_at, ended_at, created_at, participants(first_name, last_name)";

function toLogItem(c: RawCall): CallLogItem {
  const p = Array.isArray(c.participants) ? c.participants[0] : c.participants;
  const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null : null;
  return {
    id: c.id,
    direction: c.direction,
    number: c.direction === "inbound" ? c.from_number : c.to_number,
    name,
    status: c.status,
    missed: isMissedCall(c),
    duration: Math.max(0, c.duration_seconds ?? 0),
    recordingUrl: c.recording_url,
    voicemailUrl: c.voicemail_url,
    transcript: c.transcription_text || c.voicemail_transcription || null,
    createdAt: c.created_at,
  };
}

const quoteFilter = (v: string) => `"${v.replace(/"/g, "")}"`;

/** Recent calls (+ 30-day talk time) for the Call log widget. `number` = history for one number. */
export async function loadCallLog(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  requireComms(viewer);
  const firm = wantsFirm(viewer, params);
  const limit = clampInt(params.limit, 3, 50, 8);
  const filter = String(params.filter ?? "all");
  const number = typeof params.number === "string" && /^[+\d][\d\s()+-]{2,24}$/.test(params.number) ? params.number.trim() : null;
  const sb = createSupabaseAdminClient();

  let q = sb.from("calls").select(CALL_SELECT).order("created_at", { ascending: false }).limit(filter === "missed" ? 200 : limit);
  if (!firm) q = q.eq("handled_by", viewer.id);
  if (filter === "inbound" || filter === "outbound") q = q.eq("direction", filter);
  if (filter === "recorded") q = q.not("recording_url", "is", null);
  if (number) q = q.or(`from_number.eq.${quoteFilter(number)},to_number.eq.${quoteFilter(number)}`);

  const since = periodRange("30d").since;
  const [{ data, error }, recent] = await Promise.all([q, loadCalls({ since, handledBy: firm ? null : viewer.id })]);
  if (error) return { calls: [] as CallLogItem[], summary: summarizeCalls([]), firm, number, unavailable: true };
  let calls = ((data ?? []) as unknown as RawCall[]).map(toLogItem);
  if (filter === "missed") calls = calls.filter((c) => c.missed).slice(0, limit);
  const scoped = number ? recent.filter((c) => c.from_number === number || c.to_number === number) : recent;
  return { calls, summary: summarizeCalls(scoped), firm, number, unavailable: false };
}

export async function loadLatestTranscript(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  requireComms(viewer);
  const firm = wantsFirm(viewer, params);
  let q = createSupabaseAdminClient()
    .from("calls")
    .select(CALL_SELECT)
    .or("transcription_text.not.is.null,voicemail_transcription.not.is.null")
    .order("created_at", { ascending: false })
    .limit(1);
  if (!firm) q = q.eq("handled_by", viewer.id);
  const { data, error } = await q;
  if (error) return { call: null, firm };
  const row = (data ?? [])[0] as unknown as RawCall | undefined;
  return { call: row ? toLogItem(row) : null, firm };
}

export async function loadSmsInbox(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  requireComms(viewer);
  const limit = clampInt(params.limit, 3, 25, 5);
  const sb = createSupabaseAdminClient();
  const [{ data, error }, unreadRows] = await Promise.all([
    sb
      .from("sms_conversations")
      .select("id, contact_name, contact_number, last_message_at, last_message_preview, unread_count")
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit),
    sb.from("sms_conversations").select("unread_count").gt("unread_count", 0).limit(1000),
  ]);
  if (error) return { conversations: [], unread: 0, unavailable: true };
  const unread = ((unreadRows.data ?? []) as { unread_count: number }[]).reduce((t, r) => t + (r.unread_count ?? 0), 0);
  return {
    conversations: ((data ?? []) as { id: string; contact_name: string | null; contact_number: string; last_message_at: string | null; last_message_preview: string | null; unread_count: number }[]).map((c) => ({
      id: c.id, name: c.contact_name, number: c.contact_number, at: c.last_message_at, preview: c.last_message_preview, unread: c.unread_count ?? 0,
    })),
    unread,
    unavailable: false,
  };
}

export async function loadEmailInbox(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  if (!viewer.permissions.includes(PERMISSIONS.MANAGE_SETTINGS)) throw new DataForbidden();
  const limit = clampInt(params.limit, 3, 25, 5);
  const { data, error } = await createSupabaseAdminClient()
    .from("email_messages")
    .select("id, subject, from_email, from_name, snippet, received_at, flags")
    .is("deleted_at", null)
    .is("removed_at", null)
    .is("hidden_at", null)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { messages: [], unavailable: true };
  return {
    messages: ((data ?? []) as { id: string; subject: string | null; from_email: string | null; from_name: string | null; snippet: string | null; received_at: string | null; flags: string[] | null }[]).map((m) => ({
      id: m.id,
      subject: m.subject || "(no subject)",
      from: m.from_name || m.from_email || "Unknown sender",
      snippet: (m.snippet ?? "").slice(0, 160),
      at: m.received_at,
      unread: !(m.flags ?? []).some((f) => /seen/i.test(f)),
    })),
    unavailable: false,
  };
}

export async function loadDirectMessages(viewer: DashboardViewer) {
  const convos = await listConversations(viewer.id).catch(() => []);
  const unread = convos.reduce((t, c) => t + c.unread, 0);
  const awaitingReply = convos.filter((c) => c.last_sender_id && c.last_sender_id !== viewer.id).length;
  return {
    unread,
    activeConversations: convos.length,
    awaitingReply,
    recent: convos.slice(0, 4).map((c) => ({ id: c.id, name: c.other?.name ?? "Conversation", preview: c.last_message_preview, at: c.last_message_at, unread: c.unread })),
  };
}
