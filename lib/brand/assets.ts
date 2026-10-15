// SIG Brand Kit / Design System — the single source of truth for logos, colors,
// fonts, voice, and reusable on-brand snippets. Consumed by the dashboard Assets
// page and by the AI agent (Shepherd) so generated content stays on-brand.

// Logos are self-hosted at /brand (public/), NOT WordPress. These URLs are
// ABSOLUTE because they render in email, where relative paths don't resolve — and
// PNG because most email clients (Gmail, Outlook) strip SVG. The base tracks the
// site domain via env (set NEXT_PUBLIC_SITE_URL), defaulting to the primary domain
// so emails depend only on the app's canonical host — no WordPress, no subdomain.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://strategicincomegroup.com").replace(/\/$/, "");

export const BRAND_KIT = {
  name: "Strategic Income Group",
  shortName: "SIG",
  tagline: "Comprehensive Financial Planning",
  wordmark: "Strategic Income Group",

  logos: [
    {
      key: "logo_black",
      label: "Primary logo (navy)",
      url: `${SITE}/brand/sig-logo.png`,
      usage: "Light backgrounds (default).",
    },
    {
      key: "logo_white",
      label: "Primary logo (white)",
      url: `${SITE}/brand/sig-logo-white.png`,
      usage: "Dark backgrounds.",
    },
  ],

  // Hex values reflect the dashboard theme tokens (app/globals.css) and the
  // established email palette.
  colors: {
    navy: { hex: "#0d2568", label: "SIG navy (primary)" },
    navyDeep: { hex: "#02144b", label: "Deep navy (dark backgrounds)" },
    logoNavy: { hex: "#1e376c", label: "Logo navy" },
    gold: { hex: "#c9a46e", label: "Gold (accent)" },
    silver: { hex: "#989898", label: "Silver (logo gray)" },
    cream: { hex: "#f8f5ef", label: "Cream (light background)" },
    sky: { hex: "#3b74d9", label: "Sky (links, info, charts)" },
    sage: { hex: "#4f8a6b", label: "Sage (success)" },
    ink: { hex: "#0f172a", label: "Ink (body text)" },
    white: { hex: "#ffffff", label: "White" },
  },

  fonts: {
    serif: "'DM Serif Display', Georgia, serif",
    sans: "Inter, Arial, sans-serif",
    // Web fonts are unreliable in email — use these system-safe stacks there.
    emailSerif: "Georgia, 'Times New Roman', serif",
    emailSans: "Arial, Helvetica, sans-serif",
  },

  voice: [
    "Warm",
    "Professional",
    "Reassuring and plain-spoken",
    "Values-driven: stewardship and generosity",
    "Compliant — never promise returns",
  ],

  links: {
    site: "https://strategicincomegroup.com",
    optOut: "https://strategicincomegroup.com/sms/opt-out",
  },
} as const;

// A ready-to-use, on-brand email button (inline styles for email-client safety).
export function brandEmailButton(href: string, label: string): string {
  const { navy } = BRAND_KIT.colors;
  return `<a href="${href}" style="display:inline-block;background:${navy.hex};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-family:${BRAND_KIT.fonts.emailSans};font-weight:700;">${label}</a>`;
}

// An on-brand email header block (logo + wordmark eyebrow).
export function brandEmailHeader(): string {
  const logo = BRAND_KIT.logos[0].url;
  return `<div style="text-align:left;padding-bottom:16px;">
  <img src="${logo}" alt="${BRAND_KIT.name}" style="height:40px;width:auto;" />
  <p style="text-transform:uppercase;letter-spacing:.14em;color:${BRAND_KIT.colors.gold.hex};font-size:12px;font-weight:700;margin:12px 0 0;font-family:${BRAND_KIT.fonts.emailSans};">${BRAND_KIT.tagline}</p>
</div>`;
}
