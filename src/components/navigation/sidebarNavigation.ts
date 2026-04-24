import type { ElementType } from "react";
import { matchPath } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BadgeDollarSign,
  BookOpen,
  Bug,
  Calendar,
  FileBarChart2,
  FileInput,
  FlaskConical,
  HeartPulse,
  Home,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MessageSquare,
  Package,
  Palette,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Target,
  User,
  UserCircle,
  Users,
  Zap,
} from "lucide-react";

export type DashboardShellContentWidth = "contained" | "full";
export type DashboardShellMode = "tenant" | "admin";

export interface NavigationMatchPattern {
  path: string;
  end?: boolean;
}

export interface LegacySidebarItem {
  title: string;
  url: string;
  icon: ElementType;
  badge?: string;
  patterns: NavigationMatchPattern[];
}

export interface LegacySidebarGroup {
  label: string;
  items: LegacySidebarItem[];
}

export interface DashboardSidebarLinkItem {
  kind: "link";
  id: string;
  label: string;
  to: string;
  icon: ElementType;
  badge?: string;
  patterns: NavigationMatchPattern[];
  contentWidth?: DashboardShellContentWidth;
}

export interface DashboardSidebarBranchItem {
  kind: "branch";
  id: string;
  label: string;
  icon: ElementType;
  children: DashboardSidebarLinkItem[];
}

export type DashboardSidebarItem =
  | DashboardSidebarLinkItem
  | DashboardSidebarBranchItem;

export interface DashboardSidebarGroup {
  id: string;
  label: string;
  items: DashboardSidebarItem[];
}

interface DashboardRouteDescriptor {
  label: string;
  patterns: NavigationMatchPattern[];
  contentWidth?: DashboardShellContentWidth;
}

const createLegacyItem = (
  title: string,
  url: string,
  icon: ElementType,
  patterns: NavigationMatchPattern[],
  badge?: string,
): LegacySidebarItem => ({
  title,
  url,
  icon,
  badge,
  patterns,
});

const legacyDashboardItem = createLegacyItem("Dashboard", "/dashboard", Home, [
  { path: "/", end: true },
  { path: "/dashboard", end: false },
]);
const legacyAnalyticsItem = createLegacyItem(
  "Analytics",
  "/analytics",
  BarChart3,
  [{ path: "/analytics", end: false }],
);
const legacyActivityItem = createLegacyItem(
  "Activity Center",
  "/activity",
  Activity,
  [{ path: "/activity", end: false }],
);
const legacyCalendarItem = createLegacyItem("Calendar", "/calendar", Calendar, [
  { path: "/calendar", end: false },
]);
const legacyCustomersItem = createLegacyItem(
  "Customers",
  "/crm/customers",
  Users,
  [{ path: "/crm/customers", end: false }],
);
const legacyProductsItem = createLegacyItem("Products", "/products", Package, [
  { path: "/products", end: false },
]);
const legacyCampaignsItem = createLegacyItem(
  "Campaigns",
  "/crm/campaigns",
  Mail,
  [
    { path: "/crm/campaigns", end: false },
    { path: "/dashboard/campaigns", end: false },
  ],
);
const legacyAutomationsItem = createLegacyItem(
  "Automations",
  "/crm/automations",
  Zap,
  [{ path: "/crm/automations", end: false }],
);
const legacySegmentsItem = createLegacyItem(
  "Segments",
  "/crm/segments",
  Target,
  [{ path: "/crm/segments", end: false }],
);
const legacyPersonasItem = createLegacyItem(
  "Personas",
  "/crm/personas",
  UserCircle,
  [{ path: "/crm/personas", end: false }],
);
const legacyFormsItem = createLegacyItem("Forms", "/crm/forms", FileInput, [
  { path: "/crm/forms", end: false },
  { path: "/dashboard/forms", end: false },
]);
const legacySocialItem = createLegacyItem(
  "Social Media",
  "/social-accounts",
  Share2,
  [
    { path: "/social-accounts", end: false },
    { path: "/campaigns", end: false },
  ],
);
const legacyNewsletterItem = createLegacyItem(
  "Newsletter",
  "/newsletters",
  BookOpen,
  [
    { path: "/newsletters", end: false },
    { path: "/newsletters/new", end: false },
  ],
);
const legacySmsItem = createLegacyItem("SMS Campaigns", "/sms", MessageSquare, [
  { path: "/sms", end: false },
]);
const legacySettingsItem = createLegacyItem("Settings", "/settings", Settings, [
  { path: "/settings", end: false },
]);
const legacyDomainsItem = createLegacyItem("Manage Domains", "/domains", Mail, [
  { path: "/domains", end: false },
  { path: "/crm/settings/email-sending", end: false },
]);
const legacyIntegrationsItem = createLegacyItem(
  "Integrations",
  "/integrations",
  Layers,
  [{ path: "/integrations", end: false }],
);
const legacyProfileItem = createLegacyItem("Profile", "/profile", User, [
  { path: "/profile", end: false },
]);
const legacyAccountItem = createLegacyItem("Account", "/account", Settings, [
  { path: "/account", end: false },
]);
const legacySupportItem = createLegacyItem("Support", "/support", LifeBuoy, [
  { path: "/support", end: false },
]);
const legacyReportedProblemsItem = createLegacyItem(
  "Reported Problems",
  "/admin/reported-problems",
  Bug,
  [{ path: "/admin/reported-problems", end: false }],
);

const BASE_LEGACY_SIDEBAR_GROUPS: LegacySidebarGroup[] = [
  {
    label: "Overview",
    items: [
      legacyDashboardItem,
      legacyAnalyticsItem,
      legacyActivityItem,
      legacyCalendarItem,
    ],
  },
  {
    label: "CRM & Marketing",
    items: [
      legacyCustomersItem,
      legacyProductsItem,
      legacyCampaignsItem,
      legacyAutomationsItem,
      legacySegmentsItem,
      legacyPersonasItem,
      legacyFormsItem,
    ],
  },
  {
    label: "Content & Publishing",
    items: [legacySocialItem, legacyNewsletterItem, legacySmsItem],
  },
  {
    label: "Settings & Support",
    items: [
      legacySettingsItem,
      legacyDomainsItem,
      legacyIntegrationsItem,
      legacyProfileItem,
      legacyAccountItem,
      legacySupportItem,
    ],
  },
];

const LEGACY_ADMIN_GROUP: LegacySidebarGroup = {
  label: "Admin",
  items: [legacyReportedProblemsItem],
};

const createDashboardLinkItem = (
  id: string,
  legacyItem: LegacySidebarItem,
  options?: { contentWidth?: DashboardShellContentWidth },
): DashboardSidebarLinkItem => ({
  kind: "link",
  id,
  label: legacyItem.title,
  to: legacyItem.url,
  icon: legacyItem.icon,
  badge: legacyItem.badge,
  patterns: legacyItem.patterns,
  contentWidth: options?.contentWidth,
});

const createRouteDescriptor = (
  label: string,
  patterns: NavigationMatchPattern[],
  contentWidth: DashboardShellContentWidth = "contained",
): DashboardRouteDescriptor => ({
  label,
  patterns,
  contentWidth,
});

const adminLinkItems: DashboardSidebarLinkItem[] = [
  {
    kind: "link",
    id: "admin-hub",
    label: "Admin Hub",
    to: "/admin",
    icon: LayoutDashboard,
    patterns: [{ path: "/admin", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-tenants",
    label: "Tenants",
    to: "/admin/tenants",
    icon: Store,
    patterns: [{ path: "/admin/tenants", end: false }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-search",
    label: "Search",
    to: "/admin/search",
    icon: Search,
    patterns: [{ path: "/admin/search", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-manage",
    label: "Manage",
    to: "/admin/manage",
    icon: SlidersHorizontal,
    patterns: [{ path: "/admin/manage", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-governance",
    label: "Governance",
    to: "/admin/governance-config",
    icon: ScrollText,
    patterns: [{ path: "/admin/governance-config", end: true }],
    contentWidth: "contained",
  },
  {
    kind: "link",
    id: "admin-reports",
    label: "Reports",
    to: "/admin/reports",
    icon: FileBarChart2,
    patterns: [{ path: "/admin/reports", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-costs",
    label: "Costs",
    to: "/admin/costs",
    icon: BadgeDollarSign,
    patterns: [{ path: "/admin/costs", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-audit-logs",
    label: "Audit Logs",
    to: "/admin/audit-logs",
    icon: ShieldCheck,
    patterns: [{ path: "/admin/audit-logs", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-reported-problems",
    label: "Reported Problems",
    to: "/admin/reported-problems",
    icon: Bug,
    patterns: [{ path: "/admin/reported-problems", end: false }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-oauth-debug",
    label: "OAuth Debug",
    to: "/admin/oauth-debug",
    icon: FlaskConical,
    patterns: [{ path: "/admin/oauth-debug", end: true }],
    contentWidth: "contained",
  },
  {
    kind: "link",
    id: "admin-seed-demo",
    label: "Seed Demo",
    to: "/admin/seed-demo",
    icon: HeartPulse,
    patterns: [{ path: "/admin/seed-demo", end: true }],
    contentWidth: "full",
  },
  {
    kind: "link",
    id: "admin-twilio-copy",
    label: "Twilio Copy",
    to: "/admin/twilio-copy",
    icon: MessageSquare,
    patterns: [{ path: "/admin/twilio-copy", end: true }],
    contentWidth: "contained",
  },
  {
    kind: "link",
    id: "admin-analytics-health",
    label: "Analytics Health",
    to: "/admin/analytics-health",
    icon: Activity,
    patterns: [{ path: "/admin/analytics-health", end: true }],
    contentWidth: "full",
  },
];

const tenantSidebarGroups: DashboardSidebarGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      createDashboardLinkItem("dashboard", legacyDashboardItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("analytics", legacyAnalyticsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("activity-center", legacyActivityItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("calendar", legacyCalendarItem, {
        contentWidth: "full",
      }),
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      createDashboardLinkItem("customers", legacyCustomersItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("segments", legacySegmentsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("personas", legacyPersonasItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("forms", legacyFormsItem, {
        contentWidth: "full",
      }),
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      createDashboardLinkItem("campaigns", legacyCampaignsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("automations", legacyAutomationsItem, {
        contentWidth: "full",
      }),
      {
        kind: "branch",
        id: "publishing-channels",
        label: "Publishing Channels",
        icon: Palette,
        children: [
          createDashboardLinkItem("social-media", legacySocialItem, {
            contentWidth: "full",
          }),
          createDashboardLinkItem("newsletter", legacyNewsletterItem, {
            contentWidth: "full",
          }),
          createDashboardLinkItem("sms-campaigns", legacySmsItem, {
            contentWidth: "full",
          }),
        ],
      },
    ],
  },
  {
    id: "store",
    label: "Store",
    items: [
      createDashboardLinkItem("products", legacyProductsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("manage-domains", legacyDomainsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("integrations", legacyIntegrationsItem, {
        contentWidth: "full",
      }),
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      createDashboardLinkItem("settings", legacySettingsItem, {
        contentWidth: "full",
      }),
      createDashboardLinkItem("profile", legacyProfileItem),
      createDashboardLinkItem("account", legacyAccountItem),
      createDashboardLinkItem("support", legacySupportItem),
    ],
  },
];

const adminSidebarGroups: DashboardSidebarGroup[] = [
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        kind: "branch",
        id: "admin-tools",
        label: "Admin Tools",
        icon: Shield,
        children: adminLinkItems,
      },
    ],
  },
];

const tenantRouteDescriptors: DashboardRouteDescriptor[] = [
  createRouteDescriptor("Dashboard", legacyDashboardItem.patterns, "full"),
  createRouteDescriptor("Analytics", legacyAnalyticsItem.patterns, "full"),
  createRouteDescriptor("Activity Center", legacyActivityItem.patterns, "full"),
  createRouteDescriptor("Calendar", legacyCalendarItem.patterns, "full"),
  createRouteDescriptor("Customers", legacyCustomersItem.patterns, "full"),
  createRouteDescriptor("Campaigns", legacyCampaignsItem.patterns, "full"),
  createRouteDescriptor("Automations", legacyAutomationsItem.patterns, "full"),
  createRouteDescriptor("Segments", legacySegmentsItem.patterns, "full"),
  createRouteDescriptor("Personas", legacyPersonasItem.patterns, "full"),
  createRouteDescriptor("Forms", legacyFormsItem.patterns, "full"),
  createRouteDescriptor("Social Media", legacySocialItem.patterns, "full"),
  createRouteDescriptor("Newsletter", legacyNewsletterItem.patterns, "full"),
  createRouteDescriptor("SMS Campaigns", legacySmsItem.patterns, "full"),
  createRouteDescriptor("Products", legacyProductsItem.patterns, "full"),
  createRouteDescriptor("Domains", legacyDomainsItem.patterns, "full"),
  createRouteDescriptor(
    "Integrations",
    [...legacyIntegrationsItem.patterns, { path: "/crm/pos", end: false }],
    "full",
  ),
  createRouteDescriptor("Settings", legacySettingsItem.patterns, "full"),
  createRouteDescriptor("Profile", legacyProfileItem.patterns),
  createRouteDescriptor("Account", legacyAccountItem.patterns),
  createRouteDescriptor("Support", legacySupportItem.patterns),
  createRouteDescriptor(
    "Content Library",
    [
      { path: "/content", end: false },
      { path: "/assets", end: false },
    ],
    "full",
  ),
  createRouteDescriptor(
    "Website Builder",
    [{ path: "/website/app", end: false }],
    "full",
  ),
  createRouteDescriptor("Usage", [{ path: "/settings/usage", end: false }]),
  createRouteDescriptor("Account Setup", [
    { path: "/account-setup", end: false },
  ]),
  createRouteDescriptor("Publish", [{ path: "/publish", end: false }], "full"),
  createRouteDescriptor(
    "Marketing Planner",
    [{ path: "/plan", end: false }],
    "full",
  ),
  createRouteDescriptor(
    "Help Desk",
    [{ path: "/helpdesk", end: false }],
    "full",
  ),
  createRouteDescriptor("Community", [{ path: "/community", end: false }]),
];

const adminRouteDescriptors: DashboardRouteDescriptor[] = adminLinkItems.map(
  (item) => createRouteDescriptor(item.label, item.patterns, item.contentWidth),
);

export const getLegacySidebarGroups = (options: {
  isSuperAdmin?: boolean;
  isLoadingSuperAdmin?: boolean;
}): LegacySidebarGroup[] => {
  const groups = [...BASE_LEGACY_SIDEBAR_GROUPS];

  if (!options.isLoadingSuperAdmin && options.isSuperAdmin) {
    groups.push(LEGACY_ADMIN_GROUP);
  }

  return groups;
};

export const getDashboardSidebarGroups = (options: {
  mode?: DashboardShellMode;
  isSuperAdmin?: boolean;
}): DashboardSidebarGroup[] => {
  if (options.mode === "admin") {
    return adminSidebarGroups;
  }

  return tenantSidebarGroups;
};

export const matchesNavigationPatterns = (
  pathname: string,
  patterns: NavigationMatchPattern[],
) =>
  patterns.some((pattern) =>
    Boolean(
      matchPath(
        {
          path: pattern.path,
          end: pattern.end ?? false,
        },
        pathname,
      ),
    ),
  );

export const isDashboardSidebarItemActive = (
  pathname: string,
  item: DashboardSidebarItem,
): boolean => {
  if (item.kind === "branch") {
    return item.children.some((child) =>
      matchesNavigationPatterns(pathname, child.patterns),
    );
  }

  return matchesNavigationPatterns(pathname, item.patterns);
};

export const getActiveBranchIds = (
  pathname: string,
  groups: DashboardSidebarGroup[],
) =>
  groups.flatMap((group) =>
    group.items
      .filter(
        (item): item is DashboardSidebarBranchItem =>
          item.kind === "branch" &&
          isDashboardSidebarItemActive(pathname, item),
      )
      .map((item) => item.id),
  );

export const resolveDashboardContentWidth = (
  pathname: string,
  mode: DashboardShellMode,
): DashboardShellContentWidth => {
  const descriptors =
    mode === "admin" ? adminRouteDescriptors : tenantRouteDescriptors;
  const matchedRoute = descriptors.find((descriptor) =>
    matchesNavigationPatterns(pathname, descriptor.patterns),
  );

  return matchedRoute?.contentWidth ?? "contained";
};

export const resolveDashboardNavigationTitle = (
  pathname: string,
  mode: DashboardShellMode,
) => {
  const descriptors =
    mode === "admin" ? adminRouteDescriptors : tenantRouteDescriptors;
  const matchedRoute = descriptors.find((descriptor) =>
    matchesNavigationPatterns(pathname, descriptor.patterns),
  );

  return matchedRoute?.label ?? (mode === "admin" ? "Admin" : "BloomSuite");
};

export const resolveAdminDashboardContentWidth = (pathname: string) =>
  resolveDashboardContentWidth(pathname, "admin");

export const resolveAdminNavigationTitle = (pathname: string) =>
  resolveDashboardNavigationTitle(pathname, "admin");

export const resolveTenantDashboardContentWidth = (pathname: string) =>
  resolveDashboardContentWidth(pathname, "tenant");

export const resolveTenantNavigationTitle = (pathname: string) =>
  resolveDashboardNavigationTitle(pathname, "tenant");
