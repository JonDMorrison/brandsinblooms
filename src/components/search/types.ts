import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Camera,
  Calendar,
  CircleHelp,
  FileInput,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  PlugZap,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Target,
  UserCircle2,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

export type SearchEntityType =
  | "customer"
  | "campaign"
  | "campaign_recipient"
  | "product"
  | "segment"
  | "persona"
  | "automation"
  | "form"
  | "saved_block"
  | "integration"
  | "setting"
  | "help"
  | "action"
  | "page"
  | "sms_campaign"
  | "sms_automation"
  | "ticket"
  | "activity"
  | "community_story"
  | "publish_item";

export type SearchGroupKey =
  | "actions"
  | "pages"
  | "customers"
  | "campaigns"
  | "campaign_recipients"
  | "products"
  | "segments"
  | "personas"
  | "automations"
  | "forms"
  | "saved_blocks"
  | "sms_campaigns"
  | "sms_automations"
  | "activity"
  | "tickets"
  | "integrations"
  | "community"
  | "publish"
  | "settings"
  | "setup"
  | "help";

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  route: string;
  icon?: string;
  categoryIcon: string;
  metadata?: string;
  keywords?: string[];
  group: SearchGroupKey;
}

export interface SearchResultGroup {
  category: SearchGroupKey;
  title: string;
  icon: string;
  results: SearchResultItem[];
}

export const SEARCH_GROUP_ORDER: SearchGroupKey[] = [
  "actions",
  "pages",
  "customers",
  "campaigns",
  "campaign_recipients",
  "products",
  "segments",
  "personas",
  "automations",
  "forms",
  "saved_blocks",
  "sms_campaigns",
  "sms_automations",
  "activity",
  "tickets",
  "integrations",
  "community",
  "publish",
  "settings",
  "setup",
  "help",
];

export const SEARCH_GROUP_METADATA: Record<
  SearchGroupKey,
  { title: string; icon: string }
> = {
  actions: { title: "Actions", icon: "actions" },
  pages: { title: "Pages", icon: "pages" },
  customers: { title: "Customers", icon: "customers" },
  campaigns: { title: "Campaigns", icon: "campaigns" },
  campaign_recipients: { title: "Campaign Recipients", icon: "mail" },
  products: { title: "Products", icon: "products" },
  segments: { title: "Segments", icon: "segments" },
  personas: { title: "Personas", icon: "personas" },
  automations: { title: "Automations", icon: "automations" },
  forms: { title: "Forms", icon: "forms" },
  saved_blocks: { title: "Saved Blocks", icon: "saved-block" },
  sms_campaigns: { title: "SMS Campaigns", icon: "sms" },
  sms_automations: { title: "SMS Automations", icon: "sms" },
  activity: { title: "Activity", icon: "activity" },
  tickets: { title: "Tickets", icon: "support" },
  integrations: { title: "Integrations", icon: "integrations" },
  community: { title: "Community", icon: "community" },
  publish: { title: "Publish", icon: "publish" },
  settings: { title: "Settings", icon: "settings" },
  setup: { title: "Setup", icon: "setup" },
  help: { title: "Help", icon: "help" },
};

const SEARCH_ICON_MAP: Record<string, LucideIcon> = {
  actions: Zap,
  activity: Activity,
  analytics: Gauge,
  automations: Workflow,
  billing: BadgeDollarSign,
  campaigns: Megaphone,
  calendar: Calendar,
  community: Camera,
  customers: Users,
  dashboard: LayoutDashboard,
  forms: FileInput,
  help: LifeBuoy,
  integrations: PlugZap,
  mail: Mail,
  pages: LayoutDashboard,
  personas: UserCircle2,
  products: Package,
  publish: SendHorizontal,
  "saved-block": Sparkles,
  search: Search,
  segments: Target,
  settings: Settings,
  setup: Sparkles,
  sms: MessageSquare,
  support: CircleHelp,
};

export const getSearchIcon = (iconName?: string): LucideIcon =>
  SEARCH_ICON_MAP[iconName ?? "search"] ?? Search;

export const stripQueryFromRoute = (route: string) => route.split("?")[0] ?? route;

export const isCurrentRouteMatch = (pathname: string, route: string) => {
  const normalizedRoute = stripQueryFromRoute(route);

  return (
    pathname === normalizedRoute ||
    (normalizedRoute !== "/" && pathname.startsWith(`${normalizedRoute}/`))
  );
};