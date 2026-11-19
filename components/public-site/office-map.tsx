"use client";

import { useState } from "react";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type Office = {
  name: string;
  city: string;
  street: string;
  locality: string;
};

const query = (o: Office) => encodeURIComponent(`Strategic Income Group, ${o.street}, ${o.locality}`);
export const googleMapsUrl = (o: Office) => `https://www.google.com/maps/search/?api=1&query=${query(o)}`;
export const directionsUrl = (o: Office) => `https://www.google.com/maps/dir/?api=1&destination=${query(o)}`;
export const appleMapsUrl = (o: Office) => `https://maps.apple.com/?q=${query(o)}`;

/**
 * Stylised vector street map drawn with theme tokens, so it matches the UI in
 * light and dark mode. `variant` changes the street layout per office.
 */
export function VectorMap({ variant, label, className }: { variant: "east" | "west"; label: string; className?: string }) {
  const east = variant === "east";
  return (
    <svg viewBox="0 0 400 180" className={cn("h-full w-full", className)} role="img" aria-label={`Map of ${label}`} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="180" fill="hsl(var(--muted))" />
      {/* blocks */}
      <g fill="hsl(var(--background))" opacity="0.7">
        {Array.from({ length: 6 }).flatMap((_, c) =>
          Array.from({ length: 3 }).map((__, r) => <rect key={`${c}-${r}`} x={14 + c * 66} y={10 + r * 58} width="52" height="44" rx="4" />),
        )}
      </g>
      {/* park */}
      <rect x={east ? 278 : 80} y={east ? 126 : 10} width="52" height="44" rx="4" fill="hsl(var(--brand-sage) / 0.22)" />
      {/* minor streets */}
      <g stroke="hsl(var(--border))" strokeWidth="6">
        {[73, 139, 205, 271, 337].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="180" />
        ))}
        {[60, 118].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} />
        ))}
      </g>
      {/* arterial road */}
      {east ? (
        <line x1="0" y1="89" x2="400" y2="89" stroke="hsl(var(--brand-gold) / 0.55)" strokeWidth="11" />
      ) : (
        <path d="M150 180 C 165 120, 190 80, 230 0" fill="none" stroke="hsl(var(--brand-gold) / 0.55)" strokeWidth="11" />
      )}
      <text
        x={east ? 18 : 238}
        y={east ? 84 : 20}
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.08em"
        fill="hsl(var(--muted-foreground))"
      >
        {east ? "W RAY RD" : "N LAKE PLEASANT RD"}
      </text>
      {/* pin */}
      <g transform={east ? "translate(205 89)" : "translate(196 75)"}>
        <circle r="22" fill="hsl(var(--primary) / 0.12)">
          <animate attributeName="r" values="14;26;14" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <path d="M0 -20 C 9 -20 14 -13 14 -6 C 14 4 0 14 0 14 C 0 14 -14 4 -14 -6 C -14 -13 -9 -20 0 -20 Z" fill="hsl(var(--primary))" />
        <circle cy="-6" r="5" fill="hsl(var(--primary-foreground))" />
      </g>
    </svg>
  );
}

/** Office card with a vector map preview; clicking opens a sheet with the live Google map and directions. */
export function OfficeMapCard({ office, variant, compact }: { office: Office; variant: "east" | "west"; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/40 hover:shadow-md"
        aria-label={`Open map for the ${office.name}`}
      >
        <div className={cn("relative overflow-hidden", compact ? "h-20" : "h-32")}>
          <VectorMap variant={variant} label={office.name} className="transition-transform duration-500 group-hover:scale-105" />
          {compact ? null : (
            <span className="absolute right-2 top-2 rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
              View map
            </span>
          )}
        </div>
        {compact ? (
          <div className="p-2.5 text-xs">
            <p className="font-medium">{office.name.replace(" Office", "")}</p>
            <p className="text-muted-foreground">{office.city} · View map</p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{office.name}</p>
              <p className="text-muted-foreground">
                {office.street}, {office.locality}
              </p>
            </div>
          </div>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-6 text-left">
            <SheetTitle className="font-serif text-2xl font-normal">{office.name}</SheetTitle>
            <SheetDescription>
              Strategic Income Group · {office.street}, {office.locality}
            </SheetDescription>
          </SheetHeader>
          <div className="relative min-h-[320px] flex-1 bg-muted">
            {open ? (
              <iframe
                title={`Google map of the ${office.name}`}
                src={`https://www.google.com/maps?q=${query(office)}&output=embed`}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : null}
          </div>
          <div className="grid gap-2 border-t p-6 sm:grid-cols-3">
            <a
              href={directionsUrl(office)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:col-span-3"
            >
              <Navigation className="h-4 w-4" /> Get directions
            </a>
            <a href={googleMapsUrl(office)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium hover:bg-muted sm:col-span-2">
              Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href={appleMapsUrl(office)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium hover:bg-muted">
              Apple Maps <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
