"use client";

import * as React from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { WidgetShell, type WidgetProps } from "./shell";

type Note = { id: string; title: string; body: string; updated_at: string };

export async function appendToNotepad(token: string, text: string): Promise<boolean> {
  const cur = await fetch("/api/me/notepad", { headers: { "x-sig-action-token": token } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const note = (cur?.note ?? null) as Note | null;
  const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const body = `${note?.body ? `${note.body.trimEnd()}\n\n` : ""}🎙 Voice memo — ${stamp}\n${text}`;
  const res = await fetch("/api/me/notepad", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-sig-action-token": token },
    body: JSON.stringify({ id: note?.id, title: note?.title ?? "Notes", body, actionToken: token }),
  }).catch(() => null);
  if (res?.ok) window.dispatchEvent(new CustomEvent("sig:notepad-updated"));
  return Boolean(res?.ok);
}

export default function NotepadWidget({ widget, def, preview, onSettingsChange }: WidgetProps) {
  const token = useDashboardActionToken();
  const noteId = typeof widget.settings.noteId === "string" ? widget.settings.noteId : null;
  const [note, setNote] = React.useState<Note | null>(null);
  const [body, setBody] = React.useState("");
  const [state, setState] = React.useState<"loading" | "idle" | "saving" | "saved" | "error" | "missing">("loading");
  const dirty = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = React.useRef<string | null>(noteId);

  const load = React.useCallback(async () => {
    if (preview) return setState("idle");
    const res = await fetch(`/api/me/notepad${idRef.current ? `?id=${idRef.current}` : ""}`, { headers: { "x-sig-action-token": token } }).catch(() => null);
    if (!res) return setState("error");
    const j = (await res.json().catch(() => ({}))) as { note?: Note | null; migrationMissing?: boolean };
    if (j.migrationMissing) return setState("missing");
    if (!res.ok) return setState("error");
    if (!dirty.current) {
      setNote(j.note ?? null);
      setBody(j.note?.body ?? "");
      idRef.current = j.note?.id ?? idRef.current;
    }
    setState("idle");
  }, [preview, token]);

  React.useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener("sig:notepad-updated", on);
    return () => window.removeEventListener("sig:notepad-updated", on);
  }, [load]);

  const save = React.useCallback(
    async (text: string) => {
      setState("saving");
      const res = await fetch("/api/me/notepad", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-sig-action-token": token },
        body: JSON.stringify({ id: idRef.current, title: note?.title ?? "Notes", body: text, actionToken: token }),
      }).catch(() => null);
      const j = res ? ((await res.json().catch(() => ({}))) as { note?: Note; migrationMissing?: boolean }) : {};
      if (j.migrationMissing) return setState("missing");
      if (!res?.ok || !j.note) return setState("error");
      dirty.current = false;
      setNote(j.note);
      if (j.note.id !== idRef.current) {
        idRef.current = j.note.id;
        onSettingsChange?.({ noteId: j.note.id });
      }
      setState("saved");
    },
    [token, note?.title, onSettingsChange],
  );

  const onChange = (v: string) => {
    setBody(v);
    dirty.current = true;
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(v), 900);
  };

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const status =
    state === "saving" ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving</span>
    : state === "saved" ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" aria-hidden /> Saved</span>
    : state === "error" ? <span className="inline-flex items-center gap-1 text-destructive"><CloudOff className="h-3 w-3" aria-hidden /> Not saved</span>
    : null;

  return (
    <WidgetShell icon={def.icon} title={def.title} subtitle={note?.updated_at && state !== "saving" ? `Edited ${new Date(note.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : undefined} actions={<span className="text-[11px] text-muted-foreground" aria-live="polite">{status}</span>}>
      {state === "missing" ? (
        <p className="text-xs text-muted-foreground">Notes need the dashboard migration (202611250220_dashboard.sql) before they can be saved.</p>
      ) : (
        <textarea
          value={body}
          onChange={(e) => onChange(e.target.value)}
          disabled={preview || state === "loading"}
          placeholder={state === "loading" ? "Loading…" : "Jot something down — it saves as you type."}
          aria-label="Notepad"
          className="h-full min-h-[10rem] w-full resize-none rounded-xl border border-border/60 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,hsl(var(--border)/0.55)_23px,hsl(var(--border)/0.55)_24px)] bg-background/50 px-3 py-[3px] text-[13px] leading-6 outline-none transition placeholder:text-muted-foreground focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
        />
      )}
    </WidgetShell>
  );
}
