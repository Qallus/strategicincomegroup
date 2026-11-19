"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthField, AuthMessage } from "@/components/auth/auth-shell";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { createClient } from "@/lib/supabase/browser";

/** Same-origin paths only (see app/login/page.tsx). */
function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get("next"));
  const message = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(message);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"password" | "magic" | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

  async function handleSignInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setLoading("password");

    const res = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      setError(data.error ?? "Sign-in failed.");
      setLoading(null);
      return;
    }

    // The route handler wrote the session cookies. If the account has an
    // authenticator enrolled, finish sign-in with the second factor first.
    try {
      const supabase = createClient();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        window.location.assign(`/two-factor?next=${encodeURIComponent(nextPath)}`);
        return;
      }
    } catch {
      /* MFA check unavailable — continue with the password session */
    }
    window.location.assign(nextPath);
  }

  async function sendMagicLink() {
    setError(null);
    setStatus(null);
    if (!email) {
      setError("Enter your email first, then request the sign-in link.");
      return;
    }
    setLoading("magic");
    const supabase = createClient();
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setLoading(null);
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setStatus("Check your email for a secure sign-in link.");
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSignInWithPassword}>
        <AuthField label="Email" htmlFor="email">
          <Input id="email" autoComplete="email" inputMode="email" name="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} className="h-11" />
        </AuthField>
        <AuthField
          label="Password"
          htmlFor="password"
          hint={
            <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        >
          <div className="relative">
            <Input
              id="password"
              autoComplete="current-password"
              className="h-11 pr-10"
              name="password"
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              value={password}
              required
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setShowPassword((v) => !v)}
              type="button"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {status ? <AuthMessage tone="info">{status}</AuthMessage> : null}
        <Button className="h-11 w-full" disabled={loading !== null || !email || !password} type="submit">
          {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading === "password" ? "Signing in…" : "Sign in"}
        </Button>
        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-background px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        </div>
        <Button className="h-11 w-full" disabled={loading !== null} onClick={sendMagicLink} type="button" variant="outline">
          <Mail className="h-4 w-4" />
          {loading === "magic" ? "Sending link…" : "Email me a sign-in link"}
        </Button>
      </form>
      <div className="mt-6">
        <InstallAppButton fullWidth responsiveLabel={false} label="Install the SIG App" caption="Get the app on your desktop or phone — no app store needed." />
      </div>
    </div>
  );
}
