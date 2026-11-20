import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireEmployee } from "@/lib/team/api";
import { slugify } from "@/lib/team/fields";
import { getEmployeeProfileBySlug } from "@/lib/team/manage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Team page photo / gallery upload. Stores the image in the same public bucket
// as dashboard avatars (sig-media) and returns its URL; the editor then saves
// that URL onto the profile. Employees upload for themselves; admins may pass
// `slug` to upload for someone else. Images only (no SVG), 8 MB cap.
const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = "sig-media";
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  try {
    const me = await requireEmployee(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind") === "gallery" ? "gallery" : "photo";
    const slug = typeof form.get("slug") === "string" ? String(form.get("slug")).trim() : "";

    let folder = `me-${me.id}`;
    if (slug) {
      if (!me.admin) throw new HttpError("Only admins can upload photos for other team members.", 403);
      const target = await getEmployeeProfileBySlug(slug);
      if (!target) throw new HttpError("Team profile not found.", 404);
      folder = slugify(target.slug);
    }

    if (!(file instanceof File)) throw new HttpError("file is required.", 400);
    const ext = TYPES[file.type];
    if (!ext) throw new HttpError("Please choose a JPG, PNG, WebP, GIF or AVIF image.", 415);
    if (file.size > MAX_BYTES) throw new HttpError("Image exceeds 8 MB.", 413);

    const path = `team/${folder}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
