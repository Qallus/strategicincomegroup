import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kidsFedForAYear } from "@/lib/booking/types";

/**
 * SIGCares × Feed My Starving Children impact, read from events with
 * impact_program = 'fmsc' (results are entered in Dashboard → Bookings & Events).
 * Kids fed for a year = meals ÷ 365, FMSC's own conversion.
 */

export type Packing = {
  slug: string;
  date: string; // ISO
  endDate: string | null;
  location: string | null;
  title: string;
  participants: number | null;
  meals: number | null; // null = upcoming / not yet recorded
  kids: number;
  countries: string[];
  upcoming: boolean;
  /** Public event page (only for published events). */
  href: string | null;
};

export type FmscImpact = {
  packings: Packing[]; // chronological, recorded + upcoming
  recorded: Packing[]; // with results, chronological
  totals: { meals: number; kids: number; packings: number; countries: number; volunteers: number | null };
  countries: { name: string; packings: number; flag: string; region: string }[];
  next: Packing | null;
  milestones: { value: number; reached: boolean }[];
  nextMilestone: number;
};

export const MILESTONES = [100_000, 250_000, 500_000, 1_000_000];

const COUNTRY_META: Record<string, { flag: string; region: string }> = {
  Cambodia: { flag: "🇰🇭", region: "Southeast Asia" },
  Philippines: { flag: "🇵🇭", region: "Southeast Asia" },
  Thailand: { flag: "🇹🇭", region: "Southeast Asia" },
  Peru: { flag: "🇵🇪", region: "South America" },
  Guatemala: { flag: "🇬🇹", region: "Central America" },
  Haiti: { flag: "🇭🇹", region: "Caribbean" },
  Nicaragua: { flag: "🇳🇮", region: "Central America" },
  Honduras: { flag: "🇭🇳", region: "Central America" },
  Kenya: { flag: "🇰🇪", region: "East Africa" },
  Uganda: { flag: "🇺🇬", region: "East Africa" },
};

type Row = {
  slug: string;
  title: string;
  status: string;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  location_address: string | null;
  is_public: boolean;
  impact_participants: number | null;
  impact_meals: number | null;
  impact_countries: string[] | null;
};

// Mirrors the 202611190130 seed (docs/events/fmsc/fmsc-food-packing-results) — used only
// until that migration is applied, so the preview site renders real numbers.
const FALLBACK: Row[] = [
  { slug: "fmsc-food-packing-2024-12", title: "Feed My Starving Children — December 2024", status: "completed", start_at: "2024-12-04T21:00:00Z", end_at: "2024-12-04T23:00:00Z", location_name: "FMSC — Tempe, AZ", location_address: "1100 W Grove Pkwy Suite 101, Tempe, AZ 85283", is_public: true, impact_participants: 9, impact_meals: 29160, impact_countries: ["Cambodia", "Philippines"] },
  { slug: "fmsc-food-packing-2025-06", title: "Feed My Starving Children — June 2025", status: "completed", start_at: "2025-06-04T21:00:00Z", end_at: "2025-06-04T23:00:00Z", location_name: "FMSC — Tempe, AZ", location_address: "1100 W Grove Pkwy Suite 101, Tempe, AZ 85283", is_public: true, impact_participants: null, impact_meals: 24408, impact_countries: ["Peru", "Guatemala"] },
  { slug: "fmsc-food-packing-2025-12", title: "Feed My Starving Children — December 2025", status: "completed", start_at: "2025-12-03T21:00:00Z", end_at: "2025-12-03T23:00:00Z", location_name: "FMSC — Tempe, AZ", location_address: "1100 W Grove Pkwy Suite 101, Tempe, AZ 85283", is_public: true, impact_participants: null, impact_meals: 27000, impact_countries: ["Cambodia", "Philippines"] },
  { slug: "fmsc-food-packing-2026-06", title: "Feed My Starving Children — June 2026", status: "completed", start_at: "2026-06-03T21:00:00Z", end_at: "2026-06-03T23:00:00Z", location_name: "FMSC — Tempe, AZ", location_address: "1100 W Grove Pkwy Suite 101, Tempe, AZ 85283", is_public: true, impact_participants: null, impact_meals: 11880, impact_countries: ["Thailand"] },
  { slug: "fmsc-food-packing-event-december", title: "Feed My Starving Children — December 2nd", status: "published", start_at: "2026-12-02T21:00:00Z", end_at: "2026-12-02T23:00:00Z", location_name: "FMSC — Tempe, AZ", location_address: "1100 W Grove Pkwy Suite 101, Tempe, AZ 85283", is_public: true, impact_participants: null, impact_meals: null, impact_countries: [] },
];

async function loadRows(): Promise<Row[]> {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("events")
      .select("slug, title, status, start_at, end_at, location_name, location_address, is_public, impact_participants, impact_meals, impact_countries")
      .eq("impact_program", "fmsc")
      .neq("status", "canceled")
      .order("start_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Row[];
  } catch {
    return FALLBACK;
  }
}

export const loadFmscImpact = cache(async (): Promise<FmscImpact> => {
  const now = Date.now();
  const packings: Packing[] = (await loadRows()).map((r) => {
    const upcoming = r.impact_meals == null && new Date(r.start_at).getTime() > now - 86_400_000;
    return {
      slug: r.slug,
      date: r.start_at,
      endDate: r.end_at,
      location: [r.location_name, r.location_address].filter(Boolean).join(" · ") || null,
      title: r.title,
      participants: r.impact_participants,
      meals: r.impact_meals,
      kids: kidsFedForAYear(r.impact_meals),
      countries: r.impact_countries ?? [],
      upcoming,
      href: r.status === "published" && r.is_public ? `/events/${r.slug}` : null,
    };
  });

  const recorded = packings.filter((p) => p.meals != null && p.meals > 0);
  const meals = recorded.reduce((s, p) => s + (p.meals ?? 0), 0);
  const counts = new Map<string, number>();
  for (const p of recorded) for (const c of p.countries) counts.set(c, (counts.get(c) ?? 0) + 1);
  const withVolunteers = recorded.filter((p) => p.participants != null);

  return {
    packings: packings.filter((p) => p.meals != null || p.upcoming),
    recorded,
    totals: {
      meals,
      // Sum per packing so the total always equals the sum of the parts shown.
      kids: recorded.reduce((s, p) => s + p.kids, 0),
      packings: recorded.length,
      countries: counts.size,
      // Only meaningful once every packing has an attendance count (a partial sum would understate it).
      volunteers:
        recorded.length && withVolunteers.length === recorded.length
          ? withVolunteers.reduce((s, p) => s + (p.participants ?? 0), 0)
          : null,
    },
    countries: [...counts.entries()]
      .map(([name, n]) => ({ name, packings: n, ...(COUNTRY_META[name] ?? { flag: "🌍", region: "" }) }))
      .sort((a, b) => b.packings - a.packings || a.name.localeCompare(b.name)),
    next: packings.find((p) => p.upcoming && p.href) ?? null,
    milestones: MILESTONES.map((value) => ({ value, reached: meals >= value })),
    nextMilestone: MILESTONES.find((m) => m > meals) ?? Math.ceil((meals + 1) / 1_000_000) * 1_000_000,
  };
});

export const formatPackingTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" });

export const formatPackingDate = (iso: string, style: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    month: style === "short" ? "short" : "long",
    year: "numeric",
    ...(style === "long" ? { day: "numeric" } : {}),
  });
