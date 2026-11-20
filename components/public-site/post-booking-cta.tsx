import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { CONTACT } from "@/lib/public-site/site-data";
import { getPlanners } from "@/lib/team/data";

/** Native "talk to your planner" block shown under every article (replaces the WordPress FluentBooking cards). */
export async function PostBookingCta() {
  const PLANNERS = await getPlanners();
  return (
    <section className="mx-auto mt-12 max-w-[72ch] rounded-2xl border bg-muted/40 p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Your next step</p>
      <h2 className="mt-2 font-serif text-3xl">Keep your plan at the center.</h2>
      <p className="mt-2 text-muted-foreground">
        Connect with your SIG Financial Planner to discuss what has changed and which decisions deserve attention.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {PLANNERS.map((p) => (
          <li key={p.slug}>
            <Link href={p.booking ?? "/book"} className="group flex h-full flex-col items-center rounded-xl border bg-card p-4 text-center transition hover:border-primary/40 hover:shadow-md">
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo} alt="" loading="lazy" className="h-16 w-16 rounded-full border-2 border-primary/30 object-cover object-top" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/30 bg-muted font-serif text-2xl">{p.name.charAt(0)}</span>
              )}
              <span className="mt-3 font-medium leading-tight">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.credentials} · {p.office?.replace(" Office", "")}
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Book with {p.name.split(" ")[0]} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-4 w-4 text-gold" /> Prefer to call?{" "}
        <a href={CONTACT.phoneHref} className="font-medium text-foreground hover:underline">{CONTACT.phone}</a>
      </p>
    </section>
  );
}
