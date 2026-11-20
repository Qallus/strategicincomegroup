"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink, KeyRound, Mail, Pause, Phone, Play, Send, Shield, Trash2, UserCheck, UserCog, Users, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldSelect } from "@/components/ui/field-select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { InviteUserForm } from "@/components/user-management/invite-user-form";
import { ROLE_LABELS, ROLES, isAppRole, type AppRole } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

// Loose shapes of the rows getUserManagementData() returns.
type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
  avatar_url: string | null;
  invited_by: string | null;
  related_participant_id: string | null;
  notes: string | null;
  last_login_at: string | null;
  created_at: string;
  participants?: { first_name: string | null; last_name: string | null } | null;
};
type InviteRow = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  invite_method: "email" | "sms" | "manual";
  invite_status: string;
  expires_at: string | null;
  sent_at: string | null;
  created_at: string;
  metadata?: { inviteUrl?: string | null } | null;
};

type Row = {
  key: string;
  kind: "user" | "invite";
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  /** Account status; open invitations count as "invited". */
  status: string;
  detail: string | null;
  lastLogin: string | null;
  created: string;
  profile?: ProfileRow;
  invite?: InviteRow;
};

const OWNER_EMAIL = "jeremy@strategicincomegroup.com";
const STATUS_OPTIONS = ["active", "invited", "pending", "suspended", "inactive", "archived"];
const OPEN_INVITE = new Set(["pending", "sent", "failed", "expired"]);

const roleLabel = (r: string) => (isAppRole(r) ? ROLE_LABELS[r] : r || "—");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  invited: "bg-primary/10 text-primary",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  suspended: "bg-destructive/10 text-destructive",
  inactive: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground line-through",
};

function Pill({ status, label }: { status: string; label?: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[status] ?? "bg-muted")}>{label ?? cap(status)}</span>;
}

function nameOf(p: ProfileRow) {
  return p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Unnamed";
}

async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          await fn(item);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Failed.");
        }
      }
    }),
  );
  if (errors.length) throw new Error(`${errors.length} of ${items.length} failed: ${errors[0]}`);
}

export function UsersList({
  profiles, invitations, currentUserId, currentUserRole,
}: {
  profiles: ProfileRow[];
  invitations: InviteRow[];
  currentUserId: string | null;
  currentUserRole?: AppRole;
}) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const isSuper = currentUserRole === ROLES.SUPER_ADMIN;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusFocus, setStatusFocus] = useState<"" | "active" | "invited" | "suspended">("");
  const [roleDialog, setRoleDialog] = useState<Row[] | null>(null);
  const [newRole, setNewRole] = useState<string>(ROLES.TEAM_MEMBER);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const users: Row[] = profiles.map((p) => ({
      key: `u:${p.id}`,
      kind: "user",
      name: nameOf(p),
      email: p.email,
      phone: p.phone,
      role: p.role ?? "",
      status: p.status ?? "active",
      detail: p.participants ? `${p.participants.first_name ?? ""} ${p.participants.last_name ?? ""}`.trim() || null : null,
      lastLogin: p.last_login_at,
      created: p.created_at,
      profile: p,
    }));
    const activeEmails = new Set(profiles.filter((p) => p.status === "active" && p.email).map((p) => String(p.email).toLowerCase()));
    const invites: Row[] = invitations
      .filter((i) => OPEN_INVITE.has(i.invite_status) && !(i.email && activeEmails.has(i.email.toLowerCase())))
      .map((i) => ({
        key: `i:${i.id}`,
        kind: "invite",
        name: i.email ?? i.phone ?? "Invitation",
        email: i.email,
        phone: i.phone,
        role: i.role,
        status: "invited",
        detail: `Invite ${i.invite_status} · ${i.invite_method}`,
        lastLogin: null,
        created: i.created_at,
        invite: i,
      }));
    return [...users, ...invites];
  }, [profiles, invitations]);

  const isProtected = (r: Row) => r.kind === "user" && (r.profile!.id === currentUserId || String(r.email ?? "").toLowerCase() === OWNER_EMAIL);
  const users = (sel: Row[]) => sel.filter((r) => r.kind === "user");
  const invitable = (r: Row) => r.kind === "invite" || r.status === "invited" || r.status === "pending";
  const assignableRoles = (Object.values(ROLES) as AppRole[]).filter((r) => isSuper || r !== ROLES.SUPER_ADMIN);

  async function post(url: string, method: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-sig-action-token": token },
      body: JSON.stringify({ ...body, actionToken: token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "That action failed.");
    return json;
  }

  /** Re-save a profile with one field changed. The users route upserts every column, so pass the
   *  current values for the rest (otherwise avatar, notes, links would be cleared). */
  function saveProfile(p: ProfileRow, change: { role?: string; status?: string }, reason?: string) {
    if (!p.email) throw new Error(`${nameOf(p)} has no email address.`);
    const [first, ...rest] = (p.full_name ?? "").trim().split(/\s+/);
    const hasParts = Boolean(p.first_name || p.last_name);
    return post("/api/user-management/users", "POST", {
      id: p.id,
      firstName: hasParts ? p.first_name ?? "" : first ?? "",
      lastName: hasParts ? p.last_name ?? "" : rest.join(" "),
      email: p.email,
      phone: p.phone ?? "",
      role: change.role ?? p.role,
      status: change.status ?? p.status,
      notes: p.notes ?? "",
      avatarUrl: p.avatar_url ?? "",
      invitedBy: p.invited_by ?? "",
      relatedParticipantId: p.related_participant_id ?? "",
      statusChangeReason: reason,
    });
  }

  async function bulk(sel: Row[], fn: (r: Row) => Promise<unknown>) {
    try {
      await eachLimit(sel, 4, async (r) => void (await fn(r)));
    } finally {
      router.refresh();
    }
  }

  function guardSelf(sel: Row[], verb: string) {
    const blocked = sel.filter(isProtected);
    if (blocked.length) throw new Error(`You can't ${verb} your own account or the owner account — untick ${blocked.map((r) => r.name).join(", ")}.`);
  }

  async function applyRole() {
    if (!roleDialog) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (!isSuper && roleDialog.some((r) => r.role === ROLES.SUPER_ADMIN)) throw new Error("Only a Super Admin can change a Super Admin's role.");
      await bulk(roleDialog, (r) => (r.role === newRole ? Promise.resolve() : saveProfile(r.profile!, { role: newRole })));
      setRoleDialog(null);
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Role change failed.");
    } finally {
      setBusy(false);
    }
  }

  const resendInvite = (r: Row) => {
    const method = r.invite?.invite_method ?? (r.email ? "email" : "sms");
    if (!isAppRole(r.role)) throw new Error(`${r.name} has no valid role.`);
    return post("/api/user-management/invitations", "POST", { email: r.email ?? "", phone: r.phone ?? "", role: r.role, inviteMethod: method, siteUrl: window.location.origin });
  };

  const count = (fn: (r: Row) => boolean) => rows.filter(fn).length;
  const items = statusFocus
    ? rows.filter((r) => (statusFocus === "invited" ? r.status === "invited" || r.status === "pending" : r.status === statusFocus))
    : rows;
  const focus = (f: typeof statusFocus) => () => setStatusFocus((cur) => (cur === f ? "" : f));

  const columns: DataColumn<Row>[] = [
    {
      id: "name", label: "Name", required: true, width: 240, sort: (r) => r.name,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <UserAvatar firstName={r.profile?.first_name ?? r.name} lastName={r.profile?.last_name} email={r.email} avatarUrl={r.profile?.avatar_url} className="h-7 w-7 shrink-0 text-[11px]" />
          <span className="truncate font-medium">{r.name}</span>
        </span>
      ),
    },
    { id: "email", label: "Email", width: 240, cell: (r) => r.email ?? "—", sort: (r) => r.email },
    { id: "phone", label: "Phone", width: 140, cell: (r) => r.phone ?? "—", sort: (r) => r.phone },
    { id: "role", label: "Role", width: 170, cell: (r) => roleLabel(r.role), sort: (r) => roleLabel(r.role) },
    { id: "status", label: "Status", width: 120, cell: (r) => <Pill status={r.status} />, sort: (r) => r.status },
    { id: "type", label: "Type", width: 110, cell: (r) => (r.kind === "user" ? "Account" : "Invitation"), sort: (r) => r.kind, defaultHidden: true },
    { id: "participant", label: "Participant", width: 180, cell: (r) => (r.kind === "user" ? r.detail ?? "—" : "—"), sort: (r) => (r.kind === "user" ? r.detail : null) },
    { id: "invite", label: "Invite", width: 160, cell: (r) => (r.kind === "invite" ? r.detail : "—"), sort: (r) => (r.kind === "invite" ? r.detail : null), defaultHidden: true },
    { id: "login", label: "Last login", width: 130, cell: (r) => (r.lastLogin ? new Date(r.lastLogin).toLocaleDateString() : "—"), sort: (r) => r.lastLogin, exportValue: (r) => r.lastLogin },
    { id: "created", label: "Added", width: 120, cell: (r) => new Date(r.created).toLocaleDateString(), sort: (r) => r.created, exportValue: (r) => r.created, defaultHidden: true },
  ];

  return (
    <>
      <DataView<Row>
        storageKey="user-management"
        exportName="sig-users"
        noun={["person", "people"]}
        items={items}
        getId={(r) => r.key}
        title={(r) => r.name}
        subtitle={(r) => (r.kind === "invite" ? r.detail : r.email ?? r.phone ?? "No email")}
        media={(r) => <UserAvatar firstName={r.profile?.first_name ?? r.name} lastName={r.profile?.last_name} email={r.email} avatarUrl={r.profile?.avatar_url} className="h-9 w-9 shrink-0 text-xs" />}
        badge={(r) => <Pill status={r.status} />}
        meta={(r) => roleLabel(r.role)}
        columns={columns}
        searchText={(r) => [r.name, r.email, r.phone, roleLabel(r.role), r.status, r.detail].join(" ")}
        stats={[
          { label: "Active", value: count((r) => r.status === "active"), icon: UserCheck, hint: "Can sign in", onClick: focus("active"), active: statusFocus === "active" },
          { label: "Invited / pending", value: count((r) => r.status === "invited" || r.status === "pending"), icon: Send, hint: `${count((r) => r.kind === "invite")} open invitations`, onClick: focus("invited"), active: statusFocus === "invited" },
          { label: "Suspended", value: count((r) => r.status === "suspended"), icon: UserX, onClick: focus("suspended"), active: statusFocus === "suspended" },
          { label: "Everyone", value: rows.length, icon: Users, hint: `${profiles.length} accounts`, onClick: () => setStatusFocus(""), active: statusFocus === "" },
        ]}
        filters={[
          { id: "all", label: "All roles", test: () => true },
          ...(Object.values(ROLES) as AppRole[]).map((role) => ({ id: role, label: ROLE_LABELS[role], test: (r: Row) => r.role === role })),
        ]}
        selectFilters={[
          { id: "status", label: "Status", options: STATUS_OPTIONS.map((s) => ({ value: s, label: cap(s) })), get: (r) => r.status },
          { id: "kind", label: "Type", options: [{ value: "user", label: "Accounts" }, { value: "invite", label: "Open invitations" }], get: (r) => r.kind },
        ]}
        actions={[
          {
            label: "Change role", icon: Shield, show: (sel) => sel.every((r) => r.kind === "user"),
            run: (sel) => { setRoleDialog(sel); setNewRole(sel.length === 1 && isAppRole(sel[0].role) ? sel[0].role : ROLES.TEAM_MEMBER); setDialogError(null); },
          },
          {
            label: "Suspend", icon: Pause, show: (sel) => users(sel).some((r) => r.status !== "suspended"),
            run: (sel) => {
              const list = users(sel).filter((r) => r.status !== "suspended");
              guardSelf(list, "suspend");
              if (!window.confirm(`Suspend ${list.length} account${list.length === 1 ? "" : "s"}? They won't be able to sign in.`)) return;
              return bulk(list, (r) => saveProfile(r.profile!, { status: "suspended" }, "Suspended from User Management"));
            },
          },
          {
            label: "Reactivate", icon: Play, show: (sel) => users(sel).some((r) => ["suspended", "inactive", "archived"].includes(r.status)),
            run: (sel) => bulk(users(sel).filter((r) => ["suspended", "inactive", "archived"].includes(r.status)), (r) => saveProfile(r.profile!, { status: "active" }, "Reactivated from User Management")),
          },
          {
            label: "Resend invite", icon: Send, show: (sel) => sel.some(invitable),
            run: (sel) => bulk(sel.filter(invitable), resendInvite),
          },
          {
            label: "Reset password", icon: KeyRound, show: (sel) => users(sel).some((r) => r.status === "active" && r.email),
            run: (sel) => {
              const list = users(sel).filter((r) => r.status === "active" && r.email);
              if (!window.confirm(`Email a password-reset link to ${list.length} user${list.length === 1 ? "" : "s"}?`)) return;
              return bulk(list, (r) => post("/api/admin/users/reset-password", "POST", { userId: r.profile!.id, email: r.email }));
            },
          },
          { label: "Email", icon: Mail, single: true, show: (sel) => Boolean(sel[0]?.email), run: (sel) => void window.open(`mailto:${sel[0].email}`) },
          { label: "Open", icon: UserCog, single: true, show: (sel) => sel[0]?.kind === "user", run: (sel) => router.push(`/dashboard/user-management/${sel[0].profile!.id}`) },
          {
            label: "Delete", icon: Trash2, destructive: true, show: (sel) => sel.every((r) => r.kind === "user"),
            run: (sel) => {
              guardSelf(sel, "delete");
              if (!window.confirm(`Permanently delete ${sel.length} user${sel.length === 1 ? "" : "s"}?\n\nThis removes their login and profile and cannot be undone.`)) return;
              return bulk(sel, (r) => post(`/api/user-management/users/${r.profile!.id}`, "DELETE", {}));
            },
          },
        ]}
        add={{ label: "Invite user", onClick: () => setInviteOpen(true) }}
        preview={(r) => (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              <Pill status={r.status} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{roleLabel(r.role)}</span>
              {r.kind === "invite" ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Invitation</span> : null}
            </div>
            <dl className="grid gap-2.5 rounded-xl border bg-muted/30 p-4 text-sm">
              {(
                [
                  ["Email", r.email],
                  ["Phone", r.phone],
                  ["Role", roleLabel(r.role)],
                  ["Status", cap(r.status)],
                  [r.kind === "invite" ? "Invite" : "Participant", r.detail],
                  ["Last login", r.lastLogin ? new Date(r.lastLogin).toLocaleString() : null],
                  ["Expires", r.invite?.expires_at ? new Date(r.invite.expires_at).toLocaleDateString() : null],
                  ["Added", new Date(r.created).toLocaleDateString()],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {r.kind === "user" ? (
                <Button asChild size="sm">
                  <Link href={`/dashboard/user-management/${r.profile!.id}`}>
                    <UserCog className="h-4 w-4" /> Edit profile
                  </Link>
                </Button>
              ) : null}
              {r.invite?.metadata?.inviteUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={r.invite.metadata.inviteUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Invite link
                  </a>
                </Button>
              ) : null}
              {r.email ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${r.email}`}><Mail className="h-4 w-4" /> Email</a>
                </Button>
              ) : null}
              {r.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${r.phone}`}><Phone className="h-4 w-4" /> Call</a>
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Tick the row to change role, suspend, resend the invite or delete.</p>
          </div>
        )}
        empty="No users or invitations yet. Invite someone to get started."
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            {isSuper ? <DialogDescription>As a Super Admin you can also invite another Super Admin.</DialogDescription> : null}
          </DialogHeader>
          <InviteUserForm currentUserRole={currentUserRole} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleDialog)} onOpenChange={(o) => !o && !busy && setRoleDialog(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>{roleDialog ? `${roleDialog.length} account${roleDialog.length === 1 ? "" : "s"} selected.` : null}</DialogDescription>
          </DialogHeader>
          <FieldSelect value={newRole} onChange={setNewRole} options={assignableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          {!isSuper ? <p className="text-xs text-muted-foreground">Only a Super Admin can grant or change the Super Admin role.</p> : null}
          {dialogError ? <p className="text-sm text-destructive">{dialogError}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRoleDialog(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void applyRole()} disabled={busy}>{busy ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
