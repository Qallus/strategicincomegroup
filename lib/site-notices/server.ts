// Site notices — server reads/writes with the service-role client.
// Tables come from supabase/migrations/202611190170_site_notices.sql. Every public
// read fails soft: no announcement bar, and the code default for the blog sidebar,
// if the tables don't exist yet or the query errors.
import { revalidateTag, unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ANNOUNCEMENT_TONES,
  BLOG_SIDEBAR_KEY,
  DEFAULT_BLOG_SIDEBAR_BLOCK,
  normalizeBlogSidebar,
  safeHref,
  sanitizeBlogSidebar,
  type AnnouncementTone,
  type BlogSidebarBlock,
  type BlogSidebarContent,
  type PublicAnnouncement,
  type SiteAnnouncement,
} from "./shared";

export const SITE_NOTICES_TAG = "site-notices";

const ANNOUNCEMENT_COLS = "id, message, link_label, link_url, tone, enabled, dismissible, priority, starts_at, ends_at, created_at, updated_at";

// ── Public reads (cached; saves call revalidateTag) ──────────────────────────

/**
 * Enabled announcements that haven't ended. The bar picks the live one on the
 * client too, so scheduled starts/ends take effect without a rebuild.
 */
export const getPublicAnnouncements = unstable_cache(
  async (): Promise<PublicAnnouncement[]> => {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("site_announcements")
        .select("id, message, link_label, link_url, tone, dismissible, priority, starts_at, ends_at, updated_at")
        .eq("enabled", true)
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order("priority", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as PublicAnnouncement[];
    } catch {
      return [];
    }
  },
  ["site-announcements-public-v1"],
  { revalidate: 300, tags: [SITE_NOTICES_TAG] },
);

export const getBlogSidebar = unstable_cache(
  async (): Promise<BlogSidebarBlock> => {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("site_blocks")
        .select("enabled, content, updated_at")
        .eq("key", BLOG_SIDEBAR_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_BLOG_SIDEBAR_BLOCK;
      return { enabled: Boolean(data.enabled), content: normalizeBlogSidebar(data.content), updated_at: data.updated_at ?? null };
    } catch {
      return DEFAULT_BLOG_SIDEBAR_BLOCK;
    }
  },
  ["site-blocks-blog-sidebar-v1"],
  { revalidate: 300, tags: [SITE_NOTICES_TAG] },
);

// ── Admin reads / writes (uncached) ──────────────────────────────────────────

export async function listAnnouncements(): Promise<SiteAnnouncement[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("site_announcements")
    .select(ANNOUNCEMENT_COLS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteAnnouncement[];
}

export async function getAnnouncement(id: string): Promise<SiteAnnouncement | null> {
  const { data, error } = await createSupabaseAdminClient().from("site_announcements").select(ANNOUNCEMENT_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SiteAnnouncement | null) ?? null;
}

export type AnnouncementInput = {
  id?: string | null;
  message?: string;
  link_label?: string | null;
  link_url?: string | null;
  tone?: string;
  enabled?: boolean;
  dismissible?: boolean;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actor = (id: string | null) => (id && UUID.test(id) ? id : null);

function isoOrNull(v: unknown, label: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new Error(`${label} isn't a valid date/time.`);
  return d.toISOString();
}

function sanitizeAnnouncement(input: AnnouncementInput, base: SiteAnnouncement | null) {
  const row: Record<string, unknown> = {};
  if (input.message !== undefined || !base) {
    const m = (input.message ?? "").replace(/\s+/g, " ").trim();
    if (!m) throw new Error("Write the announcement message.");
    if (m.length > 280) throw new Error("Keep the message under 280 characters.");
    row.message = m;
  }
  if (input.link_label !== undefined) row.link_label = (input.link_label ?? "").trim().slice(0, 40) || null;
  if (input.link_url !== undefined) {
    const raw = (input.link_url ?? "").trim();
    if (raw && !safeHref(raw)) throw new Error("Link must be a site path (/events) or an https:// URL.");
    row.link_url = raw || null;
  }
  if (input.tone !== undefined) {
    if (!ANNOUNCEMENT_TONES.includes(input.tone as AnnouncementTone)) throw new Error(`Tone must be one of ${ANNOUNCEMENT_TONES.join(", ")}.`);
    row.tone = input.tone;
  }
  if (input.enabled !== undefined) row.enabled = Boolean(input.enabled);
  if (input.dismissible !== undefined) row.dismissible = Boolean(input.dismissible);
  if (input.priority !== undefined) {
    const p = Math.round(Number(input.priority));
    if (!Number.isFinite(p) || p < -100 || p > 100) throw new Error("Priority must be between -100 and 100.");
    row.priority = p;
  }
  if (input.starts_at !== undefined) row.starts_at = isoOrNull(input.starts_at, "Start");
  if (input.ends_at !== undefined) row.ends_at = isoOrNull(input.ends_at, "End");
  const start = (row.starts_at !== undefined ? row.starts_at : base?.starts_at) as string | null | undefined;
  const end = (row.ends_at !== undefined ? row.ends_at : base?.ends_at) as string | null | undefined;
  if (start && end && Date.parse(end) <= Date.parse(start)) throw new Error("End must be after the start.");
  const label = (row.link_label !== undefined ? row.link_label : base?.link_label) as string | null | undefined;
  const url = (row.link_url !== undefined ? row.link_url : base?.link_url) as string | null | undefined;
  if (label && !url) throw new Error("Add a link URL for the link label (or clear the label).");
  return row;
}

/** Create (no id) or update an announcement. Returns before/after for auditing. */
export async function upsertAnnouncement(input: AnnouncementInput, actorId: string | null) {
  const sb = createSupabaseAdminClient();
  const id = input.id?.trim() || null;
  if (id && !UUID.test(id)) throw new Error("Unknown announcement id.");
  const before = id ? await getAnnouncement(id) : null;
  if (id && !before) throw new Error("That announcement no longer exists.");
  const row = sanitizeAnnouncement(input, before);
  const q = before
    ? sb.from("site_announcements").update({ ...row, updated_by: actor(actorId) }).eq("id", before.id)
    : sb.from("site_announcements").insert({ ...row, created_by: actor(actorId), updated_by: actor(actorId) });
  const { data, error } = await q.select(ANNOUNCEMENT_COLS).single();
  if (error) throw new Error(error.message);
  revalidateTag(SITE_NOTICES_TAG);
  return { before, after: data as SiteAnnouncement };
}

export async function deleteAnnouncement(id: string) {
  if (!UUID.test(id)) throw new Error("Unknown announcement id.");
  const before = await getAnnouncement(id);
  if (!before) throw new Error("That announcement no longer exists.");
  const { error } = await createSupabaseAdminClient().from("site_announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag(SITE_NOTICES_TAG);
  return before;
}

/** Uncached read for the dashboard: { block, exists } (exists=false → defaults shown, row not yet saved). */
export async function getBlogSidebarForAdmin(): Promise<{ block: BlogSidebarBlock; exists: boolean }> {
  const { data, error } = await createSupabaseAdminClient()
    .from("site_blocks")
    .select("enabled, content, updated_at")
    .eq("key", BLOG_SIDEBAR_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { block: DEFAULT_BLOG_SIDEBAR_BLOCK, exists: false };
  return { block: { enabled: Boolean(data.enabled), content: normalizeBlogSidebar(data.content), updated_at: data.updated_at ?? null }, exists: true };
}

export async function updateBlogSidebar(input: { enabled?: boolean; content?: Partial<BlogSidebarContent> }, actorId: string | null) {
  const { block: before } = await getBlogSidebarForAdmin();
  const content = sanitizeBlogSidebar(input.content ?? {}, before.content);
  const enabled = input.enabled === undefined ? before.enabled : Boolean(input.enabled);
  const { data, error } = await createSupabaseAdminClient()
    .from("site_blocks")
    .upsert({ key: BLOG_SIDEBAR_KEY, enabled, content, updated_by: actor(actorId) }, { onConflict: "key" })
    .select("enabled, content, updated_at")
    .single();
  if (error) throw new Error(error.message);
  revalidateTag(SITE_NOTICES_TAG);
  const after: BlogSidebarBlock = { enabled: Boolean(data.enabled), content: normalizeBlogSidebar(data.content), updated_at: data.updated_at ?? null };
  return { before, after };
}
