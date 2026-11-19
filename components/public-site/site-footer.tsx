import Link from "next/link";
import { Facebook, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { NewsletterForm } from "@/components/public-site/newsletter-form";
import { CONTACT, FOOTER_COLUMNS, LEGAL_LINKS, OFFICES } from "@/lib/public-site/site-data";

/** Site footer (navy in both themes, like the live site) with a sub-footer for legal links. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-[hsl(225_95%_15%)] text-white dark:bg-[hsl(228_60%_5%)]">
      <div className="sig-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.1fr_repeat(3,0.8fr)_1.4fr]">
          <div className="space-y-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/sig-logo-white.png" alt="Strategic Income Group" className="h-10 w-auto" />
            <p className="max-w-xs text-sm leading-relaxed text-white/65">
              Financial solutions for every phase of life. Offices in Chandler and Peoria, Arizona.
            </p>
            <div className="flex gap-2">
              <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white/75 transition hover:border-brand-gold hover:text-brand-gold">
                <Facebook className="h-4 w-4" />
              </a>
              <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white/75 transition hover:border-brand-gold hover:text-brand-gold">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="font-serif text-xl">{col.heading}</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-white/70 transition-colors hover:text-brand-gold">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="font-serif text-xl">Newsletter</h2>
            <p className="mb-4 mt-2 text-sm text-white/60">Strategic Insights, delivered monthly.</p>
            <NewsletterForm />
          </div>
        </div>

        <div className="grid gap-6 border-t border-white/10 py-8 text-sm sm:grid-cols-2 lg:grid-cols-[0.8fr_1.2fr_1fr_1fr]">
          <div>
            <p className="font-serif text-base">Call us</p>
            <a href={CONTACT.phoneHref} className="mt-1.5 inline-flex items-center gap-2 text-white/70 hover:text-brand-gold">
              <Phone className="h-3.5 w-3.5" /> {CONTACT.phone}
            </a>
          </div>
          <div>
            <p className="font-serif text-base">Email us</p>
            <a href={`mailto:${CONTACT.email}`} className="mt-1.5 inline-flex items-center gap-2 whitespace-nowrap text-white/70 hover:text-brand-gold">
              <Mail className="h-3.5 w-3.5 shrink-0" /> {CONTACT.email}
            </a>
          </div>
          {OFFICES.map((o) => (
            <div key={o.name}>
              <p className="font-serif text-base">{o.name}</p>
              <a href={o.directions} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-start gap-2 text-white/70 hover:text-brand-gold">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {o.street}
                  <br />
                  {o.locality}
                </span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-footer */}
      <div className="relative border-t border-white/10 bg-black/20">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-5 text-xs text-white/60 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>Copyright {year} © Strategic Income Group LLC | All rights reserved</p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {LEGAL_LINKS.map((l, i) => (
              <span key={l.label} className="inline-flex items-center gap-1">
                {i > 0 ? <span aria-hidden className="mx-1.5 h-1 w-1 rounded-full bg-white/30" /> : null}
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
