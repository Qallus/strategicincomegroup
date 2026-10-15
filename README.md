# Strategic Income Group — Web App

Next.js 15 + shadcn/ui + Supabase. One app for the public website (strategicincomegroup.com)
and the staff dashboard, replacing the WordPress site. Deployed on the Coolify-managed VPS.

Forked from the MJG web app for its dashboard layout, UI components and modules.

## Run locally

```bash
cp .env.example .env.local   # fill in Supabase keys at minimum
npm install
npm run db:migrate           # applies supabase/migrations (needs DATABASE_URL)
npm run dev
```

## Brand

- Colors live as tokens in `app/globals.css` and as `brand-*` Tailwind colors
  (`bg-brand-navy`, `text-brand-gold`, `bg-brand-navy-deep`, `text-brand-sky`, …).
- Fonts: DM Serif Display (`font-serif`, headings) and Inter (body).
- Logos: `public/brand/` (SVG for the web, PNG for email).

## Build phases

1. Foundation — fork, cleanup, rebrand (1a); per-user permissions and Settings toggles (1b)
2. Public website rebuild
3. Core dashboard: CRM, notes, media, blog, team, projects
4. Planner booking and calendar
5. Communications: email campaigns, Twilio SMS and calls, social
6. Redtail API sync
7. ERP, HR, SEO
8. AI agents: OpenRouter, Hermes, Paperclip
9. Coolify deployment and WordPress migration

## Deploy (Coolify)

Build pack: **Dockerfile**. Set the `NEXT_PUBLIC_*` variables as build-time variables.
