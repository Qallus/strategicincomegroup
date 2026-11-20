"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// "The roles we offer" on /join-our-team: one tab per department (with counts),
// plus "Open now" first and "All roles" last. Cards keep the original style:
// solid + linked for roles with a detail page, dashed for waitlist-only roles.

export type RoleCard = {
  slug: string;
  title: string;
  summary: string;
  department: string;
  badge: string | null;
  open: boolean;
  featured: boolean;
  hasDetail: boolean;
  location: string | null;
  employmentType: string;
};

const APPLY = "/contact?topic=careers";

function badgeTone(badge: string) {
  return /part|contract/i.test(badge)
    ? "bg-[hsl(219_68%_54%/0.15)] text-[hsl(219_60%_40%)] dark:text-brand-sky"
    : /intern/i.test(badge)
      ? "bg-brand-gold/20 text-[hsl(36_55%_32%)] dark:text-gold"
      : "bg-[hsl(147_27%_43%/0.15)] text-[hsl(147_35%_30%)] dark:text-brand-sage";
}

function Card({ r, showDept }: { r: RoleCard; showDept: boolean }) {
  const badge = r.badge || (r.open ? "Open" : null);
  const body = (
    <>
      {showDept ? <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{r.department}</span> : null}
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-start gap-1.5 font-medium">
          {r.featured ? <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-brand-gold text-brand-gold" aria-label="Featured role" /> : null}
          {r.title}
        </span>
        {badge ? <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", badgeTone(badge))}>{badge}</span> : null}
      </span>
      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{r.summary}</span>
      {r.location ? (
        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-gold" /> {r.location}
        </span>
      ) : null}
      <span className="mt-auto pt-3">
        {r.hasDetail ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            View role <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Join the waitlist <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </span>
    </>
  );
  return r.hasDetail ? (
    <Link
      href={`/join-our-team/${r.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        r.featured && "border-brand-gold/50",
      )}
    >
      {body}
    </Link>
  ) : (
    <Link
      href={`${APPLY}&role=${encodeURIComponent(r.title)}`}
      className="group flex h-full flex-col rounded-xl border border-dashed bg-card/60 p-4 transition hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}

function Grid({ roles, showDept }: { roles: RoleCard[]; showDept?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((r) => (
        <li key={r.slug} className="min-w-0">
          <Card r={r} showDept={Boolean(showDept)} />
        </li>
      ))}
    </ul>
  );
}

const featuredFirst = (list: RoleCard[]) => [...list].sort((a, b) => Number(b.featured) - Number(a.featured));

export function CareersRoles({ groups }: { groups: { heading: string; roles: RoleCard[] }[] }) {
  const all = groups.flatMap((g) => g.roles);
  const open = featuredFirst(all.filter((r) => r.open));
  const tabs = [
    ...(open.length ? [{ id: "open", label: "Open now", count: open.length, roles: open, showDept: true }] : []),
    ...groups.map((g, i) => ({ id: `dept-${i}`, label: g.heading, count: g.roles.length, roles: featuredFirst(g.roles), showDept: false })),
    { id: "all", label: "All roles", count: all.length, roles: all, showDept: true },
  ];

  if (!all.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 p-8 text-center">
        <p className="font-serif text-2xl">No listings right now</p>
        <p className="mt-2 text-muted-foreground">We are always building a waitlist of qualified candidates.</p>
        <Link href={APPLY} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Join the waitlist <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <Tabs defaultValue={tabs[0].id} className="min-w-0">
      <div className="min-w-0">
        <TabsList
          aria-label="Roles by department"
          className="flex h-auto w-full snap-x justify-start gap-1 rounded-xl border bg-card p-1.5 shadow-sm lg:w-auto lg:max-w-full"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="group snap-start gap-2 rounded-lg px-3.5 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow"
            >
              {t.id === "open" ? <span className="h-1.5 w-1.5 rounded-full bg-[hsl(147_45%_45%)] group-data-[state=active]:bg-brand-gold" aria-hidden /> : null}
              {t.label}
              <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold tabular-nums text-muted-foreground group-data-[state=active]:bg-white/20 group-data-[state=active]:text-primary-foreground">
                {t.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-6">
          <Grid roles={t.roles} showDept={t.showDept} />
          {t.id === "open" ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Don’t see your role? Browse every department above, or{" "}
              <Link href={APPLY} className="font-semibold text-primary hover:underline">
                join our candidate waitlist
              </Link>
              .
            </p>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
