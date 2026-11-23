// iCalendar (.ics) + "add to calendar" links for a booking. Pure — safe on client and server.

export type CalendarEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string; // ISO UTC
  end: string; // ISO UTC
  organizerName?: string | null;
  organizerEmail?: string | null;
  url?: string | null;
  /** iCalendar SEQUENCE — bump on every change so calendar apps update the same event. */
  sequence?: number;
  /** PUBLISH (default) for a new / updated event, CANCEL to remove it from the calendar. */
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
};

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// RFC 5545: lines are folded at 75 octets.
function fold(line: string) {
  if (line.length <= 74) return line;
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

export function buildIcs(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Strategic Income Group//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method ?? "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}@strategicincomegroup.com`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `SEQUENCE:${Math.max(0, Math.floor(e.sequence ?? 0))}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    e.organizerEmail ? `ORGANIZER;CN=${esc(e.organizerName || "Strategic Income Group")}:mailto:${e.organizerEmail}` : "",
    e.method === "CANCEL" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    ...(e.method === "CANCEL" ? [] : ["BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.start)}/${icsDate(e.end)}`,
    details: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.start).toISOString(),
    enddt: new Date(e.end).toISOString(),
    body: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
