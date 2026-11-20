import { EmailTabs } from "@/components/emails/email-tabs";
import { SectionHeader } from "@/components/dashboard/section-header";
import { FormInbox, type Submission } from "@/components/forms/form-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Emails → Form Submissions renders the same inbox as /dashboard/form-submissions
// (one inbox, one set of actions and saved view preferences), inside the Emails tab bar.
export default async function EmailFormSubmissionsPage() {
  const supabase = createSupabaseAdminClient();
  const [{ data, error }, { data: staff }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("id, form_type, email, phone, source, status, subject, message, payload, assigned_to, hidden_at, removed_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Emails" description="Review public form submissions and reply from the email workflow." />
      <EmailTabs active="form-submissions" />
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p> : null}
      <FormInbox
        submissions={(data ?? []) as Submission[]}
        staff={(staff ?? []).map((s) => ({ id: String(s.id), name: String(s.full_name ?? "Team member") }))}
      />
    </div>
  );
}
