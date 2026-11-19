# SIG Build Plan — Website, Web App & Dashboard

Owner tags: **[You]** = you / SIG stakeholders · **[Claude]** = me in code · **[Both]** = needs a decision, then build.
Check items off as we go. This supersedes the phase list in `README.md` (reordered: dashboard first).

## Context

- The repo is a fork of the MJG (michaeljgauthier.com) app: Next.js 15 + React 19, Supabase (auth/DB/storage, RLS), Tailwind/shadcn, Resend/SMTP/IMAP, Twilio SMS+voice, OpenAI, web push, Coolify/Docker.
- Step 1a is partly done. App chrome, brand kit (`lib/brand/assets.ts`, `public/brand/sig-*`) and the package name are SIG. The **107 migrations and much of the business logic are still MJG's** (ministry programmes, steward commerce, church/facilitator roles, the "Shepherd" agent).
- Decisions so far: **staff dashboard + client portal**, **migrate the existing WordPress site**, **dashboard first**, **compliance regime unknown** (treated as a parallel track that blocks comms and launch).

## Phase order at a glance

| # | Phase | Blocks |
|---|-------|--------|
| 0 | Inputs, access & decisions | everything |
| 1 | Foundation: finish cleanup, permissions, CI, staging | 2+ |
| 2 | Core dashboard (CRM, households, tasks, notes, docs, home KPIs) | 3, 6 |
| 3 | Redtail sync | 6 |
| 4 | Booking & calendar | 6, 7 |
| 5 | Communications + compliance controls | 7 launch |
| 6 | Client portal (`my.strategicincomegroup.com`) | — |
| 7 | Public website rebuild + WordPress migration + SEO | launch |
| 8 | AI agents (OpenRouter / Hermes / Paperclip) | — |
| 9 | ERP / HR (scope TBD) | — |
| 10 | Production launch & WordPress retirement | — |
| C | **Compliance track (runs alongside 1–7)** | 5, 6, 7 go-live |

---

## Phase 0 — Inputs, access & decisions  **[You]**

Access and accounts:
- [ ] Supabase: confirm the SIG project is the target and whether any migrations are already applied (decides squash vs. incremental, see 1.2). Provide the service-role key and `DATABASE_URL` locally only.
- [ ] Coolify VPS access, plus a plan for the staging and prod app URLs.
- [ ] DNS control for `strategicincomegroup.com` (apex, `my.`, `blueprint.`, staging subdomain).
- [ ] Redtail: API key, user key and environment (sandbox, if available) and the list of objects SIG actually uses (contacts, notes, activities, accounts, workflows).
- [ ] Twilio: SIG account (not MJG's), a phone number, and **A2P 10DLC brand + campaign registration**. Financial services gets extra vetting, so start early.
- [ ] Resend: verify a sending domain (SPF/DKIM/DMARC) and the from/reply-to addresses. Mailbox host for SMTP/IMAP.
- [ ] WordPress admin login (or a WXR export, a media zip and the plugin list) for the current site.
- [ ] Google Workspace or Microsoft 365 (whichever SIG uses) for calendar sync and SSO.
- [ ] OpenRouter and Anthropic keys (Phase 8; not needed yet).

Business decisions:
- [ ] **Compliance status:** RIA (SEC or state), broker-dealer affiliated, or insurance-only? Who is the CCO? (See Track C.)
- [ ] Staff roster: names, roles and who needs which modules. This seeds Phase 1b permissions.
- [ ] Is Redtail the **system of record** for clients, with the SIG dashboard as a working layer? (Recommended. It drives Phase 3's sync direction.)
- [ ] What clients should see in the portal: documents, meetings, secure messages, plan summaries? Account balances? (Balances mean a custodian or aggregator feed, which is a big scope jump.)
- [ ] Brand: confirm the existing SIG brand kit (navy/gold/silver, DM Serif + Inter) is final, and supply logos/photography.
- [ ] Content keep/drop: "Three Phases of Wealth", "Inner Circle" and `/team/michael-gauthier`. Keep or rename?
- [ ] AI assistant name, replacing "Shepherd".
- [ ] `.env.example` currently contains the real Supabase URL and publishable key. Commit as-is or blank them? (Recommend blanking.)
- [ ] ERP/HR (Phase 9): what does it actually mean for SIG? Payroll, PTO and onboarding docs, commissions/revenue tracking?

## Phase 1 — Foundation

### 1.1 Finish the MJG cleanup (Step 1a)  **[Claude]**
- [ ] Remove the ministry/programme modules from code: participants, waves, check-ins, surveys, inner circle, impact scores, pilot forms, facilitators, experiences, challenge videos, media books, book waitlist, steward commerce. Remove their routes, API handlers, components and nav entries.
- [ ] RBAC (`lib/rbac/roles.ts`, `lib/rbac/permissions.ts`): replace facilitator, pastor_elder_reviewer and participant with SIG roles: `super_admin`, `admin`, `advisor`, `associate_planner`, `client_service`, `marketing`, `compliance_reviewer` and `client` (portal). Drop `MANAGE_SURVEYS`/`MANAGE_EXPERIENCES`.
- [ ] Contacts: remove the "Church" field from `contact-form-fields.tsx`, `contacts-manager.tsx`, import/export and `lib/ai-agent/tools.ts`. Replace the "Wave 0"/"Church Interest" segments in `components/tags-segments/tags-segments-dashboard.tsx`.
- [ ] Email/SMS constants and templates: strip the 6WC, faith-journey, pastor/elder and inner-circle categories (`lib/email/constants.ts`, `components/email-templates/*`, `lib/sms/constants.ts`).
- [ ] AI agent: rename it and rewrite the system prompt in `lib/ai-agent/agent.ts` and `lib/ai-agent/skills.ts` (no stewardship-pilot copy).
- [ ] Fix the runtime breaks. `lib/public-site/static-pages.ts` reads a missing `main/` folder and `lib/public-site/legal.ts` reads a missing `docs/legal/`. Remove the MJG static loader and FluentCRM rewrites, and move legal docs to the DB (`legal_documents`).
- [ ] Delete `app/api/debug/auth` and the legacy duplicate routes `dashboard/email-inbox` and `dashboard/email-templates`.
- [ ] Clean `tsconfig.json` references to the absent `docs/`, `_archive/` and `steward/`. Update `supabase/verify_migrations.sql` (`mjg-media` → `sig-media`) and reconcile the `media-assets` bucket references.
- [ ] Dedupe the env var names. Add the missing names (`RESEND_WEBHOOK_SECRET`, `TWILIO_*` extras, `OPENROUTER_API_KEY`, …) to `.env.example` with no values.

### 1.2 Database baseline  **[Both]**
- [ ] If the SIG DB is empty (recommended path): squash the 107 MJG migrations into one **SIG baseline migration** containing only the kept tables. Archive the old files and reset `_sig_migrations`.
- [ ] If migrations are already applied, write a forward migration instead that drops the MJG-only tables (list in "Tables to drop" below).
- [ ] Remove the ~30 MJG seed migrations (6-week challenge, Core5, Keystone Rhythms, MJG email templates).
- [ ] Run Supabase advisors (security and performance). Confirm RLS is on for every table and that the policies reference the new roles.
- [ ] Generate TypeScript types from the new schema.

### 1.3 Per-user permissions (Step 1b)  **[Claude]**
- [ ] Add a `user_module_permissions` table (user × module × view/edit/admin) with RLS, and seed it from role defaults.
- [ ] Add a Settings → Users & Access UI with Super Admin visibility toggles per module.
- [ ] Drive `components/layout/dashboard-nav.ts` and the route guards from the effective permissions, replacing the static `permission` checks.
- [ ] Use the same check in API routes through one shared helper in `lib/rbac/`.

### 1.4 Engineering hygiene and staging  **[Claude]** (DNS/Coolify **[You]**)
- [ ] Add an ESLint config so `npm run lint` works, and keep `typecheck` green.
- [ ] Add Vitest for lib/RBAC unit tests and Playwright smoke tests (login, dashboard loads, a public page renders).
- [ ] Add GitHub Actions: typecheck, lint, test and build on each PR.
- [ ] Deploy a staging environment on Coolify from the `Dockerfile`, with a staging Supabase (or a branch), the invitations cron and the env vars.
- [ ] Add error monitoring (Sentry or similar) and uptime checks.

**Exit criteria:** zero MJG references outside archived migrations, a clean build/lint/typecheck, staging live, and staff able to log in with the correct module access.

## Phase 2 — Core dashboard  **[Claude]**, data model sign-off **[You]**

- [ ] **Households and relationships:** a `households` table, contact↔household links with roles (primary, spouse, dependent, beneficiary, CPA/attorney) and assigned advisor/planner.
- [ ] **Client lifecycle:** status (lead → prospect → client → former) and a pipeline board with stages SIG defines (e.g. intro → discovery → plan presented → onboarding → active). Track source and referral attribution.
- [ ] **Contact 360 page:** profile, household, timeline (notes, emails, SMS, calls, meetings), tasks, documents and Redtail link-out.
- [ ] **Tasks and workflows:** reuse the project-manager/plans modules for onboarding and annual-review checklists, with templates per workflow.
- [ ] **Notes:** structured meeting notes per contact and household (reuse the Plate editor and `dashboard_notes`).
- [ ] **Documents:** a private storage bucket per household, signed URLs, an access audit log and retention metadata.
- [ ] **Team directory:** staff profiles that feed the public team pages later.
- [ ] **Dashboard home:** KPIs (new leads, pipeline by stage, meetings this week, overdue tasks, upcoming reviews), built with the dataviz guidelines.
- [ ] Keep and rebrand the existing modules: media studio, blog posts, CMS, workspace, DMs, business cards, reports.

## Phase 3 — Redtail sync  **[Claude]**, credentials and mapping sign-off **[You]**

- [ ] Write a Redtail API client (`lib/redtail/`) with auth, rate limiting and retries.
- [ ] Add a field-mapping table and sync-state columns (`redtail_id`, `last_synced_at`, hash).
- [ ] **v1, one-way pull** (Redtail → SIG): contacts, households/families, notes and activities, on a nightly cron plus an on-demand "sync now".
- [ ] **v2, selective push** (SIG → Redtail): new leads, notes and activities logged in SIG. Conflict rule: Redtail wins on client master data.
- [ ] Add a sync log UI with error queue and retry in Settings → Integrations.
- [ ] Before the first import, plan de-duplication against existing contacts using `contacts_merge` logic.

## Phase 4 — Booking & calendar  **[Claude]**

- [ ] Adapt `booking_types`, availability and overrides for advisor/planner meeting types (intro call, review, planning session).
- [ ] Add two-way calendar sync with Google or M365 (free/busy plus event creation) and generate Zoom/Teams links.
- [ ] Send reminders by email and SMS (only with consent) and include reschedule/cancel links.
- [ ] Use round-robin or assigned-advisor routing. Public booking pages at `/book/[slug]` create or match a contact.
- [ ] Keep events/seminars (`/events`) for workshops, with registration feeding the CRM.

## Phase 5 — Communications + compliance controls  **[Claude]**, policies **[You/CCO]**

- [ ] **Email:** campaigns, templates and automations rebranded for SIG. Unsubscribe handling, the Resend webhook (bounces/complaints) and a CAN-SPAM footer.
- [ ] **SMS:** move Twilio to SIG's account once A2P 10DLC is approved. Keep consent capture/opt-out (`consent_events`, `/sms/*`) and broadcasts with quiet hours.
- [ ] **Calls:** dialer, recording consent prompt (multi-state; assume two-party consent), transcription and call logs on the contact timeline.
- [ ] **Social:** finish the stubbed Facebook/LinkedIn publishing (`lib/social-media/publish.ts`), with a **compliance pre-approval step** before anything publishes.
- [ ] **Archiving:** store and export every outbound and inbound email, SMS and social post immutably. Integrate with Smarsh or Global Relay if the regime requires it (decided in Track C).
- [ ] Add a review queue for the `compliance_reviewer` role covering marketing emails, social posts and website changes (extend `website_change_sets` approval).

## Phase 6 — Client portal  **[Claude]**, scope sign-off **[You]**

- [ ] Serve the portal on `my.strategicincomegroup.com` as a separate layout and route group with a `client` role, and an invite-only onboarding flow (reuse `user_invitations`).
- [ ] **Security:** require MFA, use short session timeouts, restrict RLS to the client's own household, audit-log every document view and download, and get a third-party pen test before launch.
- [ ] **Features (v1):** a secure document vault (upload and download), upcoming and past meetings plus booking, secure messaging with the advisor team, a profile with contact preferences, and tasks/forms ("upload your statements", intake questionnaire).
- [ ] **v2 options:** e-signature (DocuSign), a plan summary page, and an account aggregation/custodian feed (only if decided in Phase 0).
- [ ] Mobile-friendly PWA (web push is already wired).

## Phase 7 — Public website + WordPress migration  **[Both]**

- [ ] **[You]** Provide WordPress access/export. Sign off the sitemap and which pages get rewritten versus migrated as-is.
- [ ] **[Claude]** Inventory every WordPress URL (pages, posts, categories, media) into a spreadsheet: URL, title, keep/rewrite/drop, new URL.
- [ ] **[Claude]** Write an import script: WordPress XML/REST → `blog_posts`, `website_pages` and `media_assets` (with media re-hosting and alt text).
- [ ] **[Claude]** Add 301 redirects for every changed URL into `website_redirects`, and run a broken-link report.
- [ ] **[Claude]** Build new templates for the home page (replacing the `app/page.tsx` placeholder), services, about/team, process, resources/blog, events, contact and booking CTA.
- [ ] **[You]** Provide copy, headshots and testimonials (testimonials require marketing-rule disclosures).
- [ ] **[Claude]** SEO: metadata, sitemap.xml, robots, schema.org (FinancialService, Person), Open Graph, Core Web Vitals and analytics (GA4 or Plausible).
- [ ] **[Claude]** Forms feed CRM contacts and `form_submissions` with spam protection (Turnstile).
- [ ] **[Claude]** Make the site WCAG 2.1 AA accessible.
- [ ] **[Both]** Legal and disclosures: privacy policy, terms, a site-wide footer disclosure, and links to Form ADV/CRS or BrokerCheck as the regime requires.

## Phase 8 — AI agents  **[Claude]**

- [ ] Move from raw OpenAI fetch to OpenRouter (model routing), and wire up Hermes and Paperclip as specified.
- [ ] Staff-only assistant: CRM lookup, meeting-note summarisation, draft emails (drafts only, a human sends), task creation.
- [ ] Guardrails: no client-facing investment advice, everything logged, and outputs that would be marketing go through compliance review.

## Phase 9 — ERP / HR  **[Both]** (define scope first)

- [ ] Write a short spec once Phase 0 defines it (likely staff onboarding checklists, PTO calendar, revenue/commission tracking, vendor list).

## Phase 10 — Production launch  **[Both]**

- [ ] Prod Supabase: PITR backups, a restore drill and advisors clean.
- [ ] Prod Coolify deploy, prod env vars, cron jobs and monitoring alerts.
- [ ] Run the pre-launch checklist: compliance sign-off, pen test (portal), accessibility audit, redirect verification and form tests.
- [ ] DNS cutover from WordPress. Keep WordPress read-only for 30 days, then retire it.
- [ ] Staff training plus a short runbook (user management, publishing, sync errors).

## Track C — Compliance (parallel)  **[You/CCO]** with **[Claude]** implementing

- [ ] Determine the regime (RIA / BD / insurance) and the responsible CCO.
- [ ] Set the books-and-records retention period, and decide whether to use an archiving vendor.
- [ ] Marketing rule: testimonial/endorsement and performance-claim rules for the site and social.
- [ ] Set the pre-approval policy for website, email campaigns and social, which configures the Phase 5 review queue.
- [ ] Set data security policy (Reg S-P / state privacy): encryption, access reviews and incident response, which shapes Phase 6.
- [ ] Get SMS/calls consent language approved.
- [ ] Get the required website disclosures text.

---

## Reference: MJG tables to drop

participants, participant_tags, participant_user_links, waves, check_in_results/answers/submissions, survey_responses/answers, inner_circle_responses, email_journey_events, impact_scores, pilot_forms, facilitator_teams/members/challenge_access, experience_types/steps, experiences, experience_attendees/send_events/steps/previews, challenge_videos, media_books, media_book_pages, book_waitlist_requests, steward_* (8).

## Next 5 actions

1. **[You]** Phase 0: compliance regime, Supabase status (empty or not), staff roster, Redtail credentials.
2. **[Claude]** 1.1 cleanup in code (no DB changes needed yet).
3. **[Both]** 1.2: choose baseline squash vs. forward migration, then I write it.
4. **[Claude]** 1.4 lint/CI/tests, then a staging deploy once you've set up Coolify and DNS.
5. **[Claude]** 1.3 per-user permissions.
