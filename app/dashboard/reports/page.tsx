import { redirect } from "next/navigation";

// Reports became Analytics (app/dashboard/analytics).
export default function ReportsPage() {
  redirect("/dashboard/analytics");
}
