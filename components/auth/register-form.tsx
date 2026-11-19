"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, MailCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthField, AuthMessage } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (p: string) => p.length >= 10, label: "At least 10 characters" },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: "Upper and lower case letters" },
  { test: (p: string) => /\d/.test(p), label: "At least one number" },
];

/**
 * Self-service client registration (Supabase email + password sign-up).
 * New sign-ups get no dashboard role — staff are still invited from the
 * dashboard — so an account only gains access once the team links it.
 */
export function RegisterForm() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const strong = RULES.every((r) => r.test(form.password));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!strong) return setError("Please choose a stronger password.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (!agree) return setError("Please accept the Terms of Service and Privacy Policy.");
    setBusy(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?message=Your email is confirmed. Sign in to continue.")}`,
        data: { first_name: form.firstName.trim(), last_name: form.lastName.trim(), signup_source: "website" },
      },
    });
    setBusy(false);
    if (signUpError) return setError(signUpError.message);
    setSentTo(form.email.trim());
  }

  if (sentTo) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-4 font-serif text-2xl">Check your email</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Click it to verify your address, then sign in.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <AuthField label="First name" htmlFor="firstName">
          <Input id="firstName" required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} className="h-11" />
        </AuthField>
        <AuthField label="Last name" htmlFor="lastName">
          <Input id="lastName" required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} className="h-11" />
        </AuthField>
      </div>
      <AuthField label="Email" htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} className="h-11" />
      </AuthField>
      <AuthField label="Password" htmlFor="password">
        <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} className="h-11" />
      </AuthField>
      {form.password ? (
        <ul className="grid gap-1 text-xs">
          {RULES.map((r) => {
            const ok = r.test(form.password);
            return (
              <li key={r.label} className={cn("flex items-center gap-1.5", ok ? "text-brand-sage" : "text-muted-foreground")}>
                {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {r.label}
              </li>
            );
          })}
        </ul>
      ) : null}
      <AuthField label="Confirm password" htmlFor="confirm">
        <Input id="confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className="h-11" />
      </AuthField>
      <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
        <span>
          I agree to the{" "}
          <Link href="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link> and{" "}
          <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
        </span>
      </label>
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create account
      </Button>
    </form>
  );
}
