import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { viewerFromApiProfile } from "@/lib/dashboard/viewer";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Command palette search (dashboard toolbar). Features are filtered on the client from the
// nav; this returns records, each group permission-filtered:
//   contacts  → MANAGE_PARTICIPANTS        bookings → own (admins: all)        posts → REVIEW_CONTENT
// GET ?q=  (min 2 characters, 6 results per group)

export const dynamic = "force-dynamic";

export type SearchHit = { id: string; group: "contacts" | "bookings" | "posts"; title: string; subtitle: string | null; href: string };

const like = (q: string) => `%${q.replace(/[%_\\,()]/g, " ").trim()}%`;

export async function GET(request: Request) {
  try {
    const me = await requireActiveProfile(request);
    const viewer = await viewerFromApiProfile(me);
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ hits: [] });
    const sb = createSupabaseAdminClient();
    const pattern = like(q);
    const jobs: Promise<SearchHit[]>[] = [];

    if (viewer.permissions.includes(PERMISSIONS.MANAGE_PARTICIPANTS)) {
      jobs.push(
        (async () => {
          const { data } = await sb
            .from("contacts")
            .select("id, first_name, last_name, email, phone, type, company")
            .neq("status", "archived")
            .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company.ilike.${pattern}`)
            .limit(6);
          return ((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; type: string; company: string | null }[]).map((c) => ({
            id: c.id,
            group: "contacts" as const,
            title: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Contact",
            subtitle: [c.type === "lead" ? "Lead" : "Contact", c.company, c.email].filter(Boolean).join(" · "),
            href: `/dashboard/contacts?q=${encodeURIComponent(q)}`,
          }));
        })(),
      );
    }

    jobs.push(
      (async () => {
        let bq = sb
          .from("bookings")
          .select("id, invitee_name, invitee_email, start_at, status, reference")
          .or(`invitee_name.ilike.${pattern},invitee_email.ilike.${pattern},reference.ilike.${pattern}`)
          .order("start_at", { ascending: false })
          .limit(6);
        if (!viewer.isAdmin) bq = bq.eq("host_staff_id", viewer.id);
        const { data } = await bq;
        return ((data ?? []) as { id: string; invitee_name: string; invitee_email: string | null; start_at: string; status: string; reference: string }[]).map((b) => ({
          id: b.id,
          group: "bookings" as const,
          title: b.invitee_name,
          subtitle: `${new Date(b.start_at).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${b.status} · ${b.reference}`,
          href: "/dashboard/bookings",
        }));
      })(),
    );

    if (viewer.permissions.includes(PERMISSIONS.REVIEW_CONTENT)) {
      jobs.push(
        (async () => {
          const { data } = await sb.from("blog_posts").select("id, title, status, slug").ilike("title", pattern).order("updated_at", { ascending: false }).limit(6);
          return ((data ?? []) as { id: string; title: string; status: string; slug: string }[]).map((p) => ({
            id: p.id, group: "posts" as const, title: p.title, subtitle: `Blog post · ${p.status}`, href: `/dashboard/blog-posts/${p.id}`,
          }));
        })(),
      );
    }

    const hits = (await Promise.all(jobs.map((j) => j.catch(() => [] as SearchHit[])))).flat();
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: /authentication|profile required/i.test(message) ? 401 : 500 });
  }
}
