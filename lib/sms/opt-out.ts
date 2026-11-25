import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { phoneKey, toE164 } from "@/lib/sms/contacts";
import { isMissingRelation } from "@/lib/twilio/settings";

/**
 * SMS consent at the phone-number level.
 *
 * STOP must stop everything sent to that number, whoever it belongs to. We record it in three
 * places: public.sms_opt_outs (by last-10-digits, also for numbers that match nobody), the
 * sms_opt_in flag on every profile / participant / contact with that number, and an audit row
 * in consent_events. START reverses all three.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Table = "profiles" | "participants" | "contacts";

/** Rows in `table` whose phone has the same last ten digits, whatever its formatting. */
async function rowsForPhone(supabase: Admin, table: Table, phone: string): Promise<string[]> {
  const key = phoneKey(phone);
  if (key.length < 4) return [];
  const { data } = await supabase.from(table).select("id, phone").ilike("phone", `%${key.slice(-4)}%`).limit(200);
  return ((data ?? []) as { id: string; phone: string | null }[])
    .filter((r) => phoneKey(r.phone) === key)
    .map((r) => r.id);
}

const ENTITY: Record<Table, "profile" | "participant" | "contact"> = {
  profiles: "profile",
  participants: "participant",
  contacts: "contact",
};

async function audit(supabase: Admin, table: Table, ids: string[], eventType: "opt_in" | "opt_out", source: string) {
  if (!ids.length) return;
  const { error } = await supabase.from("consent_events").insert(
    ids.map((id) => ({ entity_type: ENTITY[table], entity_id: id, channel: "sms", event_type: eventType, source })),
  );
  if (error) console.error("[sms-consent] consent_events insert failed", table, error.message);
}

export async function recordSmsOptOut(phone: string, source: "keyword_stop" | "admin_manual" = "keyword_stop") {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const key = phoneKey(phone);
  if (!key) return;

  const { error } = await supabase
    .from("sms_opt_outs")
    .upsert({ phone_key: key, phone: toE164(phone) || phone, source, opted_out_at: now }, { onConflict: "phone_key" });
  if (error && !isMissingRelation(error)) console.error("[sms-consent] sms_opt_outs upsert failed", error.message);

  for (const table of ["profiles", "participants"] as const) {
    const ids = await rowsForPhone(supabase, table, phone);
    if (!ids.length) continue;
    await supabase.from(table).update({ sms_opt_in: false, sms_opt_out_at: now }).in("id", ids);
    await audit(supabase, table, ids, "opt_out", source);
  }
  const contactIds = await rowsForPhone(supabase, "contacts", phone);
  if (contactIds.length) {
    await supabase.from("contacts").update({ sms_opt_in: false, updated_at: now }).in("id", contactIds);
    await audit(supabase, "contacts", contactIds, "opt_out", source);
  }
}

export async function recordSmsOptIn(phone: string, source: "keyword_start" | "admin_manual" = "keyword_start") {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const key = phoneKey(phone);
  if (!key) return;

  const { error } = await supabase.from("sms_opt_outs").delete().eq("phone_key", key);
  if (error && !isMissingRelation(error)) console.error("[sms-consent] sms_opt_outs delete failed", error.message);

  for (const table of ["profiles", "participants"] as const) {
    const ids = await rowsForPhone(supabase, table, phone);
    if (!ids.length) continue;
    await supabase.from(table).update({ sms_opt_in: true, sms_opt_in_at: now, sms_opt_in_source: source }).in("id", ids);
    await audit(supabase, table, ids, "opt_in", source);
  }
  const contactIds = await rowsForPhone(supabase, "contacts", phone);
  if (contactIds.length) {
    await supabase.from("contacts").update({ sms_opt_in: true, updated_at: now }).in("id", contactIds);
    await audit(supabase, "contacts", contactIds, "opt_in", source);
  }
}

/** Which of these phone keys texted STOP. Empty set if the table isn't there yet. */
export async function optedOutPhoneKeys(keys: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return out;
  const supabase = createSupabaseAdminClient();
  for (let i = 0; i < unique.length; i += 500) {
    const { data, error } = await supabase.from("sms_opt_outs").select("phone_key").in("phone_key", unique.slice(i, i + 500));
    if (error) return out;
    for (const r of data ?? []) out.add(r.phone_key as string);
  }
  return out;
}

export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const key = phoneKey(phone);
  if (!key) return false;
  return (await optedOutPhoneKeys([key])).has(key);
}
