import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Split-screen frame for every auth page (login, register, forgot/reset password, 2FA):
 * a navy brand panel on large screens and a centred form card.
 */
export function AuthShell({
  eyebrow = "Secure sign-in",
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.1fr]">
      <section className="sig-on-navy relative hidden overflow-hidden bg-[hsl(225_95%_15%)] p-12 text-white dark:bg-[hsl(228_60%_5%)] lg:flex lg:flex-col lg:justify-between">
        <div className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden />
        <Link href="/" className="relative block h-11 w-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sig-logo-white.png" alt="Strategic Income Group" className="h-full w-full object-contain object-left" />
        </Link>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">Strategic Income Group</p>
          <h2 className="mt-4 font-serif text-5xl leading-tight">
            Strategize. Invest. <em className="text-brand-gold">Give.</em>
          </h2>
          <p className="mt-4 text-white/70">Financial solutions for every phase of life — your plan, documents and team, behind secure sign-in.</p>
          <p className="mt-8 flex items-center gap-2 text-sm text-white/60">
            <ShieldCheck className="h-4 w-4 text-brand-gold" /> Protected with encryption and two-factor authentication.
          </p>
        </div>
        <p className="relative text-xs text-white/50">Chandler · Peoria · (480) 466-7070</p>
      </section>

      <section className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <Link href="/" className="mb-8 block lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/sig-logo.png" alt="Strategic Income Group" className="h-9 w-auto dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/sig-logo-white.png" alt="" aria-hidden className="hidden h-9 w-auto dark:block" />
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">{title}</h1>
            {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

export function AuthMessage({ tone, children }: { tone: "error" | "info" | "success"; children: React.ReactNode }) {
  const cls =
    tone === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "success"
        ? "border-brand-sage/30 bg-brand-sage/10 text-foreground"
        : "border-primary/20 bg-primary/5 text-foreground";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${cls}`}>
      {children}
    </p>
  );
}
