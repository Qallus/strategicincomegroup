"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthMessage } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/browser";

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

type Mode = { kind: "loading" } | { kind: "signed-out" } | { kind: "verify"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string };

/**
 * TOTP second factor (Supabase Auth MFA).
 * - Account with a verified authenticator → challenge + verify the 6-digit code.
 * - Signed-in account without one (or ?setup=1) → enroll: scan the QR code, then verify.
 */
export function TwoFactorForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) return setMode({ kind: "signed-out" });
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (listError) {
        setError(listError.message);
        return setMode({ kind: "signed-out" });
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified && params.get("setup") !== "1") return setMode({ kind: "verify", factorId: verified.id });
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `SIG ${new Date().toISOString().slice(0, 10)}` });
      if (!active) return;
      if (enrollError || !enrolled) {
        setError(enrollError?.message ?? "Could not start authenticator setup.");
        return setMode({ kind: "signed-out" });
      }
      setMode({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
    return () => {
      active = false;
    };
  }, [supabase, params]);

  const code = digits.join("");

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste of the whole code.
      const arr = clean.slice(0, 6).split("");
      setDigits((d) => d.map((_, j) => arr[j] ?? ""));
      inputs.current[Math.min(arr.length, 5)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, j) => (j === i ? clean : x)));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (mode.kind !== "verify" && mode.kind !== "enroll") return;
    if (code.length !== 6) return setError("Enter all 6 digits.");
    setBusy(true);
    setError("");
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code });
    setBusy(false);
    if (vErr) {
      setError("That code didn’t match. Check your authenticator app and try again.");
      setDigits(Array(6).fill(""));
      inputs.current[0]?.focus();
      return;
    }
    window.location.assign(next);
  }

  useEffect(() => {
    if (code.length === 6 && !busy) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (mode.kind === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your sign-in…
      </p>
    );
  }

  if (mode.kind === "signed-out") {
    return (
      <div className="space-y-4">
        <AuthMessage tone="info">{error || "Your session has expired. Sign in with your email and password first."}</AuthMessage>
        <Button asChild className="h-11 w-full">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-6">
      {mode.kind === "enroll" ? (
        <div className="rounded-xl border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-gold" /> Set up your authenticator
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open Google Authenticator, 1Password, Authy or Microsoft Authenticator.</li>
            <li>Scan this QR code (or enter the key below).</li>
            <li>Type the 6-digit code it shows.</li>
          </ol>
          <div className="mt-4 flex justify-center rounded-lg bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mode.qr} alt="Authenticator QR code" className="h-40 w-40" />
          </div>
          <p className="mt-3 break-all rounded-md bg-muted px-3 py-2 text-center font-mono text-xs">{mode.secret}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-gold" /> Open your authenticator app to view your current code.
        </div>
      )}

      <fieldset>
        <legend className="sr-only">6-digit code</legend>
        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              maxLength={6}
              autoFocus={i === 0}
              className="h-14 w-full min-w-0 rounded-md border border-input bg-background text-center font-mono text-2xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ))}
        </div>
      </fieldset>

      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

      <Button type="submit" className="h-11 w-full" disabled={busy || code.length !== 6}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {mode.kind === "enroll" ? "Turn on two-factor" : "Verify"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Lost access to your authenticator? Call <a href="tel:+14804667070" className="text-primary hover:underline">(480) 466-7070</a> and our team will help.
      </p>
    </form>
  );
}
