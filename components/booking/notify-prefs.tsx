"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  BOOKING_EMAIL_CONSENT_HINT, BOOKING_EMAIL_CONSENT_LABEL, BOOKING_SMS_CONSENT_LABEL, BOOKING_SMS_CONSENT_TEXT,
} from "@/lib/booking/consent";

/** Email + SMS opt-ins — both OFF by default; the SMS disclosure is shown verbatim. Shared with /book/manage. */
export function NotifyPrefs({ notifyEmail, notifySms, onEmail, onSms, missingPhone, idPrefix = "bk" }: {
  notifyEmail: boolean; notifySms: boolean; onEmail: (v: boolean) => void; onSms: (v: boolean) => void; missingPhone?: boolean; idPrefix?: string;
}) {
  return (
    <fieldset className="mt-6 rounded-2xl border bg-muted/30">
      <legend className="sr-only">Reminders and updates</legend>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Stay in the loop</p>
        <p className="text-xs text-muted-foreground">Optional — choose how you’d like to hear from us about this appointment.</p>
      </div>
      <OptInRow id={`${idPrefix}-notify-email`} icon={Mail} label={BOOKING_EMAIL_CONSENT_LABEL} hint={BOOKING_EMAIL_CONSENT_HINT} checked={notifyEmail} onChange={onEmail} />
      <OptInRow
        id={`${idPrefix}-notify-sms`}
        icon={MessageSquareText}
        label={BOOKING_SMS_CONSENT_LABEL}
        hint={BOOKING_SMS_CONSENT_TEXT}
        checked={notifySms}
        onChange={onSms}
        border
        footnote={
          <>
            See our <Link href="/communication-policy" className="underline underline-offset-2 hover:text-foreground">communication policy</Link> and{" "}
            <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">privacy policy</Link>.
          </>
        }
      />
      {missingPhone ? <p className="sig-book-in border-t px-4 py-2.5 text-xs font-medium text-gold">Add your mobile number above to get text reminders.</p> : null}
    </fieldset>
  );
}

function OptInRow({ id, icon: RowIcon, label, hint, checked, onChange, border, footnote }: {
  id: string; icon: typeof Mail; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; border?: boolean; footnote?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", border && "border-t")}>
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors", checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        <RowIcon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">{label}</label>
        <p id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-desc`} className="mt-1 data-[state=unchecked]:bg-muted-foreground/30" />
    </div>
  );
}
