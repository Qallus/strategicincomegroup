// Booking-created notifications.
//
//  • Client: email and/or SMS — ONLY for the channels they switched on in the booking form.
//  • Planner: always an email + SMS (when we have their address/number) and a dashboard
//    notification — a `notifications` row scoped to them plus a system DM so their header
//    bell badges. Admins get the same DM so nothing booked goes unseen.
//
// Every step is independent and swallowed: a booking is never failed or slowed by a
// notification. Missing SMTP/Twilio config is skipped with a server log.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSmtpConfig, sendSmtpEmail } from "@/lib/email/smtp";
import { getOrCreateConversation, sendSms } from "@/lib/twilio/sms";
import { toE164 } from "@/lib/sms/contacts";
import { createDashboardNotification } from "@/lib/notifications/notify";
import { dmBadge, getNotifierId } from "@/lib/notifications/system-dm";
import { CONTACT } from "@/lib/public-site/site-data";
import { ROLES } from "@/lib/rbac/roles";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "./ics";
import { recordBookingNotifications } from "./data";
import type { Booking, BookingType } from "./types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type BookingNotifyInput = {
  booking: Booking;
  type: BookingType;
  notify: { email: boolean; sms: boolean };
  consent?: { ip?: string | null; userAgent?: string | null };
};

type PlannerContact = { name: string; email: string | null; phone: string | null; profileId: string | null; fallbackEmail: boolean };

const LOCATION_LABEL: Record<string, string> = { video: "Video call", phone: "Phone call", in_person: "In person", custom: "Details to follow" };

const hasTwilioConfig = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://strategicincomegroup.com").replace(/\/$/, "");
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://strategicincomegroup.com").replace(/\/$/, "");

function fmtWhen(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", ...opts,
  });
}
function fmtShort(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
const tzLabel = (tz: string) => tz.replace(/_/g, " ").replace(/^America\//, "");
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function locationText(b: Pick<Booking, "location_type" | "location_details">, office?: string | null) {
  const base = LOCATION_LABEL[b.location_type] ?? "Details to follow";
  if (b.location_type === "in_person") return [office ? `${base} · ${office}` : base, b.location_details].filter(Boolean).join(" — ");
  return base;
}

export function calendarEventFor(b: Booking, type: BookingType, plannerName?: string | null): CalendarEvent {
  const host = plannerName || type.host_name || "Strategic Income Group";
  return {
    uid: b.reference,
    title: `${type.name} with ${host}`,
    description: [
      `${type.name} with ${host} — Strategic Income Group.`,
      `Reference: ${b.reference}`,
      `Need to reschedule? Call ${CONTACT.phone} or reply to your confirmation email.`,
    ].join("\n"),
    location: b.location_type === "in_person" ? b.location_details || type.office || "Strategic Income Group" : LOCATION_LABEL[b.location_type],
    start: b.start_at,
    end: b.end_at,
    organizerName: host,
    organizerEmail: CONTACT.email,
  };
}

async function resolvePlanner(sb: Admin, type: BookingType): Promise<PlannerContact> {
  let name = type.host_name || "";
  let email: string | null = null;
  let phone: string | null = null;
  let profileId: string | null = type.host_staff_id ?? null;

  if (type.host_slug) {
    const { data: ep } = await sb
      .from("employee_profiles")
      .select("full_name, first_name, last_name, email, account_email, phone, profile_id")
      .eq("slug", type.host_slug)
      .maybeSingle();
    if (ep) {
      name = name || ep.full_name || [ep.first_name, ep.last_name].filter(Boolean).join(" ");
      email = ep.email || ep.account_email || null;
      phone = ep.phone || null;
      profileId = profileId || ep.profile_id || null;
    }
  }
  if (profileId && (!email || !phone)) {
    const { data: p } = await sb.from("profiles").select("email, phone, full_name").eq("id", profileId).maybeSingle();
    if (p) {
      email = email || p.email || null;
      phone = phone || p.phone || null;
      name = name || p.full_name || "";
    }
  }
  // No planner inbox on file → the office's planning inbox, so the booking is never unseen.
  const fallbackEmail = !email;
  return { name: name || "your planner", email: email || CONTACT.email, phone, profileId, fallbackEmail };
}

// ── Email ─────────────────────────────────────────────────────────────────────

function emailShell(opts: { preheader: string; heading: string; intro: string; rows: [string, string][]; body?: string; cta?: { label: string; href: string } | null; footer: string }) {
  const rows = opts.rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Inter,Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e2d8">
<tr><td style="background:#101a33;padding:22px 28px;border-bottom:3px solid #c9a46a">
<div style="color:#c9a46a;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700">Strategic Income Group</div>
<div style="color:#ffffff;font-family:Georgia,serif;font-size:24px;line-height:1.25;margin-top:6px">${esc(opts.heading)}</div>
</td></tr>
<tr><td style="padding:26px 28px 8px">
<p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6">${esc(opts.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee9df;border-bottom:1px solid #eee9df;margin:4px 0 18px">${rows}</table>
${opts.body ?? ""}
${opts.cta ? `<p style="margin:20px 0 8px"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#1b2f6e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px">${esc(opts.cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px 26px;color:#6b7280;font-size:12px;line-height:1.6">${opts.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendClientEmail(b: Booking, type: BookingType, planner: PlannerContact, ics: string, cal: CalendarEvent) {
  const when = fmtWhen(b.start_at, b.timezone);
  const subject = `Confirmed: ${type.name} with ${planner.name} — ${fmtShort(b.start_at, b.timezone)}`;
  const intro = `Hi ${firstName(b.invitee_name)}, you're all set. We've saved your time with ${planner.name} and look forward to meeting you.`;
  const rows: [string, string][] = [
    ["When", `${when} (${tzLabel(b.timezone)})`],
    ["With", planner.name],
    ["Where", locationText(b, type.office)],
    ["Reference", b.reference],
  ];
  const body = `<p style="margin:0 0 6px;color:#0f172a;font-size:14px;font-weight:700">What to expect</p>
<ul style="margin:0 0 4px;padding-left:18px;color:#374151;font-size:14px;line-height:1.7">
<li>${esc(planner.name.split(",")[0])} will review your notes before you meet.</li>
<li>Bring any statements or questions you'd like to cover — there's no preparation required.</li>
<li>${b.location_type === "in_person" ? "Plan to arrive a few minutes early; parking is free." : b.location_type === "phone" ? "We'll call you at the number you provided." : "We'll send any meeting details ahead of time."}</li>
</ul>`;
  const footer = `A calendar invite (.ics) is attached. Need to reschedule? Reply to this email or call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.<br/>Strategic Income Group · <a href="${siteUrl()}" style="color:#1b2f6e">strategicincomegroup.com</a>`;
  const text = [
    intro, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Add to Google Calendar: ${googleCalendarUrl(cal)}`,
    `Need to reschedule? Reply to this email or call ${CONTACT.phone}.`,
  ].join("\n");
  return sendSmtpEmail({
    to: b.invitee_email!,
    subject,
    html: emailShell({ preheader: `${when} with ${planner.name}`, heading: "You're booked", intro, rows, body, cta: { label: "Add to Google Calendar", href: googleCalendarUrl(cal) }, footer }),
    text,
    replyTo: planner.fallbackEmail ? undefined : planner.email ?? undefined,
    attachments: [{ filename: "appointment.ics", content: Buffer.from(ics, "utf8"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  });
}

async function sendPlannerEmail(b: Booking, type: BookingType, planner: PlannerContact, ics: string, notify: { email: boolean; sms: boolean }) {
  const when = fmtWhen(b.start_at, b.timezone);
  const answers = Object.entries(b.answers ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const rows: [string, string][] = [
    ["When", `${when} (${tzLabel(b.timezone)})`],
    ["Meeting", type.name],
    ["Client", b.invitee_name],
    ["Email", b.invitee_email ?? ""],
    ["Phone", b.invitee_phone ?? ""],
    ["Where", locationText(b, type.office)],
    ["Reminders", [notify.email ? "Email" : null, notify.sms ? "Text" : null].filter(Boolean).join(" + ") || "Declined"],
    ["Reference", b.reference],
  ];
  const body = answers.length
    ? `<p style="margin:0 0 6px;color:#0f172a;font-size:14px;font-weight:700">Their answers</p>${answers
        .map(([k, v]) => `<p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.6"><span style="color:#6b7280">${esc(k.replace(/_/g, " "))}:</span> ${esc(String(v))}</p>`)
        .join("")}`
    : "";
  const intro = planner.fallbackEmail
    ? `A new appointment was booked with ${planner.name}. (No planner email is on file, so this went to the office inbox — add one in Dashboard → My Profile.)`
    : `${b.invitee_name} just booked time with you.`;
  return sendSmtpEmail({
    to: planner.email!,
    subject: `New booking: ${b.invitee_name} — ${fmtShort(b.start_at, b.timezone)}`,
    html: emailShell({
      preheader: `${type.name} · ${when}`,
      heading: "New appointment booked",
      intro,
      rows,
      body,
      cta: { label: "Open in dashboard", href: `${appUrl()}/dashboard/bookings` },
      footer: "Sent by the SIG booking system. The attached .ics adds this to your calendar.",
    }),
    text: [intro, "", ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), ...answers.map(([k, v]) => `${k}: ${v}`)].join("\n"),
    replyTo: b.invitee_email || undefined,
    attachments: [{ filename: "appointment.ics", content: Buffer.from(ics, "utf8"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  });
}

// ── Consent record (consent_events + a CRM contact) ──────────────────────────

async function recordConsent(sb: Admin, b: Booking, notify: { email: boolean; sms: boolean }, consent: BookingNotifyInput["consent"]) {
  if (!notify.email && !notify.sms) return;
  const email = b.invitee_email?.trim().toLowerCase() || null;
  const phone = b.invitee_phone ? toE164(b.invitee_phone) : null;
  const now = new Date().toISOString();

  let contactId: string | null = null;
  if (email) {
    const { data } = await sb.from("contacts").select("id").ilike("email", email).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId && phone) {
    const digits = phone.replace(/\D/g, "");
    const { data } = await sb.from("contacts").select("id").or(`phone.eq.${phone},phone.eq.${digits.slice(-10)}`).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  const flags: Record<string, unknown> = { updated_at: now };
  if (notify.email) flags.email_opt_in = true;
  if (notify.sms) flags.sms_opt_in = true;
  if (contactId) {
    await sb.from("contacts").update(flags).eq("id", contactId);
  } else {
    const [first, ...rest] = b.invitee_name.trim().split(/\s+/);
    const { data } = await sb
      .from("contacts")
      .insert({
        type: "lead", status: "active", first_name: first || null, last_name: rest.join(" ") || null,
        email, phone, source: "booking", tags: ["booking"], custom_fields: { booking_reference: b.reference },
        sms_opt_in: notify.sms, email_opt_in: notify.email,
      })
      .select("id")
      .maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId) return;

  const rows = (["email", "sms"] as const)
    .filter((c) => notify[c])
    .map((channel) => ({
      entity_type: "contact", entity_id: contactId, channel, event_type: "opt_in", source: "booking",
      ip_address: consent?.ip ?? null, user_agent: consent?.userAgent ?? null,
    }));
  const { error } = await sb.from("consent_events").insert(rows);
  // Before 202611190160 widens the source check, record as a web-form opt-in instead.
  if (error) await sb.from("consent_events").insert(rows.map((r) => ({ ...r, source: "web_form" })));
}

// ── Dashboard (notifications row + bell DM) ──────────────────────────────────

async function notifyDashboard(sb: Admin, b: Booking, type: BookingType, planner: PlannerContact) {
  const when = fmtShort(b.start_at, b.timezone);
  const title = `New booking: ${b.invitee_name}`;
  const message = `${type.name} with ${planner.name} · ${when} (${tzLabel(b.timezone)})`;
  await createDashboardNotification({
    type: "booking_created",
    title,
    message,
    userId: planner.profileId,
    metadata: {
      booking_id: b.id, reference: b.reference, booking_type_id: type.id, booking_type_slug: type.slug,
      host_slug: type.host_slug ?? null, start_at: b.start_at, href: "/dashboard/bookings",
    },
  });

  const notifierId = await getNotifierId(sb);
  if (!notifierId) return;
  const { data: admins } = await sb.from("profiles").select("id").in("role", [ROLES.SUPER_ADMIN, ROLES.ADMIN]).eq("status", "active").limit(20);
  const recipients = new Set<string>([...(planner.profileId ? [planner.profileId] : []), ...(admins ?? []).map((a) => a.id as string)]);
  const body = `${title}\n${message}\nRef ${b.reference}${b.invitee_phone ? ` · ${b.invitee_phone}` : ""}${b.invitee_email ? ` · ${b.invitee_email}` : ""}\nOpen: /dashboard/bookings`;
  for (const id of recipients) {
    try { await dmBadge(sb, notifierId, id, body); } catch (e) { console.error("[booking-notify] DM badge failed", id, e instanceof Error ? e.message : e); }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function notifyBookingCreated({ booking: b, type, notify, consent }: BookingNotifyInput): Promise<Record<string, string>> {
  const sb = createSupabaseAdminClient();
  const sent: Record<string, string> = {};
  const step = async (key: string, fn: () => Promise<string>) => {
    try { sent[key] = await fn(); } catch (e) {
      sent[key] = "failed";
      console.error(`[booking-notify] ${key} failed for ${b.reference}:`, e instanceof Error ? e.message : e);
    }
  };

  let planner: PlannerContact = { name: type.host_name || "your planner", email: CONTACT.email, phone: null, profileId: type.host_staff_id, fallbackEmail: true };
  try { planner = await resolvePlanner(sb, type); } catch (e) { console.error("[booking-notify] planner lookup failed", e); }

  const cal = calendarEventFor(b, type, planner.name);
  const ics = buildIcs(cal);
  const smtp = hasSmtpConfig();
  const twilio = hasTwilioConfig();
  if (!smtp) console.info(`[booking-notify] email not configured — skipping booking emails for ${b.reference}`);
  if (!twilio) console.info(`[booking-notify] Twilio not configured — skipping booking texts for ${b.reference}`);

  // Client — only the channels they opted into.
  if (notify.email && b.invitee_email) {
    await step("client_email", async () => (smtp ? ((await sendClientEmail(b, type, planner, ics, cal)).ok ? "sent" : "skipped") : "skipped"));
  } else sent.client_email = "not_requested";

  const clientPhone = b.invitee_phone ? toE164(b.invitee_phone) : "";
  if (notify.sms && clientPhone) {
    await step("client_sms", async () => {
      if (!twilio) return "skipped";
      const body = `Strategic Income Group: You're booked with ${planner.name.split(",")[0]} for ${fmtShort(b.start_at, b.timezone)} (${tzLabel(b.timezone)}). Ref ${b.reference}. Questions? ${CONTACT.phone}. Reply STOP to opt out, HELP for help.`;
      let conversationId: string | undefined;
      try { conversationId = await getOrCreateConversation(clientPhone, b.invitee_name); } catch { conversationId = undefined; }
      await sendSms({ to: clientPhone, body, conversationId });
      return "sent";
    });
  } else sent.client_sms = "not_requested";

  // Planner — always.
  await step("planner_email", async () => (smtp ? ((await sendPlannerEmail(b, type, planner, ics, notify)).ok ? (planner.fallbackEmail ? "sent_office" : "sent") : "skipped") : "skipped"));
  const plannerPhone = planner.phone ? toE164(planner.phone) : "";
  await step("planner_sms", async () => {
    if (!plannerPhone) return "no_phone";
    if (!twilio) return "skipped";
    await sendSms({ to: plannerPhone, body: `SIG booking: ${b.invitee_name} booked ${type.name} for ${fmtShort(b.start_at, b.timezone)}.${b.invitee_phone ? ` ${b.invitee_phone}.` : ""} Ref ${b.reference}.` });
    return "sent";
  });
  await step("dashboard", async () => { await notifyDashboard(sb, b, type, planner); return "sent"; });
  await step("consent", async () => { await recordConsent(sb, b, notify, consent); return notify.email || notify.sms ? "recorded" : "none"; });

  await recordBookingNotifications(b.id, { ...sent, at: new Date().toISOString() });
  return sent;
}
