"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthField, AuthMessage, AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell eyebrow="Account recovery" title="Set a new password">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </AuthShell>
      }
    >
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<"verifying" | "ready" | "error" | "done">("verifying");
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function run() {
      const tokenHash = params.get("token_hash");
      const type = params.get("type") || "recovery";
      if (tokenHash) {
        const { error: vErr } = await supabase.auth.verifyOtp({ type: type as "recovery", token_hash: tokenHash });
        if (!active) return;
        if (vErr) {
          setError("This reset link is invalid or has expired. Request a new one below.");
          setPhase("error");
          return;
        }
        setPhase("ready");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) setPhase("ready");
      else {
        setError("This reset link is invalid or has expired.");
        setPhase("error");
      }
    }
    run();
    return () => {
      active = false;
    };
  }, [params, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    setBusy(true);
    const { error: uErr } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (uErr) return setError(uErr.message);
    setPhase("done");
    setTimeout(() => router.push("/dashboard"), 1600);
  }

  if (phase === "verifying") {
    return (
      <AuthShell eyebrow="Account recovery" title="Set a new password">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verifying your reset link…
        </p>
      </AuthShell>
    );
  }
  if (phase === "error") {
    return (
      <AuthShell eyebrow="Account recovery" title="Reset link problem">
        <AuthMessage tone="error">{error}</AuthMessage>
        <div className="mt-5 grid gap-2">
          <Button asChild className="h-11 w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }
  if (phase === "done") {
    return (
      <AuthShell eyebrow="Account recovery" title="Password updated">
        <AuthMessage tone="success">You’re all set — taking you to your dashboard…</AuthMessage>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Set a new password" description="Choose a new password for your account.">
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="New password" htmlFor="pw">
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required className="h-11" />
        </AuthField>
        <AuthField label="Confirm password" htmlFor="pw2">
          <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required className="h-11" />
        </AuthField>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button type="submit" disabled={busy} className="h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Update password
        </Button>
      </form>
    </AuthShell>
  );
}
