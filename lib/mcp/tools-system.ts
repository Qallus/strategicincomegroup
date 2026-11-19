// Meta tools: who am I, find a tool, confirm/cancel a previewed action, my
// pending actions, recent activity, trash and restore. sig_confirm is the only
// way a high-risk action runs, and it runs the arguments stored at preview time.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelPending, claimPending, finishPending, listPending } from "./actions";
import { roleLabel, type McpCaller } from "./auth";
import { areasFor, canUseArea, type Area } from "./policy";
import { listTrash, restoreRecord } from "./trash";
import { bool, clamp, int, need, obj, s, str, toolVisible, type McpTool, type ToolOutput } from "./types";

const ENTITY_AREA: Record<string, Area> = {
  blog_post: "blog",
  contact: "contacts",
  form_submission: "forms",
  booking: "bookings",
  booking_type: "bookings",
  booking_date_override: "bookings",
  event: "events",
  event_registration: "events",
};

const entitiesFor = (c: McpCaller) => Object.entries(ENTITY_AREA).filter(([, area]) => canUseArea(c.profile.role, area)).map(([e]) => e);

export function systemTools(all: () => McpTool[]): McpTool[] {
  return [
    {
      name: "sig_whoami",
      title: "Who am I in SIG",
      description: "Your SIG identity for this connection: name, email, role, which areas you can work in, which app/token you're connected from and which risk tiers it may use.",
      risk: "read",
      inputSchema: obj(),
      run: async (_a, c) => ({
        result: {
          name: c.profile.name,
          email: c.profile.email,
          role: c.profile.role,
          role_label: roleLabel(c.profile.role),
          areas: areasFor(c.profile.role),
          connected_via: c.authKind === "oauth" ? `${c.clientName} (OAuth, ${c.clientKind})` : `${c.clientName} (personal API token)`,
          allowed_tiers: c.allowedTiers,
          tool_count: all().filter((t) => toolVisible(t, c)).length,
        },
      }),
    },
    {
      name: "sig_search_tools",
      title: "Find a SIG tool",
      description: "Search the SIG tools available to you by keyword (e.g. 'event', 'booking', 'blog', 'contact', 'trash', 'website'). Returns name, risk tier and description. Leave keyword empty to list everything.",
      risk: "read",
      inputSchema: obj({ keyword: str("Word(s) to look for") }),
      run: async (a, c) => {
        const words = s(a.keyword).toLowerCase().split(/\s+/).filter(Boolean);
        const tools = all()
          .filter((t) => toolVisible(t, c))
          .filter((t) => {
            const hay = `${t.name} ${t.title} ${t.description} ${t.area ?? ""}`.toLowerCase();
            return words.every((w) => hay.includes(w));
          })
          .map((t) => ({ name: t.name, title: t.title, risk: t.risk, area: t.area ?? "meta", description: t.description.slice(0, 300) }));
        return { result: { count: tools.length, tools } };
      },
    },
    {
      name: "sig_confirm",
      title: "Confirm a previewed action",
      description: "Run a high-risk action you previewed earlier (publish, delete, cancel an event…). Call this ONLY after you showed the person the preview and they clearly said yes. Takes the confirmation_id from the preview; the stored action runs exactly once, within 15 minutes.",
      risk: "write",
      inputSchema: obj({ confirmation_id: str("The confirmation_id from the preview") }, ["confirmation_id"]),
      run: async (a, c) => {
        const id = need(a, "confirmation_id");
        const pending = await claimPending(id, c);
        try {
          const tool = all().find((t) => t.name === pending.tool);
          const exec = tool?.execute ?? tool?.run;
          if (!tool || !exec) throw new Error(`"${pending.tool}" can't be confirmed.`);
          // Permissions are checked again now, not just at preview time.
          if (!toolVisible(tool, c) || !c.allowedTiers.includes("high")) throw new Error(`You no longer have access to ${pending.tool}.`);
          const out = await exec(pending.args, c);
          await finishPending(id, { result: out.result });
          return { ...out, confirmationId: id, executedTool: tool.name } as ToolOutput;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Action failed.";
          await finishPending(id, { error: message });
          throw err;
        }
      },
    },
    {
      name: "sig_cancel",
      title: "Cancel a previewed action",
      description: "Cancel a high-risk action that's waiting for confirmation (when the person says no or changes their mind).",
      risk: "read",
      inputSchema: obj({ confirmation_id: str("The confirmation_id from the preview") }, ["confirmation_id"]),
      run: async (a, c) => ({
        result: (await cancelPending(need(a, "confirmation_id"), c)) ? { cancelled: true } : { error: "Nothing pending with that id." },
      }),
    },
    {
      name: "sig_pending_actions",
      title: "My actions waiting for confirmation",
      description: "High-risk actions you previewed in the last 15 minutes that haven't been confirmed or cancelled.",
      risk: "read",
      inputSchema: obj(),
      run: async (_a, c) => ({
        result: {
          pending: (await listPending(c)).map((p) => ({ confirmation_id: p.id, tool: p.tool, summary: p.preview?.summary, expires_at: p.expires_at })),
        },
      }),
    },
    {
      name: "sig_audit_recent",
      title: "Recent AI activity",
      description: "Your most recent SIG tool calls from any AI app (what ran, when, whether it worked). Admins can pass everyone=true to see the whole team.",
      risk: "read",
      inputSchema: obj({ everyone: bool("Admins: include everyone"), tool: str("Only this tool"), limit: int("Max rows (default 30)") }),
      run: async (a, c) => {
        let q = createSupabaseAdminClient()
          .from("mcp_audit_log")
          .select("created_at, tool, risk, client_name, client_kind, summary, entity, record_id, success, error, profile_id, profile:profiles(email)")
          .order("created_at", { ascending: false })
          .limit(clamp(a.limit, 30, 100));
        if (!(a.everyone === true && canUseArea(c.profile.role, "admin"))) q = q.eq("profile_id", c.profile.id);
        if (s(a.tool)) q = q.eq("tool", s(a.tool));
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return { result: { calls: data ?? [] } };
      },
    },
    {
      name: "sig_trash_list",
      title: "What's in the trash",
      description: "Records deleted through AI that you can restore (only the kinds your role works with), newest first, with the trash_id sig_restore needs.",
      risk: "read",
      inputSchema: obj({ include_restored: bool("Also show ones already restored") }),
      available: (c) => entitiesFor(c).length > 0,
      run: async (a, c) => ({
        result: {
          trash: (await listTrash({ limit: 50, includeRestored: a.include_restored === true, entities: entitiesFor(c) })).map((t) => ({
            trash_id: t.id, entity: t.entity, record_id: t.record_id, label: t.label, deleted_at: t.deleted_at, restored_at: t.restored_at,
          })),
        },
      }),
    },
    {
      name: "sig_restore",
      title: "Restore from the trash",
      description: "Put a record deleted through AI back exactly as it was (child records too, e.g. an event's registrations). Takes the trash_id from sig_trash_list or a delete result.",
      risk: "write",
      inputSchema: obj({ trash_id: str("trash_id") }, ["trash_id"]),
      available: (c) => entitiesFor(c).length > 0,
      run: async (a, c) => {
        const trashId = need(a, "trash_id");
        const { data: row } = await createSupabaseAdminClient().from("mcp_trash").select("entity").eq("id", trashId).maybeSingle();
        if (!row) throw new Error("That trash entry doesn't exist.");
        if (!entitiesFor(c).includes(row.entity as string)) throw new Error(`Your role can't restore ${String(row.entity).replace(/_/g, " ")} records.`);
        const out = await restoreRecord(trashId, c.profile);
        return { result: { restored: true, ...out }, summary: `Restored ${out.entity.replace(/_/g, " ")} "${out.label}"`, entity: out.entity, recordId: out.recordId };
      },
    },
  ];
}
