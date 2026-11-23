import { Search } from "lucide-react";
import { NotConnected } from "@/components/analytics/panel";

export const dynamic = "force-dynamic";

export default function SearchTabPage() {
  return (
    <NotConnected
      icon={Search}
      phase={2}
      title="Google Search Console & Business Profile"
      description="Organic search visits already show under Acquisition. Connecting Google adds what people searched for before they clicked, and how SIG's two offices perform on Maps."
      preview={[
        "Top search queries and pages: clicks, impressions, CTR and average position",
        "Position trend over time",
        "“Almost page 1” opportunities (average position 8–20)",
        "Business Profile calls, direction requests, website clicks and views per office",
      ]}
      steps={[
        "Verify strategicincomegroup.com in Google Search Console (add the DNS TXT record Google gives you).",
        "Create a Google Cloud service account and add its email as a user on the Search Console property.",
        "Request Business Profile API access from Google — approval can take days to weeks.",
        "Add the service account as a manager on both office listings (Chandler and Peoria).",
        "Put the service account JSON in GOOGLE_SA_JSON, the property in GSC_SITE_URL and the listing in GBP_LOCATION_ID (Coolify env vars).",
      ]}
    />
  );
}
