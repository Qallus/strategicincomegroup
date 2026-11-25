"use client";

import * as React from "react";
import { Download, FileText, Loader2, Mic, NotebookPen, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { appendToNotepad } from "./notepad";
import { WidgetShell, type WidgetProps } from "./shell";

// Voice memo (MediaRecorder), adapted from RecorderDialog in components/workspace/plate-editor.tsx.
// Transcription uses /api/workspace/transcribe, which is super-admin only — everyone else
// can still record, play back and download; the transcript button explains why it's off.

type Status = "idle" | "recording" | "recorded" | "transcribing";

export default function RecorderWidget({ def, preview }: WidgetProps) {
  const token = useDashboardActionToken();
  const [status, setStatus] = React.useState<Status>("idle");
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const rec = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const blob = React.useRef<Blob | null>(null);
  const tick = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = React.useRef<number | null>(null);
  const audioCtx = React.useRef<AudioContext | null>(null);

  const cleanup = () => {
    if (tick.current) clearInterval(tick.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  };
  React.useEffect(() => () => {
    cleanup();
    try { rec.current?.stop(); } catch { /* not recording */ }
  }, []);

  const start = async () => {
    setError(null);
    setTranscript(null);
    setSaved(false);
    if (typeof window === "undefined" || !("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        const b = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        blob.current = b;
        setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
        setStatus("recorded");
        stream.getTracks().forEach((t) => t.stop());
        cleanup();
      };
      // Input level meter.
      try {
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch { /* meter is optional */ }
      rec.current = r;
      r.start();
      setElapsed(0);
      tick.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setStatus("recording");
    } catch {
      setError("Microphone permission was denied.");
      setStatus("idle");
    }
  };

  const stop = () => {
    try { rec.current?.stop(); } catch { /* already stopped */ }
  };

  const transcribe = async () => {
    if (!blob.current) return;
    setStatus("transcribing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob.current], `memo-${Date.now()}.webm`, { type: blob.current.type || "audio/webm" }));
      const res = await fetch("/api/workspace/transcribe", { method: "POST", headers: { "x-sig-action-token": token }, body: fd });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (res.status === 403) setError("Transcription is limited to super admins. You can still download the memo.");
      else if (!res.ok) setError(data.error || "Transcription failed.");
      else setTranscript(data.text || "(No speech detected.)");
    } catch {
      setError("Transcription failed. Please try again.");
    }
    setStatus("recorded");
  };

  const saveToNotes = async () => {
    if (!transcript) return;
    const ok = await appendToNotepad(token, transcript);
    setSaved(ok);
    if (!ok) setError("Couldn't save to your notepad.");
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const bars = 18;

  return (
    <WidgetShell icon={def.icon} title={def.title} subtitle={status === "recording" ? `Recording · ${mmss}` : status === "recorded" ? "Ready" : "Voice memo"} tone="red">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={preview || status === "transcribing"}
            onClick={status === "recording" ? stop : start}
            className={cn(
              "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              status === "recording" ? "bg-red-600 shadow-red-600/30" : "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/25 hover:scale-105 motion-reduce:hover:scale-100",
            )}
            aria-label={status === "recording" ? "Stop recording" : status === "recorded" ? "Record again" : "Start recording"}
          >
            {status === "recording" ? <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30 motion-reduce:hidden" aria-hidden /> : null}
            {status === "recording" ? <Square className="relative h-5 w-5" /> : status === "recorded" ? <RotateCcw className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
          </button>
          <div className="flex h-10 flex-1 items-center gap-[3px]" aria-hidden>
            {Array.from({ length: bars }).map((_, i) => {
              const wave = status === "recording" ? Math.max(0.12, level * (0.55 + 0.45 * Math.sin((i / bars) * Math.PI))) : 0.12;
              return <span key={i} className={cn("w-1 flex-1 rounded-full transition-[height] duration-100", status === "recording" ? "bg-red-500/80" : "bg-muted-foreground/25")} style={{ height: `${Math.round(wave * 100)}%` }} />;
            })}
          </div>
        </div>

        {url && status !== "recording" ? <audio controls src={url} className="h-9 w-full" aria-label="Your recording" /> : null}

        {url && status !== "recording" ? (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={transcribe} disabled={status === "transcribing"} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition hover:border-brand-gold/50 disabled:opacity-60">
              {status === "transcribing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}
              {status === "transcribing" ? "Transcribing…" : "Transcribe"}
            </button>
            <a href={url} download={`voice-memo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.webm`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition hover:border-brand-gold/50">
              <Download className="h-3.5 w-3.5" aria-hidden /> Download
            </a>
          </div>
        ) : null}

        {transcript ? (
          <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
            <p className="line-clamp-4 text-xs leading-relaxed">{transcript}</p>
            <button type="button" onClick={saveToNotes} disabled={saved} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-navy hover:underline disabled:no-underline disabled:opacity-70 dark:text-brand-gold">
              <NotebookPen className="h-3 w-3" aria-hidden /> {saved ? "Saved to your notepad" : "Save to notepad"}
            </button>
          </div>
        ) : null}
        {error ? <p className="text-[11px] text-destructive" role="alert">{error}</p> : null}
        {!url && !error && status === "idle" ? <p className="text-[11px] text-muted-foreground">Tap the mic to record a quick memo. Audio stays on this device until you download it.</p> : null}
      </div>
    </WidgetShell>
  );
}
