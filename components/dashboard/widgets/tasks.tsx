"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetRequest } from "@/lib/dashboard/requests";
import type { MyTask } from "@/lib/project-manager/my-tasks";
import { TABS, TaskBucketDialog, dueLabel, groupTasks, bucketOf, type Bucket } from "@/components/dashboard/my-tasks-card";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, useMounted, type WidgetProps } from "./shell";

type TasksData = { tasks: MyTask[]; name: string };

const BUCKET_FOR_KIND: Record<string, Bucket> = { tasks_overdue: "overdue", tasks_today: "today", tasks_next7: "next7" };

const ACCENT: Record<Bucket, { bar: string; chip: string; glow: string }> = {
  overdue: { bar: "from-red-500/80 to-red-400/40", chip: "bg-red-500/10 text-red-600 dark:text-red-400", glow: "from-red-500/[0.07]" },
  today: { bar: "from-amber-500/80 to-amber-300/40", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400", glow: "from-amber-500/[0.07]" },
  next7: { bar: "from-emerald-500/80 to-emerald-300/40", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", glow: "from-emerald-500/[0.07]" },
};

function useTasks(widget: WidgetProps["widget"], preview?: boolean) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  return useWidgetData<TasksData>(req, { refreshMs: preview ? 0 : 120_000 });
}

/** One bucket (Overdue / Today / Next 7 days) — count, the first few tasks, opens the list dialog. */
function BucketCard({ widget, preview }: WidgetProps) {
  const bucket = BUCKET_FOR_KIND[widget.kind] ?? "today";
  const tab = TABS.find((t) => t.key === bucket)!;
  const { data, error, status, loading, refresh } = useTasks(widget, preview);
  const mounted = useMounted(); // buckets use the viewer's local timezone
  const tasks = React.useMemo(() => (data && mounted ? groupTasks(data.tasks)[bucket] : []), [data, mounted, bucket]);
  const [open, setOpen] = React.useState(false);
  const Icon = tab.icon;
  const a = ACCENT[bucket];

  return (
    <div className={cn("relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-2xl bg-gradient-to-br to-transparent p-4", a.glow)}>
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", a.bar)} />
      <button
        type="button"
        disabled={preview}
        onClick={() => setOpen(true)}
        className="flex items-start justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${tab.label}: ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
      >
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{tab.label}</p>
          {loading && !data ? <div className="sig-skeleton mt-2 h-8 w-10" /> : <p className="mt-1 text-3xl font-semibold tabular-nums">{tasks.length}</p>}
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", a.chip)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </button>
      <div className="mt-2 min-h-0 flex-1">
        {error ? (
          <WidgetError error={error} status={status} onRetry={refresh} />
        ) : loading && !data ? (
          <WidgetSkeleton lines={2} />
        ) : tasks.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> All clear
          </p>
        ) : (
          <ul className="space-y-1">
            {tasks.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", bucket === "overdue" ? "bg-red-500" : bucket === "today" ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{dueLabel(t.dueDate).replace(/^Due /, "")}</span>
              </li>
            ))}
            {tasks.length > 3 ? <li className="pl-3.5 text-[11px] text-muted-foreground">+{tasks.length - 3} more</li> : null}
          </ul>
        )}
      </div>
      {!preview ? <TaskBucketDialog bucket={open ? bucket : null} tasks={tasks} name={data?.name} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/** Every open task assigned to the viewer, soonest first. */
function TaskListCard({ widget, def, preview }: WidgetProps) {
  const { data, error, status, loading, refresh } = useTasks(widget, preview);
  const mounted = useMounted();
  const limit = Number(widget.settings.limit) || 6;
  const tasks = data?.tasks ?? [];
  return (
    <WidgetShell icon={def.icon} title={def.title} subtitle={data ? `${tasks.length} open` : undefined} href="/dashboard/project-manager" hrefLabel="Projects">
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !tasks.length ? (
        <WidgetEmpty icon={ListTodo}>No open tasks assigned to you.</WidgetEmpty>
      ) : (
        <ul className="space-y-1">
          {tasks.slice(0, limit).map((t) => {
            const b = mounted ? bucketOf(t.dueDate) : null;
            return (
              <li key={t.id}>
                <Link href="/dashboard/project-manager" className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs transition hover:bg-muted/60">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", b === "overdue" ? "bg-red-500" : b === "today" ? "bg-amber-500" : b === "next7" ? "bg-emerald-500" : "bg-muted-foreground/40")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    {t.project ? <span className="block truncate text-[11px] text-muted-foreground">{t.project}</span> : null}
                  </span>
                  <span className={cn("shrink-0 text-[11px]", b === "overdue" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{mounted ? dueLabel(t.dueDate) : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

export default function TasksWidget(props: WidgetProps) {
  if (props.widget.kind === "task_list") return <TaskListCard {...props} />;
  return <BucketCard {...props} />;
}
