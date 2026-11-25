// Pure call-stat helpers (client-safe). The "missed" rule matches
// components/dialer/dialer-dashboard.tsx: Twilio reported no-answer / busy, or an inbound
// call ended without ever being answered (rang out to voicemail).

export type CallLike = {
  direction: "inbound" | "outbound" | string;
  status: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url?: string | null;
  voicemail_url?: string | null;
};

export function isMissedCall(c: CallLike): boolean {
  return c.status === "no-answer" || c.status === "busy" || (c.direction === "inbound" && !c.answered_at && !!c.ended_at);
}

export type CallSummary = {
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  recorded: number;
  voicemails: number;
  talkTimeSeconds: number;
};

export function summarizeCalls(calls: CallLike[]): CallSummary {
  const s: CallSummary = { total: 0, inbound: 0, outbound: 0, missed: 0, recorded: 0, voicemails: 0, talkTimeSeconds: 0 };
  for (const c of calls) {
    s.total += 1;
    if (c.direction === "inbound") s.inbound += 1;
    if (c.direction === "outbound") s.outbound += 1;
    if (isMissedCall(c)) s.missed += 1;
    if (c.recording_url) s.recorded += 1;
    if (c.voicemail_url) s.voicemails += 1;
    s.talkTimeSeconds += Math.max(0, c.duration_seconds ?? 0);
  }
  return s;
}

export function formatTalkTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
