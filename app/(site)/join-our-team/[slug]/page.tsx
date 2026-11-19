import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import { ButtonLink, CheckList, Container, CtaBand, PageHero } from "@/components/public-site/blocks";
import { JOBS, getJob } from "@/lib/public-site/careers";
import { OFFICES } from "@/lib/public-site/site-data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return JOBS.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: Props) {
  const job = getJob((await params).slug);
  if (!job) return { title: "Role not found" };
  return { title: `${job.title} — Careers`, description: job.intro[0]?.slice(0, 160) };
}

export default async function JobPage({ params }: Props) {
  const job = getJob((await params).slug);
  if (!job) notFound();
  const apply = `/contact?topic=careers&role=${encodeURIComponent(job.title)}`;

  return (
    <>
      <PageHero
        eyebrow={job.type}
        title={job.title}
        breadcrumb={[{ label: "Careers", href: "/join-our-team" }, { label: job.title }]}
        description={job.intro[0]}
        actions={[{ label: "Career Application", href: apply }, { label: "Contact SIG Direct", href: "/contact" }]}
      />

      <Container className="py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <article className="min-w-0 space-y-12">
            {job.intro.slice(1).length ? (
              <div className="space-y-4 text-[17px] leading-relaxed text-muted-foreground">
                {job.intro.slice(1).map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            ) : null}
            {job.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-serif text-3xl">{s.heading}</h2>
                {s.paragraphs ? (
                  <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">
                    {s.paragraphs.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                  </div>
                ) : null}
                {s.items ? <CheckList className="mt-5" items={s.items} /> : null}
              </section>
            ))}
            {job.closing ? (
              <div className="rounded-xl border bg-muted/40 p-6">
                <h2 className="font-serif text-2xl">Apply Now</h2>
                <p className="mt-2 text-muted-foreground">{job.closing}</p>
                <div className="mt-5">
                  <ButtonLink label="Start Your Application" href={apply} />
                </div>
              </div>
            ) : null}
            <Link href="/join-our-team" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> All careers
            </Link>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Come Grow</p>
              <p className="mt-2 font-serif text-2xl">{job.title}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gold" /> {job.type}
                </li>
                {OFFICES.map((o) => (
                  <li key={o.name} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold" /> {o.name} · {o.city}
                  </li>
                ))}
              </ul>
              <ButtonLink label="Apply" href={apply} className="mt-6 w-full" />
            </div>
          </aside>
        </div>
      </Container>

      <CtaBand title="Join SIG and make a difference." description="Not the right role? We actively build a waitlist of qualified candidates for immediate and future opportunities." />
    </>
  );
}
