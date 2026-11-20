"use server";

import { getCurrentProfile } from "@/lib/auth/server";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";
import { deleteAnnouncement, upsertAnnouncement, updateBlogSidebar, type AnnouncementInput } from "@/lib/site-notices/server";
import type { BlogSidebarBlock, BlogSidebarContent, SiteAnnouncement } from "@/lib/site-notices/shared";

// Site Notices writes. Same gate as the page: Admin / Super Admin (manage_settings).

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function guard() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !can(profile.role, PERMISSIONS.MANAGE_SETTINGS)) {
    throw new Error("Admin settings permission required.");
  }
  return profile;
}

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "That didn't save." });

export async function saveAnnouncement(input: AnnouncementInput): Promise<Result<SiteAnnouncement>> {
  try {
    const me = await guard();
    const { after } = await upsertAnnouncement(input, me.id);
    return { ok: true, data: after };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAnnouncement(id: string): Promise<Result> {
  try {
    await guard();
    await deleteAnnouncement(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function saveBlogSidebar(input: { enabled: boolean; content: BlogSidebarContent }): Promise<Result<BlogSidebarBlock>> {
  try {
    const me = await guard();
    const { after } = await updateBlogSidebar(input, me.id);
    return { ok: true, data: after };
  } catch (e) {
    return fail(e);
  }
}
