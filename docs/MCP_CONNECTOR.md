# SIG MCP Connector

Strategic Income Group runs a remote **MCP server** so AI apps — Claude, ChatGPT, Gemini CLI and Grok/xAI — can work with SIG data as the signed-in team member.

- **Server URL:** `https://<your SIG domain>/api/mcp` (Streamable HTTP, stateless, JSON responses)
- **Auth:** OAuth 2.1 (dynamic client registration + PKCE S256 + refresh tokens), or a personal API token (`Authorization: Bearer sig_pat_…`) for clients that can't do OAuth.
- **Dashboard:** Admin Settings → **AI Connectors** (`/dashboard/settings/ai-connectors`) shows the URL, setup guides, connected apps (disconnect), API tokens (create/revoke) and recent AI activity.

## How it works

| Piece | Where |
| --- | --- |
| MCP endpoint | `app/api/mcp/route.ts` → `lib/mcp/server.ts` |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp` |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` (and any `/…/api/mcp` suffix) |
| Dynamic client registration (RFC 7591) | `POST /api/oauth/register` |
| Consent page | `/oauth/authorize` (uses `AuthShell`); decision posts to `/api/oauth/authorize` |
| Token endpoint | `POST /api/oauth/token` (`authorization_code`, `refresh_token` — rotated on use) |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |
| Dashboard API | `/api/admin/ai-connectors` (+ `/tokens`, `/tokens/[id]`, `/clients/[clientId]`) |
| Database | `supabase/migrations/202611190110_mcp_core.sql` |

- An unauthenticated call to `/api/mcp` returns **401** with `WWW-Authenticate: Bearer … resource_metadata="…/.well-known/oauth-protected-resource"`, which is how MCP clients discover sign-in.
- Signing in uses the normal SIG login; signed-out people go to `/login?next=/oauth/authorize?…` and come straight back to the consent page.
- Only **active** dashboard profiles that are **not self-registered roles** (participant, facilitator) can grant access. Status and role are re-read from `profiles` on every MCP call, so suspending someone or changing their role takes effect immediately.
- Access tokens last 1 hour, refresh tokens 30 days (rotated on every use). Codes last 5 minutes and are single use. Only SHA-256 hashes of codes, tokens and client secrets are stored.
- Redirect URIs are limited to known AI-app hosts (claude.ai, claude.com, chatgpt.com, chat.openai.com, platform.openai.com, grok.com, x.ai, console.x.ai, gemini.google.com) and loopback `http://localhost|127.0.0.1` (Gemini CLI, MCP Inspector). Add more with `MCP_EXTRA_REDIRECT_HOSTS` (host names) or `MCP_EXTRA_REDIRECT_URIS` (exact URIs), comma-separated.

### Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `MCP_PUBLIC_URL` | Public origin advertised as issuer/resource (e.g. `https://my.strategicincomegroup.com`). Set this in production behind a proxy. Default: the request's own origin (honours `x-forwarded-host/proto`). |
| `MCP_EXTRA_REDIRECT_HOSTS` | Extra allowed OAuth redirect host names. |
| `MCP_EXTRA_REDIRECT_URIS` | Extra allowed exact redirect URIs. |
| `MCP_RATE_PER_MIN` | Tool calls per person per minute (default 120, in-memory). |

## Safety model

Every tool has a **risk level**:

- **read** — runs immediately.
- **write** — changes one record; runs immediately and the audit row keeps before/after.
- **high** — publishing, unpublishing, deleting, cancelling events, navigation/global/site-wide website changes. The first call **changes nothing**: it stores the arguments and a preview in `mcp_pending_actions` and returns `confirmation_id`. The AI must show the preview and call **`sig_confirm`** only after the person clearly agrees (or `sig_cancel`). The stored arguments run exactly once, for the same person and the same app/token, within 15 minutes; permissions are re-checked at confirm time.
- Some write tools **escalate** a particular call to the high path: editing a *published* blog post or event, or making a booking page public.

Other rules:

- **Role-based access** mirrors the dashboard's own API guards: contacts, form submissions, bookings and events → Super Admin, Admin, Team Member; blog → Super Admin, Admin, Content Reviewer; website pages (Frontend Editor) → Super Admin only. Tools outside your role are not listed and can't be called.
- **Deletes go to the trash** (`mcp_trash`) and can be restored with `sig_restore`: blog posts → status `deleted`; contacts → status `archived`; form submissions → `deleted_at`; bookings, booking pages (with availability, overrides and bookings), date overrides, events (with registrations) and registrations → snapshot then delete.
- **Audit log:** every call (including refusals and previews) is written to `mcp_audit_log` with who, which app/token, tool, risk, redacted args, a summary, success/error and before/after.
- **API tokens** carry their own tiers: read only, read + write, or full. A read-only token never sees write or high tools. Max 10 active per person; shown once at creation.
- Nothing in this connector sends email or SMS to clients.

## Setting up each client

### Claude (claude.ai, desktop, mobile)
1. Settings → **Connectors** → **Add custom connector** (Team/Enterprise: an owner adds it in Organization settings first).
2. Name: *Strategic Income Group*; URL: the server URL. Leave the advanced OAuth client ID/secret empty (Claude registers itself).
3. Click **Connect**, sign in to SIG, choose **Allow access**.
4. Enable the connector in a chat from the tools menu.

**Claude Code:** `claude mcp add --transport http sig https://<domain>/api/mcp`, then `/mcp` to authenticate.

### ChatGPT
1. Settings → **Apps & Connectors** → **Advanced settings** → enable **Developer mode** (Business/Enterprise/Edu: a workspace admin must allow custom connectors).
2. **Create** a connector: name *Strategic Income Group*, MCP server URL = the server URL, authentication **OAuth**.
3. ChatGPT registers itself and opens SIG's consent page; choose **Allow access**.
4. Use it from the **+ → Developer mode** menu in a chat. ChatGPT asks before running tools marked as non-read-only.

### Gemini CLI
Add to `~/.gemini/settings.json` (or `.gemini/settings.json` in a project):

```json
{
  "mcpServers": {
    "sig": {
      "httpUrl": "https://<domain>/api/mcp",
      "oauth": { "enabled": true }
    }
  }
}
```

Run `gemini`, then `/mcp auth sig` (a browser opens the SIG consent page). `/mcp list` shows the tools. On a headless machine use an API token instead:

```json
{ "mcpServers": { "sig": { "httpUrl": "https://<domain>/api/mcp", "headers": { "Authorization": "Bearer sig_pat_…" } } } }
```

### Grok / xAI
The xAI API's remote MCP tool sends a fixed authorization value, so create an **API token** in AI Connectors (choose the access level) and pass it:

```bash
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4",
    "input": "List next week'"'"'s SIG bookings",
    "tools": [{ "type": "mcp", "server_label": "sig", "server_url": "https://<domain>/api/mcp", "authorization": "sig_pat_…" }]
  }'
```

If a Grok app offers custom connectors with OAuth, use the server URL like Claude. Any other MCP client that can send a header can use `Authorization: Bearer sig_pat_…`.

### Testing locally
`npx @modelcontextprotocol/inspector` → Transport *Streamable HTTP*, URL `http://localhost:3417/api/mcp`, then *Open Auth Settings → Quick OAuth Flow* (loopback redirects are allowed), or paste an API token as a Bearer header.

## Tools

Areas: **meta** (everyone who can connect), **contacts**, **forms**, **bookings**, **events**, **blog**, **website** (Super Admin).

### Meta
| Tool | Risk | What it does |
| --- | --- | --- |
| `sig_whoami` | read | Your identity, role, areas, connection and allowed tiers |
| `sig_search_tools` | read | Find tools by keyword |
| `sig_confirm` | write | Run a previewed high-risk action (after the person agrees) |
| `sig_cancel` | read | Cancel a pending action |
| `sig_pending_actions` | read | Your actions awaiting confirmation |
| `sig_audit_recent` | read | Your recent AI activity (admins: `everyone=true`) |
| `sig_trash_list` | read | Records deleted through AI that you can restore |
| `sig_restore` | write | Restore a trashed record (and its children) |

### Contacts (`contacts`)
| Tool | Risk |
| --- | --- |
| `sig_contacts_search` | read |
| `sig_contact_get` | read |
| `sig_contact_create` (returns an existing match by email unless `allow_duplicate`) | write |
| `sig_contact_update` (custom_fields merged, `append_note`) | write |
| `sig_contact_delete` (archive) | high |

### Form submissions (`forms`)
| Tool | Risk |
| --- | --- |
| `sig_form_submissions_list` (filter by `form_type`: new_client, client_service, church_403b, career_interest, contact, newsletter; status; date) | read |
| `sig_form_submission_get` | read |
| `sig_form_submission_update` (status, notes / append_note, assigned_to, hide/show) | write |
| `sig_form_submission_delete` (soft delete) | high |

### Booking pages & bookings (`bookings`)
| Tool | Risk |
| --- | --- |
| `sig_booking_types_list` | read |
| `sig_booking_type_get` (with availability and upcoming overrides) | read |
| `sig_booking_type_create` (not public unless asked; making it public escalates) | write → high if public |
| `sig_booking_type_update` (making it public escalates) | write → high if going public |
| `sig_booking_type_delete` (with its availability, overrides and bookings; restorable) | high |
| `sig_booking_availability_set` (replace weekly windows) | write |
| `sig_booking_date_override_add` (block a date or special hours) | write |
| `sig_booking_date_override_delete` | high |
| `sig_booking_open_slots` | read |
| `sig_bookings_list` | read |
| `sig_booking_get` (id or reference, e.g. `SIG-4F9K2`) | read |
| `sig_booking_create` (staff-entered; no email) | write |
| `sig_booking_update` (status, notes, client details) | write |
| `sig_booking_cancel` | write |
| `sig_booking_reschedule` | write |
| `sig_booking_delete` | high |

New columns on `booking_types` (`host_slug`, `office`, `audience`, …) are accepted as optional fields and anything else via `extra`; they're written after the core save, and a missing column comes back as a warning instead of failing the call.

### Events & registrations (`events`)
| Tool | Risk |
| --- | --- |
| `sig_events_list` | read |
| `sig_event_get` | read |
| `sig_event_create` (always a draft) | write |
| `sig_event_update` (editing a published event escalates) | write → high if published |
| `sig_event_publish` | high |
| `sig_event_unpublish` | high |
| `sig_event_cancel` (no emails sent) | high |
| `sig_event_delete` (with registrations; restorable) | high |
| `sig_event_registrations_list` | read |
| `sig_event_registration_add` (waitlists when full) | write |
| `sig_event_registration_update` | write |
| `sig_event_check_in` (bulk attended / undo) | write |
| `sig_event_registration_delete` | high |

Optional event columns (`event_type`, `series`, `speakers`, `office`, `directions_url`, `audience`, `waitlist_enabled`, `allow_guests`, `max_party_size`, `arrival_note`, `meeting_id`) and `extra` pass through the same way.

### Blog (`blog`)
| Tool | Risk |
| --- | --- |
| `sig_blog_list` | read |
| `sig_blog_get` | read |
| `sig_blog_categories` | read |
| `sig_blog_create` (always a draft) | write |
| `sig_blog_update` (editing a published post escalates) | write → high if published |
| `sig_blog_publish` (now or at `publish_at`) | high |
| `sig_blog_unpublish` (→ hidden or draft) | high |
| `sig_blog_delete` (status deleted; restorable) | high |

### Job postings (`blog` area) — `lib/mcp/tools-careers.ts`
The roles on `/join-our-team` and their `/join-our-team/<slug>` detail pages — the same data as Dashboard → Content → Job Postings (`job_postings`; migration `202611190180_job_postings.sql`). Same access as Blog (Super Admin, Admin, Content Reviewer). A listing is on the site only while `status` is `published` (or `scheduled`) and now is inside `publish_at` / `close_at`.

| Tool | Risk |
| --- | --- |
| `sig_job_postings_list` — every listing with `live_now`; filter by `status`, `department`, `search`, `live_only`; `full` adds detail content | read |
| `sig_job_posting_upsert` — create (no `job`; defaults to draft) or edit (`job` = id or slug; only passed fields change): `title`, `slug`, `department`, `employment_type` (full_time / part_time / internship / contract), `type_label`, `badge_text`, `hiring_status` (open / waitlist), `location`, `compensation`, `summary`, `intro`, `sections` (`[{heading, paragraphs?, items?}]`), `apply_instructions`, `status`, `publish_at`, `close_at` (ISO; Arizona is `-07:00`), `sort_order`, `featured` | write → high when the result is (or was) live on the site |
| `sig_job_posting_delete` (trashed; restorable with `sig_restore`) — to just hide a listing set `status: "closed"` instead | high |

### Team pages (employee profiles) — `lib/mcp/tools-team.ts`
The public `strategicincomegroup.com/team/<slug>` pages, stored in `employee_profiles` and edited in Dashboard → My Profile. Every SIG employee (any staff role) can read and edit **their own** page; Super Admins / Admins can list and edit anyone's.

| Tool | Who | Risk |
| --- | --- | --- |
| `sig_my_profile_get` — your page, every field, plus what's still empty | any staff | read |
| `sig_my_profile_update` — change any of your fields; creates the page (hidden) if you don't have one | any staff | write → high when turning `is_published` on/off |
| `sig_team_profiles_list` — every page with completeness; pass `slug` for one page in full | admins (`admin` area) | read |
| `sig_team_profile_update` — edit anyone's page, plus `new_slug`, `team_group`, `sort_order`, `booking_href`, `account_email` | admins (`admin` area) | write → high when changing `is_published` or the slug |

Fields: `first_name`, `last_name`, `full_name`, `job_title`, `credentials`, `office` (East/West Valley Office), `employment_date` (YYYY-MM-DD), `experience` (paragraphs separated by a blank line), `inspires`, `hobbies`, `best_purchase` (under $100), `favorite_destination`, `why_love_job`, `favorite_quote`, `phone`, `email`, `linkedin_url`, `work_days` (`mon`…`sun`, replaces the list), `start_time` / `close_time` (24h HH:MM), `photo_url`, `gallery_urls` (replaces the list), `is_published`. Nothing is required; `''` clears a field. Uploading new image files happens in the dashboard (the tools take URLs).

Example prompts: *"Draft my 'Why I love my job' from these notes, then save it"*, *"Set my schedule to Mon–Thu 8 to 4:30"*, *"Which team pages are missing a photo?"* (admin). The assistant should show a draft and save only after the person approves it. Saves refresh `/team` and the person's page immediately.

### Site notices (`admin`) — `lib/mcp/tools-site-notices.ts`
The announcement bar above the main menu on every public page and the Blog Sidebar Notification card on every `/resources/<slug>` post — the same data as Dashboard → Content → Site Notices (`site_announcements`, `site_blocks`; migration `202611190170_site_notices.sql`). Admins / Super Admins only.

| Tool | Risk |
| --- | --- |
| `sig_site_announcements_list` — every entry with status (live / scheduled / off / ended); `id` for one, `status` to filter | read |
| `sig_site_announcement_upsert` — create (no `id`) or edit: `message`, `link_label`, `link_url`, `tone` (navy / gold / alert), `enabled`, `dismissible`, `priority`, `starts_at`, `ends_at` (ISO with offset; Arizona is `-07:00`) | write → high when the result is (or was) live on the site |
| `sig_site_announcement_delete` | high |
| `sig_blog_sidebar_get` | read |
| `sig_blog_sidebar_update` — `enabled`, `eyebrow`, `title`, `body` (blank line between paragraphs), `phone`, `email`, `hours`, `show_offices`, `cta_label`, `cta_url` | write → always asks for confirmation (live immediately) |

The bar shows only while enabled and inside its window; when several are live the highest `priority` (then the most recent start) wins. Visitors can dismiss it per announcement; editing it shows it again.

### Website pages (`website`, Super Admin) — wraps `lib/website/shepherd-tools.ts`
| Tool | Risk |
| --- | --- |
| `sig_website_list_pages`, `sig_website_get_page`, `sig_website_list_components`, `sig_website_search`, `sig_website_get_navigation`, `sig_website_get_globals`, `sig_website_list_versions`, `sig_website_link_report`, `sig_website_history`, `sig_website_list_change_sets` | read |
| `sig_website_create_page`, `sig_website_propose_change`, `sig_website_edit_section`, `sig_website_update_page_settings`, `sig_website_create_preview_link`, `sig_website_request_component` | write (drafts only) |
| `sig_website_publish_page`, `sig_website_page_lifecycle`, `sig_website_update_navigation`, `sig_website_update_global`, `sig_website_site_wide_replace` | high |

Website changes are recorded in the Frontend Editor's own audit trail too (as `actor_type = 'shepherd'`, the AI actor type that layer already uses), with the person's profile id.

## Operations

- Apply `supabase/migrations/202611190110_mcp_core.sql` before using the connector (until then the dashboard page shows a load error and every token is rejected).
- To cut off one app for one person: AI Connectors → Disconnect. To cut off a token: Revoke. To cut off a person entirely: suspend their profile — every token stops on the next call.
- Old rows in `mcp_oauth_codes` (expired) and `mcp_pending_actions` can be pruned periodically; nothing depends on them after expiry.
