"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthField } from "@/components/auth/auth-shell";

export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // The endpoint always answers ok so it never reveals whether an account exists.
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-4 font-serif text-2xl">Check your inbox</p>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, a password reset link is on its way. The link expires
          after a short time.
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-medium text-primary hover:underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <AuthField label="Email" htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      </AuthField>
      <Button type="submit" className="h-11 w-full" disabled={busy || !email}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send reset link
      </Button>
    </form>
  );
}
