"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const CONSENT =
  "By checking this box, I agree to receive the Strategic Income Group Newsletter via email. Messages may include links to pages on strategicincomegroup.com. Message frequency varies (typically 1 to 2 emails each month).";

/** Footer newsletter sign-up (dark footer surface). */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Please check the consent box to subscribe.");
      return;
    }
    setState("busy");
    const hp = new FormData(e.currentTarget).get("company_website");
    const res = await fetch("/api/public/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType: "newsletter", email, consent, consentText: CONSENT, source: "footer", company_website: hp }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-white/85">
        <Check className="h-4 w-4 text-brand-gold" /> You’re subscribed. Watch your inbox for Strategic Insights.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="footer-email" className="text-sm font-medium text-white">
        Email <span className="text-brand-gold">*</span>
      </label>
      <div className="flex gap-2">
        <input
          id="footer-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 min-w-0 flex-1 rounded-md border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          aria-label="Subscribe"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-gold px-4 text-sm font-semibold text-[hsl(225_80%_10%)] transition hover:brightness-110 disabled:opacity-60"
        >
          {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Subscribe <ArrowRight className="h-3.5 w-3.5" /></>}
        </button>
      </div>
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-white/65">
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          wrapperClassName="mt-0.5"
          className="border-white/40 bg-transparent text-[hsl(225_80%_10%)] peer-checked:border-brand-gold peer-checked:bg-brand-gold peer-focus-visible:ring-brand-gold peer-focus-visible:ring-offset-transparent"
        />
        <span>
          <strong className="font-medium text-white/85">Newsletter Email Consent:</strong> {CONSENT} See our{" "}
          <a href="/privacy-policy" className="underline underline-offset-2 hover:text-white">Privacy Policy</a> and{" "}
          <a href="/terms-of-service" className="underline underline-offset-2 hover:text-white">Terms of Service</a>.
        </span>
      </label>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </form>
  );
}
