// Website pages managed by the Frontend Editor. These wrap Shepherd's website
// tools (lib/website/shepherd-tools.ts) one-for-one rather than re-implement
// them, so the same validation, protected-route rules, draft/publish split
// and website audit trail apply. The Frontend Editor is Super-Admin-only in
// the dashboard, so these tools are too (policy area "website").
//
// Risk: reads → read; anything that only touches drafts → write; publishing,
// unpublishing/archiving, navigation, global content and site-wide replace
// (which change what every visitor sees) → high, previewed via sig_confirm.
import { WEBSITE_TOOLS } from "@/lib/website/shepherd-tools";
import type { Risk } from "./safety";
import type { Json, McpTool } from "./types";

const HIGH = new Set([
  "website_publish_page",
  "website_page_lifecycle",
  "website_update_navigation",
  "website_update_global",
  "website_site_wide_replace",
]);

const TITLES: Record<string, string> = {
  website_list_pages: "List website pages",
  website_get_page: "Read a website page",
  website_list_components: "Website components",
  website_search: "Search the website",
  website_get_navigation: "Website navigation",
  website_get_globals: "Website global content",
  website_list_versions: "Page versions",
  website_link_report: "Website link report",
  website_history: "Website change history",
  website_list_change_sets: "Website change sets",
  website_create_page: "Create a website page (draft)",
  website_propose_change: "Propose a page change (draft)",
  website_edit_section: "Edit a page section (draft)",
  website_update_page_settings: "Update page settings / SEO",
  website_publish_page: "Publish a website page",
  website_page_lifecycle: "Unpublish / archive / restore a page",
  website_update_navigation: "Change website navigation",
  website_update_global: "Change website global content",
  website_site_wide_replace: "Site-wide find & replace",
  website_create_preview_link: "Create a page preview link",
  website_request_component: "Request a new website component",
};

export function websiteTools(): McpTool[] {
  return WEBSITE_TOOLS.map((t) => {
    const risk: Risk = !t.requiresConfirmation ? "read" : HIGH.has(t.name) ? "high" : "write";
    const name = `sig_${t.name}`;
    const ctx = (c: { profile: { id: string; email: string } }) => ({ actorId: c.profile.id, actorEmail: c.profile.email });
    const run = async (args: Json, c: Parameters<NonNullable<McpTool["run"]>>[1]) => {
      const result = await t.execute(args, ctx(c));
      const r = (result ?? {}) as Json;
      return {
        result,
        summary: t.summarize ? t.summarize(args) : risk === "read" ? null : `${TITLES[t.name] ?? t.name}`,
        entity: risk === "read" ? null : "website_page",
        recordId: typeof r.id === "string" ? r.id : null,
        after: risk === "read" ? null : result,
      };
    };
    const tool: McpTool = {
      name,
      title: TITLES[t.name] ?? t.name.replace(/_/g, " "),
      description: t.description.replace(/\bwebsite_([a-z_]+)/g, "sig_website_$1"),
      risk,
      area: "website",
      openWorld: risk === "high",
      inputSchema: t.parameters as Json,
    };
    if (risk === "high") {
      tool.preview = async (args) => ({ summary: t.summarize ? t.summarize(args) : `${tool.title}.`, details: args, entity: "website_page" });
      tool.execute = run;
    } else {
      tool.run = run;
    }
    return tool;
  });
}
