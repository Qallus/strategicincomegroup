// Contacts & leads (Clients → Contacts, table `contacts`). Same access as the
// dashboard's contacts API (requireParticipantManager): Super Admin, Admin,
// Team Member. Delete = archive (status 'archived'), restorable.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trashRecord } from "./trash";
import {
  anyObj, bool, clamp, ilikeSafe, int, need, obj, opt, pickDefined, s, str, strArr, strEnum, type Json, type McpTool,
} from "./types";

const sb = () => createSupabaseAdminClient();

const CONTACT_FIELDS = {
  type: strEnum(["contact", "lead"], "contact or lead (default contact)"),
  status: strEnum(["active", "inactive", "converted"], "Status (use sig_contact_delete to archive)"),
  first_name: str("First name"),
  last_name: str("Last name"),
  email: str("Email"),
  phone: str("Phone"),
  company: str("Company"),
  website: str("Website"),
  church: str("Church / ministry"),
  address_line_1: str("Address line 1"),
  address_line_2: str("Address line 2"),
  city: str("City"),
  state: str("State"),
  zip_code: str("ZIP"),
  source: str("Where they came from"),
  list: str("List name"),
  tags: strArr("Tags (replaces existing tags)"),
  notes: str("Notes (replaces existing notes)"),
  custom_fields: anyObj("Custom fields (merged into existing)"),
  sms_opt_in: bool("Agreed to SMS"),
  email_opt_in: bool("Agreed to email"),
};
const WRITABLE = Object.keys(CONTACT_FIELDS);

async function findContact(idValue: string): Promise<Record<string, unknown>> {
  const { data, error } = await sb().from("contacts").select("*").eq("id", idValue).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No contact with id ${idValue}. Use sig_contacts_search.`);
  return data as Record<string, unknown>;
}

const brief = (c: Record<string, unknown>) => ({
  id: c.id, type: c.type, status: c.status, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
  email: c.email, phone: c.phone, company: c.company, church: c.church, city: c.city, state: c.state,
  tags: c.tags, source: c.source, created_at: c.created_at,
});

export function contactTools(): McpTool[] {
  return [
    {
      name: "sig_contacts_search",
      title: "Search contacts",
      description: "Search SIG contacts and leads by name, email, phone, company or church. Archived contacts are excluded unless status=archived.",
      risk: "read",
      area: "contacts",
      inputSchema: obj({
        search: str("Words to match"),
        type: strEnum(["contact", "lead", "all"], "Default all"),
        status: strEnum(["active", "inactive", "converted", "archived"], "Only this status"),
        tag: str("Only contacts with this tag"),
        limit: int("Max rows (default 25)"),
      }),
      run: async (a) => {
        let q = sb().from("contacts").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(clamp(a.limit, 25, 100));
        if (opt(a.type) && a.type !== "all") q = q.eq("type", s(a.type));
        q = opt(a.status) ? q.eq("status", s(a.status)) : q.neq("status", "archived");
        if (opt(a.tag)) q = q.contains("tags", [s(a.tag)]);
        const term = ilikeSafe(s(a.search));
        if (term) {
          const words = term.split(/\s+/).filter(Boolean);
          const parts = ["first_name", "last_name", "email", "phone", "company", "church"].map((f) => `${f}.ilike.%${term}%`);
          // "John Smith" → first name John and last name Smith.
          if (words.length >= 2) parts.push(`and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words.slice(1).join(" ")}%)`);
          q = q.or(parts.join(","));
        }
        const { data, count, error } = await q;
        if (error) throw new Error(error.message);
        return { result: { total: count ?? 0, contacts: (data ?? []).map((c) => brief(c as Record<string, unknown>)) } };
      },
    },
    {
      name: "sig_contact_get",
      title: "Read a contact",
      description: "One contact in full: details, address, tags, notes and custom fields.",
      risk: "read",
      area: "contacts",
      inputSchema: obj({ contact_id: str("Contact id") }, ["contact_id"]),
      run: async (a) => ({ result: await findContact(need(a, "contact_id")) }),
    },
    {
      name: "sig_contact_create",
      title: "Create a contact",
      description: "Add a contact or lead. If a non-archived contact with the same email already exists it is returned instead (pass allow_duplicate=true to add anyway).",
      risk: "write",
      area: "contacts",
      inputSchema: obj({ ...CONTACT_FIELDS, allow_duplicate: bool("Create even if the email already exists") }),
      run: async (a, c) => {
        const fields = pickDefined(a, WRITABLE);
        if (!opt(fields.first_name) && !opt(fields.last_name) && !opt(fields.email) && !opt(fields.phone)) {
          throw new Error("Give at least a name, email or phone.");
        }
        if (typeof fields.email === "string") fields.email = fields.email.trim().toLowerCase();
        if (fields.email && a.allow_duplicate !== true) {
          const { data: existing } = await sb().from("contacts").select("*").ilike("email", String(fields.email)).neq("status", "archived").limit(1).maybeSingle();
          if (existing) return { result: { created: false, existing: true, contact: brief(existing as Record<string, unknown>), note: "A contact with this email already exists; use sig_contact_update to change it." } };
        }
        const { data, error } = await sb().from("contacts").insert({ ...fields, created_by: c.profile.id }).select("*").single();
        if (error) throw new Error(error.message);
        const row = data as Record<string, unknown>;
        return { result: { created: true, contact: brief(row) }, summary: `Created ${row.type} ${brief(row).name ?? row.email}`, entity: "contact", recordId: row.id as string, after: row };
      },
    },
    {
      name: "sig_contact_update",
      title: "Update a contact",
      description: "Change a contact's fields. Only the fields you pass change; custom_fields are merged; append_note adds to the notes.",
      risk: "write",
      area: "contacts",
      inputSchema: obj({ contact_id: str("Contact id"), ...CONTACT_FIELDS, append_note: str("Text to add to the notes") }, ["contact_id"]),
      run: async (a, c) => {
        const before = await findContact(need(a, "contact_id"));
        const patch: Json = pickDefined(a, WRITABLE);
        if (patch.custom_fields && typeof patch.custom_fields === "object") {
          patch.custom_fields = { ...((before.custom_fields ?? {}) as Json), ...(patch.custom_fields as Json) };
        }
        if (opt(a.append_note)) {
          const stamp = `[${new Date().toISOString().slice(0, 10)} ${c.profile.name}]`;
          patch.notes = [typeof patch.notes === "string" ? patch.notes : (before.notes as string) ?? "", `${stamp} ${s(a.append_note)}`].filter(Boolean).join("\n");
        }
        if (typeof patch.email === "string") patch.email = patch.email.trim().toLowerCase();
        if (!Object.keys(patch).length) throw new Error("Nothing to change.");
        patch.updated_at = new Date().toISOString();
        const { data, error } = await sb().from("contacts").update(patch).eq("id", before.id as string).select("*").single();
        if (error) throw new Error(error.message);
        return { result: { updated: true, contact: data }, summary: `Updated contact ${brief(before).name ?? before.email} (${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")})`, entity: "contact", recordId: before.id as string, before, after: data };
      },
    },
    {
      name: "sig_contact_delete",
      title: "Delete (archive) a contact",
      description: "Archive a contact (status archived; hidden from lists). Restorable with sig_restore. High risk: returns a preview first.",
      risk: "high",
      area: "contacts",
      inputSchema: obj({ contact_id: str("Contact id") }, ["contact_id"]),
      preview: async (a) => {
        const row = await findContact(need(a, "contact_id"));
        if (row.status === "archived") throw new Error("That contact is already archived.");
        return { summary: `Archive ${row.type} ${brief(row).name ?? row.email ?? row.id}. Restorable from the trash.`, details: brief(row), entity: "contact", recordId: row.id as string };
      },
      execute: async (a, c) => {
        const { trashId, label, before } = await trashRecord("contact", need(a, "contact_id"), c.profile);
        return { result: { archived: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Archived contact ${label}`, entity: "contact", recordId: s(a.contact_id), before };
      },
    },
  ];
}
