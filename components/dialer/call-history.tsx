"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Mic, PhoneIncoming, PhoneMissed, PhoneOutgoing, RotateCcw, Voicemail } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { CallStatusBadge, type DialerCall } from "./call-detail-sheet";
import { formatDuration, formatTalkTime, formatWhen } from "./format";

export type HistoryGroup = {
  key: string;
  phone: string;
  phoneDisplay: string;
  name: string | null;
  kind: string | null;
  contactId: string | null;
  calls: number;
  inbound: number;
  outbound: number;
  missed: number;
  talkSeconds: number;
  voicemails: number;
  recordings: number;
  transcripts: number;
  lastAt: string | null;
  lastStatus: string | null;
  lastDirection: string | null;
};

const KIND_LABEL: Record<string, string> = { profile: "User", participant: "Participant", contact: "Contact" };

/** Calls grouped by the other party. Selecting a person opens their full history in a Sheet. */
export function CallHistory({
  from,
  q,
  onOpenCall,
  onCallBack,
  isMissed,
}: {
  from: string | null;
  q: string;
  onOpenCall: (call: DialerCall) => void;
  onCallBack: (number: string) => void;
  isMissed: (c: DialerCall) => boolean;
}) {
  const actionToken = useDashboardActionToken();
  const [groups, setGroups] = useState<HistoryGroup[] | null>(null);
  const [selected, setSelected] = useState<HistoryGroup | null>(null);
  const [calls, setCalls] = useState<DialerCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/voice/calls/history?${params}`, { headers: { "x-sig-action-token": actionToken } });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setGroups(json.groups ?? []);
      setError(null);
    } else setError(json.error ?? "Could not load history.");
  }, [actionToken, from, q]);

  useEffect(() => {
    setGroups(null);
    load();
  }, [load]);

  async function open(group: HistoryGroup) {
    setSelected(group);
    setCalls(null);
    const params = new URLSearchParams({ q: group.key, limit: "100" });
    const res = await fetch(`/api/admin/voice/calls?${params}`, { headers: { "x-sig-action-token": actionToken } });
    const json = await res.json().catch(() => ({}));
    setCalls(json.calls ?? []);
  }

  if (error) return <p className="px-6 py-10 text-center text-sm text-destructive">{error}</p>;
  if (!groups) return <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</p>;
  if (!groups.length) return <p className="py-12 text-center text-sm text-muted-foreground">No calls in this period.</p>;

  return (
    <>
      <ul className="divide-y">
        {groups.map((g) => (
          <li key={g.key}>
            <button type="button" onClick={() => open(g)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
                {(g.name ?? "#").slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{g.name ?? g.phoneDisplay}</span>
                  {g.kind ? <Badge variant="secondary" className="hidden px-1.5 py-0 text-[10px] sm:inline-flex">{KIND_LABEL[g.kind] ?? g.kind}</Badge> : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {g.name ? `${g.phoneDisplay} · ` : ""}last {formatWhen(g.lastAt)}
                </span>
              </span>
              <span className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
                <span className="flex items-center gap-1" title="Inbound"><PhoneIncoming className="h-3.5 w-3.5" />{g.inbound}</span>
                <span className="flex items-center gap-1" title="Outbound"><PhoneOutgoing className="h-3.5 w-3.5" />{g.outbound}</span>
                {g.missed ? <span className="flex items-center gap-1 text-destructive" title="Missed"><PhoneMissed className="h-3.5 w-3.5" />{g.missed}</span> : null}
                {g.voicemails ? <span className="flex items-center gap-1" title="Voicemails"><Voicemail className="h-3.5 w-3.5" />{g.voicemails}</span> : null}
              </span>
              <span className="w-16 shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums">{g.calls}</span>
                <span className="block text-[11px] text-muted-foreground">{formatTalkTime(g.talkSeconds)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader className="border-b px-6 pb-4 pt-6 text-left">
                <SheetTitle className="text-xl">{selected.name ?? selected.phoneDisplay}</SheetTitle>
                <SheetDescription className="font-mono">{selected.phoneDisplay}</SheetDescription>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <Mini label="Calls" value={String(selected.calls)} />
                  <Mini label="Talk time" value={formatTalkTime(selected.talkSeconds)} />
                  <Mini label="Missed" value={String(selected.missed)} />
                </div>
                <div className="pt-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { onCallBack(selected.phone); setSelected(null); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Call
                  </Button>
                </div>
              </SheetHeader>
              <div className="flex-1">
                {!calls ? (
                  <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading calls…</p>
                ) : (
                  <ul className="divide-y">
                    {calls.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-accent/60" onClick={() => { setSelected(null); onOpenCall(c); }}>
                          {c.direction === "inbound" ? <PhoneIncoming className="h-4 w-4 shrink-0 text-muted-foreground" /> : <PhoneOutgoing className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm">{formatWhen(c.started_at ?? c.created_at)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.duration_seconds != null ? formatDuration(c.duration_seconds) : "—"}
                              {c.notes ? " · has notes" : ""}
                            </span>
                          </span>
                          {c.recording_url ? <Mic className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                          {c.voicemail_url ? <Voicemail className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                          <CallStatusBadge status={c.status} missed={isMissed(c)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-2 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
