// Every dashboard feature, grouped, for the All Features sheet, the command palette and
// the Quick links widget. Built from the sidebar nav (components/layout/dashboard-nav.ts)
// plus routes that aren't in the nav, each with a one-line description. Client-safe.

import {
  BarChart3,
  Bot,
  ChartNoAxesCombined,
  FileBarChart,
  FilePenLine,
  Globe,
  Inbox,
  LayoutTemplate,
  Link2,
  Mail,
  MessageSquarePlus,
  Megaphone,
  MousePointerClick,
  Search,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { dashboardNav, type NavLeaf } from "@/components/layout/dashboard-nav";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

export type Feature = { href: string; label: string; description: string; icon: LucideIcon; group: string; permission?: Permission; keywords?: string[] };

const DESCRIPTIONS: Record<string, string> = {
  "/dashboard": "Your customizable home: cards, stats and shortcuts.",
  "/dashboard/contacts": "Clients, prospects and leads in the CRM.",
  "/dashboard/tags-segments": "Group contacts with tags and saved segments.",
  "/dashboard/form-submissions": "Everything submitted through website forms.",
  "/dashboard/bookings": "Appointments, booking pages, events and RSVPs.",
  "/dashboard/emails": "Send email and review delivery history.",
  "/dashboard/direct-messages": "Private messages with your teammates.",
  "/dashboard/sms": "Text conversations, single sends and broadcasts.",
  "/dashboard/dialer": "Browser phone, call log, recordings and transcripts.",
  "/dashboard/social-media": "Compose, schedule and review social posts.",
  "/dashboard/business-cards": "Digital business cards with QR codes.",
  "/dashboard/project-manager": "Projects, tasks, milestones and timelines.",
  "/dashboard/plans": "Client plans and their task boards.",
  "/dashboard/workspace": "Notes, docs and voice memos.",
  "/dashboard/blog-posts": "Write, review and publish blog posts.",
  "/dashboard/careers": "Job postings on the careers page.",
  "/dashboard/media-studio": "Images, video and files for the site.",
  "/dashboard/cms": "Every page of the public website.",
  "/dashboard/cms/editor": "Edit website pages visually.",
  "/dashboard/site-notices": "Banners and notices shown on the website.",
  "/dashboard/ai-agent": "Siggy, the SIG assistant, and its tools.",
  "/dashboard/analytics": "Website traffic, sources and conversions.",
  "/dashboard/profile": "Your photo, bio and team page.",
  "/dashboard/preferences": "Notifications, theme and personal settings.",
  "/dashboard/user-management": "Invite teammates and manage roles.",
  "/dashboard/settings": "Firm-wide settings and integrations.",
  "/dashboard/settings/ai-connectors": "Connect AI assistants to SIG through MCP.",
  "/dashboard/credentials": "Encrypted API keys, tokens and service URLs.",
};

const EXTRAS: Feature[] = [
  { href: "/dashboard/reports", label: "Reports", description: "Firm reports and exports.", icon: FileBarChart, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/email-inbox", label: "Email inbox", description: "The shared inbox synced from IMAP.", icon: Inbox, group: "Communications", permission: PERMISSIONS.MANAGE_SETTINGS },
  { href: "/dashboard/email-templates", label: "Email templates", description: "Reusable templates and event mappings.", icon: LayoutTemplate, group: "Communications", permission: PERMISSIONS.MANAGE_SETTINGS },
  { href: "/dashboard/sms/compose", label: "Compose a text", description: "Send a single SMS from a SIG number.", icon: MessageSquarePlus, group: "Communications", permission: PERMISSIONS.MANAGE_SETTINGS },
  { href: "/dashboard/sms?campaign=new", label: "Bulk text campaign", description: "Text a list, tag or segment with consent checks.", icon: Megaphone, group: "Communications", permission: PERMISSIONS.MANAGE_SETTINGS, keywords: ["bulk", "broadcast"] },
  { href: "/dashboard/sms/templates", label: "SMS templates", description: "Saved text messages with merge fields.", icon: FilePenLine, group: "Communications", permission: PERMISSIONS.MANAGE_SETTINGS },
  { href: "/dashboard/analytics/acquisition", label: "Analytics · Acquisition", description: "Where visitors come from.", icon: MousePointerClick, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/content", label: "Analytics · Content", description: "Top pages and engagement.", icon: BarChart3, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/conversions", label: "Analytics · Conversions", description: "Leads, bookings and registrations.", icon: ChartNoAxesCombined, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/search", label: "Analytics · Search", description: "Search Console queries and rankings.", icon: Search, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/ai", label: "Analytics · AI visibility", description: "Traffic from AI assistants.", icon: Sparkles, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/social", label: "Analytics · Social", description: "Social reach and engagement.", icon: Share2, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/email-sms", label: "Analytics · Email & SMS", description: "Opens, clicks and deliveries.", icon: Mail, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/analytics/connections", label: "Analytics · Connections", description: "Data sources and sync health.", icon: Link2, group: "Insights", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/dashboard/cms/pages", label: "Website pages (list)", description: "Manage page drafts, versions and publishing.", icon: Globe, group: "Content", permission: PERMISSIONS.MANAGE_CMS },
  { href: "/dashboard/ai-agent", label: "Ask Siggy", description: "Chat with the SIG assistant.", icon: Bot, group: "AI", permission: PERMISSIONS.MANAGE_SETTINGS },
];

function leafToFeature(leaf: NavLeaf, group: string): Feature {
  return { href: leaf.href, label: leaf.label, icon: leaf.icon, permission: leaf.permission, group, description: DESCRIPTIONS[leaf.href] ?? "" };
}

export const FEATURES: Feature[] = (() => {
  const out: Feature[] = [];
  for (const entry of dashboardNav) {
    if (entry.kind === "group") for (const leaf of entry.items) out.push(leafToFeature(leaf, entry.label));
    else out.push(leafToFeature(entry, topLevelGroup(entry.href)));
  }
  const seen = new Set(out.map((f) => f.href));
  for (const extra of EXTRAS) if (!seen.has(extra.href)) out.push(extra);
  return out;
})();

export const FEATURE_GROUP_ORDER = ["General", "Clients", "Communications", "Projects", "Content", "Insights", "AI", "You", "Admin"];

export function featuresFor(permissions: Permission[]): Feature[] {
  return FEATURES.filter((f) => !f.permission || permissions.includes(f.permission));
}

const rank = (g: string) => {
  const i = FEATURE_GROUP_ORDER.indexOf(g);
  return i === -1 ? 999 : i;
};

function topLevelGroup(href: string): string {
  if (href.includes("/settings") || href.includes("/credentials") || href.includes("/user-management")) return "Admin";
  if (href === "/dashboard/profile" || href === "/dashboard/preferences") return "You";
  if (href.startsWith("/dashboard/analytics")) return "Insights";
  if (href.startsWith("/dashboard/ai-agent")) return "AI";
  if (href.startsWith("/dashboard/bookings")) return "Clients";
  return "General";
}

export function groupFeatures(features: Feature[]): { group: string; items: Feature[] }[] {
  const map = new Map<string, Feature[]>();
  for (const f of features) map.set(f.group, [...(map.get(f.group) ?? []), f]);
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([group, items]) => ({ group, items }));
}
