// The SIG MCP tool list. Every tool carries a risk tier (lib/mcp/safety.ts):
// read runs at once, write runs at once with a before/after audit, high returns
// a preview and waits for sig_confirm. Each tool also names the RBAC area its
// caller's role must reach (lib/mcp/policy.ts), so people only see what they
// could do in the dashboard.
import type { McpCaller } from "./auth";
import { blogTools } from "./tools-blog";
import { bookingTools } from "./tools-booking";
import { contactTools } from "./tools-contacts";
import { eventTools } from "./tools-events";
import { formTools } from "./tools-forms";
import { systemTools } from "./tools-system";
import { websiteTools } from "./tools-website";
import { toolVisible, type McpTool } from "./types";

export type { McpTool, ToolOutput } from "./types";

let cache: McpTool[] | null = null;

export function allTools(): McpTool[] {
  if (!cache) {
    cache = [
      ...systemTools(() => allTools()),
      ...contactTools(),
      ...formTools(),
      ...bookingTools(),
      ...eventTools(),
      ...blogTools(),
      ...websiteTools(),
    ];
  }
  return cache;
}

/** The tools this caller may see and call. */
export function toolsFor(caller: McpCaller): McpTool[] {
  return allTools().filter((t) => toolVisible(t, caller));
}
