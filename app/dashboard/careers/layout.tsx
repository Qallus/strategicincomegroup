import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Access guard for /dashboard/careers and all nested routes (same as Blog Posts).
export default async function GuardLayout({ children }: { children: ReactNode }) {
  await requirePagePermission(PERMISSIONS.REVIEW_CONTENT, "/dashboard/careers");
  return <>{children}</>;
}
