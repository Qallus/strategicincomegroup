"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarDays, Clock, Link2Off, Loader2, MapPin, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDayYear, fmtTime, tzName } from "@/components/booking/format";
import type { AccessListItem } from "@/lib/booking/manage";

const ICONS: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: MapPin, custom: Clock };
const STATUS: Record<string, string> = { confirmed: "Confirmed", pending: "Pending", canceled: "Cancelled", completed: "Completed", no_show: "Missed" };

type State = "valid" | "used" | "expired" | "invalid";

export function ListClient({ token, initialState }: { token: string; initialState: State }) {
  const [state, setState] = React.useState<State>(initialState);
  const [items, setItems] = React.useState<AccessListItem[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  async function open() {
    setBusy(true);
    try {
      const res = await fetch("/api/booking/manage/list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setState((json.reason as State) || "invalid"); return; }
      setItems(json.items ?? []);
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setState("invalid");
    } finally {
      setBusy(false);
    }
  }

  if (items) {
    const nowIso = new Date().toISOString();
    const upcoming = items.filter((i) => i.end_at >= nowIso && i.status !== "canceled");
    const recent = items.filter((i) => !(i.end_at >= nowIso && i.status !== "canceled")).reverse();
    return (
      <div className="sig-book-in mt-6 space-y-8">
        <p className="text-sm text-muted-foreground">These links work for the next 24 hours. Bookmark the page for any appointment you want to come back to — or request a new email any time.</p>
        <Section title="Upcoming" headingRef={headingRef} items={upcoming} empty="No upcoming appointments." />
        {recent.length ? <Section title="Recent" items={recent} empty="" muted /> : null}
        <Button asChild variant="outline"><Link href="/book">Book another appointment</Link></Button>
      </div>
    );
  }

  if (state !== "valid") {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <Link2Off className="mx-auto h-7 w-7 text-gold" aria-hidden />
        <p className="mt-3 font-semibold">{state === "used" ? "This link has already been used" : state === "expired" ? "This link has expired" : "This link isn’t valid"}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">For your security, appointment links work once and expire after an hour. Request a fresh one below.</p>
        <Button asChild className="mt-5"><Link href="/book/manage">Email me a new link</Link></Button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border bg-card p-6 text-center shadow-sm">
      <CalendarClock className="mx-auto h-7 w-7 text-gold" aria-hidden />
      <p className="mt-3 font-semibold">Your secure link is ready</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">It works once — continue to see your upcoming and recent appointments.</p>
      <Button className="mt-5 h-11 px-6" onClick={open} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} View my appointments
      </Button>
    </div>
  );
}

function Section({ title, items, empty, muted, headingRef }: {
  title: string; items: AccessListItem[]; empty: string; muted?: boolean; headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section aria-labelledby={`sec-${title}`}>
      <h2 id={`sec-${title}`} ref={headingRef} tabIndex={-1} className="font-serif text-xl outline-none">{title}</h2>
      {items.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          <CalendarDays className="h-5 w-5 text-gold" aria-hidden /> {empty}
        </div>
      ) : (
        <ul className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {items.map((i) => {
            const Icon = ICONS[i.locationType] ?? Clock;
            return (
              <li key={i.reference}>
                <Link href={i.manageUrl} className={cn("group flex items-center gap-4 p-4 transition hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5", muted && "opacity-80")}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{i.typeName}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", i.status === "canceled" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{STATUS[i.status] ?? i.status}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {fmtDayYear(i.start_at, i.timezone)} · {fmtTime(i.start_at, i.timezone)} ({tzName(i.timezone)})
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {i.hostName ? <span>with {i.hostName.split(",")[0]}</span> : null}
                      <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" aria-hidden /> Ref {i.reference}</span>
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Manage</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
