import { organizationJsonLd } from "@/lib/public-site/seo";

/** Renders schema.org structured data. `<` is escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Organization / FinancialService (both offices) + WebSite — once per public page, via SiteShell. */
export function OrganizationJsonLd() {
  return <JsonLd data={organizationJsonLd()} />;
}
