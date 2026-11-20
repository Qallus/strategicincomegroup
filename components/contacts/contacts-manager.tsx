"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, Building2, Pencil, Mail, MessageSquare, Phone, Plus, RefreshCw, Settings2, Shuffle, Tag, Tags,
  Trash2, UserCheck, UserPlus, Users, X, CircleDot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldSelect } from "@/components/ui/field-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataView, type DataColumn } from "@/components/dashboard/collection";
import { ContactFormFields, BLANK_CONTACT, type ContactFormData } from "./contact-form-fields";
import { useDashboardActionToken } from "@/components/layout/dashboard-action-token";
import { cn } from "@/lib/utils";

type Contact = {
  id: string; type: string; status: string;
  first_name: string | null; last_name: string | null;
  email: string | null; phone: string | null;
  company: string | null; church: string | null;
  source: string | null; list: string | null; tags: string[];
  notes: string | null; profile_photo_url: string | null;
  address_line_1: string | null; address_line_2: string | null;
  city: string | null; state: string | null; zip_code: string | null;
  website: string | null; sms_opt_in: boolean; email_opt_in: boolean;
  converted_to_participant_id: string | null; converted_to_profile_id: string | null;
  custom_fields: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  [key: string]: unknown;
};

type CustomField = { id: string; field_key: string; field_label: string; field_type: string };
export type ContactStaff = { id: string; name: string };

// The contacts table allows exactly these two roles (DB check constraint) and four statuses.
const ROLES = [
  { value: "contact", label: "Contact" },
  { value: "lead", label: "Lead" },
] as const;
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
] as const;

const PAGE = 100; // the list API caps `limit` at 100

const roleLabel = (t: string) => ROLES.find((r) => r.value === t)?.label ?? t;
const statusLabel = (s: string) => STATUSES.find((r) => r.value === s)?.label ?? s;

function fullName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "—";
}

function initials(c: Contact) {
  const i = `${(c.first_name ?? "").trim().charAt(0)}${(c.last_name ?? "").trim().charAt(0)}`;
  return (i || (c.email ?? "").charAt(0) || "?").toUpperCase();
}

/** Owner = custom_fields.owner_id (set from this page), falling back to whoever created the contact. */
const ownerId = (c: Contact) => {
  const v = c.custom_fields?.owner_id;
  return typeof v === "string" && v ? v : c.created_by;
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
  archived: "bg-muted text-muted-foreground line-through",
};
const ROLE_CLASS: Record<string, string> = {
  lead: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  contact: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium", className)}>{children}</span>;
}

function Avatar({ c, size = "h-9 w-9 text-xs" }: { c: Contact; size?: string }) {
  return c.profile_photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.profile_photo_url} alt="" className={cn("shrink-0 rounded-full object-cover", size)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary", size)}>{initials(c)}</span>
  );
}

/** Run `fn` over `items` with at most `limit` requests in flight. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          await fn(item);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Failed.");
        }
      }
    }),
  );
  if (errors.length) throw new Error(`${errors.length} of ${items.length} failed: ${errors[0]}`);
}

/** CSV writer for re-posting imported rows to the existing import route (no formula escaping —
 *  the route stores values verbatim, and phone numbers like +1… must survive). */
function rowsToCsv(rows: Record<string, string>[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers.map(cell).join(","), ...rows.map((r) => headers.map((h) => cell(r[h] ?? "")).join(","))].join("\n");
}

type Bulk =
  | { kind: "addTags" | "removeTags"; rows: Contact[] }
  | { kind: "role" | "status" | "owner"; rows: Contact[] };

export function ContactsManager({ initialType = "contact", staff = [] }: { initialType?: "contact" | "lead"; staff?: ContactStaff[] }) {
  const actionToken = useDashboardActionToken();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleFocus, setRoleFocus] = useState<"" | "contact" | "lead" | "converted">("");

  // Add / edit modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [formType, setFormType] = useState<string>(initialType);
  const [formData, setFormData] = useState<ContactFormData>(BLANK_CONTACT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Convert modal
  const [convertContact, setConvertContact] = useState<Contact | null>(null);
  const [convertTarget, setConvertTarget] = useState<"profile">("profile");
  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState<string | null>(null);

  // Delete (single, from the preview)
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk dialog
  const [bulk, setBulk] = useState<Bulk | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Custom fields settings
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-sig-action-token": actionToken }), [actionToken]);

  // Load every contact and lead (the API pages by type, 100 at a time) so DataView can search,
  // filter, sort and select across the whole list.
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const all: Contact[] = [];
      for (const type of ["contact", "lead"]) {
        for (let page = 1; page < 500; page++) {
          const res = await fetch(`/api/admin/contacts?${new URLSearchParams({ type, page: String(page), limit: String(PAGE) })}`, {
            headers: { "x-sig-action-token": actionToken },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Could not load contacts.");
          const batch = (data.data ?? []) as Contact[];
          all.push(...batch);
          if (batch.length < PAGE || page * PAGE >= (data.total ?? 0)) break;
        }
      }
      all.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setContacts(all);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }, [actionToken]);

  const loadCustomFields = useCallback(async () => {
    const res = await fetch("/api/admin/contacts/fields", { headers: { "x-sig-action-token": actionToken } });
    const data = await res.json().catch(() => ({}));
    setCustomFields(data.fields ?? []);
  }, [actionToken]);

  useEffect(() => {
    void fetchContacts();
    void loadCustomFields();
  }, [fetchContacts, loadCustomFields]);

  async function patch(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/contacts/${id}`, { method: "PATCH", headers, body: JSON.stringify({ ...fields, actionToken }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Update failed.");
    const updated = data.contact as Contact | undefined;
    if (updated) setContacts((list) => list.map((c) => (c.id === id ? updated : c)));
  }

  async function destroy(id: string) {
    const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE", headers, body: JSON.stringify({ actionToken }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Delete failed.");
    setContacts((list) => list.filter((c) => c.id !== id));
  }

  // ── Add / Edit ────────────────────────────────────────
  function openAdd() {
    setEditContact(null);
    setFormType(roleFocus === "lead" ? "lead" : initialType);
    setFormData({ ...BLANK_CONTACT });
    setSaveError(null);
    setShowAddModal(true);
  }

  function openEdit(c: Contact) {
    setEditContact(c);
    setFormType(c.type);
    setFormData({
      first_name: c.first_name ?? "", last_name: c.last_name ?? "",
      email: c.email ?? "", phone: c.phone ?? "",
      company: c.company ?? "", website: c.website ?? "", church: c.church ?? "",
      source: c.source ?? "", list: c.list ?? "",
      tags: (c.tags ?? []).join(", "), status: c.status,
      address_line_1: c.address_line_1 ?? "", address_line_2: c.address_line_2 ?? "",
      city: c.city ?? "", state: c.state ?? "", zip_code: c.zip_code ?? "",
      notes: c.notes ?? "", profile_photo_url: c.profile_photo_url ?? "",
      sms_opt_in: c.sms_opt_in, email_opt_in: c.email_opt_in,
    });
    setSaveError(null);
    setShowAddModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(/[,;]+/).map((t) => t.trim()).filter(Boolean),
        type: formType,
        actionToken,
      };
      const url = editContact ? `/api/admin/contacts/${editContact.id}` : "/api/admin/contacts";
      const res = await fetch(url, { method: editContact ? "PATCH" : "POST", headers, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setShowAddModal(false);
      await fetchContacts();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Import (existing CSV import route) ───────────────
  async function handleImport(rows: Record<string, string>[]) {
    // The kit's CSV export guards formula-like cells with a leading apostrophe; undo that on the way back in.
    const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => {
        const out = /^'[=+\-@]/.test(v) ? v.slice(1) : v;
        return [k, /^status$/i.test(k.trim()) ? out.toLowerCase() : out];
      })));
    // A "Role"/"Type" column decides contact vs lead per row; everything else imports as a contact.
    const roleOf = (r: Record<string, string>) => {
      const key = Object.keys(r).find((k) => /^(role|type)$/i.test(k.trim()));
      return key && r[key].trim().toLowerCase() === "lead" ? "lead" : "contact";
    };
    const groups = { contact: clean.filter((r) => roleOf(r) === "contact"), lead: clean.filter((r) => roleOf(r) === "lead") };
    const done: string[] = [];
    const mapped = new Set<string>();
    for (const type of ["contact", "lead"] as const) {
      const group = groups[type];
      if (!group.length) continue;
      const fd = new FormData();
      fd.set("file", new File([rowsToCsv(group)], `import-${type}s.csv`, { type: "text/csv" }));
      fd.set("type", type);
      fd.set("actionToken", actionToken);
      const res = await fetch("/api/admin/contacts/import", { method: "POST", headers: { "x-sig-action-token": actionToken }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      done.push(`${data.imported} ${type}${data.imported === 1 ? "" : "s"}`);
      (data.mappedColumns ?? []).forEach((c: string) => mapped.add(c));
    }
    await fetchContacts();
    return `Imported ${done.join(" and ")}.${mapped.size ? ` Mapped columns: ${[...mapped].join(", ")}.` : ""}`;
  }

  // ── Delete (single) ───────────────────────────────────
  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await destroy(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Convert ───────────────────────────────────────────
  async function handleConvert() {
    if (!convertContact) return;
    setConverting(true);
    setConvertMsg(null);
    try {
      const res = await fetch(`/api/admin/contacts/${convertContact.id}/convert`, {
        method: "POST",
        headers,
        body: JSON.stringify({ target: convertTarget, actionToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Conversion failed.");
      setConvertMsg("Invitation created. Complete it from User Management.");
      await fetchContacts();
    } catch (err) {
      setConvertMsg(`Error: ${err instanceof Error ? err.message : "Failed."}`);
    } finally {
      setConverting(false);
    }
  }

  // ── Custom fields ─────────────────────────────────────
  async function addCustomField() {
    if (!newFieldLabel.trim()) return;
    await fetch("/api/admin/contacts/fields", {
      method: "POST",
      headers,
      body: JSON.stringify({ field_label: newFieldLabel, field_type: newFieldType, actionToken }),
    });
    setNewFieldLabel("");
    await loadCustomFields();
  }

  async function deleteCustomField(id: string) {
    await fetch(`/api/admin/contacts/fields/${id}`, { method: "DELETE", headers, body: JSON.stringify({ actionToken }) });
    await loadCustomFields();
  }

  // ── Bulk ──────────────────────────────────────────────
  function openBulk(next: Bulk) {
    setBulk(next);
    setBulkError(null);
    setBulkValue(next.kind === "role" ? "lead" : next.kind === "status" ? "active" : next.kind === "owner" ? staff[0]?.id ?? "" : "");
  }

  async function applyBulk() {
    if (!bulk) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const tags = bulkValue.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
      await eachLimit(bulk.rows, 5, async (c) => {
        if (bulk.kind === "addTags") {
          const next = Array.from(new Set([...(c.tags ?? []), ...tags]));
          if (next.length !== (c.tags ?? []).length) await patch(c.id, { tags: next });
        } else if (bulk.kind === "removeTags") {
          const drop = new Set(tags.map((t) => t.toLowerCase()));
          const next = (c.tags ?? []).filter((t) => !drop.has(t.toLowerCase()));
          if (next.length !== (c.tags ?? []).length) await patch(c.id, { tags: next });
        } else if (bulk.kind === "role") {
          if (c.type !== bulkValue) await patch(c.id, { type: bulkValue });
        } else if (bulk.kind === "status") {
          if (c.status !== bulkValue) await patch(c.id, { status: bulkValue });
        } else if (bulk.kind === "owner") {
          await patch(c.id, { custom_fields: { ...(c.custom_fields ?? {}), owner_id: bulkValue || null } });
        }
      });
      setBulk(null);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Some updates failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  // ── Derived ───────────────────────────────────────────
  const staffName = useCallback((id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? null : null), [staff]);
  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort((a, b) => a.localeCompare(b)), [contacts]);
  const tagsForRows = (rows: Contact[]) => Array.from(new Set(rows.flatMap((c) => c.tags ?? []))).sort((a, b) => a.localeCompare(b));
  const items = useMemo(
    () =>
      roleFocus === "converted"
        ? contacts.filter((c) => c.status === "converted")
        : roleFocus
          ? contacts.filter((c) => c.type === roleFocus)
          : contacts,
    [contacts, roleFocus],
  );
  const count = (fn: (c: Contact) => boolean) => contacts.filter(fn).length;
  const focus = (f: typeof roleFocus) => () => setRoleFocus((cur) => (cur === f ? "" : f));

  const columns: DataColumn<Contact>[] = [
    {
      id: "name", label: "Name", required: true, width: 240, sort: fullName,
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar c={c} size="h-7 w-7 text-[11px]" />
          <span className="truncate font-medium">{fullName(c)}</span>
        </span>
      ),
    },
    { id: "role", label: "Role", width: 110, cell: (c) => <Pill className={ROLE_CLASS[c.type]}>{roleLabel(c.type)}</Pill>, sort: (c) => roleLabel(c.type), exportValue: (c) => c.type },
    { id: "company", label: "Company", width: 180, cell: (c) => c.company ?? "—", sort: (c) => c.company },
    { id: "email", label: "Email", width: 240, cell: (c) => c.email ?? "—", sort: (c) => c.email },
    { id: "phone", label: "Phone", width: 150, cell: (c) => <span className="font-mono text-xs">{c.phone ?? "—"}</span>, sort: (c) => c.phone },
    { id: "owner", label: "Owner", width: 160, cell: (c) => staffName(ownerId(c)) ?? "—", sort: (c) => staffName(ownerId(c)) },
    { id: "status", label: "Status", width: 120, cell: (c) => <Pill className={STATUS_CLASS[c.status]}>{statusLabel(c.status)}</Pill>, sort: (c) => statusLabel(c.status), exportValue: (c) => c.status },
    {
      id: "tags", label: "Tags", width: 220,
      cell: (c) => (
        <span className="flex gap-1 overflow-hidden">
          {(c.tags ?? []).slice(0, 3).map((t) => <Badge key={t} variant="outline" className="shrink-0 text-[10px]">{t}</Badge>)}
          {(c.tags ?? []).length > 3 ? <Badge variant="outline" className="shrink-0 text-[10px]">+{c.tags.length - 3}</Badge> : null}
          {!(c.tags ?? []).length ? "—" : null}
        </span>
      ),
      sort: (c) => (c.tags ?? []).join(", "),
      exportValue: (c) => (c.tags ?? []).join("; "),
    },
    { id: "source", label: "Source", width: 140, cell: (c) => c.source ?? "—", sort: (c) => c.source, defaultHidden: true },
    { id: "list", label: "List", width: 140, cell: (c) => c.list ?? "—", sort: (c) => c.list, defaultHidden: true },
    { id: "church", label: "Church", width: 180, cell: (c) => c.church ?? "—", sort: (c) => c.church, defaultHidden: true },
    {
      id: "optin", label: "Opt-in", width: 120, defaultHidden: true,
      cell: (c) => [c.email_opt_in && "Email", c.sms_opt_in && "SMS"].filter(Boolean).join(" · ") || "None",
      sort: (c) => [c.email_opt_in && "Email", c.sms_opt_in && "SMS"].filter(Boolean).join(" · ") || "None",
    },
    { id: "created", label: "Added", width: 120, defaultHidden: true, cell: (c) => new Date(c.created_at).toLocaleDateString(), sort: (c) => c.created_at, exportValue: (c) => c.created_at },
    // Export-only columns (headers match the import route's mapping so an export re-imports cleanly).
    ...(
      [
        ["first_name", "First Name"], ["last_name", "Last Name"], ["website", "Website"],
        ["address_line_1", "Address Line 1"], ["address_line_2", "Address Line 2"], ["city", "City"], ["state", "State"],
        ["zip_code", "Zip Code"], ["notes", "Notes"], ["profile_photo_url", "Profile Photo"],
      ] as const
    ).map(([key, label]): DataColumn<Contact> => ({
      id: key, label, width: key === "notes" ? 280 : 160, defaultHidden: true,
      cell: (c) => (c[key] as string | null) ?? "—",
      sort: (c) => c[key] as string | null,
    })),
    { id: "sms_opt_in", label: "SMS Opt In", width: 110, defaultHidden: true, cell: (c) => (c.sms_opt_in ? "Yes" : "No"), sort: (c) => (c.sms_opt_in ? "Yes" : "No"), exportValue: (c) => String(c.sms_opt_in) },
    { id: "email_opt_in", label: "Email Opt In", width: 110, defaultHidden: true, cell: (c) => (c.email_opt_in ? "Yes" : "No"), sort: (c) => (c.email_opt_in ? "Yes" : "No"), exportValue: (c) => String(c.email_opt_in) },
  ];

  const bulkTitle = bulk
    ? { addTags: "Add tags", removeTags: "Remove tags", role: "Change role", status: "Change status", owner: "Set owner" }[bulk.kind]
    : "";

  return (
    <div className="space-y-4">
      {loadError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p> : null}

      <DataView<Contact>
        storageKey="contacts"
        exportName="sig-contacts"
        noun={["contact", "contacts"]}
        loading={loading}
        items={items}
        getId={(c) => c.id}
        title={fullName}
        subtitle={(c) => c.email ?? c.phone ?? c.company ?? "No contact details"}
        media={(c) => <Avatar c={c} />}
        badge={(c) => <Pill className={ROLE_CLASS[c.type]}>{roleLabel(c.type)}</Pill>}
        meta={(c) => (
          <span className="flex items-center gap-2">
            {c.company ? <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company}</span> : null}
            {c.status !== "active" ? <Pill className={STATUS_CLASS[c.status]}>{statusLabel(c.status)}</Pill> : null}
          </span>
        )}
        columns={columns}
        searchText={(c) => [fullName(c), c.email, c.phone, c.company, c.church, c.source, c.list, (c.tags ?? []).join(" "), c.notes, c.city, c.state].join(" ")}
        stats={[
          { label: "All contacts", value: contacts.length, icon: Users, hint: `${count((c) => c.status === "active")} active`, onClick: () => setRoleFocus(""), active: roleFocus === "" },
          { label: "Leads", value: count((c) => c.type === "lead"), icon: CircleDot, hint: "Role: lead", onClick: focus("lead"), active: roleFocus === "lead" },
          { label: "Contacts", value: count((c) => c.type === "contact"), icon: UserCheck, hint: "Role: contact", onClick: focus("contact"), active: roleFocus === "contact" },
          { label: "Converted", value: count((c) => c.status === "converted"), icon: UserPlus, hint: "Invited as dashboard users", onClick: focus("converted"), active: roleFocus === "converted" },
        ]}
        selectFilters={[
          { id: "role", label: "Role", options: ROLES.map((r) => ({ value: r.value, label: r.label })), get: (c) => c.type },
          { id: "status", label: "Status", options: STATUSES.map((s) => ({ value: s.value, label: s.label })), get: (c) => c.status },
          { id: "tags", label: "Tags", options: allTags.map((t) => ({ value: t, label: t })), get: (c) => c.tags ?? [] },
          { id: "owner", label: "Owner", options: [...staff.map((s) => ({ value: s.id, label: s.name })), { value: "__none", label: "No owner" }], get: (c) => ownerId(c) ?? "__none" },
          {
            id: "optin", label: "Opt-in",
            options: [{ value: "email", label: "Email opted in" }, { value: "sms", label: "SMS opted in" }, { value: "none", label: "Not opted in" }],
            get: (c) => (c.email_opt_in || c.sms_opt_in ? [c.email_opt_in ? "email" : "", c.sms_opt_in ? "sms" : ""].filter(Boolean) : ["none"]),
          },
        ]}
        board={{
          lanes: ROLES.map((r) => ({ id: r.value, label: `${r.label}s` })),
          get: (c) => c.type,
          onMove: (c, lane) => patch(c.id, { type: lane }).catch((e) => window.alert(e instanceof Error ? e.message : "Could not change the role.")),
        }}
        actions={[
          { label: "Add tags", icon: Tag, run: (rows) => openBulk({ kind: "addTags", rows }) },
          { label: "Remove tags", icon: Tags, show: (rows) => rows.some((c) => (c.tags ?? []).length), run: (rows) => openBulk({ kind: "removeTags", rows }) },
          { label: "Role", icon: Shuffle, run: (rows) => openBulk({ kind: "role", rows }) },
          { label: "Status", icon: CircleDot, run: (rows) => openBulk({ kind: "status", rows }) },
          ...(staff.length ? [{ label: "Owner", icon: UserCheck, run: (rows: Contact[]) => openBulk({ kind: "owner", rows }) }] : []),
          { label: "Email", icon: Mail, single: true, show: (rows) => Boolean(rows[0]?.email), run: (rows) => void window.open(`mailto:${rows[0].email}`) },
          {
            label: "Convert", icon: UserPlus, single: true, show: (rows) => rows[0]?.status !== "converted",
            run: (rows) => { setConvertContact(rows[0]); setConvertMsg(null); },
          },
          { label: "Edit", icon: Pencil, single: true, run: (rows) => openEdit(rows[0]) },
          {
            label: "Archive", icon: Archive, show: (rows) => rows.some((c) => c.status !== "archived"),
            run: (rows) => eachLimit(rows.filter((c) => c.status !== "archived"), 5, (c) => patch(c.id, { status: "archived" })),
          },
          {
            label: "Delete", icon: Trash2, destructive: true,
            run: (rows) =>
              window.confirm(`Permanently delete ${rows.length} contact${rows.length === 1 ? "" : "s"}? This cannot be undone.`)
                ? eachLimit(rows, 5, (c) => destroy(c.id))
                : undefined,
          },
        ]}
        add={{ label: "Add contact", onClick: openAdd }}
        onImport={handleImport}
        toolbar={
          <>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setShowFieldSettings(true); void loadCustomFields(); }} title="Custom fields">
              <Settings2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Fields</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 w-9 px-0" onClick={() => void fetchContacts()} title="Refresh" aria-label="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </>
        }
        preview={(c, close) => (
          <ContactDetail
            c={c}
            ownerName={staffName(ownerId(c))}
            customFields={customFields}
            onEdit={() => { close(); openEdit(c); }}
            onDelete={() => { close(); setDeleteConfirm(c); }}
            onConvert={() => { setConvertContact(c); setConvertMsg(null); }}
          />
        )}
        empty={
          <span>
            No contacts yet. Add one, or import a CSV with headers like First Name, Last Name, Email, Phone, Company, Church, Source, List, Tags,
            Status, Website, Address Line 1, City, State, Zip Code, Notes (add a Role column with “lead” to import leads).
          </span>
        }
      />

      {/* Add / Edit */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit" : "Add"} {roleLabel(formType).toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label>Role</Label>
            <FieldSelect value={formType} onChange={setFormType} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
          <ContactFormFields data={formData} onChange={(p) => setFormData((d) => ({ ...d, ...p }))} />
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit */}
      <Dialog open={Boolean(bulk)} onOpenChange={(o) => !o && !bulkBusy && setBulk(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{bulkTitle}</DialogTitle>
            <DialogDescription>
              {bulk ? `${bulk.rows.length} contact${bulk.rows.length === 1 ? "" : "s"} selected.` : null}
            </DialogDescription>
          </DialogHeader>
          {bulk?.kind === "addTags" || bulk?.kind === "removeTags" ? (
            <div className="space-y-3">
              <Input
                autoFocus
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Tags, separated by commas"
                onKeyDown={(e) => e.key === "Enter" && bulkValue.trim() && void applyBulk()}
              />
              {(() => {
                const options = bulk.kind === "removeTags" ? tagsForRows(bulk.rows) : allTags;
                const chosen = bulkValue.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
                return options.length ? (
                  <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {options.map((t) => {
                      const on = chosen.includes(t.toLowerCase());
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setBulkValue((v) => {
                              const list = v.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
                              return (on ? list.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...list, t]).join(", ");
                            })
                          }
                          className={cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
            </div>
          ) : bulk?.kind === "role" ? (
            <FieldSelect value={bulkValue} onChange={setBulkValue} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} />
          ) : bulk?.kind === "status" ? (
            <FieldSelect value={bulkValue} onChange={setBulkValue} options={STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          ) : bulk?.kind === "owner" ? (
            <FieldSelect value={bulkValue} onChange={setBulkValue} options={[{ value: "", label: "No owner (creator)" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
          ) : null}
          {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setBulk(null)} disabled={bulkBusy}>Cancel</Button>
            <Button
              onClick={() => void applyBulk()}
              disabled={bulkBusy || ((bulk?.kind === "addTags" || bulk?.kind === "removeTags") && !bulkValue.trim())}
            >
              {bulkBusy ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert */}
      <Dialog open={Boolean(convertContact)} onOpenChange={(o) => !o && setConvertContact(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert {convertContact ? fullName(convertContact) : "contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose what to create from this {convertContact ? roleLabel(convertContact.type).toLowerCase() : "contact"}:</p>
            <Select value={convertTarget} onValueChange={(v: string) => setConvertTarget(v as "profile")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profile">Dashboard user (profile / staff)</SelectItem>
              </SelectContent>
            </Select>
            {convertMsg && (
              <div className={cn("rounded p-3 text-sm", convertMsg.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
                {convertMsg}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConvertContact(null)}>{convertMsg && !convertMsg.startsWith("Error") ? "Done" : "Cancel"}</Button>
            <Button onClick={handleConvert} disabled={converting || Boolean(convertMsg && !convertMsg.startsWith("Error"))}>
              {converting ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm (from the preview) */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o: boolean) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm">
          <DialogHeader><DialogTitle>Delete {deleteConfirm ? fullName(deleteConfirm) : "contact"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom field settings */}
      <Dialog open={showFieldSettings} onOpenChange={setShowFieldSettings}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader><DialogTitle>Custom contact fields</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {customFields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields defined yet.</p>}
              {customFields.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.field_label}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.field_key} · {f.field_type}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteCustomField(f.id)} aria-label={`Delete ${f.field_label}`}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Field label (e.g. Baptism Date)" className="min-w-0 flex-1 basis-48" />
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["text", "email", "phone", "url", "textarea", "select", "date", "number", "checkbox"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-10" onClick={addCustomField} disabled={!newFieldLabel.trim()} aria-label="Add field">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowFieldSettings(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactDetail({
  c, ownerName, customFields, onEdit, onDelete, onConvert,
}: {
  c: Contact;
  ownerName: string | null;
  customFields: CustomField[];
  onEdit: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const custom = customFields
    .map((f) => [f.field_label, c.custom_fields?.[f.field_key]] as const)
    .filter(([, v]) => v !== undefined && v !== null && v !== "");
  const quick = "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors hover:bg-accent";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Pill className={STATUS_CLASS[c.status]}>{statusLabel(c.status)}</Pill>
        <Pill className={ROLE_CLASS[c.type]}>{roleLabel(c.type)}</Pill>
        {c.converted_to_participant_id || c.converted_to_profile_id ? <Pill className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Converted</Pill> : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={c.email ? `mailto:${c.email}` : undefined} aria-disabled={!c.email} className={cn(quick, !c.email && "pointer-events-none opacity-40")}>
          <Mail className="h-5 w-5 text-primary" /> Email
        </a>
        <a href={c.phone ? `tel:${c.phone}` : undefined} aria-disabled={!c.phone} className={cn(quick, !c.phone && "pointer-events-none opacity-40")}>
          <Phone className="h-5 w-5 text-primary" /> Call
        </a>
        <a
          href={c.phone ? `/dashboard/sms/compose?phone=${encodeURIComponent(c.phone)}&name=${encodeURIComponent(fullName(c))}` : undefined}
          aria-disabled={!c.phone}
          className={cn(quick, !c.phone && "pointer-events-none opacity-40")}
        >
          <MessageSquare className="h-5 w-5 text-primary" /> SMS
        </a>
      </div>

      <dl className="grid gap-2.5 rounded-xl border bg-muted/30 p-4 text-sm">
        <DetailRow label="Email" value={c.email} />
        <DetailRow label="Phone" value={c.phone} />
        <DetailRow label="Company" value={c.company} />
        <DetailRow label="Church" value={c.church} />
        <DetailRow label="Website" value={c.website} link />
        <DetailRow label="Owner" value={ownerName} />
        <DetailRow label="Source" value={c.source} />
        <DetailRow label="List" value={c.list} />
        <DetailRow label="Location" value={[c.address_line_1, c.address_line_2, c.city, c.state, c.zip_code].filter(Boolean).join(", ")} />
        <DetailRow label="Opt-in" value={`Email ${c.email_opt_in ? "yes" : "no"} · SMS ${c.sms_opt_in ? "yes" : "no"}`} />
        <DetailRow label="Added" value={new Date(c.created_at).toLocaleDateString()} />
        {custom.map(([label, v]) => (
          <DetailRow key={label} label={label} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)} />
        ))}
        {(c.tags ?? []).length > 0 && (
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</dd>
          </div>
        )}
      </dl>

      {c.notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{c.notes}</p>
        </div>
      )}

      {c.status !== "converted" && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Convert</p>
          <Button variant="outline" size="sm" className="w-full" onClick={onConvert}>
            <UserPlus className="h-3.5 w-3.5" /> Invite as dashboard user
          </Button>
        </div>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>Edit contact</Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete contact" title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">
        {link ? (
          <a href={/^https?:\/\//i.test(value) ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{value}</a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
