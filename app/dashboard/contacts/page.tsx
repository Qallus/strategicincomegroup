import { SectionHeader } from "@/components/dashboard/section-header";
import { ContactsManager, type ContactStaff } from "@/components/contacts/contacts-manager";
import { loadStaffOptions } from "@/lib/business-cards/data";

// Roles that can own contacts (the same roles the contacts API lets in).
const OWNER_ROLES = new Set(["super_admin", "admin", "team_member"]);

export default async function ContactsPage() {
  const staff: ContactStaff[] = await loadStaffOptions()
    .then((list) =>
      list
        .filter((s) => OWNER_ROLES.has(String(s.role_slug ?? "")))
        .map((s) => ({ id: s.id, name: s.display_name || s.email || "Unnamed" })),
    )
    .catch(() => []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contacts"
        description="Manage contacts and leads. Import, track, and convert them to participants or dashboard users."
      />
      <ContactsManager staff={staff} />
    </div>
  );
}
