// Site notices — the announcement bar above the main nav on every public page,
// and the Blog Sidebar Notification on every /resources/<slug> post. Same data
// and validation as Dashboard → Site Notices (lib/site-notices/server.ts).
// Admins / Super Admins only (`admin` area), matching the page's manage_settings gate.
import {
  deleteAnnouncement, getAnnouncement, getBlogSidebarForAdmin, listAnnouncements, updateBlogSidebar, upsertAnnouncement,
} from "@/lib/site-notices/server";
import { ANNOUNCEMENT_TONES, announcementStatus, formatAz, type BlogSidebarContent, type SiteAnnouncement } from "@/lib/site-notices/shared";
import { bool, int, need, obj, s, str, strEnum, type Json, type McpTool } from "./types";

function present(a: SiteAnnouncement) {
  return {
    id: a.id,
    status: announcementStatus(a),
    message: a.message,
    link_label: a.link_label,
    link_url: a.link_url,
    tone: a.tone,
    enabled: a.enabled,
    dismissible: a.dismissible,
    priority: a.priority,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    window_arizona: `${a.starts_at ? formatAz(a.starts_at) : "from when saved"} → ${a.ends_at ? formatAz(a.ends_at) : "no end"}`,
    updated_at: a.updated_at,
  };
}

const ANNOUNCEMENT_FIELDS = {
  message: str("The bar text (max 280 characters, one short sentence reads best on phones)"),
  link_label: str("Optional link text, e.g. 'See details' ('' clears)"),
  link_url: str("Optional link: a site path like /events or an https:// URL ('' clears)"),
  tone: strEnum(ANNOUNCEMENT_TONES, "navy = info (default), gold = highlight, alert = red for closures/urgent notices"),
  enabled: bool("On/off switch. It only shows while enabled AND inside its start/end window."),
  dismissible: bool("Whether visitors can close it (default true)"),
  priority: int("When several are live, the highest priority shows (-100..100, default 0)", -100, 100),
  starts_at: str("Start, ISO 8601 with offset, e.g. 2026-11-24T08:00:00-07:00 (Arizona is UTC-7 year-round). '' = start immediately."),
  ends_at: str("End, ISO 8601 with offset. '' = no end date."),
};

const SIDEBAR_FIELDS = {
  enabled: bool("Show the card on blog posts"),
  eyebrow: str("Small gold label above the title ('' hides it)"),
  title: str("Card title"),
  body: str("Plain text; separate paragraphs with a blank line. Educational/compliant — no performance promises."),
  phone: str("Phone shown in the card ('' hides it)"),
  email: str("Email shown in the card ('' hides it)"),
  hours: str("Office hours line ('' hides it)"),
  show_offices: bool("List the East Valley (Chandler) and West Valley (Peoria) offices"),
  cta_label: str("Optional text link label at the bottom ('' hides it)"),
  cta_url: str("Link for the text link: site path (/contact) or https:// URL"),
};
const SIDEBAR_CONTENT_KEYS = Object.keys(SIDEBAR_FIELDS).filter((k) => k !== "enabled") as (keyof BlogSidebarContent)[];

export function siteNoticeTools(): McpTool[] {
  return [
    {
      name: "sig_site_announcements_list",
      title: "List site announcements",
      description:
        "Every announcement-bar entry (the slim bar above the main menu on every public strategicincomegroup.com page) with its status " +
        "(live / scheduled / off / ended), message, link, tone, priority and start/end window. Pass `id` for one entry.",
      risk: "read",
      area: "admin",
      inputSchema: obj({ id: str("Return only this announcement"), status: strEnum(["live", "scheduled", "off", "ended"], "Only entries with this status") }),
      run: async (a) => {
        if (s(a.id)) {
          const row = await getAnnouncement(s(a.id));
          if (!row) throw new Error("No announcement with that id. Use sig_site_announcements_list.");
          return { result: present(row) };
        }
        let rows = (await listAnnouncements()).map(present);
        if (s(a.status)) rows = rows.filter((r) => r.status === s(a.status));
        return { result: { announcements: rows, live_now: rows.filter((r) => r.status === "live").length } };
      },
    },
    {
      name: "sig_site_announcement_upsert",
      title: "Create or update a site announcement",
      description:
        "Create (omit `id`) or edit (pass `id`) an announcement-bar entry. Only the fields you pass change on an edit; `message` is required " +
        "for a new one. Schedule with starts_at/ends_at (ISO with offset; Arizona = -07:00). Anything that would be live on the public site " +
        "right away asks for confirmation first. Show the person the wording before saving.",
      risk: "write",
      area: "admin",
      openWorld: true,
      inputSchema: obj({ id: str("Announcement id (uuid) to edit; omit to create"), ...ANNOUNCEMENT_FIELDS }),
      escalate: async (a) => {
        const before = s(a.id) ? await getAnnouncement(s(a.id)) : null;
        const merged = {
          enabled: a.enabled !== undefined ? a.enabled !== false : before?.enabled ?? true,
          starts_at: a.starts_at !== undefined ? s(a.starts_at) || null : before?.starts_at ?? null,
          ends_at: a.ends_at !== undefined ? s(a.ends_at) || null : before?.ends_at ?? null,
        };
        const willBeLive = announcementStatus(merged) === "live";
        const wasLive = before ? announcementStatus(before) === "live" : false;
        if (!willBeLive && !wasLive) return null;
        return {
          summary: before
            ? `${wasLive ? "Change the live" : "Turn on the"} announcement bar on every public page: "${s(a.message) || before.message}".`
            : `Publish an announcement bar on every public page now: "${need(a, "message")}".`,
          details: { id: before?.id ?? null, ...a },
          entity: "site_announcement",
          recordId: before?.id,
        };
      },
      run: async (a, c) => {
        const input: Json = {};
        for (const k of Object.keys(ANNOUNCEMENT_FIELDS)) if (a[k] !== undefined) input[k] = a[k];
        if (!s(a.id) && !s(a.message)) throw new Error("message is required for a new announcement.");
        const { before, after } = await upsertAnnouncement({ id: s(a.id) || null, ...input }, c.profile.id);
        return {
          result: { saved: true, created: !before, ...present(after) },
          summary: `${before ? "Updated" : "Created"} site announcement "${after.message.slice(0, 60)}" (${announcementStatus(after)})`,
          entity: "site_announcement",
          recordId: after.id,
          before: before ? present(before) : null,
          after: present(after),
        };
      },
    },
    {
      name: "sig_site_announcement_delete",
      title: "Delete a site announcement",
      description: "Permanently delete an announcement-bar entry. To just hide it, use sig_site_announcement_upsert with enabled=false instead.",
      risk: "high",
      area: "admin",
      openWorld: true,
      inputSchema: obj({ id: str("Announcement id (uuid)") }, ["id"]),
      preview: async (a) => {
        const row = await getAnnouncement(need(a, "id"));
        if (!row) throw new Error("No announcement with that id.");
        return { summary: `Delete the announcement "${row.message}" (${announcementStatus(row)}). This can't be undone.`, details: present(row), entity: "site_announcement", recordId: row.id };
      },
      execute: async (a) => {
        const before = await deleteAnnouncement(need(a, "id"));
        return { result: { deleted: true, id: before.id }, summary: `Deleted site announcement "${before.message.slice(0, 60)}"`, entity: "site_announcement", recordId: before.id, before: present(before), after: null };
      },
    },
    {
      name: "sig_blog_sidebar_get",
      title: "Read the blog sidebar notification",
      description:
        "The 'Blog Sidebar Notification' card shown under 'Talk to a planner' on every blog post: on/off, eyebrow, title, body, phone, email, hours, " +
        "whether the two offices are listed, and its link. `saved: false` means it still shows the built-in default.",
      risk: "read",
      area: "admin",
      inputSchema: obj({}),
      run: async () => {
        const { block, exists } = await getBlogSidebarForAdmin();
        return { result: { saved: exists, enabled: block.enabled, ...block.content, updated_at: block.updated_at } };
      },
    },
    {
      name: "sig_blog_sidebar_update",
      title: "Update the blog sidebar notification",
      description:
        "Edit the Blog Sidebar Notification card on every blog post. Only the fields you pass change. It's live immediately, so this asks for " +
        "confirmation first — show the person the wording. Keep it educational and compliant (no performance promises or guarantees).",
      risk: "write",
      area: "admin",
      openWorld: true,
      inputSchema: obj(SIDEBAR_FIELDS),
      escalate: async (a) => ({
        summary: "Update the notification card on every blog post (live immediately).",
        details: a,
        entity: "site_block",
        recordId: "blog_sidebar",
      }),
      run: async (a, c) => {
        const content: Partial<BlogSidebarContent> = {};
        for (const k of SIDEBAR_CONTENT_KEYS) if (a[k] !== undefined) (content as Json)[k] = a[k];
        if (!Object.keys(content).length && a.enabled === undefined) throw new Error("Pass at least one field to change. Use sig_blog_sidebar_get first.");
        const { before, after } = await updateBlogSidebar({ enabled: a.enabled === undefined ? undefined : a.enabled === true, content }, c.profile.id);
        return {
          result: { saved: true, enabled: after.enabled, ...after.content },
          summary: "Updated the blog sidebar notification",
          entity: "site_block",
          recordId: "blog_sidebar",
          before,
          after,
        };
      },
    },
  ];
}
