"use client";

import * as React from "react";
import { Apple, CalendarPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/booking/ics";
import { cn } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09z" />
      <path fill="#34A853" d="M12 23c2.96 0 5.45-.98 7.26-2.65l-3.54-2.75c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.2v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.85 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.2a11 11 0 0 0 0 9.92l3.65-2.84z" />
      <path fill="#EA4335" d="M12 5.35c1.61 0 3.06.55 4.2 1.64l3.14-3.14A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.2 7.04l3.65 2.84C6.71 7.28 9.14 5.35 12 5.35z" />
    </svg>
  );
}
function OutlookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="2" y="4" width="13" height="16" rx="2" fill="#0A64D6" />
      <path fill="#fff" d="M8.5 8.2c-2 0-3.2 1.6-3.2 3.8s1.2 3.8 3.2 3.8 3.2-1.6 3.2-3.8-1.2-3.8-3.2-3.8zm0 6.1c-1 0-1.6-.9-1.6-2.3s.6-2.3 1.6-2.3 1.6.9 1.6 2.3-.6 2.3-1.6 2.3z" />
      <path fill="#2B88E8" d="M15 7h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-6z" />
    </svg>
  );
}

/**
 * Google / Outlook / Apple / .ics. Apple Calendar and "ICS file" both use the .ics —
 * from `icsHref` (a server URL, e.g. the manage link's ?view=ics) or built in the browser.
 */
export function AddToCalendar({ event, icsHref, className, label = "Add to your calendar" }: {
  event: CalendarEvent; icsHref?: string | null; className?: string; label?: string;
}) {
  function download() {
    const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SIG-appointment-${event.uid}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const icsButton = (children: React.ReactNode, aria: string) =>
    icsHref ? (
      <Button asChild variant="outline" size="sm" className="h-10 gap-2">
        <a href={icsHref} aria-label={aria}>{children}</a>
      </Button>
    ) : (
      <Button type="button" variant="outline" size="sm" className="h-10 gap-2" onClick={download} aria-label={aria}>{children}</Button>
    );

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarPlus className="h-4 w-4 text-gold" aria-hidden /> {label}</p>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4")}>
        <Button asChild variant="outline" size="sm" className="h-10 gap-2">
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><GoogleMark /> Google</a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-10 gap-2">
          <a href={outlookCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><OutlookMark /> Outlook</a>
        </Button>
        {icsButton(<><Apple className="h-4 w-4" aria-hidden /> Apple</>, "Add to Apple Calendar (.ics)")}
        {icsButton(<><Download className="h-4 w-4" aria-hidden /> ICS file</>, "Download .ics file")}
      </div>
    </div>
  );
}
