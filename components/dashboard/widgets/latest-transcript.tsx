"use client";

import * as React from "react";
import { FileText, PhoneIncoming, PhoneOutgoing, Play, Square } from "lucide-react";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { CallLogItem } from "@/lib/dashboard/data/comms";
import { formatDuration } from "@/lib/voice/format";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWidgetData } from "../use-widget-data";
import { WidgetEmpty, WidgetError, WidgetShell, WidgetSkeleton, formatPhone, relativeTime, type WidgetProps } from "./shell";

export function RecordingButton({ url, label = "Play recording" }: { url: string; label?: string }) {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  React.useEffect(() => () => ref.current?.pause(), []);
  const toggle = () => {
    if (!ref.current) {
      ref.current = new Audio(url);
      ref.current.onended = () => setPlaying(false);
      ref.current.onpause = () => setPlaying(false);
    }
    if (playing) ref.current.pause();
    else void ref.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-navy px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-navy/90 dark:bg-brand-gold dark:text-brand-navy-deep"
      aria-pressed={playing}
    >
      {playing ? <Square className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
      {playing ? "Stop" : label}
    </button>
  );
}

export default function LatestTranscriptWidget({ widget, def, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<{ call: CallLogItem | null; firm: boolean }>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const [open, setOpen] = React.useState(false);
  const call = data?.call;
  const Dir = call?.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;

  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/dialer" hrefLabel="Dialer" tone="navy">
      {loading && !data ? (
        <WidgetSkeleton lines={4} />
      ) : error ? (
        <WidgetError error={error} status={status} onRetry={refresh} />
      ) : !call ? (
        <WidgetEmpty icon={FileText}>No transcribed calls yet. Recordings are transcribed after each call.</WidgetEmpty>
      ) : (
        <div className="flex h-full flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Dir className="h-3.5 w-3.5 text-brand-gold" aria-hidden />
            <span className="truncate font-medium text-foreground">{call.name || formatPhone(call.number)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{relativeTime(call.createdAt)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0 tabular-nums">{formatDuration(call.duration)}</span>
          </div>
          <blockquote className="line-clamp-5 border-l-2 border-brand-gold/60 pl-3 text-[13px] leading-relaxed text-foreground/90">{call.transcript}</blockquote>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {call.recordingUrl && !preview ? <RecordingButton url={call.recordingUrl} /> : null}
            {!preview ? (
              <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition hover:border-brand-gold/50">
                <FileText className="h-3 w-3" aria-hidden /> Full transcript
              </button>
            ) : null}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Call transcript</SheetTitle>
                <SheetDescription>
                  {call.direction === "outbound" ? "Outbound to" : "Inbound from"} {call.name ? `${call.name} (${formatPhone(call.number)})` : formatPhone(call.number)} · {new Date(call.createdAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              {call.recordingUrl ? <audio controls preload="none" src={call.recordingUrl} className="mt-4 w-full" /> : null}
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{call.transcript}</p>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </WidgetShell>
  );
}
