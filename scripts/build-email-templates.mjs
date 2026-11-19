#!/usr/bin/env node
// Builds the Supabase Auth email templates (Authentication → Emails → Templates) from one
// shared SIG layout. Output: supabase/email-templates/*.html + README.md (subjects + where to paste).
//
//   node scripts/build-email-templates.mjs
//
// Email clients ignore CSS variables and most <style>, so everything is inline, table-based,
// and mirrors the site's shadcn tokens as literal hex values.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "supabase", "email-templates");

const C = {
  page: "#f8f5ef", // brand cream (site background)
  card: "#ffffff",
  border: "#e7e1d6",
  navy: "#0d2568", // primary
  navyDeep: "#02144b",
  gold: "#c9a46e",
  goldText: "#8f6a29", // gold that passes AA on white (site .text-gold)
  ink: "#141c33", // foreground
  muted: "#5d6577", // muted-foreground
  codeBg: "#f3efe7", // muted
};
const SERIF = `'DM Serif Display', Georgia, 'Times New Roman', serif`;
const SANS = `Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
// Supabase templates use Go syntax ({{ .SiteURL }}); the app's own templates use {{site_url}}.
let SITE = "{{ .SiteURL }}";
// The logo uses a fixed absolute URL rather than {{ .SiteURL }}: Supabase's template preview
// doesn't substitute variables (so the image showed broken there), and a fixed URL keeps the
// logo working even if the Site URL changes. Update it at the apex-domain cutover.
const LOGO_URL = "https://app.strategicincomegroup.com/brand/sig-logo-white.png";
const logo = () => LOGO_URL;

const confirmUrl = (type, extra = "") => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}${extra}`;

function button(href, label) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr>
    <td bgcolor="${C.navy}" style="border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:6px;">${label} &rarr;</a>
    </td>
  </tr>
</table>`;
}

function code(token, label = "Your code") {
  return `
<p style="margin:24px 0 8px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">${label}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background:${C.codeBg};border:1px solid ${C.border};border-radius:8px;padding:14px 22px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.3em;color:${C.ink};">${token}</td>
  </tr>
</table>`;
}

function fallbackLink(href) {
  return `
<p style="margin:20px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">
  Button not working? Copy this link into your browser:<br />
  <a href="${href}" style="color:${C.navy};word-break:break-all;">${href}</a>
</p>`;
}

function layout({ title, preheader, eyebrow, heading, body }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td bgcolor="${C.navy}" style="background:${C.navy};border-radius:12px 12px 0 0;padding:26px 32px;">
              <img src="${logo()}" width="200" alt="Strategic Income Group" style="display:block;width:200px;max-width:100%;height:auto;border:0;" />
            </td>
          </tr>
          <tr><td height="3" bgcolor="${C.gold}" style="background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Card -->
          <tr>
            <td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-top:0;border-radius:0 0 12px 12px;padding:36px 32px 32px;">
              <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${C.goldText};">${eyebrow}</p>
              <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:30px;font-weight:400;line-height:1.15;color:${C.ink};">${heading}</h1>
              ${body}
              <hr style="border:0;border-top:1px solid ${C.border};margin:32px 0 20px;" />
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">
                If you didn’t request this email, you can safely ignore it. Questions? Call us at
                <a href="tel:+14804667070" style="color:${C.navy};text-decoration:none;">(480) 466-7070</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 8px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted};">
              <span style="font-family:${SERIF};font-size:14px;color:${C.ink};">Strategize. Invest. <em style="color:${C.goldText};">Give.</em></span><br />
              Strategic Income Group · 2330 W Ray Rd. #3, Chandler, AZ 85224<br />
              20542 N. Lake Pleasant Rd. #119, Peoria, AZ 85382<br />
              <a href="${SITE}" style="color:${C.muted};">app.strategicincomegroup.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const p = (html) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.ink};">${html}</p>`;
const note = (html) => `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">${html}</p>`;

// Names match Supabase → Authentication → Emails → Templates exactly.
const TEMPLATES = [
  {
    name: "Confirm sign up",
    file: "confirm-sign-up.html",
    subject: "Confirm your Strategic Income Group account",
    preheader: "One click to confirm your email and finish creating your account.",
    eyebrow: "Confirm your email",
    heading: "Welcome to Strategic Income Group",
    body: () => {
      const url = confirmUrl("email");
      return `${p("Thanks for creating an account. Please confirm that <strong>{{ .Email }}</strong> is your email address to finish setting it up.")}${button(url, "Confirm email address")}${note("This link can be used once and expires soon.")}${fallbackLink(url)}`;
    },
  },
  {
    name: "Invite user",
    file: "invite-user.html",
    subject: "You’re invited to Strategic Income Group",
    preheader: "Accept your invitation and choose a password.",
    eyebrow: "You’re invited",
    heading: "Join the Strategic Income Group workspace",
    body: () => {
      const url = confirmUrl("invite");
      return `${p("You’ve been invited to the Strategic Income Group workspace — clients, appointments, events, communications and projects, behind secure sign-in.")}${p("Accept the invitation to choose your password and sign in.")}${button(url, "Accept invitation")}${note("This invitation is for <strong>{{ .Email }}</strong> and can be used once.")}${fallbackLink(url)}`;
    },
  },
  {
    name: "Magic link or OTP",
    file: "magic-link-or-otp.html",
    subject: "Your Strategic Income Group sign-in link",
    preheader: "Sign in with one click, or use your one-time code.",
    eyebrow: "Secure sign-in",
    heading: "Sign in to Strategic Income Group",
    body: () => {
      const url = confirmUrl("email");
      return `${p("Use the button below to sign in as <strong>{{ .Email }}</strong>. No password needed.")}${button(url, "Sign in")}${code("{{ .Token }}", "Or enter this one-time code")}${note("The link and code can be used once and expire soon.")}${fallbackLink(url)}`;
    },
  },
  {
    name: "Change email address",
    file: "change-email-address.html",
    subject: "Confirm your new email address",
    preheader: "Confirm the change to your Strategic Income Group sign-in email.",
    eyebrow: "Email change",
    heading: "Confirm your new email address",
    body: () => {
      const url = confirmUrl("email_change");
      return `${p("We received a request to change the email on your Strategic Income Group account from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.")}${button(url, "Confirm email change")}${note("If you didn’t ask for this change, don’t click the button — your account stays as it is. Contact us if you think someone else has access.")}${fallbackLink(url)}`;
    },
  },
  {
    name: "Reset password",
    file: "reset-password.html",
    subject: "Reset your Strategic Income Group password",
    preheader: "Choose a new password for your account.",
    eyebrow: "Account recovery",
    heading: "Reset your password",
    body: () => {
      const url = "{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery";
      return `${p("We received a request to reset the password for <strong>{{ .Email }}</strong>. Choose a new one using the button below.")}${button(url, "Choose a new password")}${note("This link can be used once and expires soon. If you didn’t request a reset, your password hasn’t changed.")}${fallbackLink(url)}`;
    },
  },
  {
    name: "Reauthentication",
    file: "reauthentication.html",
    subject: "Your Strategic Income Group verification code",
    preheader: "Use this code to confirm it’s you.",
    eyebrow: "Verify it’s you",
    heading: "Confirm this action",
    body: () =>
      `${p("You’re about to make a sensitive change to your Strategic Income Group account. Enter this code to confirm it’s you.")}${code("{{ .Token }}", "Verification code")}${note("The code expires soon. If you didn’t start this, change your password and let us know.")}`,
  },
];

mkdirSync(OUT, { recursive: true });
const readme = [
  "# Supabase Auth email templates",
  "",
  "Generated by `node scripts/build-email-templates.mjs` — edit the script, not these files.",
  "",
  "Paste each into **Supabase → Authentication → Emails → Templates → (template)**: set the **Subject**, switch the body to **Source**, replace everything with the HTML file’s contents, **Save**.",
  "Custom SMTP must be set up first (Emails → SMTP Settings) or Supabase won’t let you edit templates.",
  "",
  "Links go to `{{ .SiteURL }}/auth/confirm` (or `/reset-password`), which verifies the token on the server — so they work on any device. Site URL must be `https://app.strategicincomegroup.com`.",
  "",
  "| Template | Subject | File |",
  "|---|---|---|",
];
for (const t of TEMPLATES) {
  writeFileSync(path.join(OUT, t.file), layout({ title: t.subject, preheader: t.preheader, eyebrow: t.eyebrow, heading: t.heading, body: t.body() }));
  readme.push(`| ${t.name} | ${t.subject} | \`${t.file}\` |`);
}
writeFileSync(path.join(OUT, "README.md"), readme.join("\n") + "\n");
console.log(`Wrote ${TEMPLATES.length} templates to ${path.relative(process.cwd(), OUT)}`);

// ── App-sent emails (lib/email/templates.ts renders {{merge_field}}) ────────────
// Dashboard → Team & Users invitations use the "user_invitation" event. The fork mapped it to
// MJG's "6-Week Challenge Invitation"; this SIG version replaces that mapping.
SITE = "{{site_url}}";
const invite = {
  subject: "You’re invited to the Strategic Income Group dashboard",
  html: layout({
    title: "You’re invited to the Strategic Income Group dashboard",
    preheader: "Accept your invitation and choose a password.",
    eyebrow: "You’re invited",
    heading: "Join the Strategic Income Group dashboard",
    body: `${p("You’ve been invited to the Strategic Income Group dashboard — clients, bookings and events, communications, content and projects, behind secure sign-in.")}${p("Accept the invitation to choose your password and sign in.")}${button("{{invite_url}}", "Accept invitation")}${note("This invitation is for <strong>{{email}}</strong>.")}${fallbackLink("{{invite_url}}")}`,
  }),
  text: "You’ve been invited to the Strategic Income Group dashboard.\n\nAccept your invitation and choose a password: {{invite_url}}\n\nQuestions? Call (480) 466-7070.",
};
const APP_OUT = path.join(OUT, "app");
mkdirSync(APP_OUT, { recursive: true });
writeFileSync(path.join(APP_OUT, "user-invitation.html"), invite.html);
const q = (s) => `$tpl$${s}$tpl$`;
writeFileSync(
  path.join(process.cwd(), "supabase", "migrations", "202611190140_sig_user_invitation_email.sql"),
  `-- Dashboard user invitations (Team & Users → Invite) send the "user_invitation" event.
-- The MJG fork mapped it to its "6-Week Challenge Invitation"; point it at a SIG template.
-- Generated by scripts/build-email-templates.mjs. The old template row is left in place, unused.

insert into public.email_templates (name, slug, subject, preheader, html_body, text_body, category, status, available_fields)
values (
  'SIG Dashboard Invitation',
  'sig-dashboard-invitation',
  ${q(invite.subject)},
  'Accept your invitation and choose a password.',
  ${q(invite.html)},
  ${q(invite.text)},
  'general',
  'active',
  array['invite_url', 'email', 'site_url']
)
on conflict (slug) do update
  set subject = excluded.subject, html_body = excluded.html_body, text_body = excluded.text_body,
      status = 'active', updated_at = now();

update public.email_template_mappings
   set template_id = (select id from public.email_templates where slug = 'sig-dashboard-invitation'),
       enabled = true,
       updated_at = now()
 where event_key = 'user_invitation';
`,
);
console.log("Wrote app/user-invitation.html and migration 202611190140_sig_user_invitation_email.sql");
