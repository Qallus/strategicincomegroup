"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, Headphones, Loader2, Megaphone, MessageCircle, PhoneIncoming, PhoneOff, PhoneOutgoing, Radio, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { formatDuration } from "./format";

type Mode = "listen" | "whisper" | "barge";

type LiveCall = {
  id: string;
  direction: "inbound" | "outbound";
  number: string;
  numberDisplay: string;
  contactName: string | null;
  status: string;
  startedAt: string;
  answeredAt: string | null;
  monitorable: boolean;
  hasConference: boolean;
};

type Payload = { conferenceMode: boolean; available: boolean; calls: LiveCall[]; sessions: { id: string; call_id: string; mode: Mode }[]; monitoredToday: number };

const MODES: { mode: Mode; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: "listen", label: "Listen", hint: "Hear both sides, muted", icon: Ear },
  { mode: "whisper", label: "Whisper", hint: "Only the agent hears you", icon: MessageCircle },
  { mode: "barge", label: "Barge", hint: "Everyone hears you", icon: Megaphone },
];

/** Live calls with Listen / Whisper / Barge (Conference mode only). Admin / Super Admin. */
export function CallMonitor() {
  const actionToken = useDashboardActionToken();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [active, setActive] = useState<{ sessionId: string; callId: string; mode: Mode; state: "connecting" | "live" } | null>(null);
  const [switching, setSwitching] = useState(false);
  const deviceRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voice/monitor", { headers: { "x-sig-action-token": actionToken } });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json);
        setError(null);
      } else setError(json.error ?? "Could not load live calls.");
    } finally {
      setLoading(false);
    }
  }, [actionToken]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const endSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/admin/voice/monitor/${sessionId}`, { method: "DELETE", headers: { "x-sig-action-token": actionToken } }).catch(() => undefined);
    },
    [actionToken],
  );

  // Leave cleanly if the page is closed mid-session.
  useEffect(() => {
    return () => {
      connRef.current?.disconnect();
      deviceRef.current?.destroy();
      if (activeRef.current) void endSession(activeRef.current.sessionId);
    };
  }, [endSession]);

  async function getDevice() {
    if (deviceRef.current) return deviceRef.current;
    const res = await fetch("/api/admin/voice/monitor/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.token) throw new Error(json.error ?? "Could not get a voice token.");
    const { Device } = await import("@twilio/voice-sdk");
    const device = new Device(json.token, { logLevel: 1, codecPreferences: ["opus", "pcmu"] as any });
    deviceRef.current = device;
    return device;
  }

  async function start(call: LiveCall, mode: Mode) {
    if (active) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/voice/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, callId: call.id, mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not start monitoring.");
      const sessionId = json.session.id as string;
      setActive({ sessionId, callId: call.id, mode, state: "connecting" });

      const device = await getDevice();
      const conn = await device.connect({ params: { monitorSession: sessionId } });
      connRef.current = conn;
      conn.on("accept", () => setActive((a) => (a ? { ...a, state: "live" } : a)));
      const finish = () => {
        connRef.current = null;
        setActive(null);
        void endSession(sessionId);
        void load();
      };
      conn.on("disconnect", finish);
      conn.on("cancel", finish);
      conn.on("error", (e: Error) => setError(e.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start monitoring.");
      if (activeRef.current) void endSession(activeRef.current.sessionId);
      setActive(null);
    }
  }

  async function switchMode(mode: Mode) {
    if (!active || mode === active.mode) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/voice/monitor/${active.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not switch.");
      setActive((a) => (a ? { ...a, mode } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch.");
    } finally {
      setSwitching(false);
    }
  }

  function leave() {
    if (connRef.current) connRef.current.disconnect();
    else if (active) {
      void endSession(active.sessionId);
      setActive(null);
    }
  }

  const calls = data?.calls ?? [];
  const activeCall = active ? calls.find((c) => c.id === active.callId) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-primary" /> Live calls
          </CardTitle>
          <CardDescription className="mt-1">
            {data?.conferenceMode
              ? "Join a call to coach or take over. Listen is muted; Whisper only reaches the agent; Barge joins the conversation."
              : "Monitoring needs Conference mode — a Super Admin can turn it on in Settings."}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data ? <Badge variant="outline" className="hidden text-[11px] sm:inline-flex">{data.monitoredToday} monitored today</Badge> : null}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={load} disabled={loading} aria-label="Refresh live calls">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Headphones className="h-4 w-4" />
                  {active.state === "live" ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 ring-2 ring-background" /> : null}
                </span>
                <div>
                  <p className="text-sm font-semibold">{activeCall?.contactName ?? activeCall?.numberDisplay ?? "Live call"}</p>
                  <p className="text-xs text-muted-foreground">
                    {active.state === "connecting" ? "Connecting…" : `Monitoring · ${MODES.find((m) => m.mode === active.mode)?.hint}`}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={leave}>
                <PhoneOff className="h-3.5 w-3.5" /> Leave
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Monitor mode">
              {MODES.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active.mode === mode}
                  disabled={switching || active.state !== "live"}
                  onClick={() => switchMode(mode)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
                    active.mode === mode ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {data && !data.available ? <p className="text-xs text-muted-foreground">Run the communications migration to enable monitoring.</p> : null}

        {!data ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : calls.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">No calls in progress.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {calls.map((c) => {
              const since = c.answeredAt ?? c.startedAt;
              const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {c.direction === "inbound" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.contactName ?? c.numberDisplay}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.contactName ? `${c.numberDisplay} · ` : ""}
                      {c.answeredAt ? `Talking ${formatDuration(secs)}` : `${c.status.replace(/-/g, " ")} ${formatDuration(secs)}`}
                    </p>
                  </div>
                  {c.monitorable ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5" disabled={Boolean(active)}>
                          <Headphones className="h-3.5 w-3.5" /> Monitor
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {MODES.map(({ mode, label, hint, icon: Icon }) => (
                          <DropdownMenuItem key={mode} onSelect={() => start(c, mode)} className="flex items-start gap-2 py-2">
                            <Icon className="mt-0.5 h-4 w-4" />
                            <span>
                              <span className="block text-sm font-medium">{label}</span>
                              <span className="block text-xs text-muted-foreground">{hint}</span>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {!data.conferenceMode ? "Conference off" : !c.hasConference ? "Not monitorable" : "Ringing"}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
