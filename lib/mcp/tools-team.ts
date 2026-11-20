// Employee team profiles — the public strategicincomegroup.com/team/<slug>
// pages. Any SIG employee can read and edit THEIR OWN page (the same as
// Dashboard → My Profile); Super Admins / Admins can list and edit anyone's.
// Reuses lib/team/manage.ts, which validates every field and refreshes the
// public pages after a save.
import {
  completeness, displayName, formatTime, formatWorkDays, sanitizePatch, splitParagraphs, type EmployeeProfile,
} from "@/lib/team/fields";
import {
  createEmployeeProfileForUser, getEmployeeProfileBySlug, getEmployeeProfileForUser, isStaffRole, isTeamAdmin,
  listEmployeeProfiles, syncAccountFromEmployee, updateEmployeeProfile,
} from "@/lib/team/manage";
import type { McpCaller } from "./auth";
import { bool, int, need, obj, s, str, strArr, strEnum, type Json, type McpTool } from "./types";

const SITE = "https://strategicincomegroup.com";

const PROFILE_FIELDS = {
  first_name: str("First name"),
  last_name: str("Last name"),
  full_name: str("Name exactly as shown on the website, if different from first + last (e.g. Martha “MO” Cortez). Empty string clears it."),
  job_title: str("Job title, e.g. 'Client Service Associate'"),
  credentials: str("Professional designations, comma-separated, e.g. 'CFP®, CTFA®'"),
  office: strEnum(["East Valley Office", "West Valley Office", ""], "Office shown on the page ('' for none)"),
  employment_date: str("Date they joined SIG, YYYY-MM-DD"),
  experience: str("Professional experience / history. Plain text, several paragraphs separated by a blank line (\\n\\n). Third person reads best on the site (e.g. 'Laurie joined SIG in 2019…'), but match what the person already uses."),
  inspires: str("Answer to 'Who inspires you?' (1–3 sentences, first person)"),
  hobbies: str("Favorite hobbies (1–3 sentences)"),
  best_purchase: str("Best purchase under $100 — what and why (1–2 sentences)"),
  favorite_destination: str("Favorite destination (1–3 sentences)"),
  why_love_job: str("'Why I love my job' (2–4 sentences, first person, warm and specific — shown as 'Why I love what I do')"),
  favorite_quote: str("Favorite quote, with attribution, e.g. “…” – Maya Angelou"),
  phone: str("Public phone number (blank = main SIG line is shown). Also updates their dashboard account phone when editing your own profile."),
  email: str("Public email address (blank = planning@strategicincomegroup.com is shown)"),
  linkedin_url: str("LinkedIn profile URL (linkedin.com/in/…)"),
  work_days: strArr("Work days as short keys: mon, tue, wed, thu, fri, sat, sun. Pass the full list (it replaces the old one); [] clears."),
  start_time: str("Start time, 24-hour HH:MM (e.g. 08:00). '' clears."),
  close_time: str("Close time, 24-hour HH:MM (e.g. 17:00). '' clears."),
  photo_url: str("Profile photo URL (https://… or a site path like /team/name.webp). Uploading a new file is done in Dashboard → My Profile."),
  gallery_urls: strArr("Gallery photo URLs in display order. Pass the full list (it replaces the old one)."),
  is_published: bool("Show the page on the public website (Our Team + /team/<slug>)"),
};

const ADMIN_ONLY_FIELDS = {
  new_slug: str("Change the public URL slug (/team/<new_slug>), lowercase-hyphenated. Old links stop working."),
  team_group: strEnum(["leadership", "planner", "admin"], "Which section of Our Team they appear in (planners also show in the 'Book with a planner' grids)"),
  sort_order: int("Order on the Team page (lower first)", -100000, 100000),
  booking_href: str("Booking link for planners, e.g. /book?planner=<slug>. '' clears."),
  account_email: str("Dashboard account email this page links to automatically when that person signs in"),
};

const EDITABLE = Object.keys(PROFILE_FIELDS);
const ADMIN_EDITABLE = [...EDITABLE, ...Object.keys(ADMIN_ONLY_FIELDS)];

function pickArgs(a: Json, keys: string[]) {
  const out: Json = {};
  for (const k of keys) if (a[k] !== undefined) out[k] = a[k];
  return out;
}

/** The page as an AI assistant should see it: every field, plus what's still empty. */
function present(p: EmployeeProfile) {
  const meter = completeness(p);
  return {
    id: p.id,
    slug: p.slug,
    name: displayName(p),
    public_url: `${SITE}/team/${p.slug}`,
    is_published: p.is_published,
    linked_to_dashboard_user: Boolean(p.profile_id),
    team_group: p.team_group,
    sort_order: p.sort_order,
    booking_href: p.booking_href,
    first_name: p.first_name,
    last_name: p.last_name,
    full_name: p.full_name,
    job_title: p.job_title,
    credentials: p.credentials,
    office: p.office,
    employment_date: p.employment_date,
    photo_url: p.photo_url,
    gallery_urls: p.gallery_urls,
    experience: p.experience,
    experience_paragraphs: splitParagraphs(p.experience).length,
    inspires: p.inspires,
    hobbies: p.hobbies,
    best_purchase: p.best_purchase,
    favorite_destination: p.favorite_destination,
    why_love_job: p.why_love_job,
    favorite_quote: p.favorite_quote,
    phone: p.phone,
    email: p.email,
    linkedin_url: p.linkedin_url,
    work_days: p.work_days,
    start_time: p.start_time?.slice(0, 5) ?? null,
    close_time: p.close_time?.slice(0, 5) ?? null,
    schedule_display: [formatWorkDays(p.work_days), p.start_time && p.close_time ? `${formatTime(p.start_time)} – ${formatTime(p.close_time)}` : ""].filter(Boolean).join(" · ") || null,
    completeness: { percent: meter.percent, missing: meter.missing },
    updated_at: p.updated_at,
  };
}

const callerUser = (c: McpCaller) => {
  const [firstName, ...rest] = c.profile.name.split(" ");
  return { id: c.profile.id, email: c.profile.email, firstName: c.profile.name.includes("@") ? "" : firstName, lastName: c.profile.name.includes("@") ? "" : rest.join(" ") };
};

async function findBySlug(ref: string) {
  const slug = ref.trim().toLowerCase().replace(/^https?:\/\/[^/]+/, "").replace(/^\/?(team\/)?/, "").replace(/\/$/, "");
  const row = await getEmployeeProfileBySlug(slug);
  if (!row) throw new Error(`No team profile with slug "${slug}". Use sig_team_profiles_list.`);
  return row;
}

const staffOnly = (c: McpCaller) => isStaffRole(c.profile.role);

export function teamTools(): McpTool[] {
  return [
    {
      name: "sig_my_profile_get",
      title: "Read my team page",
      description:
        "Your own public team page on strategicincomegroup.com (/team/<slug>) as stored in Dashboard → My Profile: name, title, credentials, office, " +
        "professional history, who inspires you, hobbies, best purchase under $100, favorite destination, why you love your job, favorite quote, " +
        "contact details, LinkedIn, work schedule, photo and gallery — plus which fields are still empty. Call this before drafting or editing so you " +
        "can match the person's existing voice and see what's missing.",
      risk: "read",
      available: staffOnly,
      inputSchema: obj({}),
      run: async (_a, c) => {
        const row = await getEmployeeProfileForUser(c.profile);
        if (!row) {
          return {
            result: {
              exists: false,
              message: "You don't have a team page yet. sig_my_profile_update will create one (hidden from the website until is_published is true).",
              fields: Object.keys(PROFILE_FIELDS),
            },
          };
        }
        return { result: { exists: true, ...present(row) } };
      },
    },
    {
      name: "sig_my_profile_update",
      title: "Update my team page",
      description:
        "Save changes to YOUR OWN public team page (the same fields as Dashboard → My Profile). Only the fields you pass change; nothing is required. " +
        "Typical use: the person gives rough notes ('I love helping retirees sleep at night, 15 years at Schwab, two kids, Maui') and asks you to draft a " +
        "section — write it in their voice, SHOW them the draft, and call this only once they're happy with it. Lists (work_days, gallery_urls) replace " +
        "the whole list. Text is plain (no Markdown); separate paragraphs of `experience` with a blank line. Turning is_published on or off asks for confirmation first. " +
        "Creates the page if they don't have one yet (hidden until is_published is true). Slug, team section and sort order can only be changed by an admin.",
      risk: "write",
      openWorld: true,
      available: staffOnly,
      inputSchema: obj(PROFILE_FIELDS),
      escalate: async (a, c) => {
        if (a.is_published === undefined) return null;
        const row = await getEmployeeProfileForUser(c.profile);
        const next = a.is_published === true;
        if (row && row.is_published === next) return null;
        return {
          summary: next
            ? `Publish your team page — it will appear on strategicincomegroup.com/team${row ? ` at /team/${row.slug}` : ""}.`
            : `Hide your team page from the public website${row ? ` (/team/${row.slug})` : ""}.`,
          details: { fields: Object.keys(pickArgs(a, EDITABLE)) },
          entity: "employee_profile",
          recordId: row?.id,
        };
      },
      run: async (a, c) => {
        const raw = pickArgs(a, EDITABLE);
        if (!Object.keys(raw).length) throw new Error("Pass at least one field to change. Use sig_my_profile_get to see the current values.");
        const admin = isTeamAdmin(c.profile.role);
        const existing = await getEmployeeProfileForUser(c.profile);
        let before: EmployeeProfile | null = existing;
        let after: EmployeeProfile;
        let changed: string[];
        if (!existing) {
          after = await createEmployeeProfileForUser(callerUser(c), sanitizePatch(raw, { admin }));
          changed = Object.keys(raw);
          before = null;
        } else {
          ({ after, changed } = await updateEmployeeProfile(existing.id, raw, { admin, updatedBy: c.profile.id }));
        }
        if (["first_name", "last_name", "full_name", "phone"].some((k) => k in raw)) await syncAccountFromEmployee(c.profile.id, after);
        return {
          result: { saved: true, created: !existing, changed, ...present(after) },
          summary: existing ? `Updated own team page (${changed.join(", ") || "no changes"})` : `Created own team page /team/${after.slug}`,
          entity: "employee_profile",
          recordId: after.id,
          before: before ? present(before) : null,
          after: present(after),
        };
      },
    },
    {
      name: "sig_team_profiles_list",
      title: "List team pages",
      description:
        "Every employee team page (published and hidden) with slug, name, title, section, whether it's linked to a dashboard user, and how complete it is. " +
        "Admins only. Pass `slug` to get that one page in full (every field). Use the slug with sig_team_profile_update.",
      risk: "read",
      area: "admin",
      inputSchema: obj({
        slug: str("Return this one page in full instead of the list"),
        include_hidden: bool("Include pages hidden from the website (default true)"),
        search: str("Words in the name or title"),
      }),
      run: async (a) => {
        if (s(a.slug)) return { result: present(await findBySlug(s(a.slug))) };
        let rows = await listEmployeeProfiles();
        if (a.include_hidden === false) rows = rows.filter((r) => r.is_published);
        const term = s(a.search).toLowerCase();
        if (term) rows = rows.filter((r) => `${displayName(r)} ${r.job_title ?? ""} ${r.slug}`.toLowerCase().includes(term));
        return {
          result: {
            profiles: rows.map((r) => ({
              slug: r.slug,
              name: displayName(r),
              job_title: r.job_title,
              credentials: r.credentials,
              team_group: r.team_group,
              office: r.office,
              is_published: r.is_published,
              sort_order: r.sort_order,
              linked_to_dashboard_user: Boolean(r.profile_id),
              completeness: completeness(r).percent,
              public_url: `${SITE}/team/${r.slug}`,
            })),
          },
        };
      },
    },
    {
      name: "sig_team_profile_update",
      title: "Update a team member's page",
      description:
        "Admins: edit any employee's public team page by slug — every field employees can edit themselves, plus slug, team_group, sort_order, " +
        "booking_href and account_email (new_slug renames the page). Only the fields you pass change. Read the page first with " +
        "sig_team_profiles_list({slug}) so drafts match the person's voice. Changing is_published or the slug affects the live site and asks for confirmation first.",
      risk: "write",
      area: "admin",
      openWorld: true,
      inputSchema: obj({ slug: str("The team page's slug (e.g. laurie-simons) or its /team/ URL"), ...PROFILE_FIELDS, ...ADMIN_ONLY_FIELDS }, ["slug"]),
      escalate: async (a) => {
        const row = await findBySlug(need(a, "slug"));
        const publishChange = a.is_published !== undefined && (a.is_published === true) !== row.is_published;
        const slugChange = typeof a.new_slug === "string" && a.new_slug.trim() && a.new_slug.trim() !== row.slug;
        if (!publishChange && !slugChange) return null;
        const parts: string[] = [];
        if (publishChange) parts.push(a.is_published === true ? "publish it on the website" : "hide it from the website");
        if (slugChange) parts.push(`move it from /team/${row.slug} to /team/${s(a.new_slug)} (old links stop working)`);
        return {
          summary: `${displayName(row)}'s team page: ${parts.join(" and ")}.`,
          details: { slug: row.slug, public_url: `${SITE}/team/${row.slug}`, fields: Object.keys(pickArgs(a, ADMIN_EDITABLE)) },
          entity: "employee_profile",
          recordId: row.id,
        };
      },
      run: async (a, c) => {
        const row = await findBySlug(need(a, "slug"));
        const raw = pickArgs(a, ADMIN_EDITABLE.filter((k) => k !== "new_slug"));
        if (typeof a.new_slug === "string" && a.new_slug.trim()) raw.slug = a.new_slug.trim();
        if (!Object.keys(raw).length) throw new Error("Pass at least one field to change.");
        const { before, after, changed } = await updateEmployeeProfile(row.id, raw, { admin: true, updatedBy: c.profile.id });
        return {
          result: { saved: true, changed, ...present(after) },
          summary: `Updated team page /team/${after.slug} (${changed.join(", ") || "no changes"})`,
          entity: "employee_profile",
          recordId: after.id,
          before: present(before),
          after: present(after),
        };
      },
    },
  ];
}
