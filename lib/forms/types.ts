// Public website form types → how they're labelled and organised in the dashboard
// Form Submissions inbox. Rows live in `form_submissions` (form_type, status, payload).

export const FORM_TYPES = {
  new_client: { label: "Start planning", short: "New clients", description: "Consultation requests from people new to SIG", icon: "compass" },
  client_service: { label: "Current client", short: "Client service", description: "Service requests from existing clients", icon: "users" },
  investment_committee: { label: "Investment Committee", short: "Inv. committee", description: "Fund companies and partners presenting investment offerings", icon: "landmark" },
  church_403b: { label: "Churches & 403(b)", short: "Churches", description: "Older 403(b) and stewardship inquiries from ministries", icon: "church" },
  career_interest: { label: "Careers", short: "Careers", description: "Job applications and the candidate waitlist", icon: "briefcase" },
  newsletter: { label: "Newsletter", short: "Newsletter", description: "Strategic Insights sign-ups with consent", icon: "mail" },
  contact: { label: "General contact", short: "General", description: "Older general contact form", icon: "message" },
} as const;

export type FormType = keyof typeof FORM_TYPES;

export const SUBMISSION_STATUSES = [
  { value: "received", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "spam", label: "Spam" },
] as const;

export function formTypeLabel(type: string) {
  return (FORM_TYPES as Record<string, { label: string }>)[type]?.label ?? type.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human labels for the option-specific answers the contact page sends in payload.details. */
export const DETAIL_LABELS: Record<string, string> = {
  meeting: "How they’d like to meet",
  phase: "Phase of wealth",
  helpWith: "Wants help with",
  planner: "Their planner",
  requestType: "Request type",
  bestTime: "Best time to reach",
  organization: "Company / organization",
  orgRole: "Role / title",
  offeringType: "Type of offering",
  strategy: "Asset class / strategy",
  aum: "Firm AUM",
  trackRecord: "Track record",
  staffCount: "Number of staff",
  existingPlan: "Current retirement plan",
  interest: "Interested in",
  position: "Position",
  profileUrl: "LinkedIn / résumé",
};
