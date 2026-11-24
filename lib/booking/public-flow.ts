// Server-side data for the public booking flow (/book and /book/[slug]).
// Shapes booking types + published planners into the plain props the client flow takes.
import { loadPublicBookingTypes } from "@/lib/booking/data";
import type { BookingType } from "@/lib/booking/types";
import type { TeamMember } from "@/lib/public-site/team";
import { getPublishedTeam } from "@/lib/team/data";
import type { MeetingOption, PlannerInfo } from "@/components/booking/booking-flow";

/**
 * Planners whose booking pages stay reachable by direct link (/book/<slug>, /book?planner=<slug>)
 * but are not listed in the /book planner tabs or step-1 cards.
 */
const UNLISTED_PLANNERS = new Set(["michael-gauthier"]);

export function toPlannerInfo(m: TeamMember): PlannerInfo {
  return {
    slug: m.slug,
    name: m.name,
    credentials: m.credentials ?? null,
    title: m.title ?? null,
    photo: m.photo || null,
    office: m.office ?? null,
  };
}

export function toOption(t: BookingType, planner: PlannerInfo | null, listed: boolean): MeetingOption {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    durationMinutes: t.duration_minutes,
    locationType: t.location_type,
    locationDetails: t.location_details,
    office: t.office ?? planner?.office ?? null,
    audience: t.audience ?? "everyone",
    color: t.color,
    timezone: t.timezone || "America/Phoenix",
    questions: t.questions ?? [],
    maxAdvanceDays: t.max_advance_days || 60,
    hostSlug: planner?.slug ?? null,
    hostName: planner?.name ?? t.host_name ?? null,
    planner,
    listed,
  };
}

export type BookingFlowData = { options: MeetingOption[]; planners: PlannerInfo[] };

/** Every public booking page, plus the planners listed in the /book tabs (in team order). */
export async function loadBookingFlowData(): Promise<BookingFlowData> {
  const [types, team] = await Promise.all([loadPublicBookingTypes().catch(() => [] as BookingType[]), getPublishedTeam()]);
  const bySlug = new Map(team.map((m) => [m.slug, toPlannerInfo(m)]));
  const options: MeetingOption[] = [];
  for (const t of types) {
    const planner = t.host_slug ? bySlug.get(t.host_slug) ?? null : null;
    // `host_slug === null` (not undefined) means the SIG booking migration has run, so these are
    // real SIG pages without a planner — before it runs, the MJG fork's seed types stay hidden.
    if (!planner && t.host_slug === undefined) continue;
    options.push(toOption(t, planner, !(planner && UNLISTED_PLANNERS.has(planner.slug))));
  }
  const planners = team
    .filter((m) => !UNLISTED_PLANNERS.has(m.slug) && options.some((o) => o.hostSlug === m.slug))
    .map(toPlannerInfo);
  return { options, planners };
}
