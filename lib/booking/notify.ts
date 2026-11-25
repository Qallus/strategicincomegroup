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
import { hasTwilioConfig } from "@/lib/twilio/client";
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
  /** Absolute self-service link (/book/manage/<token>) — null before 202611210200 is applied. */
  manageUrl?: string | null;
};

type PlannerContact = { name: string; email: string | null; phone: string | null; profileId: string | null; fallbackEmail: boolean };

const LOCATION_LABEL: Record<string, string> = { video: "Video call", phone: "Phone call", in_person: "In person", custom: "Details to follow" };

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

export function calendarEventFor(
  b: Booking, type: BookingType, plannerName?: string | null,
  opts: { manageUrl?: string | null; method?: CalendarEvent["method"] } = {},
): CalendarEvent {
  const host = plannerName || type.host_name || "Strategic Income Group";
  return {
    uid: b.reference,
    title: `${type.name} with ${host}`,
    description: [
      `${type.name} with ${host} — Strategic Income Group.`,
      `Reference: ${b.reference}`,
      opts.manageUrl
        ? `Reschedule or cancel: ${opts.manageUrl}\nQuestions? Call ${CONTACT.phone}.`
        : `Need to reschedule? Call ${CONTACT.phone} or reply to your confirmation email.`,
    ].join("\n"),
    url: opts.manageUrl ?? null,
    sequence: b.ics_sequence ?? 0,
    method: opts.method,
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

async function sendClientEmail(b: Booking, type: BookingType, planner: PlannerContact, ics: string, cal: CalendarEvent, manageUrl?: string | null) {
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
  const footer = manageUrl
    ? `A calendar invite (.ics) is attached. Need to reschedule or cancel? <a href="${esc(manageUrl)}" style="color:#1b2f6e">Manage your appointment</a> any time, or call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.<br/>Strategic Income Group · <a href="${siteUrl()}" style="color:#1b2f6e">strategicincomegroup.com</a>`
    : `A calendar invite (.ics) is attached. Need to reschedule? Reply to this email or call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.<br/>Strategic Income Group · <a href="${siteUrl()}" style="color:#1b2f6e">strategicincomegroup.com</a>`;
  const text = [
    intro, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Add to Google Calendar: ${googleCalendarUrl(cal)}`,
    ...(manageUrl ? [`Reschedule or cancel: ${manageUrl}`, `Questions? Call ${CONTACT.phone}.`] : [`Need to reschedule? Reply to this email or call ${CONTACT.phone}.`]),
  ].join("\n");
  return sendSmtpEmail({
    to: b.invitee_email!,
    subject,
    html: emailShell({
      preheader: `${when} with ${planner.name}`, heading: "You're booked", intro, rows, body,
      cta: manageUrl ? { label: "Manage your appointment", href: manageUrl } : { label: "Add to Google Calendar", href: googleCalendarUrl(cal) },
      footer,
    }),
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

export async function recordBookingConsent(b: Booking, notify: { email: boolean; sms: boolean }, consent: BookingNotifyInput["consent"]) {
  return recordConsent(createSupabaseAdminClient(), b, notify, consent);
}

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

export async function notifyBookingCreated({ booking: b, type, notify, consent, manageUrl }: BookingNotifyInput): Promise<Record<string, string>> {
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

  const cal = calendarEventFor(b, type, planner.name, { manageUrl });
  const ics = buildIcs(cal);
  const [smtp, twilio] = await Promise.all([hasSmtpConfig(), hasTwilioConfig()]);
  if (!smtp) console.info(`[booking-notify] email not configured — skipping booking emails for ${b.reference}`);
  if (!twilio) console.info(`[booking-notify] Twilio not configured — skipping booking texts for ${b.reference}`);

  // Client — only the channels they opted into.
  if (notify.email && b.invitee_email) {
    await step("client_email", async () => (smtp ? ((await sendClientEmail(b, type, planner, ics, cal, manageUrl)).ok ? "sent" : "skipped") : "skipped"));
  } else sent.client_email = "not_requested";

  const clientPhone = b.invitee_phone ? toE164(b.invitee_phone) : "";
  if (notify.sms && clientPhone) {
    await step("client_sms", async () => {
      if (!twilio) return "skipped";
      const body = `Strategic Income Group: You're booked with ${planner.name.split(",")[0]} for ${fmtShort(b.start_at, b.timezone)} (${tzLabel(b.timezone)}). Ref ${b.reference}. ${manageUrl ? `Reschedule or cancel: ${manageUrl} ` : ""}Questions? ${CONTACT.phone}. Reply STOP to opt out, HELP for help.`;
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

// ── Reschedule / cancel ───────────────────────────────────────────────────────

export type BookingChangeInput = {
  kind: "rescheduled" | "cancelled";
  booking: Booking;
  type: BookingType;
  /** The time before a reschedule. */
  previous?: { start_at: string; end_at: string } | null;
  by: "client" | "staff";
  reason?: string | null;
  /** Absolute manage link to include for a reschedule (null = don't include one). */
  manageUrl?: string | null;
};

/** The planner for a booking — honours a reassigned booking (host_staff_id) over the page's planner. */
async function plannerForBooking(sb: Admin, b: Booking, type: BookingType): Promise<PlannerContact> {
  let planner: PlannerContact = { name: type.host_name || "your planner", email: CONTACT.email, phone: null, profileId: type.host_staff_id, fallbackEmail: true };
  try { planner = await resolvePlanner(sb, type); } catch (e) { console.error("[booking-notify] planner lookup failed", e); }
  if (b.host_staff_id && b.host_staff_id !== planner.profileId) {
    const { data: p } = await sb.from("profiles").select("email, phone, full_name").eq("id", b.host_staff_id).maybeSingle();
    const { data: ep } = await sb.from("employee_profiles").select("full_name, email, phone").eq("profile_id", b.host_staff_id).maybeSingle();
    const email = ep?.email || p?.email || null;
    planner = {
      name: ep?.full_name || p?.full_name || planner.name,
      email: email || CONTACT.email,
      phone: ep?.phone || p?.phone || null,
      profileId: b.host_staff_id,
      fallbackEmail: !email,
    };
  }
  return planner;
}

export async function notifyBookingChanged(input: BookingChangeInput): Promise<Record<string, string>> {
  const { kind, booking: b, type, previous, by, reason, manageUrl } = input;
  const sb = createSupabaseAdminClient();
  const sent: Record<string, string> = {};
  const step = async (key: string, fn: () => Promise<string>) => {
    try { sent[key] = await fn(); } catch (e) {
      sent[key] = "failed";
      console.error(`[booking-notify] ${kind} ${key} failed for ${b.reference}:`, e instanceof Error ? e.message : e);
    }
  };
  const planner = await plannerForBooking(sb, b, type);
  const cancelled = kind === "cancelled";
  const cal = calendarEventFor(b, type, planner.name, { manageUrl: cancelled ? null : manageUrl, method: cancelled ? "CANCEL" : "PUBLISH" });
  const ics = buildIcs(cal);
  const icsAttachment = {
    filename: cancelled ? "cancelled-appointment.ics" : "appointment.ics",
    content: Buffer.from(ics, "utf8"),
    contentType: `text/calendar; charset=utf-8; method=${cancelled ? "CANCEL" : "PUBLISH"}`,
  };
  const [smtp, twilio] = await Promise.all([hasSmtpConfig(), hasTwilioConfig()]);
  const when = fmtWhen(b.start_at, b.timezone);
  const wasWhen = previous ? fmtWhen(previous.start_at, b.timezone) : null;
  const hostShort = planner.name.split(",")[0];
  const bookAgain = `${siteUrl()}/book/${type.slug}`;

  // Client — only the channels they opted into.
  if (b.notify_email && b.invitee_email) {
    await step("client_email", async () => {
      if (!smtp) return "skipped";
      const intro = cancelled
        ? `Hi ${firstName(b.invitee_name)}, your ${type.name} with ${hostShort} on ${when} has been cancelled${by === "staff" ? " by our office" : ""}.`
        : `Hi ${firstName(b.invitee_name)}, your ${type.name} with ${hostShort} has been moved${by === "staff" ? " by our office" : ""}. Here are the new details.`;
      const rows: [string, string][] = cancelled
        ? [["Was", `${when} (${tzLabel(b.timezone)})`], ["With", planner.name], ["Reference", b.reference], ["Reason", reason ?? ""]]
        : [["New time", `${when} (${tzLabel(b.timezone)})`], ["Was", wasWhen ?? ""], ["With", planner.name], ["Where", locationText(b, type.office)], ["Reference", b.reference]];
      const footer = cancelled
        ? `The attached file removes it from your calendar. Want to find another time? <a href="${esc(bookAgain)}" style="color:#1b2f6e">Book again</a> or call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.`
        : `The attached invite updates your calendar.${manageUrl ? ` Need another change? <a href="${esc(manageUrl)}" style="color:#1b2f6e">Manage your appointment</a>, or` : " Questions?"} call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.`;
      const res = await sendSmtpEmail({
        to: b.invitee_email!,
        subject: cancelled ? `Cancelled: ${type.name} — ${fmtShort(b.start_at, b.timezone)}` : `Rescheduled: ${type.name} with ${hostShort} — ${fmtShort(b.start_at, b.timezone)}`,
        html: emailShell({
          preheader: cancelled ? `Your appointment on ${when} is cancelled` : `New time: ${when}`,
          heading: cancelled ? "Appointment cancelled" : "Your new time",
          intro, rows,
          cta: cancelled ? { label: "Book another time", href: bookAgain } : manageUrl ? { label: "Manage your appointment", href: manageUrl } : null,
          footer,
        }),
        text: [intro, "", ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), "", cancelled ? `Book again: ${bookAgain}` : manageUrl ? `Manage: ${manageUrl}` : "", `Questions? ${CONTACT.phone}`].join("\n"),
        replyTo: planner.fallbackEmail ? undefined : planner.email ?? undefined,
        attachments: [icsAttachment],
      });
      return res.ok ? "sent" : "skipped";
    });
  } else sent.client_email = "not_requested";

  const clientPhone = b.invitee_phone ? toE164(b.invitee_phone) : "";
  if (b.notify_sms && clientPhone) {
    await step("client_sms", async () => {
      if (!twilio) return "skipped";
      const body = cancelled
        ? `Strategic Income Group: Your ${type.name} on ${fmtShort(b.start_at, b.timezone)} is cancelled. Ref ${b.reference}. Book again: ${bookAgain} or call ${CONTACT.phone}. Reply STOP to opt out.`
        : `Strategic Income Group: Your appointment with ${hostShort} is now ${fmtShort(b.start_at, b.timezone)} (${tzLabel(b.timezone)}). Ref ${b.reference}.${manageUrl ? ` Manage: ${manageUrl}` : ""} Reply STOP to opt out.`;
      let conversationId: string | undefined;
      try { conversationId = await getOrCreateConversation(clientPhone, b.invitee_name); } catch { conversationId = undefined; }
      await sendSms({ to: clientPhone, body, conversationId });
      return "sent";
    });
  } else sent.client_sms = "not_requested";

  // Planner — always (the office inbox when no planner email is on file).
  const who = by === "client" ? b.invitee_name : "SIG staff";
  await step("planner_email", async () => {
    if (!smtp) return "skipped";
    const rows: [string, string][] = cancelled
      ? [["Client", b.invitee_name], ["Meeting", type.name], ["Was", `${when} (${tzLabel(b.timezone)})`], ["Cancelled by", who], ["Reason", reason ?? ""], ["Email", b.invitee_email ?? ""], ["Phone", b.invitee_phone ?? ""], ["Reference", b.reference]]
      : [["Client", b.invitee_name], ["Meeting", type.name], ["New time", `${when} (${tzLabel(b.timezone)})`], ["Was", wasWhen ?? ""], ["Moved by", who], ["Email", b.invitee_email ?? ""], ["Phone", b.invitee_phone ?? ""], ["Reference", b.reference]];
    const intro = cancelled
      ? `${b.invitee_name}'s ${type.name} was cancelled${by === "client" ? " by the client" : " by SIG staff"}. The time is open again.`
      : `${b.invitee_name}'s ${type.name} was rescheduled${by === "client" ? " by the client" : " by SIG staff"}.`;
    const res = await sendSmtpEmail({
      to: planner.email!,
      subject: cancelled ? `Cancelled: ${b.invitee_name} — ${fmtShort(b.start_at, b.timezone)}` : `Rescheduled: ${b.invitee_name} → ${fmtShort(b.start_at, b.timezone)}`,
      html: emailShell({
        preheader: cancelled ? `${type.name} · ${when}` : `New time ${when}`,
        heading: cancelled ? "Appointment cancelled" : "Appointment rescheduled",
        intro: planner.fallbackEmail ? `${intro} (No planner email is on file for ${planner.name}, so this went to the office inbox.)` : intro,
        rows,
        cta: { label: "Open in dashboard", href: `${appUrl()}/dashboard/bookings` },
        footer: "Sent by the SIG booking system. The attached .ics updates your calendar.",
      }),
      text: [intro, "", ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join("\n"),
      replyTo: b.invitee_email || undefined,
      attachments: [icsAttachment],
    });
    return res.ok ? (planner.fallbackEmail ? "sent_office" : "sent") : "skipped";
  });
  const plannerPhone = planner.phone ? toE164(planner.phone) : "";
  await step("planner_sms", async () => {
    if (!plannerPhone) return "no_phone";
    if (!twilio) return "skipped";
    await sendSms({
      to: plannerPhone,
      body: cancelled
        ? `SIG booking: ${b.invitee_name}'s ${type.name} (${fmtShort(b.start_at, b.timezone)}) was cancelled. Ref ${b.reference}.`
        : `SIG booking: ${b.invitee_name}'s ${type.name} moved to ${fmtShort(b.start_at, b.timezone)}. Ref ${b.reference}.`,
    });
    return "sent";
  });

  // Dashboard notification + bell DM (planner and admins).
  await step("dashboard", async () => {
    const title = cancelled ? `Booking cancelled: ${b.invitee_name}` : `Booking rescheduled: ${b.invitee_name}`;
    const message = cancelled
      ? `${type.name} with ${planner.name} · was ${fmtShort(b.start_at, b.timezone)}${by === "client" ? " · cancelled by the client" : ""}`
      : `${type.name} with ${planner.name} · now ${fmtShort(b.start_at, b.timezone)}${previous ? ` (was ${fmtShort(previous.start_at, b.timezone)})` : ""}`;
    await createDashboardNotification({
      type: cancelled ? "booking_cancelled" : "booking_rescheduled",
      title, message, userId: planner.profileId,
      // A cancellation is an alert (Alerts feed); a reschedule stays a plain notification.
      ...(cancelled ? { severity: "warning" as const, category: "bookings" } : { category: "bookings" }),
      metadata: {
        booking_id: b.id, reference: b.reference, booking_type_id: type.id, start_at: b.start_at,
        previous_start_at: previous?.start_at ?? null, by, reason: reason ?? null, href: "/dashboard/bookings",
      },
    });
    const notifierId = await getNotifierId(sb);
    if (!notifierId) return "sent";
    const { data: admins } = await sb.from("profiles").select("id").in("role", [ROLES.SUPER_ADMIN, ROLES.ADMIN]).eq("status", "active").limit(20);
    const recipients = new Set<string>([...(planner.profileId ? [planner.profileId] : []), ...(admins ?? []).map((a) => a.id as string)]);
    for (const id of recipients) {
      try { await dmBadge(sb, notifierId, id, `${title}\n${message}\nRef ${b.reference}\nOpen: /dashboard/bookings`); } catch (e) { console.error("[booking-notify] DM badge failed", id, e instanceof Error ? e.message : e); }
    }
    return "sent";
  });

  const prior = (b.notifications_sent ?? {}) as Record<string, unknown>;
  await recordBookingNotifications(b.id, { ...prior, [kind]: { ...sent, by, at: new Date().toISOString() } });
  return sent;
}

// ── "Email me my appointments" link ─────────────────────────────────────────────

export async function sendAccessLinkEmail(to: string, url: string): Promise<void> {
  if (!(await hasSmtpConfig())) {
    console.info("[booking-notify] email not configured — access link not sent");
    return;
  }
  const intro = "Use the button below to see your upcoming and recent appointments with Strategic Income Group. From there you can reschedule, cancel or update your details.";
  await sendSmtpEmail({
    to,
    subject: "Your Strategic Income Group appointments",
    html: emailShell({
      preheader: "Your secure link (expires in 1 hour)",
      heading: "Manage your appointments",
      intro,
      rows: [],
      cta: { label: "View my appointments", href: url },
      footer: `This link works once and expires in 1 hour. If you didn't ask for it, you can ignore this email. Questions? Call <a href="${CONTACT.phoneHref}" style="color:#1b2f6e">${CONTACT.phone}</a>.`,
    }),
    text: `${intro}\n\n${url}\n\nThis link works once and expires in 1 hour. If you didn't ask for it, ignore this email.`,
  });
}
