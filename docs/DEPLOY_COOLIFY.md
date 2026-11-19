# Deploying the SIG app to Coolify (preview subdomain)

Replace **`YOUR-SUBDOMAIN`** everywhere below with the real host, e.g. `preview.strategicincomegroup.com`.
Supabase project: `sshdncfgoxnaxaaeluno`.

## 1. DNS

| Type | Name | Value |
|---|---|---|
| A | the subdomain label (e.g. `preview`) | the VPS public IP Coolify runs on |

Coolify issues the Let’s Encrypt certificate once DNS resolves.

## 2. Coolify application

- **Source:** GitHub `Qallus/strategicincomegroup`, branch `site-and-dashboard`
- **Build pack:** Dockerfile (repo root `Dockerfile`)
- **Port exposed:** `3000`
- **Domain:** `https://YOUR-SUBDOMAIN`
- **Environment variables:** mark every `NEXT_PUBLIC_*` variable as **"Build variable"** too, because Next.js inlines them at build time.

```env
NEXT_PUBLIC_SITE_URL=https://YOUR-SUBDOMAIN
NEXT_PUBLIC_APP_URL=https://YOUR-SUBDOMAIN
MCP_PUBLIC_URL=https://YOUR-SUBDOMAIN

NEXT_PUBLIC_SUPABASE_URL=https://sshdncfgoxnaxaaeluno.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<copy from .env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from .env.local, if set>
SUPABASE_SERVICE_ROLE_KEY=<copy from .env.local — secret>
DATABASE_URL=<copy from .env.local — secret>

# Email (password resets, notifications) — copy the values you use locally
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=Strategic Income Group
RESEND_REPLY_TO=
NOTIFICATION_FROM_EMAIL=

# Optional now, needed for those features
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:planning@strategicincomegroup.com
CRON_SECRET=<any long random string>

# Redtail (Phase 3) — leave sync off until verified locally
REDTAIL_API_BASE_URL=https://review.crm.redtailtechnology.com/api/public/v1
REDTAIL_API_KEY=
REDTAIL_USER_KEY=
REDTAIL_SYNC_ENABLED=false
```

Twilio, SMTP/IMAP variables: copy from `.env.local` only if you want SMS/voice/inbox on the preview.

## 3. Supabase → Authentication → URL Configuration

**Site URL**

```
https://YOUR-SUBDOMAIN
```

**Redirect URLs** (add each line):

```
https://YOUR-SUBDOMAIN/**
https://YOUR-SUBDOMAIN/auth/callback
https://YOUR-SUBDOMAIN/reset-password
https://YOUR-SUBDOMAIN/two-factor
http://localhost:3417/**
```

## 4. Supabase → Authentication → other settings

- **Sign In / Providers → Email:** enabled; "Confirm email" **on** (the Register page sends a confirmation link).
- **Multi-Factor:** TOTP **enabled** (the `/two-factor` page uses it).
- **Emails → SMTP Settings (recommended):** use your Resend SMTP credentials so Supabase’s confirmation emails come from SIG. Password-reset emails are already sent by the app through Resend.

## 5. Database migrations (SQL Editor, in this order)

Paste each file’s full contents into **SQL Editor → New query → Run**:

1. `supabase/migrations/202611190110_mcp_core.sql` — AI connector tables (new tables only).
2. `supabase/migrations/202611190120_sig_booking_events.sql` — SIG booking pages, availability and events
   (removes the 3 MJG seed booking types and the MJG sample webinar, which have no bookings).

Then from a terminal in the repo (imports the 39 WordPress articles into Blog Posts):

```bash
node scripts/import-wp-posts.mjs --dry-run
node scripts/import-wp-posts.mjs
```

Don’t use `npm run db:migrate` yet — its tracking table is empty, so it would try to re-run all 108 earlier migrations.

## 6. After deploy — quick checks

- `https://YOUR-SUBDOMAIN/` loads; toggle light/dark.
- Sign in at `/login`; open Dashboard → Bookings & Events, Form Submissions, Blog Posts.
- Submit the contact form once and see it in Form Submissions.
- `https://YOUR-SUBDOMAIN/.well-known/oauth-authorization-server` shows the HTTPS issuer (MCP connector).
