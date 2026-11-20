"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, Briefcase, Check, CheckCircle2, Compass, Landmark, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JOBS } from "@/lib/public-site/careers";
import { PLANNERS } from "@/lib/public-site/team";
import { cn } from "@/lib/utils";

type OptionKey = "new_client" | "client_service" | "investment_committee" | "career_interest";

const OPTIONS: {
  key: OptionKey;
  icon: typeof Compass;
  title: string;
  blurb: string;
  eyebrow: string;
  heading: string;
  sub: string;
  submit: string;
  messageLabel: string;
  messagePlaceholder: string;
  messageRequired?: boolean;
}[] = [
  {
    key: "new_client",
    icon: Compass,
    title: "Start planning",
    blurb: "New to SIG? Book a free consultation with a CFP® professional.",
    eyebrow: "New clients",
    heading: "Tell us about your goals",
    sub: "A few details help us match you with the right planner. Only the starred fields are required.",
    submit: "Request a consultation",
    messageLabel: "Anything else we should know?",
    messagePlaceholder: "Your timeline, questions, or what prompted you to reach out…",
  },
  {
    key: "client_service",
    icon: Users,
    title: "Current client",
    blurb: "Service requests, documents, reviews and account questions.",
    eyebrow: "Client service",
    heading: "How can our team help?",
    sub: "Your request goes straight to the client service team and your planner.",
    submit: "Send service request",
    messageLabel: "Request details",
    messagePlaceholder: "Describe what you need. Please don’t include full account or Social Security numbers.",
    messageRequired: true,
  },
  {
    key: "investment_committee",
    icon: Landmark,
    title: "Investment Committee",
    blurb: "Fund companies, managers and partners with an investment offering.",
    eyebrow: "Investment Committee",
    heading: "Tell us about your offering",
    sub: "Our Investment Committee reviews every submission. If it’s a fit for our clients, a committee member will reach out — please don’t call the main line.",
    submit: "Submit to the committee",
    messageLabel: "Brief overview",
    messagePlaceholder: "What it is, who it’s for, how it fits a fiduciary planning practice, and any track record or materials we should review…",
    messageRequired: true,
  },
  {
    key: "career_interest",
    icon: Briefcase,
    title: "Careers",
    blurb: "Apply for an open role or join our candidate waitlist.",
    eyebrow: "Join our team",
    heading: "Tell us about yourself",
    sub: "We actively build a waitlist of qualified candidates for immediate and future opportunities.",
    submit: "Send career application",
    messageLabel: "Why SIG?",
    messagePlaceholder: "A brief cover note: your experience and why this work feels like a calling…",
    messageRequired: true,
  },
];

const TOPIC_TO_OPTION: Record<string, OptionKey> = {
  careers: "career_interest",
  investments: "investment_committee",
  "investment-committee": "investment_committee",
  "403b": "new_client",
  client: "client_service",
  service: "client_service",
};

const HELP_WITH = ["Financial planning", "Investments", "Retirement income", "Estate planning", "Insurance", "Tax planning", "Charitable giving"];

export function ContactExperience({ topic, role }: { topic?: string; role?: string }) {
  const [selected, setSelected] = useState<OptionKey>(TOPIC_TO_OPTION[topic ?? ""] ?? "new_client");
  const [sent, setSent] = useState<OptionKey | null>(null);
  const option = OPTIONS.find((o) => o.key === selected)!;

  return (
    <div id="contact-form" className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-serif text-3xl">How can we help?</h2>
        <p className="text-sm text-muted-foreground">Choose one of 4 options. The form below changes to match.</p>
      </div>

      <div role="radiogroup" aria-label="What are you contacting us about?" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OPTIONS.map((o, i) => {
          const on = o.key === selected;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setSelected(o.key);
                setSent(null);
              }}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-4 text-left transition",
                on ? "border-foreground/80 bg-muted/60 shadow-sm ring-1 ring-foreground/80" : "hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", on ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                    {i + 1}
                  </span>
                  <o.icon className="h-4 w-4 text-gold" />
                </span>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", on && "border-foreground bg-foreground text-background")}>
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
              </span>
              <span className="mt-3 font-semibold">{o.title}</span>
              <span className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{o.blurb}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium">
                {on ? (
                  <>
                    Selected <ArrowDown className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Choose this <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex items-start gap-4 border-b pb-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted">
            <option.icon className="h-5 w-5 text-gold" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{option.eyebrow}</p>
            <h3 className="font-serif text-2xl">{option.heading}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{option.sub}</p>
          </div>
        </div>
        {sent === selected ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-brand-sage" />
            <p className="mt-4 font-serif text-2xl">Thank you — we received your message.</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">A real person on our team will reply within one business day, Monday through Friday.</p>
            <button type="button" onClick={() => setSent(null)} className="mt-6 text-sm font-medium text-primary hover:underline">
              Send another message
            </button>
          </div>
        ) : (
          <VariantForm key={selected} option={option} role={role} onSent={() => setSent(selected)} />
        )}
      </div>
    </div>
  );
}

function VariantForm({ option, role, onSent }: { option: (typeof OPTIONS)[number]; role?: string; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const k = option.key;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const base = ["firstName", "lastName", "email", "phone", "message", "company_website", "office"];
    const details: Record<string, string> = {};
    for (const [key, value] of fd.entries()) if (!base.includes(key)) details[key] = String(value);
    if (chips.length) details.helpWith = chips.join(", ");
    const res = await fetch("/api/public/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: k,
        source: "contact_page",
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        office: fd.get("office"),
        topic: option.title,
        message: fd.get("message"),
        company_website: fd.get("company_website"),
        details,
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Something went wrong. Please call (480) 466-7070.");
    onSent();
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <Field label="First name" required>
        <Input name="firstName" required autoComplete="given-name" className="h-10" />
      </Field>
      <Field label="Last name" required>
        <Input name="lastName" required autoComplete="family-name" className="h-10" />
      </Field>
      <Field label="Email" required>
        <Input name="email" type="email" required autoComplete="email" className="h-10" />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" autoComplete="tel" className="h-10" />
      </Field>

      {k === "new_client" ? (
        <>
          <Field label="Preferred office">
            <Select name="office" options={["No preference", "East Valley (Chandler)", "West Valley (Peoria)", "Phone / virtual"]} />
          </Field>
          <Field label="How would you like to meet?">
            <Select name="meeting" options={["In person", "Phone call", "Video call"]} />
          </Field>
          <Field label="Which phase best describes you?" className="sm:col-span-2">
            <Select
              name="phase"
              options={["Not sure yet", "Phase I — Building a foundation", "Phase II — Accumulating wealth", "Phase III — Retirement income & legacy"]}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">What would you like help with?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {HELP_WITH.map((h) => {
                const on = chips.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChips((c) => (on ? c.filter((x) => x !== h) : [...c, h]))}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {on ? <Check className="h-3 w-3" /> : null} {h}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}

      {k === "client_service" ? (
        <>
          <Field label="Your planner">
            <Select name="planner" options={[...PLANNERS.map((p) => p.name), "Michael Gauthier", "Not sure"]} />
          </Field>
          <Field label="Request type" required>
            <Select
              name="requestType"
              options={["Schedule a review", "Money movement / distribution", "Required Minimum Distribution", "Beneficiary update", "Document or tax form request", "Address or contact update", "Something else"]}
            />
          </Field>
          <Field label="Best time to reach you">
            <Select name="bestTime" options={["Any time", "Morning", "Midday", "Afternoon"]} />
          </Field>
          <Field label="Preferred office">
            <Select name="office" options={["Either", "East Valley (Chandler)", "West Valley (Peoria)"]} />
          </Field>
        </>
      ) : null}

      {k === "investment_committee" ? (
        <>
          <Field label="Company / firm" required>
            <Input name="organization" required className="h-10" />
          </Field>
          <Field label="Your title">
            <Input name="orgRole" placeholder="e.g. Regional Director" className="h-10" />
          </Field>
          <Field label="Type of offering" required>
            <Select
              name="offeringType"
              options={["Mutual fund / ETF", "Separately managed account (SMA)", "Alternative investment / private fund", "Annuity / insurance product", "Fixed income / structured note", "Technology or service provider", "Other"]}
            />
          </Field>
          <Field label="Asset class / strategy">
            <Input name="strategy" placeholder="e.g. Private credit, large-cap value" className="h-10" />
          </Field>
          <Field label="Firm AUM">
            <Select name="aum" options={["Prefer not to say", "Under $1B", "$1B – $10B", "$10B – $100B", "Over $100B"]} />
          </Field>
          <Field label="Track record">
            <Select name="trackRecord" options={["Under 3 years", "3 – 5 years", "5 – 10 years", "10+ years"]} />
          </Field>
          <Field label="Website or fact sheet link" className="sm:col-span-2">
            <Input name="profileUrl" type="url" placeholder="https://" className="h-10" />
          </Field>
        </>
      ) : null}

      {k === "career_interest" ? (
        <>
          <Field label="Position" required>
            <Select name="position" defaultValue={role} options={[...JOBS.map((j) => j.title), "General interest / waitlist"]} />
          </Field>
          <Field label="Preferred office">
            <Select name="office" options={["Either", "East Valley (Chandler)", "West Valley (Peoria)"]} />
          </Field>
          <Field label="LinkedIn or résumé link" className="sm:col-span-2">
            <Input name="profileUrl" type="url" placeholder="https://" className="h-10" />
          </Field>
        </>
      ) : null}

      <Field label={option.messageLabel} required={option.messageRequired} className="sm:col-span-2">
        <Textarea name="message" required={option.messageRequired} rows={4} placeholder={option.messagePlaceholder} />
      </Field>
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
        By submitting, you agree we may contact you about your inquiry. See our <a href="/privacy-policy" className="underline">Privacy Policy</a> and{" "}
        <a href="/communication-policy" className="underline">Communication Policy</a>.
      </p>
      {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:col-span-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {option.submit}
      </button>
    </form>
  );
}

function Select({ name, options, defaultValue }: { name: string; options: string[]; defaultValue?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue && options.includes(defaultValue) ? defaultValue : options[0]}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1.5 text-sm font-medium", className)}>
      <span>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {children}
    </label>
  );
}
