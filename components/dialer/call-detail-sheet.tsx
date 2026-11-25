"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Mic, NotebookPen, PhoneIncoming, PhoneOutgoing, RotateCcw, Sparkles, Voicemail, Check } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { formatCost, formatDuration, formatWhen } from "./format";

export type DialerCall = {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  number_display?: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  voicemail_url: string | null;
  transcription_text: string | null;
  transcription_status: string | null;
  voicemail_transcription: string | null;
  price: number | null;
  price_unit: string | null;
  notes: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at?: string;
  participants: { first_name: string; last_name: string } | null;
  profiles: { full_name: string } | null;
  handled_by_profile?: { full_name: string | null } | null;
  contact?: { name: string | null; kind: string; id: string } | null;
};

export function callContactName(c: DialerCall) {
  if (c.contact?.name) return c.contact.name;
  if (c.participants) return `${c.participants.first_name ?? ""} ${c.participants.last_name ?? ""}`.trim() || null;
  return c.profiles?.full_name ?? null;
}

export function callNumber(c: DialerCall) {
  return c.direction === "inbound" ? c.from_number : c.to_number;
}

export function CallStatusBadge({ status, missed }: { status: string; missed?: boolean }) {
  if (missed) return <Badge variant="destructive" className="text-[11px]">Missed</Badge>;
  const variant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    "in-progress": "default",
    failed: "destructive",
    "no-answer": "secondary",
    busy: "secondary",
    canceled: "outline",
    ringing: "secondary",
    initiated: "secondary",
  };
  return (
    <Badge variant={variant[status] ?? "outline"} className="text-[11px] capitalize">
      {status.replace(/-/g, " ")}
    </Badge>
  );
}

export function CallDetailSheet({
  call,
  open,
  onOpenChange,
  onUpdated,
  onCallBack,
}: {
  call: DialerCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (call: DialerCall) => void;
  onCallBack?: (number: string) => void;
}) {
  const actionToken = useDashboardActionToken();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [busy, setBusy] = useState<"recording" | "voicemail" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(call?.notes ?? "");
    setNotesSaved(false);
    setError(null);
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!call) return null;
  const name = callContactName(call);
  const number = callNumber(call);
  const pending = call.transcription_status === "pending";

  async function saveNotes() {
    if (!call) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/voice/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, notes }),
      });
      if (res.ok) {
        onUpdated({ ...call, notes });
        setNotesSaved(true);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function transcribe(target: "recording" | "voicemail") {
    if (!call) return;
    setBusy(target);
    setError(null);
    try {
      const res = await fetch(`/api/admin/voice/calls/${call.id}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        onUpdated({
          ...call,
          transcription_status: "completed",
          ...(target === "voicemail" ? { voicemail_transcription: data.text } : { transcription_text: data.text }),
        });
      } else setError(data.error ?? "Transcription failed.");
    } catch {
      setError("Transcription failed.");
    } finally {
      setBusy(null);
    }
  }

  async function copyTranscript(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 pb-4 pt-6 text-left">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {call.direction === "inbound" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
            {call.direction} call · {formatWhen(call.started_at ?? call.created_at)}
          </div>
          <SheetTitle className="text-xl">{name ?? call.number_display ?? number}</SheetTitle>
          <SheetDescription className="font-mono text-sm">{call.number_display ?? number}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CallStatusBadge status={call.status} />
            {call.duration_seconds != null ? <Badge variant="outline" className="text-[11px]">{formatDuration(call.duration_seconds)}</Badge> : null}
            {call.price != null ? <Badge variant="outline" className="text-[11px] tabular-nums">{formatCost(call.price, call.price_unit)}</Badge> : null}
            {call.handled_by_profile?.full_name ? <Badge variant="secondary" className="text-[11px]">Handled by {call.handled_by_profile.full_name}</Badge> : null}
          </div>
          {onCallBack && number && !number.startsWith("client:") ? (
            <div className="pt-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { onCallBack(number); onOpenChange(false); }}>
                <RotateCcw className="h-3.5 w-3.5" /> Call back
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-5">
          {call.recording_url ? (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Recording</h3>
              <audio controls preload="none" className="h-10 w-full">
                <source src={call.recording_url} type="audio/mpeg" />
              </audio>
              <Transcript
                text={call.transcription_text}
                pending={pending && !call.transcription_text}
                busy={busy === "recording"}
                onTranscribe={() => transcribe("recording")}
                onCopy={copyTranscript}
                copied={copied}
              />
            </section>
          ) : null}

          {call.voicemail_url || call.voicemail_transcription ? (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><Voicemail className="h-3.5 w-3.5" /> Voicemail</h3>
              {call.voicemail_url ? (
                <audio controls preload="none" className="h-10 w-full">
                  <source src={call.voicemail_url} type="audio/mpeg" />
                </audio>
              ) : null}
              <Transcript
                text={call.voicemail_transcription}
                pending={false}
                busy={busy === "voicemail"}
                onTranscribe={call.voicemail_url ? () => transcribe("voicemail") : undefined}
                onCopy={copyTranscript}
                copied={copied}
              />
            </section>
          ) : null}

          {!call.recording_url && !call.voicemail_url && !call.voicemail_transcription ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No recording or voicemail for this call.</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><NotebookPen className="h-3.5 w-3.5" /> Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Add notes about this call…"
              rows={4}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveNotes} disabled={savingNotes || notes === (call.notes ?? "")} className="gap-1.5">
                {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5" />}
                Save notes
              </Button>
              {notesSaved ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );

}

function Transcript({ text, pending, busy, onTranscribe, onCopy, copied }: { text: string | null; pending: boolean; busy: boolean; onTranscribe?: () => void; onCopy: (t: string) => void; copied: boolean }) {
  if (text) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript</span>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => onCopy(text)}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6">{text}</p>
      </div>
    );
  }
  if (pending) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing automatically…</p>;
  }
  if (!onTranscribe) return null;
  return (
    <Button size="sm" variant="outline" onClick={onTranscribe} disabled={busy} className="gap-1.5">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {busy ? "Transcribing…" : "Transcribe"}
    </Button>
  );
}
