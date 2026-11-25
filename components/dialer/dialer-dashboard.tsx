"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail, Mic, MessageSquare,
  RotateCcw, RefreshCw, Clock, NotebookPen, Search, Loader2, Settings2, Users, Radio, ListOrdered, DollarSign,
} from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { Softphone } from "./softphone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldSelect } from "@/components/ui/field-select";
import { CallDetailSheet, CallStatusBadge, callContactName, callNumber, type DialerCall } from "./call-detail-sheet";
import { CallHistory } from "./call-history";
import { CallMonitor } from "./call-monitor";
import { DialerSettings } from "./dialer-settings";
import { RANGE_OPTIONS, formatCost, formatDuration, formatTalkTime, formatWhen, rangeStart, type RangeKey } from "./format";

type Totals = {
  all: number; inbound: number; outbound: number; missed: number; voicemails: number; recordings: number; transcripts: number;
  talkSeconds: number; filteredTalkSeconds: number; cost: number; costUnit: string; capped: boolean;
};

type Kind = "all" | "inbound" | "outbound" | "missed" | "voicemail" | "recording" | "transcript";

const PAGE = 50;

// A call counts as missed if Twilio reported no-answer/busy, or if an inbound
// call ended without ever being answered by the agent (rang out to voicemail).
export const isMissed = (c: Pick<DialerCall, "status" | "direction" | "answered_at" | "ended_at">) =>
  c.status === "no-answer" || c.status === "busy" || (c.direction === "inbound" && !c.answered_at && !!c.ended_at);

export function DialerDashboard({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const actionToken = useDashboardActionToken();
  const [calls, setCalls] = useState<DialerCall[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState("log");
  const [kind, setKind] = useState<Kind>("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DialerCall | null>(null);
  const [callbackNumber, setCallbackNumber] = useState<string | null>(null);

  const from = useMemo(() => rangeStart(range), [range]);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (from) params.set("from", from);
      if (q) params.set("q", q);
      if (kind === "inbound" || kind === "outbound") params.set("direction", kind);
      else if (kind !== "all") params.set("kind", kind);
      return params;
    },
    [from, q, kind],
  );

  const fetchCalls = useCallback(
    async (quiet = false) => {
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const res = await fetch(`/api/admin/voice/calls?${buildParams(0)}`, { headers: { "x-sig-action-token": actionToken } });
        if (res.ok) {
          const data = await res.json();
          setCalls(data.calls ?? []);
          setTotals(data.totals ?? null);
          setTotal(data.total ?? 0);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [actionToken, buildParams],
  );

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/voice/calls?${buildParams(calls.length)}`, { headers: { "x-sig-action-token": actionToken } });
      if (res.ok) {
        const data = await res.json();
        setCalls((prev) => [...prev, ...((data.calls ?? []) as DialerCall[]).filter((c) => !prev.some((p) => p.id === c.id))]);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function updateCall(next: DialerCall) {
    setCalls((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
    setSelected((s) => (s?.id === next.id ? { ...s, ...next } : s));
  }

  function callBack(number: string) {
    setCallbackNumber(number);
    if (typeof window !== "undefined" && window.innerWidth < 1280) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const t = totals;
  const dash = loading && !t;
  const kinds: { value: Kind; label: string; count?: number }[] = [
    { value: "all", label: "All", count: t?.all },
    { value: "inbound", label: "Inbound", count: t?.inbound },
    { value: "outbound", label: "Outbound", count: t?.outbound },
    { value: "missed", label: "Missed", count: t?.missed },
    { value: "voicemail", label: "Voicemails", count: t?.voicemails },
    { value: "recording", label: "Recordings", count: t?.recordings },
    { value: "transcript", label: "Transcripts", count: t?.transcripts },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={Phone} label="Total calls" value={dash ? "—" : t?.all ?? 0} />
        <StatTile icon={PhoneIncoming} label="Inbound" value={dash ? "—" : t?.inbound ?? 0} />
        <StatTile icon={PhoneOutgoing} label="Outbound" value={dash ? "—" : t?.outbound ?? 0} />
        <StatTile icon={PhoneMissed} label="Missed" value={dash ? "—" : t?.missed ?? 0} tone={t?.missed ? "warn" : undefined} />
        <StatTile icon={Clock} label="Talk time" value={dash ? "—" : formatTalkTime(t?.talkSeconds ?? 0)} />
        <StatTile icon={DollarSign} label="Cost" value={dash ? "—" : formatCost(t?.cost ?? 0, t?.costUnit ?? "USD")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <CardHeader><CardTitle>Softphone</CardTitle></CardHeader>
          <CardContent>
            <Softphone callbackNumber={callbackNumber} onCallbackNumberUsed={() => setCallbackNumber(null)} onCallEnded={() => fetchCalls(true)} />
          </CardContent>
        </Card>

        <Tabs value={view} onValueChange={setView} className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-9 w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="log" className="gap-1.5 text-xs"><ListOrdered className="h-3.5 w-3.5" />Call log</TabsTrigger>
              <TabsTrigger value="people" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />By contact</TabsTrigger>
              {isAdmin ? <TabsTrigger value="live" className="gap-1.5 text-xs"><Radio className="h-3.5 w-3.5" />Live</TabsTrigger> : null}
              {isAdmin ? <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" />Settings</TabsTrigger> : null}
            </TabsList>
            {view === "log" || view === "people" ? (
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or number" className="h-9 pl-8" aria-label="Search calls" />
                </div>
                <FieldSelect value={range} onChange={(v) => setRange(v as RangeKey)} options={RANGE_OPTIONS} className="h-9 w-[140px]" aria-label="Date range" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => fetchCalls(true)} disabled={refreshing} aria-label="Refresh">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            ) : null}
          </div>

          <TabsContent value="log" className="mt-0">
            <Card className="min-w-0">
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-6">
                <div className="-mx-1 flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Filter calls">
                  {kinds.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      role="tab"
                      aria-selected={kind === k.value}
                      onClick={() => setKind(k.value)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        kind === k.value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k.label}{k.count != null ? <span className="ml-1 tabular-nums opacity-80">{k.count}</span> : null}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading ? "Loading…" : (
                    <>
                      {total} call{total === 1 ? "" : "s"} · talk time <span className="font-medium text-foreground">{formatTalkTime(t?.filteredTalkSeconds ?? 0)}</span>
                      {t?.capped ? " · totals cover the latest 10,000 calls" : ""}
                    </>
                  )}
                </p>
              </div>

              {loading ? (
                <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading call log…</p>
              ) : calls.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No calls match.</p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[44px]" />
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead className="hidden lg:table-cell">Cost</TableHead>
                          <TableHead>When</TableHead>
                          <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calls.map((call) => {
                          const name = callContactName(call);
                          const number = callNumber(call);
                          return (
                            <TableRow key={call.id} className="cursor-pointer" onClick={() => setSelected(call)}>
                              <TableCell>
                                <DirectionIcon call={call} />
                              </TableCell>
                              <TableCell>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{name ?? call.number_display ?? number}</p>
                                  {name ? <p className="truncate font-mono text-xs text-muted-foreground">{call.number_display ?? number}</p> : null}
                                </div>
                              </TableCell>
                              <TableCell><CallStatusBadge status={call.status} missed={isMissed(call)} /></TableCell>
                              <TableCell className="text-sm tabular-nums">{call.duration_seconds != null ? formatDuration(call.duration_seconds) : "—"}</TableCell>
                              <TableCell className="hidden text-sm tabular-nums lg:table-cell">{call.price != null ? formatCost(call.price, call.price_unit) : "—"}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatWhen(call.started_at ?? call.created_at)}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <RowActions call={call} onOpen={() => setSelected(call)} onCallBack={callBack} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile list */}
                  <ul className="divide-y md:hidden">
                    {calls.map((call) => {
                      const name = callContactName(call);
                      const number = callNumber(call);
                      return (
                        <li key={call.id}>
                          <button type="button" onClick={() => setSelected(call)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent/60">
                            <DirectionIcon call={call} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{name ?? call.number_display ?? number}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {formatWhen(call.started_at ?? call.created_at)}
                                {call.duration_seconds != null ? ` · ${formatDuration(call.duration_seconds)}` : ""}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                              {call.recording_url ? <Mic className="h-3.5 w-3.5" /> : null}
                              {call.voicemail_url ? <Voicemail className="h-3.5 w-3.5" /> : null}
                              {call.transcription_text || call.voicemail_transcription ? <MessageSquare className="h-3.5 w-3.5" /> : null}
                            </span>
                            <CallStatusBadge status={call.status} missed={isMissed(call)} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {calls.length < total ? (
                    <div className="border-t p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore} className="gap-1.5">
                        {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load more ({total - calls.length} left)
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="people" className="mt-0">
            <Card className="min-w-0 overflow-hidden">
              {view === "people" ? <CallHistory from={from} q={q} onOpenCall={setSelected} onCallBack={callBack} isMissed={isMissed} /> : null}
            </Card>
          </TabsContent>

          {isAdmin ? (
            <TabsContent value="live" className="mt-0">
              {view === "live" ? <CallMonitor /> : null}
            </TabsContent>
          ) : null}
          {isAdmin ? (
            <TabsContent value="settings" className="mt-0">
              {view === "settings" ? <DialerSettings /> : null}
            </TabsContent>
          ) : null}
        </Tabs>
      </div>

      <CallDetailSheet call={selected} open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)} onUpdated={updateCall} onCallBack={callBack} />
    </div>
  );
}

function DirectionIcon({ call }: { call: DialerCall }) {
  const missed = isMissed(call);
  const Icon = missed ? PhoneMissed : call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${missed ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
      title={missed ? "Missed" : call.direction}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function RowActions({ call, onOpen, onCallBack }: { call: DialerCall; onOpen: () => void; onCallBack: (n: string) => void }) {
  const number = callNumber(call);
  return (
    <div className="flex items-center justify-end gap-0.5">
      {call.recording_url || call.voicemail_url ? (
        <IconBtn title={call.transcription_text || call.voicemail_transcription ? "Recording & transcript" : "Play recording"} onClick={onOpen}>
          {call.voicemail_url && !call.recording_url ? <Voicemail className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </IconBtn>
      ) : null}
      {call.transcription_text || call.voicemail_transcription ? (
        <IconBtn title="View transcript" onClick={onOpen}><MessageSquare className="h-3.5 w-3.5" /></IconBtn>
      ) : null}
      <IconBtn title={call.notes ? "Edit notes" : "Add notes"} onClick={onOpen}>
        <NotebookPen className={`h-3.5 w-3.5 ${call.notes ? "text-primary" : ""}`} />
      </IconBtn>
      {number && !number.startsWith("client:") ? (
        <IconBtn title="Call back" onClick={() => onCallBack(number)}><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
      ) : null}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
      {children}
    </button>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold leading-none tabular-nums sm:text-2xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

