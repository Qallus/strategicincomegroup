import nodemailer from "nodemailer";
import { getCredential, getProviderConfig } from "@/lib/credentials/server";

export type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

export type SmtpResult = {
  ok: boolean;
  skipped: boolean;
  messageId?: string;
  reason?: string;
};

// Config comes from SIG Credentials (Dashboard → Credentials): the dashboard value first,
// then the Coolify env var (RESEND_*, SMTP_*, NOTIFICATION_FROM_EMAIL) as before.
async function resendConfig() {
  return getProviderConfig("resend");
}

type SmtpConfig = Record<string, string | undefined> & { fromEmail?: string };

async function smtpConfig(): Promise<SmtpConfig> {
  const [smtp, notifications] = await Promise.all([getProviderConfig("smtp"), getProviderConfig("notifications")]);
  return { ...smtp, fromEmail: notifications.from_email };
}

function hasSmtpCredentials(cfg: Record<string, string | undefined>) {
  return Boolean(cfg.host && cfg.port && cfg.user && cfg.password);
}

export async function hasSmtpConfig() {
  const [resend, smtp] = await Promise.all([resendConfig(), smtpConfig()]);
  return Boolean(resend.api_key) || hasSmtpCredentials(smtp);
}

async function sendViaResend(input: SendEmailInput, cfg: Record<string, string | undefined>): Promise<SmtpResult> {
  const apiKey = cfg.api_key!;

  // All outbound mail goes out as planning@strategicincomegroup.com. This used to fall back
  // to NOTIFICATION_FROM_EMAIL and then a hardcoded my.strategicincomegroup.com address,
  // which meant a missing or misspelled RESEND_FROM_EMAIL didn't fail — it silently
  // sent under a different identity, from a domain that isn't even verified in
  // Resend. A misconfigured sender is worse than a bounced send, so refuse instead.
  // Trimmed and emptiness-checked because ?? alone treats "" as a real value.
  const fromEmail = (cfg.from_email ?? "").trim();
  if (!fromEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Refusing to send under a fallback identity — set it to planning@strategicincomegroup.com.",
    );
  }
  // Give the sender a display name so inboxes show "SIG" instead of the bare local
  // part ("hello"). If RESEND_FROM_EMAIL already carries a name ("SIG <hello@…>"),
  // respect it; otherwise wrap the address with RESEND_FROM_NAME (default "SIG").
  const fromName = (cfg.from_name ?? "SIG").trim();
  const from = fromEmail.includes("<") || !fromName ? fromEmail : `${fromName} <${fromEmail}>`;

  const replyTo = input.replyTo?.trim() || cfg.reply_to?.trim() || from;

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    reply_to: replyTo,
  };
  if (input.text) body.text = input.text;
  if (input.cc) body.cc = Array.isArray(input.cc) ? input.cc : [input.cc];
  if (input.bcc) body.bcc = Array.isArray(input.bcc) ? input.bcc : [input.bcc];
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Resend API error: ${err.message ?? response.statusText}`);
  }

  const data = (await response.json()) as { id: string };
  return { ok: true, skipped: false, messageId: data.id };
}

export async function sendSmtpEmail(input: SendEmailInput): Promise<SmtpResult> {
  const resend = await resendConfig();
  if (resend.api_key) {
    return sendViaResend(input, resend);
  }

  const smtp = await smtpConfig();
  if (!hasSmtpCredentials(smtp)) {
    return {
      ok: false,
      skipped: true,
      reason: "No email provider configured. Add a Resend API key or SMTP credentials (Dashboard → Credentials → Email) to enable sending.",
      messageId: undefined,
    };
  }

  const port = Number(smtp.port ?? 465);
  const user = smtp.user;
  const pass = smtp.password;
  const secure =
    smtp.secure !== "false" &&
    (smtp.secure === "true" || process.env.SMTP_ENCRYPTION === "ssl" || port === 465);

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port,
    secure,
    auth: { user, pass },
  });

  const from = smtp.fromEmail || user;

  const info = await transporter.sendMail({
    from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo || from,
    attachments: input.attachments,
  });

  return { ok: true, skipped: false, messageId: info.messageId };
}

/**
 * Owner inbox that is always emailed when a page or dashboard edit request is filed.
 * Credentials → Email → Notification addresses, then EDIT_REQUEST_NOTIFY_EMAIL, then the
 * site owner's address.
 */
export async function editRequestNotifyEmail(): Promise<string> {
  return ((await getCredential("notifications", "edit_request_email")) || "jwaters@qallus.co").trim().toLowerCase();
}
