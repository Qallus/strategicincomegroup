import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Dialer + SMS settings (public.communication_settings, one row). Super Admin edits them on
 * the Dialer page. If the communications migration hasn't been applied every value falls
 * back to its safe default — in particular Conference mode stays OFF, so the call flow is
 * exactly the original Dial flow.
 */

export type CommunicationSettings = {
  autoTranscribe: boolean;
  voiceConferenceMode: boolean;
  smsMessagesPerSecond: number;
  smsKeywordReplies: boolean;
  updatedAt: string | null;
  /** false when the table is missing (migration not applied). */
  available: boolean;
};

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  autoTranscribe: false,
  voiceConferenceMode: false,
  smsMessagesPerSecond: 1,
  smsKeywordReplies: true,
  updatedAt: null,
  available: false,
};

let cache: { at: number; value: CommunicationSettings } | null = null;
const TTL_MS = 10_000;

export async function getCommunicationSettings({ fresh = false }: { fresh?: boolean } = {}): Promise<CommunicationSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULT_COMMUNICATION_SETTINGS;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("communication_settings")
      .select("auto_transcribe, voice_conference_mode, sms_messages_per_second, sms_keyword_replies, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (!error) {
      value = {
        autoTranscribe: Boolean(data?.auto_transcribe),
        voiceConferenceMode: Boolean(data?.voice_conference_mode),
        smsMessagesPerSecond: Number(data?.sms_messages_per_second ?? 1) || 1,
        smsKeywordReplies: data?.sms_keyword_replies ?? true,
        updatedAt: data?.updated_at ?? null,
        available: true,
      };
    }
  } catch {
    /* defaults */
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function updateCommunicationSettings(
  patch: Partial<Pick<CommunicationSettings, "autoTranscribe" | "voiceConferenceMode" | "smsMessagesPerSecond" | "smsKeywordReplies">>,
  actorId: string | null,
): Promise<CommunicationSettings> {
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = { id: true, updated_at: new Date().toISOString(), updated_by: actorId };
  if (patch.autoTranscribe !== undefined) row.auto_transcribe = Boolean(patch.autoTranscribe);
  if (patch.voiceConferenceMode !== undefined) row.voice_conference_mode = Boolean(patch.voiceConferenceMode);
  if (patch.smsKeywordReplies !== undefined) row.sms_keyword_replies = Boolean(patch.smsKeywordReplies);
  if (patch.smsMessagesPerSecond !== undefined) {
    const n = Number(patch.smsMessagesPerSecond);
    if (!Number.isFinite(n) || n <= 0 || n > 50) throw new Error("Messages per second must be between 0.1 and 50.");
    row.sms_messages_per_second = Math.round(n * 100) / 100;
  }
  const { error } = await supabase.from("communication_settings").upsert(row, { onConflict: "id" });
  if (error) {
    if (isMissingRelation(error)) throw new Error("Run the communications migration (202611250230_communications.sql) first.");
    throw new Error(error.message);
  }
  cache = null;
  return getCommunicationSettings({ fresh: true });
}

/** PostgREST / Postgres "relation or column does not exist". */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}
