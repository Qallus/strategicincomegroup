"use client";

import { ArrowRight, HelpCircle } from "lucide-react";
import { askSiggey } from "@/components/public-site/site-search";

export function AskSiggeyCard() {
  return (
    <div className="rounded-2xl border bg-muted/40 p-5">
      <p className="flex items-center gap-2 font-semibold">
        <HelpCircle className="h-4 w-4 text-gold" /> Quick answer?
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Services, offices, the Three Phases of Wealth, getting started and more.</p>
      <button type="button" onClick={() => askSiggey("")} className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
        Ask Siggey <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
