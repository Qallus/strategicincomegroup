import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/public-site/blocks";
import { peekAccessLink } from "@/lib/booking/manage";
import { ListClient } from "./list-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your appointments",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function AppointmentListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Peek only — the link is consumed by an explicit click (POST), so mail scanners can't burn it.
  const state = await peekAccessLink(token).catch(() => "invalid" as const);
  return (
    <div className="relative border-t bg-muted/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-gold/[0.07] to-transparent" aria-hidden />
      <Container className="relative max-w-3xl py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/book" className="hover:text-foreground hover:underline">Schedule Online</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <Link href="/book/manage" className="hover:text-foreground hover:underline">Manage</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-foreground">Your appointments</span>
        </nav>
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Your appointments</h1>
        <ListClient token={token} initialState={state} />
      </Container>
    </div>
  );
}
