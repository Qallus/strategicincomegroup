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

## 7. Analytics (SIG Analytics, Phase 1)

1. Run `supabase/migrations/202611210190_analytics.sql` in **SQL Editor** (new tables, attribution columns and the rollup/report functions; safe to re-run).
2. Add to the app's environment variables:

```env
ANALYTICS_IP_SALT=<any long random string — keeps daily visitor hashes stable across restarts>
# Optional
NEXT_PUBLIC_ANALYTICS_DEBUG=   # set to 1 (build variable) only to test the tracker on localhost / the preview host
ANALYTICS_INTERNAL_ORIGIN=     # e.g. http://127.0.0.1:3000 if the crawler log should not loop through the proxy
```

3. **Scheduled tasks** (Coolify → the app → Scheduled Tasks; both run inside the app container and use `CRON_SECRET`):

| Name | Command | Frequency |
|---|---|---|
| `analytics-intraday` | `node scripts/analytics-cron.mjs intraday` | `*/15 * * * *` (rebuilds today's rollup) |
| `analytics-nightly` | `node scripts/analytics-cron.mjs nightly` | `0 9 * * *` (09:00 UTC = 02:00 Arizona: rebuilds yesterday + today, deletes raw analytics older than 13 months) |

4. Check: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://YOUR-SUBDOMAIN/api/admin/analytics/sync?mode=intraday` returns `{"ok":true,...}`, and **Dashboard → Analytics → Connections** shows the rollup as Live.

The tracker never runs on `localhost` or a `preview.` host (unless `NEXT_PUBLIC_ANALYTICS_DEBUG=1`), honours Do Not Track / Global Privacy Control, and skips browsers signed in to the dashboard.

## 8. Credentials (Dashboard → Credentials, Super Admin only)

One place to add, update and remove the API keys, tokens and service URLs the integrations use (CRM, email, Twilio, Microsoft 365, Google, social, AI models, agent harnesses and custom providers). Secret values are encrypted in the app with AES-256-GCM before they reach the database, and they are **write-only**: after saving, the page shows only the last four characters. Every add, update, removal and connection test is written to the activity log (provider and field names only, never values).

### Before first use

1. Generate a master key and add it to the app's environment variables in Coolify, then redeploy:

   ```bash
   openssl rand -base64 32
   ```

   ```env
   CREDENTIALS_MASTER_KEY=<the 44-character base64 string>
   ```

2. **Back the key up** (e.g. in the password manager). The database only holds ciphertext, so losing this key means re-entering every key saved on the page. Changing it without the rotation steps below makes every saved secret unreadable (the app then falls back to the Coolify values and the page shows "Can't decrypt").
3. Run `supabase/migrations/202611250210_credentials.sql` in **SQL Editor** (tables `credentials` and `credential_tests`, RLS on, service role only; safe to re-run).
4. If social accounts were set up before this release, open **Credentials → Social** and click **Encrypt saved social tokens**. It encrypts each account's tokens into the store and only then clears the old plain-text `social_accounts.credentials` column. Check afterwards that this returns no rows:

   ```sql
   select id, platform from public.social_accounts where credentials <> '{}'::jsonb;
   ```

### How values are chosen

For every field the app uses **the dashboard value first, then the Coolify variable** (the variable name is shown under each field on the page). So nothing changes until a value is saved on the page, and removing a saved value goes back to the Coolify variable. Saved values are cached for 60 seconds, and a save clears the cache, so a new key is live within a minute without a redeploy.

The status pill on each card shows **Connected** (dashboard values), **Using Coolify value**, **Incomplete** / **Not set**, or **Test failed** (the last *Test connection* failed after the last change).

### What must stay in Coolify

These are shown on the **Platform** tab as status only and can never be stored on the page, because the app needs them to reach the database at all, or changing them would break existing hashes and signatures:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (also signs dashboard action tokens), `DATABASE_URL`
- `CREDENTIALS_MASTER_KEY` itself
- `CRON_SECRET`, `ANALYTICS_IP_SALT`, `BOOKING_HASH_SALT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `MCP_*` (`MCP_PUBLIC_URL`, `MCP_RATE_PER_MIN`, `MCP_EXTRA_REDIRECT_URIS`, `MCP_EXTRA_REDIRECT_HOSTS`)
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` and other `NEXT_PUBLIC_*` build variables

### Rotating the master key (later)

Rows record the key version that encrypted them. To rotate: copy the current key into `CREDENTIALS_MASTER_KEY_V1`, put the new key in `CREDENTIALS_MASTER_KEY`, set `CREDENTIALS_KEY_VERSION=2`, redeploy, then re-save each secret on the page (each save re-encrypts with version 2). Remove `CREDENTIALS_MASTER_KEY_V1` once nothing uses version 1.

## 9. Communications (Dialer, SMS campaigns, call monitoring)

### Migration

Run `supabase/migrations/202611250230_communications.sql` in **SQL Editor** (new tables `communication_settings`, `sms_opt_outs`, `sms_campaigns`, `sms_campaign_recipients`, `call_monitor_sessions`, plus `calls.conference_name / conference_sid / agent_call_sid`; RLS on, service role only; safe to re-run). It also copies every number already opted out on a profile or participant into `sms_opt_outs`. Until it runs, the dialer and SMS keep working, settings stay at their defaults (auto-transcribe off, Conference mode off) and the Campaigns tab shows a "run the migration" notice.

### Twilio console URLs

Twilio signs every webhook. The app now **rejects unsigned or mis-signed requests** (403), checking the signature against `NEXT_PUBLIC_APP_URL` + path first, then the `x-forwarded-proto` / `x-forwarded-host` URL, then the raw request URL. The URL in the Twilio console must therefore match `NEXT_PUBLIC_APP_URL` exactly (same scheme and host, no trailing-slash differences).

| Where | Setting | URL (POST) |
|---|---|---|
| Phone number → Voice | A call comes in | `https://YOUR-HOST/api/webhooks/twilio/voice` |
| Phone number → Voice | Call status changes | `https://YOUR-HOST/api/webhooks/twilio/voice-status` |
| TwiML App (the softphone's `twiml_app_sid`) | Voice Request URL | `https://YOUR-HOST/api/webhooks/twilio/voice` |
| TwiML App | Status Callback URL | `https://YOUR-HOST/api/webhooks/twilio/voice-status` |
| Messaging Service → Integration | Send a webhook (incoming messages) | `https://YOUR-HOST/api/webhooks/twilio/sms` |
| Phone number → Messaging (only if the number is **not** in a Messaging Service) | A message comes in | `https://YOUR-HOST/api/webhooks/twilio/sms` |

Delivery status (`/api/webhooks/twilio/sms-status`), recordings (`/recording`), voicemail transcription (`/transcription`), the conference voicemail redirect (`/voicemail`) and conference events (`/conference-status`) are set per call / message by the app — nothing to configure.

**Debug bypass:** if calls or texts start failing with 403s after a deploy (wrong `NEXT_PUBLIC_APP_URL`, proxy rewriting the host), set `TWILIO_SKIP_SIGNATURE=1` in Coolify, redeploy, fix the URL, then **remove it**. While it is set every webhook logs `signature check SKIPPED` and the Dialer → Settings tab shows a warning. Rejections log the URLs that were tried.

### Messaging Service (bulk SMS)

Put the A2P 10DLC Messaging Service SID on **Dashboard → Credentials → Voice & SMS** (`messaging_service_sid`, or `TWILIO_MESSAGING_SERVICE_SID`). Single texts and campaigns send through it when set, otherwise from the bare number (US carriers reject unregistered traffic with error 30034). If **Advanced Opt-Out** is enabled on the service, Twilio answers STOP / START / HELP itself — the app still records the opt-out and does not reply twice. Otherwise the app replies with the standard texts (toggle in Dialer → Settings).

### Scheduled task

| Name | Command | Frequency |
|---|---|---|
| `sms-campaigns` | `node scripts/sms-campaign-cron.mjs` | `* * * * *` (every minute: starts scheduled campaigns that are due and keeps sending ones in progress, ~50 s per run) |

"Send now" also starts sending immediately without waiting for the task. Check: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://YOUR-HOST/api/admin/sms/campaigns/process` returns `{"ok":true,...}`.

### Dialer → Settings (Super Admin)

- **Auto-transcribe recordings** — transcribes each call recording / voicemail with OpenAI when Twilio delivers it (needs the OpenAI key on Credentials).
- **Conference mode** — OFF by default. When ON, every new call is placed in a per-call Twilio Conference so admins can **Listen** (muted), **Whisper** (only the agent hears) or **Barge** from Dialer → Live. Inbound callers hear hold music until the softphone answers (20 s), then get the same voicemail prompt as before. Turn it on only after testing on a test number; with it OFF the call flow is the original direct `<Dial>`.
- **Bulk send speed** (default 1 message / second) and **keyword replies**.

### Environment

```env
TWILIO_SKIP_SIGNATURE=   # leave unset; 1 = accept unsigned Twilio webhooks (temporary debugging only)
```
