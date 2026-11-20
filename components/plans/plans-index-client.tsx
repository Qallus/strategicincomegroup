"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, ClipboardList, ListTodo, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { CreatePlanDialog } from "./create-plan/create-plan-dialog";
import { ProgressIndicator } from "./shared/badges";
import { planColor, planIcon } from "@/lib/plans/constants";
import { cn } from "@/lib/utils";
import type { PlanPerson, PlanSummary, PlanTemplate } from "@/lib/plans/types";

const progressOf = (plan: PlanSummary) => (plan.task_count ? (plan.completed_count / plan.task_count) * 100 : 0);
const fmtDay = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";

function PlanIcon({ plan }: { plan: PlanSummary }) {
  const Icon = planIcon(plan.icon);
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", planColor(plan.color).chip)}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function PremiumBadge({ plan }: { plan: PlanSummary }) {
  return plan.plan_type === "premium" ? (
    <span className="shrink-0 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
      Premium
    </span>
  ) : null;
}

export function PlansIndexClient({
  plans,
  templates,
  people,
  owner,
  premiumAllowed,
}: {
  plans: PlanSummary[];
  templates: PlanTemplate[];
  people: PlanPerson[];
  owner: PlanPerson;
  premiumAllowed: boolean;
}) {
  const router = useRouter();
  const token = useDashboardActionToken();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlanSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = (plan: PlanSummary) => `/dashboard/plans/${plan.id}?view=${plan.default_view}`;
  const ownerLabel = (plan: PlanSummary) => (plan.owner_id === owner.id ? "You" : plan.owner?.name ?? "Someone else");
  const mine = (plan: PlanSummary) => plan.owner_id === owner.id;

  async function confirmDelete() {
    if (!deleting.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const plan of deleting) {
        const res = await fetch(`/api/plans/${plan.id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-sig-action-token": token },
          body: JSON.stringify({ actionToken: token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? `Deleting “${plan.name}” failed.`);
      }
      setDeleting([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan delete failed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const columns: DataColumn<PlanSummary>[] = [
    { id: "name", label: "Plan", required: true, width: 260, cell: (p) => <span className="font-medium">{p.name}</span>, sort: (p) => p.name },
    {
      id: "progress",
      label: "Progress",
      width: 170,
      cell: (p) => <ProgressIndicator value={progressOf(p)} />,
      sort: progressOf,
      exportValue: (p) => Math.round(progressOf(p)),
    },
    { id: "tasks", label: "Tasks done", width: 120, align: "right", cell: (p) => `${p.completed_count}/${p.task_count}`, sort: (p) => p.task_count, exportValue: (p) => `${p.completed_count}/${p.task_count}` },
    { id: "owner", label: "Owner", width: 170, cell: ownerLabel, sort: ownerLabel },
    { id: "members", label: "Members", width: 110, align: "right", cell: (p) => p.member_count, sort: (p) => p.member_count },
    { id: "visibility", label: "Visibility", width: 120, cell: (p) => (p.visibility === "private" ? "Private" : "Team"), sort: (p) => p.visibility },
    { id: "type", label: "Type", width: 110, defaultHidden: true, cell: (p) => (p.plan_type === "premium" ? "Premium" : "Basic"), sort: (p) => p.plan_type },
    { id: "start", label: "Start", width: 130, defaultHidden: true, cell: (p) => fmtDay(p.start_date), sort: (p) => p.start_date, exportValue: (p) => p.start_date },
    { id: "target", label: "Target date", width: 130, cell: (p) => fmtDay(p.target_date), sort: (p) => p.target_date, exportValue: (p) => p.target_date },
    { id: "updated", label: "Updated", width: 130, defaultHidden: true, cell: (p) => fmtDay(p.updated_at), sort: (p) => p.updated_at, exportValue: (p) => p.updated_at },
    { id: "description", label: "Description", width: 300, defaultHidden: true, cell: (p) => <span className="text-muted-foreground">{p.description || "—"}</span>, exportValue: (p) => p.description },
  ];

  const openTasks = plans.reduce((s, p) => s + Math.max(0, p.task_count - p.completed_count), 0);
  const allTasks = plans.reduce((s, p) => s + p.task_count, 0);
  const doneTasks = plans.reduce((s, p) => s + p.completed_count, 0);

  return (
    <div className="space-y-4">
      <DataView<PlanSummary>
        storageKey="plans-index"
        exportName="sig-plans"
        noun={["plan", "plans"]}
        defaultView="cards"
        items={plans}
        getId={(p) => p.id}
        title={(p) => p.name}
        subtitle={(p) => p.description || "No description"}
        media={(p) => <PlanIcon plan={p} />}
        badge={(p) => <PremiumBadge plan={p} />}
        meta={(p) => (
          <span className="flex items-center gap-3">
            <span className="tabular-nums">
              {p.completed_count}/{p.task_count} task{p.task_count === 1 ? "" : "s"} done
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">{p.member_count}</span>
              <span className="sr-only">members</span>
            </span>
            {p.visibility === "private" ? <span>Private</span> : null}
          </span>
        )}
        columns={columns}
        searchText={(p) => [p.name, p.description, p.owner?.name].join(" ")}
        stats={[
          { label: "Plans", value: plans.length, icon: ClipboardList, hint: `${plans.filter(mine).length} owned by you` },
          { label: "Open tasks", value: openTasks, icon: ListTodo },
          { label: "Completed", value: doneTasks, icon: CheckCircle2, hint: allTasks ? `${Math.round((doneTasks / allTasks) * 100)}% of all tasks` : undefined },
          { label: "Shared with you", value: plans.filter((p) => !mine(p)).length, icon: UserRound },
        ]}
        filters={[
          { id: "all", label: "All plans", test: () => true },
          { id: "mine", label: "Owned by me", test: mine },
          { id: "shared", label: "Shared with me", test: (p) => !mine(p) },
        ]}
        selectFilters={[
          { id: "visibility", label: "Visibility", options: [{ value: "team", label: "Team" }, { value: "private", label: "Private" }], get: (p) => p.visibility },
          { id: "type", label: "Type", options: [{ value: "basic", label: "Basic" }, { value: "premium", label: "Premium" }], get: (p) => p.plan_type },
        ]}
        date={(p) => (p.target_date ? (p.target_date.length === 10 ? `${p.target_date}T12:00:00` : p.target_date) : null)}
        onOpen={(p) => router.push(href(p))}
        add={{ label: "New plan", onClick: () => setCreating(true) }}
        actions={[
          { label: "Open", icon: ArrowUpRight, single: true, run: (sel) => router.push(href(sel[0])) },
          {
            label: "Delete",
            icon: Trash2,
            destructive: true,
            show: (sel) => sel.some((p) => p.can_manage),
            run: (sel) => {
              setError(null);
              setDeleting(sel.filter((p) => p.can_manage));
            },
          },
        ]}
        empty={
          <div>
            <p className="text-sm font-medium text-foreground">No plans yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              A plan is a board of tasks you can group, assign and schedule. Start from scratch or pick a template.
            </p>
            <Button size="sm" onClick={() => setCreating(true)} className="mt-4 gap-1.5">
              Create your first plan
            </Button>
          </div>
        }
      />

      <CreatePlanDialog
        open={creating}
        onOpenChange={setCreating}
        templates={templates}
        people={people}
        owner={owner}
        premiumAllowed={premiumAllowed}
      />

      <Dialog
        open={deleting.length > 0}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleting([]);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleting.length > 1 ? `Delete ${deleting.length} plans?` : "Delete this plan?"}</DialogTitle>
            <DialogDescription>
              {/* Deletion cascades, so say exactly what goes with it. */}
              {deleting.length === 1 ? (
                <>
                  <span className="font-medium text-foreground">{deleting[0].name}</span> and its {deleting[0].task_count} task
                  {deleting[0].task_count === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{deleting.map((p) => p.name).join(", ")}</span> and their{" "}
                  {deleting.reduce((s, p) => s + p.task_count, 0)} tasks
                </>
              )}
              , groups, labels and activity history will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleting([])} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : deleting.length > 1 ? `Delete ${deleting.length} plans` : "Delete plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
