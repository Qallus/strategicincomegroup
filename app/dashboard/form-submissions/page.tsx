import { SectionHeader } from "@/components/dashboard/section-header";
import { FormInbox, type Submission } from "@/components/forms/form-inbox";
import { requireStaffPage } from "@/lib/rbac/guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Form Submissions — SIG Dashboard" };

export default async function FormSubmissionsPage() {
  await requireStaffPage("/dashboard/form-submissions");
  const supabase = createSupabaseAdminClient();
  const [{ data, error }, { data: staff }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("id, form_type, email, phone, source, status, subject, message, payload, assigned_to, hidden_at, created_at")
      .is("deleted_at", null)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Clients"
        title="Form Submissions"
        description="Everything sent from the website — consultation requests, client service, churches & 403(b), careers and newsletter sign-ups — organised by form."
      />
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p> : null}
      <FormInbox
        submissions={(data ?? []) as Submission[]}
        staff={(staff ?? []).map((s) => ({ id: String(s.id), name: String(s.full_name ?? "Team member") }))}
      />
    </div>
  );
}
