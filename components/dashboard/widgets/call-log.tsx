"use client";

import * as React from "react";
import { ArrowLeft, FileText, History, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Voicemail } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeRequest, widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { CallLogItem } from "@/lib/dashboard/data/comms";
import { formatDuration, formatTalkTime, type CallSummary } from "@/lib/voice/format";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWidgetData } from "../use-widget-data";
import { RecordingButton } from "./latest-transcript";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, formatPhone, relativeTime, useNow, type WidgetProps } from "./shell";

type Data = { calls: CallLogItem[]; summary: CallSummary; firm: boolean; number: string | null; unavailable: boolean };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "inbound", label: "In" },
  { value: "outbound", label: "Out" },
  { value: "missed", label: "Missed" },
  { value: "recorded", label: "Rec" },
];

function CallIcon({ c }: { c: CallLogItem }) {
  const Icon = c.missed ? PhoneMissed : c.voicemailUrl ? Voicemail : c.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", c.missed ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-brand-navy/[0.07] text-brand-navy dark:bg-brand-gold/10 dark:text-brand-gold")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

export default function CallLogWidget({ widget, def, preview, onSettingsChange }: WidgetProps) {
  const filter = String(widget.settings.filter ?? "all");
  const [number, setNumber] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<CallLogItem | null>(null);
  const base = React.useMemo(() => widgetRequest(widget), [widget]);
  const req = React.useMemo(() => (number && base ? makeRequest("call_log", { ...base.params, number, filter: "all" }) : base), [base, number]);
  const { data, error, status, loading, refresh } = useWidgetData<Data>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const now = useNow();
  const s = data?.summary;

  return (
    <WidgetShell
      icon={def.icon}
      title={number ? `History · ${formatPhone(number)}` : def.title}
      subtitle={s ? `${formatTalkTime(s.talkTimeSeconds)} talk time · ${s.total} calls in 30 days${data?.firm ? " · firm" : ""}` : undefined}
      href="/dashboard/dialer"
      hrefLabel="Dialer"
      tone="navy"
      actions={
        number ? (
          <button type="button" onClick={() => setNumber(null)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All calls
          </button>
        ) : null
      }
    >
      {!number ? (
        <ToggleGroup
          type="single"
          size="sm"
          value={filter}
          onValueChange={(v) => v && onSettingsChange?.({ filter: v })}
          className="mb-2.5 w-full justify-between sm:w-auto"
          aria-label="Filter calls"
          disabled={preview}
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="flex-1 sm:flex-none">{f.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : s ? (
        <div className="mb-2.5 grid grid-cols-4 gap-1.5 text-center text-[11px]">
          {[["In", s.inbound], ["Out", s.outbound], ["Missed", s.missed], ["Talk", formatTalkTime(s.talkTimeSeconds)]].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg bg-muted/60 py-1.5"><p className="text-muted-foreground">{l}</p><p className="font-semibold tabular-nums">{v}</p></div>
          ))}
        </div>
      ) : null}

      {loading && !data ? (
        <WidgetSkeleton lines={5} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !data?.calls.length ? (
        <WidgetEmpty icon={PhoneCall}>{data?.unavailable ? "Calls aren't available yet." : "No calls to show."}</WidgetEmpty>
      ) : (
        <ul className="-mx-1 max-h-[19rem] space-y-0.5 overflow-y-auto pr-1 sig-noscroll">
          {data.calls.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-muted/60">
              <CallIcon c={c} />
              <button type="button" disabled={preview || Boolean(number)} onClick={() => setNumber(c.number)} className="min-w-0 flex-1 text-left" title="Show history for this number">
                <span className="block truncate text-[13px] font-medium">{c.name || formatPhone(c.number)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {relativeTime(c.createdAt, now)} · {c.missed ? "Missed" : formatDuration(c.duration)}
                  {c.name ? ` · ${formatPhone(c.number)}` : ""}
                </span>
              </button>
              <span className="flex shrink-0 items-center gap-1">
                {c.transcript && !preview ? (
                  <button type="button" onClick={() => setTranscript(c)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Read transcript" title="Transcript">
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {!number && !preview ? (
                  <button type="button" onClick={() => setNumber(c.number)} className="hidden h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground group-hover:flex" aria-label="History for this number" title="History">
                    <History className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {(c.recordingUrl || c.voicemailUrl) && !preview ? (
                  <audio controls preload="none" src={(c.recordingUrl || c.voicemailUrl)!} className="hidden h-7 w-36 xl:block" aria-label="Recording" />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={Boolean(transcript)} onOpenChange={(v) => !v && setTranscript(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {transcript ? (
            <>
              <SheetHeader>
                <SheetTitle>Call transcript</SheetTitle>
                <SheetDescription>
                  {transcript.direction === "outbound" ? "Outbound to" : "Inbound from"} {transcript.name || formatPhone(transcript.number)} · {new Date(transcript.createdAt).toLocaleString()} · {formatDuration(transcript.duration)}
                </SheetDescription>
              </SheetHeader>
              {transcript.recordingUrl ? <div className="mt-4"><RecordingButton url={transcript.recordingUrl} /></div> : null}
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{transcript.transcript}</p>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </WidgetShell>
  );
}
