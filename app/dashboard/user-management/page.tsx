import Link from "next/link";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UsersList } from "./users-list";
import { ROLE_LABELS, ROLES, isAppRole } from "@/lib/rbac/roles";
import { getCurrentProfile } from "@/lib/auth/server";
import { getUserManagementData } from "@/lib/user-management/repository";

export default async function UserManagementPage() {
  const [data, profile] = await Promise.all([getUserManagementData(), getCurrentProfile()]);
  const currentUserId = profile?.id ?? null;
  // Link each participant to its user account (if any) — matched by the profile's
  // related_participant_id or a shared email — so the Participants table can show the
  // account's role, status, and last login alongside the participant's own fields.
  const accountByParticipant = new Map<string, any>();
  for (const p of data.profiles as any[]) {
    if (p.related_participant_id) accountByParticipant.set(p.related_participant_id, p);
    if (p.email) accountByParticipant.set(`email:${String(p.email).toLowerCase()}`, p);
  }
  const accountFor = (pt: any) =>
    accountByParticipant.get(pt.id) ||
    (pt.email ? accountByParticipant.get(`email:${String(pt.email).toLowerCase()}`) : null) ||
    null;
  const prettify = (value?: string | null) =>
    value ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-";

  return (
    <div className="space-y-6">
      <SectionHeader title="User Management" description="Invite admins, team members, content reviewers, Pastor/Elder reviewers, and future participants." />

      <UsersList
        profiles={data.profiles as any[]}
        invitations={data.invitations as any[]}
        currentUserId={currentUserId}
        currentUserRole={profile?.role}
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/user-management/communications" className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Communications & Opt-In Management →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <p className="text-sm text-muted-foreground">Everyone in the participant records — Role, Status, and Last login come from their linked account when they have one.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.participants as any[]).map((pt) => {
                  const account = accountFor(pt);
                  const name = `${pt.first_name ?? ""} ${pt.last_name ?? ""}`.trim() || "-";
                  return (
                    <TableRow key={pt.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{pt.email ?? "-"}</TableCell>
                      <TableCell>{pt.phone ?? "-"}</TableCell>
                      <TableCell>{account ? roleLabel(account.role) : ROLE_LABELS[ROLES.PARTICIPANT]}</TableCell>
                      <TableCell>
                        {account ? <StatusBadge status={account.status} /> : <StatusBadge status="no account" />}
                      </TableCell>
                      <TableCell><StatusBadge status={pt.check_in_status ?? "not_started"} /></TableCell>
                      <TableCell>{prettify(pt.participant_type)}</TableCell>
                      <TableCell>{account?.last_login_at ? new Date(account.last_login_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right">
                        <Link className="text-sm font-medium text-primary hover:underline" href={`/dashboard/participants/${pt.id}`}>
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!data.participants.length ? <TableRow><TableCell colSpan={9}>No participants yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activity.slice(0, 12).map((activity: any) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.action}</TableCell>
                    <TableCell>{activity.entity_type ?? "-"}</TableCell>
                    <TableCell>{new Date(activity.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {!data.activity.length ? <TableRow><TableCell colSpan={3}>No user activity yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected form submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>User linked</TableHead>
                <TableHead>Participant linked</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.submissions.slice(0, 25).map((submission: any) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">{submission.form_type}</TableCell>
                  <TableCell>{submission.email ?? "-"}</TableCell>
                  <TableCell>{submission.phone ?? "-"}</TableCell>
                  <TableCell>{submission.user_id ? "Yes" : "No"}</TableCell>
                  <TableCell>{submission.participant_id ? "Yes" : "No"}</TableCell>
                  <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!data.submissions.length ? <TableRow><TableCell colSpan={6}>No connected form submissions yet.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.error ? <p className="text-sm text-destructive">{data.error}</p> : null}
    </div>
  );
}

function roleLabel(role: unknown) {
  return typeof role === "string" && isAppRole(role) ? ROLE_LABELS[role] : String(role ?? "-");
}
