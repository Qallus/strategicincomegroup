import Link from "next/link";
import { CalendarClock, Mail, MessageSquareText } from "lucide-react";
import { loadUpcomingBookings } from "@/lib/booking/data";
import type { Booking } from "@/lib/booking/types";

const AZ = "America/Phoenix";

function when(b: Booking) {
  const tz = b.timezone || AZ;
  const d = new Date(b.start_at);
  const dayKey = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const day = dayKey(d) === today ? "Today" : dayKey(d) === tomorrow ? "Tomorrow" : d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  return { day, time: d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) };
}

/**
 * Dashboard home: the signed-in planner's next appointments. Admins with none of their
 * own see the firm's next appointments instead. Never throws (renders nothing on error).
 */
export async function UpcomingAppointmentsCard({ profileId, isAdmin }: { profileId: string; isAdmin: boolean }) {
  let items: Booking[] = [];
  let firmWide = false;
  try {
    items = await loadUpcomingBookings({ hostId: profileId, limit: 5 });
    if (!items.length && isAdmin) {
      items = await loadUpcomingBookings({ hostId: null, limit: 5 });
      firmWide = items.length > 0;
    }
  } catch {
    return null;
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{firmWide ? "Upcoming appointments (all planners)" : "Your upcoming appointments"}</h2>
        <Link href="/dashboard/bookings" className="text-xs font-medium text-primary hover:underline">Open appointments</Link>
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card px-5 py-6 text-sm text-muted-foreground">
          <CalendarClock className="h-5 w-5 text-gold" aria-hidden />
          No upcoming appointments on your calendar.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {items.map((b) => {
            const w = when(b);
            return (
              <li key={b.id}>
                <Link href="/dashboard/bookings" className="flex items-center gap-4 px-5 py-3 transition hover:bg-muted/50">
                  <span className="w-24 shrink-0">
                    <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{w.day}</span>
                    <span className="block font-semibold tabular-nums">{w.time}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.invitee_name}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.booking_type?.color || "hsl(var(--primary))" }} />
                      {b.booking_type?.name ?? "Appointment"}
                      {firmWide && b.booking_type?.host_name ? ` · ${b.booking_type.host_name.split(",")[0]}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <Mail className={b.notify_email ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 opacity-30"} aria-label={b.notify_email ? "Email reminders on" : "Email reminders off"} />
                    <MessageSquareText className={b.notify_sms ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 opacity-30"} aria-label={b.notify_sms ? "Text reminders on" : "Text reminders off"} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
