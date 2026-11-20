// Booking & Event Management — shared types (ported from CMI, reframed for SIG).
// Two surfaces: 1:1 "booking types" (appointments) and group "events" (RSVP/registration).

export type LocationType = "video" | "phone" | "in_person" | "custom";
export type BookingStatus = "confirmed" | "pending" | "canceled" | "completed" | "no_show";
export type EventStatus = "draft" | "published" | "canceled" | "completed";
export type EventLocationType = "in_person" | "online" | "hybrid";
export type RegistrationStatus = "registered" | "waitlisted" | "canceled" | "attended";

export type BookingAudience = "everyone" | "new_clients" | "clients";
export type EventType = "roundtable" | "workshop" | "luncheon" | "webinar" | "community_service" | "client_appreciation" | "church" | "other";
export type EventAudience = "public" | "clients" | "clients_and_guests" | "invite_only";
export type EventSpeaker = { name: string; title?: string; bio?: string; photo_url?: string; team_slug?: string };

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  roundtable: "Private Roundtable",
  workshop: "Educational Workshop",
  luncheon: "Investment Manager Luncheon",
  webinar: "Webinar",
  community_service: "Community Service (SIGCares)",
  client_appreciation: "Client Appreciation",
  church: "Kingdom Stewardship (Church)",
  other: "Other",
};

export const EVENT_AUDIENCE_LABELS: Record<EventAudience, string> = {
  public: "Open to the public",
  clients: "Clients only",
  clients_and_guests: "Clients & guests",
  invite_only: "Invite only",
};

export const BOOKING_AUDIENCE_LABELS: Record<BookingAudience, string> = {
  everyone: "Everyone",
  new_clients: "New clients",
  clients: "Current clients",
};

export const IMPACT_PROGRAMS: Record<string, string> = { fmsc: "Feed My Starving Children" };
export const kidsFedForAYear = (meals: number | null | undefined) => Math.round((meals ?? 0) / 365);

export type IntakeQuestion = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "phone" | "email";
  required: boolean;
  options?: string[];
};

export type BookingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  slot_interval_minutes: number | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  location_type: LocationType;
  location_details: string | null;
  color: string | null;
  is_active: boolean;
  is_public: boolean;
  host_staff_id: string | null;
  host_name: string | null;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  price_cents: number;
  currency: string;
  questions: IntakeQuestion[];
  confirmation_message: string | null;
  /** Public planner (team page slug) this page belongs to. */
  host_slug?: string | null;
  office?: string | null;
  audience?: BookingAudience;
  created_at?: string;
  updated_at?: string;
  // computed
  booking_count?: number;
};

export type AvailabilityRule = {
  id: string;
  booking_type_id: string;
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
  is_active: boolean;
};

export type DateOverride = {
  id: string;
  booking_type_id: string;
  override_date: string; // YYYY-MM-DD
  is_available: boolean;  // false = blackout
  start_time: string | null;
  end_time: string | null;
  note: string | null;
};

export type Booking = {
  id: string;
  booking_type_id: string;
  reference: string;
  host_staff_id: string | null;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  start_at: string;  // ISO UTC
  end_at: string;    // ISO UTC
  timezone: string;
  status: BookingStatus;
  location_type: LocationType;
  location_details: string | null;
  answers: Record<string, unknown>;
  internal_notes: string | null;
  cancel_reason: string | null;
  reschedule_of: string | null;
  source: string | null;
  // Client notification opt-ins (202611190160) — absent until that migration runs.
  notify_email?: boolean;
  notify_sms?: boolean;
  notify_consent_at?: string | null;
  sms_consent_text?: string | null;
  notifications_sent?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  // joined
  booking_type?: Pick<BookingType, "name" | "slug" | "color"> | null;
};

export type EventItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  status: EventStatus;
  start_at: string; // ISO UTC
  end_at: string | null;
  timezone: string;
  location_type: EventLocationType;
  location_name: string | null;
  location_address: string | null;
  online_url: string | null;
  cover_image_url: string | null;
  capacity: number | null; // null = unlimited
  registration_required: boolean;
  registration_closes_at: string | null;
  price_cents: number;
  currency: string;
  host_staff_id: string | null;
  host_name: string | null;
  is_public: boolean;
  custom_fields: IntakeQuestion[];
  published_at: string | null;
  // SIG event fields (202611190120)
  event_type?: EventType;
  series?: string | null;
  speakers?: EventSpeaker[];
  office?: string | null;
  directions_url?: string | null;
  audience?: EventAudience;
  waitlist_enabled?: boolean;
  allow_guests?: boolean;
  max_party_size?: number;
  arrival_note?: string | null;
  meeting_id?: string | null;
  // SIGCares impact results (202611190130) — kids fed is derived (meals ÷ 365).
  impact_program?: string | null;
  impact_participants?: number | null;
  impact_meals?: number | null;
  impact_countries?: string[];
  impact_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // computed
  registered_count?: number;
  waitlist_count?: number;
};

export type EventRegistration = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  status: RegistrationStatus;
  answers: Record<string, unknown>;
  notes: string | null;
  source: string | null;
  created_at?: string;
  updated_at?: string;
  event?: Pick<EventItem, "title" | "slug"> | null;
};

export type Slot = { start: string; end: string }; // ISO UTC

export type BookingManagerData = {
  bookingTypes: BookingType[];
  bookings: Booking[];
  events: EventItem[];
  registrations: EventRegistration[];
  stats: BookingStats;
};

export type BookingStats = {
  activeTypes: number;
  upcomingBookings: number;
  pendingBookings: number;
  publishedEvents: number;
  totalRegistrations: number;
};
