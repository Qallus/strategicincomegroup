import Link from "next/link";
import { ChevronRight, Phone, ShieldCheck } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";
import { RequestLinkForm } from "./request-form";

export const metadata = {
  title: "Manage your appointments",
  description: "Reschedule, cancel or update an appointment with Strategic Income Group.",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function ManageAppointmentsPage() {
  return (
    <div className="relative border-t bg-muted/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-gold/[0.07] to-transparent" aria-hidden />
      <Container className="relative max-w-2xl py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <Link href="/book" className="hover:text-foreground hover:underline">Schedule Online</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-foreground">Manage</span>
        </nav>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Your appointments</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">Manage your appointments</h1>
        <p className="mt-3 text-muted-foreground">
          Enter the email you booked with and we’ll send you a secure link to see your appointments — then reschedule, cancel or update your details.
        </p>

        <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <RequestLinkForm />
        </div>

        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
            <span>The link works once and expires after an hour. Your confirmation email also has a direct “Manage your appointment” link.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
            <span>
              Prefer to talk? Call <a href={CONTACT.phoneHref} className="font-medium text-primary hover:underline">{CONTACT.phone}</a> ({CONTACT.hours}).
            </span>
          </li>
        </ul>
      </Container>
    </div>
  );
}
