"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { name: string; client: string; nonClient: string; note?: string };

const ITEMS: Item[] = [
  { name: "Estate Plan review of existing documents", client: "$200", nonClient: "$250", note: "Have an attorney review and comment on your current Estate Plan and recommend any needed changes or updates." },
  { name: "Creation of a new Will based plan", client: "$1,095", nonClient: "$1,295", note: "Living Will, Medical Power of Attorney, Financial Power of Attorney" },
  { name: "Creation of a new Trust based plan", client: "$1,695", nonClient: "$1,895", note: "State specific Revocable Living Trust, with Living Will, Medical Power of Attorney, Financial Power of Attorney, Community Property Agreements, HIPAA releases" },
  { name: "Each Property Deed into new Trust", client: "$300", nonClient: "$350", note: "(AZ) (some states are higher, check rates)" },
  { name: "Estate Plan Amendment", client: "$300", nonClient: "$350" },
  { name: "Powers Package", client: "$275", nonClient: "$325" },
  { name: "Business Assignments", client: "$100", nonClient: "$150", note: "per entity" },
];

const INCLUDES = [
  "Creation of a state specific Revocable Living Trust with Living Will, Medical Power of Attorney, Financial Power of Attorney, Community Property Agreements, HIPAA releases",
  "Deed primary home to trust",
  "Life/Disability Needs Analysis w/recommendations",
  "Budget Analysis w/recommendations (Housing Expense Ratio, Consumer Debt Ratio, Total Debt Ratio, Power Dollars)",
  "Investment Risk assessment w/recommendations",
];

/** Estate planning service menu with the SIG Clients / Non-Clients toggle from the live page. */
export function EstatePricing() {
  const [who, setWho] = useState<"client" | "nonClient">("client");
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
          <h3 className="font-serif text-2xl">Service Menu</h3>
          <div role="tablist" aria-label="Pricing for" className="inline-flex rounded-lg border bg-muted p-1 text-sm">
            {(["client", "nonClient"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={who === k}
                onClick={() => setWho(k)}
                className={cn("rounded-md px-3 py-1.5 font-medium transition", who === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {k === "client" ? "SIG Clients" : "Non-Clients"}
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y">
          {ITEMS.map((i) => (
            <li key={i.name} className="flex items-start justify-between gap-6 p-5">
              <div>
                <p className="font-medium">{i.name}</p>
                {i.note ? <p className="mt-1 text-sm text-muted-foreground">{i.note}</p> : null}
              </div>
              <p className="shrink-0 font-serif text-2xl text-gold">{i[who]}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-muted/40 p-6">
        <h3 className="font-serif text-xl">Signing & Review Meeting Includes</h3>
        <ul className="mt-4 space-y-3 text-sm">
          {INCLUDES.map((x) => (
            <li key={x} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          Financial Foundations is no longer available. Discovery Meeting to gather all necessary information and documents.
        </p>
      </div>
    </div>
  );
}
