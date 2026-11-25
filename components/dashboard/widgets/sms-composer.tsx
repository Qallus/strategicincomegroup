"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Megaphone, Send } from "lucide-react";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WidgetShell, type WidgetProps } from "./shell";

function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (raw.trim().startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

export default function SmsComposerWidget({ def, preview }: WidgetProps) {
  const token = useDashboardActionToken();
  const [to, setTo] = React.useState("");
  const [body, setBody] = React.useState("");
  const [state, setState] = React.useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });
  const segments = Math.max(1, Math.ceil(body.length / 160));
  const number = toE164(to);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number || !body.trim()) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/admin/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sig-action-token": token },
        body: JSON.stringify({ to: number, body: body.trim(), recipientType: "manual", actionToken: token }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "The text didn't send.");
      setState({ kind: "sent", message: `Sent to ${to}` });
      setBody("");
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "The text didn't send." });
    }
  };

  return (
    <WidgetShell
      icon={def.icon}
      title={def.title}
      tone="sage"
      href="/dashboard/sms"
      hrefLabel="SMS"
      actions={
        <Link href="/dashboard/sms?campaign=new" className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-gold/15 px-2 text-[11px] font-semibold text-[hsl(30_55%_35%)] hover:bg-brand-gold/25 dark:text-brand-gold">
          <Megaphone className="h-3.5 w-3.5" aria-hidden /> Bulk
        </Link>
      }
    >
      <form onSubmit={send} className="flex h-full flex-col gap-2">
        <Input
          value={to}
          onChange={(e) => { setTo(e.target.value); if (state.kind !== "sending") setState({ kind: "idle" }); }}
          placeholder="Mobile number, e.g. (480) 555-0100"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Recipient phone number"
          disabled={preview}
          className="h-9 bg-background/70"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1600))}
          placeholder="Write a message…"
          rows={3}
          aria-label="Message"
          disabled={preview}
          className="min-h-[5rem] flex-1 resize-none bg-background/70"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {body.length}/160 · {segments} segment{segments === 1 ? "" : "s"}
          </span>
          <Button type="submit" size="sm" disabled={preview || !number || !body.trim() || state.kind === "sending"}>
            {state.kind === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Send
          </Button>
        </div>
        {state.kind === "sent" ? (
          <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400" role="status"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {state.message}</p>
        ) : state.kind === "error" ? (
          <p className="text-[11px] text-destructive" role="alert">{state.message}</p>
        ) : to && !number ? (
          <p className="text-[11px] text-muted-foreground">Enter a 10-digit US number or a +country number.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Opt-outs are honoured automatically. Use Bulk to text a list.</p>
        )}
      </form>
    </WidgetShell>
  );
}
