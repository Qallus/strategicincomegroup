"use client";

import * as React from "react";
import { AlertCircle, Loader2, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function RequestLinkForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const doneRef = React.useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter the email you booked with.");
      document.getElementById("bm-email")?.focus();
      return;
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/booking/manage/request", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Something went wrong. Please try again.");
      setDone(json.message || "If we have appointments for that email, we’ve sent a link.");
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="sig-book-in flex items-start gap-3 outline-none">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">{done}</p>
          <button type="button" className="mt-3 text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={() => { setDone(null); setEmail(""); }}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="bm-email" className="text-sm font-medium">Email you booked with</label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <Input
          id="bm-email" type="email" inputMode="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className="h-11 flex-1"
          aria-invalid={error ? true : undefined} aria-describedby={error ? "bm-email-error" : undefined}
        />
        <Button type="submit" className="h-11 px-5" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Email me a link
        </Button>
      </div>
      {error ? (
        <p id="bm-email-error" role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {error}
        </p>
      ) : null}
    </form>
  );
}
