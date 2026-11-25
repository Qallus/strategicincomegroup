"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Phone, PhoneCall } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsDesktop } from "../dashboard-context";
import { WidgetShell, type WidgetProps } from "./shell";

// The browser phone (Twilio Voice SDK) — loaded only in the browser, and only when the card
// is real (not an Add Card preview), so it registers one device per dashboard.
const Softphone = dynamic(() => import("@/components/dialer/softphone").then((m) => m.Softphone), {
  ssr: false,
  loading: () => <div className="sig-skeleton h-64 w-full" />,
});

export default function DialpadWidget({ def, preview }: WidgetProps) {
  const desktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);

  if (preview) {
    return (
      <WidgetShell icon={def.icon} title={def.title} tone="navy">
        <div className="grid grid-cols-3 gap-2 px-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
            <span key={k} className="flex h-9 items-center justify-center rounded-full border border-border/70 bg-background/60 text-sm font-semibold">{k}</span>
          ))}
        </div>
      </WidgetShell>
    );
  }

  if (!desktop) {
    return (
      <WidgetShell icon={def.icon} title={def.title} subtitle="Browser phone" href="/dashboard/dialer" hrefLabel="Dialer" tone="navy">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-h-[7rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/60 text-sm font-semibold transition hover:border-brand-gold/60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-sage text-white shadow-lg shadow-brand-sage/30">
            <PhoneCall className="h-5 w-5" aria-hidden />
          </span>
          Open dialpad
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92dvh] overflow-y-auto p-4 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden /> Dialpad</DialogTitle>
              <DialogDescription>Calls use your SIG number. Keep this open during the call.</DialogDescription>
            </DialogHeader>
            <Softphone />
          </DialogContent>
        </Dialog>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell icon={def.icon} title={def.title} href="/dashboard/dialer" hrefLabel="Dialer" tone="navy" bodyClassName="overflow-y-auto">
      <Softphone />
    </WidgetShell>
  );
}
