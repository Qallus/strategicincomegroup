import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SigOverview = {
  contacts: number;
  leads: number;
  upcomingBookings: number;
  bookingsThisMonth: number;
  smsConversations: number;
  callsThisMonth: number;
  emailsThisMonth: number;
  publishedPosts: number;
  error: string | null;
};

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// Head-only counts for the staff overview and Reports. Each count is isolated so one
// missing table or failed query shows 0 instead of taking the page down.
export async function getSigOverview(): Promise<SigOverview> {
  const sb = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const since = monthStart();
  const errors: string[] = [];

  async function count(label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
    try {
      const { count: n, error } = await query;
      if (error) errors.push(`${label}: ${error.message}`);
      return n ?? 0;
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : "failed"}`);
      return 0;
    }
  }

  const head = { count: "exact" as const, head: true };
  const [contacts, leads, upcomingBookings, bookingsThisMonth, smsConversations, callsThisMonth, emailsThisMonth, publishedPosts] =
    await Promise.all([
      count("contacts", sb.from("contacts").select("id", head).eq("type", "contact").neq("status", "archived")),
      count("leads", sb.from("contacts").select("id", head).eq("type", "lead").neq("status", "archived")),
      count("upcoming bookings", sb.from("bookings").select("id", head).gte("start_at", now).in("status", ["confirmed", "pending"])),
      count("bookings this month", sb.from("bookings").select("id", head).gte("start_at", since)),
      count("sms", sb.from("sms_conversations").select("id", head)),
      count("calls", sb.from("calls").select("id", head).gte("created_at", since)),
      count("emails", sb.from("email_send_logs").select("id", head).gte("created_at", since)),
      count("posts", sb.from("blog_posts").select("id", head).eq("status", "published")),
    ]);

  return {
    contacts,
    leads,
    upcomingBookings,
    bookingsThisMonth,
    smsConversations,
    callsThisMonth,
    emailsThisMonth,
    publishedPosts,
    error: errors.length ? errors.join("; ") : null,
  };
}
