import Link from "next/link";
import { FileText } from "lucide-react";
import { Container, PageHero } from "@/components/public-site/blocks";
import { CONTACT } from "@/lib/public-site/site-data";

export type LegalSection = { heading: string; paragraphs?: string[]; items?: string[]; sub?: LegalSection[] };

const DOCS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Communication Policy", href: "/communication-policy" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Shared layout for legal documents: sticky contents list + readable body. */
export function LegalPage({ title, effective, intro, sections }: { title: string; effective: string; intro?: string; sections: LegalSection[] }) {
  return (
    <>
      <PageHero tone="plain" eyebrow="Legal" title={title} breadcrumb={[{ label: "Legal" }, { label: title }]} description={`Effective Date: ${effective}`} />
      <Container className="py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">On this page</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {sections.map((s) => (
                  <li key={s.heading}>
                    <a href={`#${slug(s.heading)}`} className="text-muted-foreground hover:text-foreground">{s.heading}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">Documents</p>
              <ul className="mt-2 space-y-1.5">
                {DOCS.map((d) => (
                  <li key={d.href}><Link href={d.href} className="text-muted-foreground hover:text-foreground">{d.label}</Link></li>
                ))}
                <li>
                  <a href={CONTACT.crsPdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <FileText className="h-3.5 w-3.5" /> Download the SIG CRS
                  </a>
                </li>
                <li>
                  <a href={CONTACT.adv} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <FileText className="h-3.5 w-3.5" /> Form ADV Part 2A
                  </a>
                </li>
              </ul>
            </div>
          </aside>
          <div className="sig-prose max-w-[72ch]">
            {intro ? <p>{intro}</p> : null}
            {sections.map((s) => (
              <Block key={s.heading} section={s} level={2} />
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}

function Block({ section, level }: { section: LegalSection; level: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <>
      <H id={level === 2 ? slug(section.heading) : undefined} className="scroll-mt-24">
        {section.heading}
      </H>
      {section.paragraphs?.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      {section.items ? (
        <ul>
          {section.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
      {section.sub?.map((s) => <Block key={s.heading} section={s} level={3} />)}
    </>
  );
}
