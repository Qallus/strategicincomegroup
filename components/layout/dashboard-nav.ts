import {
  BarChart3,
  BatteryCharging,
  BookMarked,
  BookOpen,
  Bot,
  CalendarClock,
  CalendarRange,
  Palette,
  CheckSquare,
  CircleUserRound,
  ClipboardList,
  Download,
  FileText,
  FileBarChart,
  FolderKanban,
  Home,
  Newspaper,
  IdCard,
  MailCheck,
  MessagesSquare,
  MonitorPlay,
  MessageSquare,
  MessageSquareText,
  NotebookPen,
  PanelsTopLeft,
  Phone,
  Settings,
  Share2,
  SquarePen,
  Sparkles,
  Users,
  UsersRound,
  UserCircle,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

export type NavLeaf = { href: string; label: string; icon: LucideIcon; permission?: Permission };
export type NavGroup = { kind: "group"; label: string; icon: LucideIcon; items: NavLeaf[] };
export type NavEntry = ({ kind: "item" } & NavLeaf) | NavGroup;

// Sidebar navigation. Items render flat; a group renders as a collapsible accordion.
// Step 1b replaces the static `permission` checks with per-user module permissions
// and Super Admin visibility toggles managed from Settings.
export const dashboardNav: NavEntry[] = [
  { kind: "item", href: "/dashboard", label: "Dashboard", icon: Home },
  {
    kind: "group", label: "Clients", icon: Users, items: [
      { href: "/dashboard/contacts", label: "Contacts", icon: UserCircle, permission: PERMISSIONS.MANAGE_PARTICIPANTS },
      { href: "/dashboard/tags-segments", label: "Tags & Segments", icon: UsersRound, permission: PERMISSIONS.MANAGE_PARTICIPANTS },
    ],
  },
  { kind: "item", href: "/dashboard/bookings", label: "Bookings & Events", icon: CalendarClock },
  {
    kind: "group", label: "Communications", icon: MessagesSquare, items: [
      { href: "/dashboard/emails", label: "Emails", icon: MailCheck, permission: PERMISSIONS.MANAGE_SETTINGS },
      { href: "/dashboard/direct-messages", label: "Direct Messages", icon: MessageSquareText },
      { href: "/dashboard/sms", label: "SMS", icon: MessageSquare, permission: PERMISSIONS.MANAGE_SETTINGS },
      { href: "/dashboard/dialer", label: "Dialer", icon: Phone, permission: PERMISSIONS.MANAGE_SETTINGS },
      { href: "/dashboard/social-media", label: "Social Media", icon: Share2, permission: PERMISSIONS.MANAGE_SETTINGS },
      { href: "/dashboard/business-cards", label: "Business Cards", icon: IdCard, permission: PERMISSIONS.MANAGE_SETTINGS },
    ],
  },
  {
    kind: "group", label: "Projects", icon: FolderKanban, items: [
      { href: "/dashboard/project-manager", label: "Project Manager", icon: FolderKanban },
      { href: "/dashboard/plans", label: "Plans", icon: ClipboardList },
      { href: "/dashboard/workspace", label: "Notes & Docs", icon: NotebookPen, permission: PERMISSIONS.MANAGE_WORKSPACE },
    ],
  },
  {
    kind: "group", label: "Content", icon: FileText, items: [
      { href: "/dashboard/blog-posts", label: "Blog Posts", icon: FileText, permission: PERMISSIONS.REVIEW_CONTENT },
      { href: "/dashboard/media-studio", label: "Media", icon: MonitorPlay, permission: PERMISSIONS.MANAGE_SETTINGS },
      { href: "/dashboard/cms", label: "Website Pages", icon: PanelsTopLeft, permission: PERMISSIONS.MANAGE_CMS },
      { href: "/dashboard/cms/editor", label: "Website Editor", icon: SquarePen, permission: PERMISSIONS.MANAGE_CMS },
    ],
  },
  { kind: "item", href: "/dashboard/ai-agent", label: "AI Agent", icon: Bot, permission: PERMISSIONS.MANAGE_SETTINGS },
  { kind: "item", href: "/dashboard/reports", label: "Reports", icon: FileBarChart, permission: PERMISSIONS.VIEW_REPORTS },
  { kind: "item", href: "/dashboard/profile", label: "My Profile", icon: UserCircle },
  { kind: "item", href: "/dashboard/preferences", label: "My Settings", icon: Settings },
  { kind: "item", href: "/dashboard/user-management", label: "Team & Users", icon: BarChart3, permission: PERMISSIONS.MANAGE_USERS },
  { kind: "item", href: "/dashboard/settings", label: "Admin Settings", icon: Settings, permission: PERMISSIONS.MANAGE_SETTINGS },
];
