import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import type { ColorPaletteProp } from "@mui/joy/styles";
import { Navigate, useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { DateStrip } from "@/components/dashboard/DateStrip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Download,
  FileDown,
  Shield,
  Users,
  Search,
  FileText,
  Settings,
  BarChart3,
  Upload,
  Eye,
  Wrench,
  TrendingUp,
  DollarSign,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";

type AdminHubStats = {
  total_tenants: number;
  active_trials: number;
  paid_active: number;
  inactive_tenants: number;
};

type AdminHubTenant = {
  city: string;
  company_name: string;
  country: string;
  current_period_end: string;
  is_active: boolean;
  is_paid_active: boolean;
  is_trialing: boolean;
  last_activity_at: string;
  onboarding_completed_at: string;
  plan: string;
  primary_contact_email: string;
  primary_contact_last_login: string;
  primary_contact_name: string;
  region: string;
  subscription_status: string;
  tenant_created_at: string;
  tenant_id: string;
  trial_end: string;
  trial_not_expired: boolean;
  trial_start: string;
  website: string;
};

type AdminHubStatusTone = "success" | "warning" | "danger" | "neutral" | "info";

type AdminHubItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  subtitle: string;
  description: string;
  categoryLabel: string;
  icon: typeof Activity;
  iconColor: ColorPaletteProp;
  accentColor: ColorPaletteProp;
  statusLabel: string;
  statusTone: AdminHubStatusTone;
  scheduledStart: Date;
  scheduledEnd: Date;
  signalDate: Date;
  actionHref: string;
  actionLabel: string;
  metadata: Array<{ label: string; value: string }>;
  highlights: string[];
};

type DashboardDownloadResource = {
  content: string;
  fileName: string;
  mimeType: string;
  sizeLabel: string;
};

type ToolCard = {
  category?: string;
  title: string;
  description: string;
  icon: typeof Shield;
  href?: string;
  iconColor: ColorPaletteProp;
  action?: () => void;
};

const EMPTY_STATS: AdminHubStats = {
  total_tenants: 0,
  active_trials: 0,
  paid_active: 0,
  inactive_tenants: 0,
};

const SCHEDULE_SLOTS = [
  { startHour: 8, startMinute: 0, durationMinutes: 90 },
  { startHour: 10, startMinute: 0, durationMinutes: 60 },
  { startHour: 11, startMinute: 30, durationMinutes: 45 },
  { startHour: 13, startMinute: 0, durationMinutes: 90 },
  { startHour: 15, startMinute: 0, durationMinutes: 60 },
  { startHour: 16, startMinute: 15, durationMinutes: 45 },
] as const;

const parseDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatLocation = (tenant: AdminHubTenant) => {
  const parts = [tenant.city, tenant.region, tenant.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not specified";
};

const formatTimeRange = (start: Date, end: Date) =>
  `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;

const formatPercentage = (value: number, total: number) => {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
};

const formatFileSize = (content: string) => {
  const bytes = new Blob([content]).size;

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
};

const buildScheduledWindow = (signalDate: Date, index: number) => {
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const signalOffset = differenceInCalendarDays(signalDate, currentWeekStart);
  const slot = SCHEDULE_SLOTS[index % SCHEDULE_SLOTS.length];
  const derivedWeekOffset = Math.floor(index / 7);
  const derivedDayOffset = index % 7;
  const useSignalPlacement = signalOffset >= 0 && signalOffset < 14;
  const dayOffset = useSignalPlacement ? signalOffset % 7 : derivedDayOffset;
  const weekOffset = useSignalPlacement
    ? Math.floor(signalOffset / 7)
    : derivedWeekOffset;
  const scheduledDate = addDays(currentWeekStart, dayOffset + weekOffset * 7);
  const scheduledStart = new Date(scheduledDate);

  scheduledStart.setHours(slot.startHour, slot.startMinute, 0, 0);

  return {
    scheduledStart,
    scheduledEnd: addMinutes(scheduledStart, slot.durationMinutes),
  };
};

const buildActivityItem = (
  tenant: AdminHubTenant,
  index: number,
): AdminHubItem | null => {
  const lastActivity = parseDate(tenant.last_activity_at);

  if (!lastActivity) {
    return null;
  }

  const { scheduledStart, scheduledEnd } = buildScheduledWindow(
    lastActivity,
    index,
  );
  const statusTone: AdminHubStatusTone = tenant.is_active
    ? "success"
    : "danger";

  return {
    id: `${tenant.tenant_id}-activity`,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name || "Unnamed Company",
    title: `${tenant.company_name || "Unnamed Company"} engagement pulse`,
    subtitle: `Recent activity • ${formatDistanceToNow(lastActivity, { addSuffix: true })}`,
    description:
      "Review the latest tenant activity and decide whether outreach, approval handling, or a deeper operational check is needed.",
    categoryLabel: "Activity",
    icon: Activity,
    iconColor: "info",
    accentColor: "info",
    statusLabel: tenant.is_active ? "Active" : "Attention",
    statusTone,
    scheduledStart,
    scheduledEnd,
    signalDate: lastActivity,
    actionHref: "/admin/tenants",
    actionLabel: "Open tenant list",
    metadata: [
      { label: "Tenant", value: tenant.company_name || "Unnamed Company" },
      {
        label: "Contact",
        value: tenant.primary_contact_email || "Not available",
      },
      {
        label: "Source signal",
        value: format(lastActivity, "EEE, MMM d • h:mm a"),
      },
      { label: "Location", value: formatLocation(tenant) },
    ],
    highlights: [
      `Primary plan: ${tenant.plan || "Not specified"}`,
      `Subscription status: ${tenant.subscription_status || "Unknown"}`,
      `Recent activity was detected ${formatDistanceToNow(lastActivity, { addSuffix: true })}.`,
    ],
  };
};

const buildTrialItem = (
  tenant: AdminHubTenant,
  index: number,
): AdminHubItem | null => {
  const trialEnd = parseDate(tenant.trial_end);

  if (!tenant.is_trialing || !trialEnd) {
    return null;
  }

  const daysUntilTrialEnd = differenceInCalendarDays(trialEnd, new Date());
  const { scheduledStart, scheduledEnd } = buildScheduledWindow(
    trialEnd,
    index,
  );

  return {
    id: `${tenant.tenant_id}-trial`,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name || "Unnamed Company",
    title: `${tenant.company_name || "Unnamed Company"} trial conversion review`,
    subtitle: `Trial ends ${format(trialEnd, "MMM d")} • ${tenant.primary_contact_email}`,
    description:
      "Validate onboarding progress, launch blockers, and upgrade readiness before the trial period closes.",
    categoryLabel: "Trial Ops",
    icon: Clock3,
    iconColor: "warning",
    accentColor: "warning",
    statusLabel: daysUntilTrialEnd <= 1 ? "Needs Review" : "Scheduled",
    statusTone: daysUntilTrialEnd <= 1 ? "danger" : "warning",
    scheduledStart,
    scheduledEnd,
    signalDate: trialEnd,
    actionHref: `/admin/tenants/${tenant.tenant_id}/email`,
    actionLabel: "Open email governance",
    metadata: [
      { label: "Tenant", value: tenant.company_name || "Unnamed Company" },
      { label: "Trial end", value: format(trialEnd, "EEEE, MMMM d") },
      {
        label: "Contact",
        value: tenant.primary_contact_email || "Not available",
      },
      { label: "Current plan", value: tenant.plan || "Trial" },
    ],
    highlights: [
      `Trial is ${tenant.trial_not_expired ? "still active" : "past due"}.`,
      `Prepare a conversion plan for ${tenant.primary_contact_name || tenant.primary_contact_email || "the primary contact"}.`,
      "Confirm that account setup, data import, and deliverability are not blocking launch.",
    ],
  };
};

const buildRenewalItem = (
  tenant: AdminHubTenant,
  index: number,
): AdminHubItem | null => {
  const renewalDate = parseDate(tenant.current_period_end);

  if (!tenant.is_paid_active || !renewalDate) {
    return null;
  }

  const daysUntilRenewal = differenceInCalendarDays(renewalDate, new Date());
  const { scheduledStart, scheduledEnd } = buildScheduledWindow(
    renewalDate,
    index,
  );

  return {
    id: `${tenant.tenant_id}-renewal`,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name || "Unnamed Company",
    title: `${tenant.company_name || "Unnamed Company"} subscription health check`,
    subtitle: `Renews ${format(renewalDate, "MMM d")} • ${tenant.plan || "Custom plan"}`,
    description:
      "Review billing posture, usage confidence, and any governance concerns before the next renewal checkpoint.",
    categoryLabel: "Billing",
    icon: CreditCard,
    iconColor: "success",
    accentColor: "success",
    statusLabel: daysUntilRenewal <= 1 ? "Due Soon" : "Scheduled",
    statusTone: daysUntilRenewal <= 1 ? "warning" : "success",
    scheduledStart,
    scheduledEnd,
    signalDate: renewalDate,
    actionHref: `/admin/tenants/${tenant.tenant_id}/email`,
    actionLabel: "Open renewal context",
    metadata: [
      { label: "Tenant", value: tenant.company_name || "Unnamed Company" },
      { label: "Renewal date", value: format(renewalDate, "EEEE, MMMM d") },
      { label: "Plan", value: tenant.plan || "Custom" },
      { label: "Status", value: tenant.subscription_status || "Unknown" },
    ],
    highlights: [
      `Renewal checkpoint is ${daysUntilRenewal < 0 ? "in the past" : `in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? "" : "s"}`}.`,
      `Primary contact: ${tenant.primary_contact_name || tenant.primary_contact_email || "Not available"}.`,
      "Use this review to confirm account health and identify upsell or risk signals.",
    ],
  };
};

const buildOnboardingItem = (
  tenant: AdminHubTenant,
  index: number,
): AdminHubItem | null => {
  const createdAt = parseDate(tenant.tenant_created_at);

  if (!createdAt) {
    return null;
  }

  const createdWithinWindow =
    differenceInCalendarDays(new Date(), createdAt) <= 45;

  if (!createdWithinWindow && tenant.onboarding_completed_at) {
    return null;
  }

  const { scheduledStart, scheduledEnd } = buildScheduledWindow(
    createdAt,
    index,
  );

  return {
    id: `${tenant.tenant_id}-onboarding`,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name || "Unnamed Company",
    title: `${tenant.company_name || "Unnamed Company"} onboarding follow-up`,
    subtitle: `Created ${format(createdAt, "MMM d")} • ${tenant.primary_contact_email}`,
    description:
      "Confirm account setup, import readiness, and any remaining launch tasks for this tenant.",
    categoryLabel: "Onboarding",
    icon: Sparkles,
    iconColor: "primary",
    accentColor: "primary",
    statusLabel: tenant.onboarding_completed_at ? "Ready" : "New",
    statusTone: tenant.onboarding_completed_at ? "success" : "info",
    scheduledStart,
    scheduledEnd,
    signalDate: createdAt,
    actionHref: "/admin/search",
    actionLabel: "Open tenant search",
    metadata: [
      { label: "Tenant", value: tenant.company_name || "Unnamed Company" },
      { label: "Created", value: format(createdAt, "EEEE, MMMM d") },
      {
        label: "Contact",
        value: tenant.primary_contact_email || "Not available",
      },
      { label: "Location", value: formatLocation(tenant) },
    ],
    highlights: [
      `Onboarding status: ${tenant.onboarding_completed_at ? "Completed" : "Still in progress"}.`,
      `Check whether the primary contact has completed launch tasks.`,
      "Use this slot to unblock imports, email setup, or internal approvals.",
    ],
  };
};

const buildReactivationItem = (
  tenant: AdminHubTenant,
  index: number,
): AdminHubItem | null => {
  if (tenant.is_active) {
    return null;
  }

  const sourceDate =
    parseDate(tenant.last_activity_at) ||
    parseDate(tenant.tenant_created_at) ||
    new Date();
  const { scheduledStart, scheduledEnd } = buildScheduledWindow(
    sourceDate,
    index,
  );

  return {
    id: `${tenant.tenant_id}-reactivation`,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name || "Unnamed Company",
    title: `${tenant.company_name || "Unnamed Company"} reactivation follow-up`,
    subtitle: `Inactive tenant • ${tenant.primary_contact_email}`,
    description:
      "Review deactivation context and decide whether billing, outreach, or account hygiene work is needed.",
    categoryLabel: "Recovery",
    icon: AlertTriangle,
    iconColor: "danger",
    accentColor: "danger",
    statusLabel: "Attention",
    statusTone: "danger",
    scheduledStart,
    scheduledEnd,
    signalDate: sourceDate,
    actionHref: "/admin/tenants",
    actionLabel: "Open tenant list",
    metadata: [
      { label: "Tenant", value: tenant.company_name || "Unnamed Company" },
      {
        label: "Contact",
        value: tenant.primary_contact_email || "Not available",
      },
      {
        label: "Last signal",
        value: format(sourceDate, "EEE, MMM d • h:mm a"),
      },
      { label: "Subscription", value: tenant.subscription_status || "Unknown" },
    ],
    highlights: [
      "Use this review to determine whether the account should remain inactive.",
      `Primary contact: ${tenant.primary_contact_name || tenant.primary_contact_email || "Not available"}.`,
      "Document any needed recovery, cancellation, or governance actions.",
    ],
  };
};

const buildAdminHubItems = (tenants: AdminHubTenant[]) => {
  const items: AdminHubItem[] = [];
  let itemIndex = 0;

  tenants.forEach((tenant) => {
    const builders = [
      buildActivityItem,
      buildTrialItem,
      buildRenewalItem,
      buildOnboardingItem,
      buildReactivationItem,
    ];

    builders.forEach((builder) => {
      const nextItem = builder(tenant, itemIndex);

      if (nextItem) {
        items.push(nextItem);
        itemIndex += 1;
      }
    });
  });

  return items.sort(
    (leftItem, rightItem) =>
      leftItem.scheduledStart.getTime() - rightItem.scheduledStart.getTime(),
  );
};

const buildDownloadResources = (
  item: AdminHubItem,
): DashboardDownloadResource[] => {
  const summaryContent = [
    `Title: ${item.title}`,
    `Tenant: ${item.tenantName}`,
    `Scheduled window: ${format(item.scheduledStart, "PPpp")} - ${format(item.scheduledEnd, "p")}`,
    `Signal date: ${format(item.signalDate, "PPpp")}`,
    `Status: ${item.statusLabel}`,
    "",
    item.description,
  ].join("\n");

  const jsonContent = JSON.stringify(
    {
      id: item.id,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      category: item.categoryLabel,
      status: item.statusLabel,
      scheduledStart: item.scheduledStart.toISOString(),
      scheduledEnd: item.scheduledEnd.toISOString(),
      signalDate: item.signalDate.toISOString(),
      metadata: item.metadata,
      highlights: item.highlights,
    },
    null,
    2,
  );

  const csvContent = [
    "label,value",
    ...item.metadata.map(
      ({ label, value }) => `"${label}","${value.replaceAll('"', '""')}"`,
    ),
  ].join("\n");

  const resources = [
    {
      content: summaryContent,
      fileName: `${item.tenantId}-ops-brief.txt`,
      mimeType: "text/plain;charset=utf-8",
    },
    {
      content: jsonContent,
      fileName: `${item.tenantId}-ops-detail.json`,
      mimeType: "application/json;charset=utf-8",
    },
    {
      content: csvContent,
      fileName: `${item.tenantId}-ops-metadata.csv`,
      mimeType: "text/csv;charset=utf-8",
    },
  ];

  return resources.map((resource) => ({
    ...resource,
    sizeLabel: formatFileSize(resource.content),
  }));
};

const triggerDownload = (resource: DashboardDownloadResource) => {
  const blob = new Blob([resource.content], { type: resource.mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = resource.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default function AdminHub() {
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading } = useIsSuperAdmin();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("description");

  const {
    data: stats = EMPTY_STATS,
    error: statsError,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["admin-hub-stats"],
    queryFn: async (): Promise<AdminHubStats> => {
      const { data, error } = await supabase.rpc("admin_get_stats");

      if (error) {
        throw error;
      }

      return data?.[0]
        ? {
            total_tenants: Number(data[0].total_tenants),
            active_trials: Number(data[0].active_trials),
            paid_active: Number(data[0].paid_active),
            inactive_tenants: Number(data[0].inactive_tenants),
          }
        : EMPTY_STATS;
    },
    enabled: isSuperAdmin === true,
  });

  const {
    data: tenants = [],
    error: tenantsError,
    isLoading: loadingTenants,
    refetch: refetchTenants,
  } = useQuery({
    queryKey: ["admin-hub-tenants"],
    queryFn: async (): Promise<AdminHubTenant[]> => {
      const { data, error } = await supabase.rpc("admin_list_tenants", {
        p_limit: 18,
        p_offset: 0,
        p_search: null,
        p_status: null,
      });

      if (error) {
        throw error;
      }

      return (data ?? []) as AdminHubTenant[];
    },
    enabled: isSuperAdmin === true,
  });

  if (isLoading) {
    return (
      <PageContainer fullWidth>
        <Stack
          minHeight="40vh"
          alignItems="center"
          justifyContent="center"
          spacing={2}
        >
          <CircularProgress size="md" />
          <Typography level="body-sm" color="neutral">
            Loading admin tools...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const adminTools: Array<{ category: string; tools: ToolCard[] }> = [
    {
      category: "Tenant Management",
      tools: [
        {
          title: "All Tenants",
          description:
            "View and manage all tenant accounts with filtering and pagination",
          icon: Users,
          href: "/admin/tenants",
          iconColor: "primary",
        },
        {
          title: "Search Users",
          description:
            "Search for specific users by email and access their tenant data",
          icon: Search,
          href: "/admin/search",
          iconColor: "primary",
        },
        {
          title: "Manage Client",
          description:
            "Switch context to manage a specific client account and their data",
          icon: Wrench,
          href: "/admin/manage",
          iconColor: "warning",
        },
      ],
    },
    {
      category: "Data & Reporting",
      tools: [
        {
          title: "Reports Dashboard",
          description:
            "View comprehensive reports and analytics across all tenants",
          icon: BarChart3,
          href: "/admin/reports",
          iconColor: "success",
        },
        {
          title: "Cost Dashboard",
          description: "Monitor platform resource usage, costs, and anomalies",
          icon: DollarSign,
          href: "/admin/costs",
          iconColor: "success",
        },
        {
          title: "Import Data",
          description:
            "Bulk import customer data via CSV for any tenant account",
          icon: Upload,
          href: "/admin/manage",
          iconColor: "primary",
        },
      ],
    },
    {
      category: "System Tools",
      tools: [
        {
          title: "Audit Logs",
          description: "View all administrative actions and system events",
          icon: FileText,
          href: "/admin/audit-logs",
          iconColor: "warning",
        },
        {
          title: "System Settings",
          description: "Configure global system settings and permissions",
          icon: Settings,
          href: "/admin/manage",
          iconColor: "danger",
        },
        {
          title: "Email Governance Settings",
          description:
            "Manage global email governance thresholds, batch defaults, and warmup limits",
          icon: Shield,
          href: "/admin/governance-config",
          iconColor: "warning",
        },
      ],
    },
  ];

  const quickActions: ToolCard[] = [
    {
      title: "Find User",
      description: "Quick search by email",
      icon: Search,
      iconColor: "primary",
      action: () => navigate("/admin/search"),
    },
    {
      title: "View All Tenants",
      description: "Browse tenant list",
      icon: Eye,
      iconColor: "neutral",
      action: () => navigate("/admin/tenants"),
    },
    {
      title: "View Reports",
      description: "Analytics dashboard",
      icon: TrendingUp,
      iconColor: "success",
      action: () => navigate("/admin/reports"),
    },
  ];

  const operationalItems = useMemo(
    () => buildAdminHubItems(tenants),
    [tenants],
  );

  const selectedDateItems = useMemo(
    () =>
      operationalItems.filter((item) =>
        isSameDay(item.scheduledStart, selectedDate),
      ),
    [operationalItems, selectedDate],
  );

  useEffect(() => {
    if (selectedDateItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    if (!selectedDateItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(selectedDateItems[0].id);
    }
  }, [selectedDateItems, selectedItemId]);

  const selectedItem =
    selectedDateItems.find((item) => item.id === selectedItemId) ?? null;

  const detailResources = selectedItem
    ? buildDownloadResources(selectedItem)
    : [];

  const statCards = [
    {
      label: "Total Tenants",
      value: stats.total_tenants.toLocaleString(),
      icon: <Users size={20} />,
      iconColor: "primary" as const,
      change: {
        value: `${formatPercentage(stats.paid_active, stats.total_tenants)} active portfolio`,
        direction: "up" as const,
      },
    },
    {
      label: "Paid Active",
      value: stats.paid_active.toLocaleString(),
      icon: <CreditCard size={20} />,
      iconColor: "success" as const,
      change: {
        value: `${operationalItems.filter((item) => item.categoryLabel === "Billing").length} renewal checks`,
        direction: "up" as const,
      },
    },
    {
      label: "Active Trials",
      value: stats.active_trials.toLocaleString(),
      icon: <Clock3 size={20} />,
      iconColor: "warning" as const,
      change: {
        value: `${operationalItems.filter((item) => item.categoryLabel === "Trial Ops").length} trial reviews`,
        direction: "up" as const,
      },
    },
    {
      label: "Attention Needed",
      value: stats.inactive_tenants.toLocaleString(),
      icon: <AlertTriangle size={20} />,
      iconColor: "danger" as const,
      change: {
        value:
          stats.inactive_tenants > 0
            ? `${stats.inactive_tenants} flagged account${stats.inactive_tenants === 1 ? "" : "s"}`
            : "No flagged accounts",
        direction:
          stats.inactive_tenants > 0 ? ("down" as const) : ("up" as const),
      },
    },
  ];

  const loadError = statsError || tenantsError;

  const rightPanelTitle = selectedItem
    ? selectedItem.title
    : "Select an item to view details";

  return (
    <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
      <Stack spacing={4}>
        <JoyCard
          variant="plain"
          sx={{ borderBottom: "1px solid", borderColor: "neutral.200" }}
        >
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: "column", xl: "row" }}
                alignItems={{ xs: "flex-start", xl: "center" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Sheet
                      color="primary"
                      variant="soft"
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={24} />
                    </Sheet>
                    <Stack spacing={0.5}>
                      <Typography level="h2">Admin Operations Hub</Typography>
                      <Typography level="body-sm" color="neutral">
                        A live operational view of tenant health, billing
                        checkpoints, and admin tasks.
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <JoyStatusChip label="Live admin view" status="active" />
                    <Typography level="body-xs" color="neutral">
                      Snapshot updated{" "}
                      {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ width: { xs: "100%", xl: "auto" } }}
                >
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() => navigate("/admin/search")}
                    startDecorator={<Search size={16} />}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    Search Users
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() => {
                      void refetchStats();
                      void refetchTenants();
                    }}
                    startDecorator={<ArrowRight size={16} />}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    Refresh Snapshot
                  </JoyButton>
                </Stack>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {loadError ? (
          <JoyCard variant="soft" color="danger">
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack spacing={1}>
                <Typography level="title-sm">
                  Unable to load the live admin snapshot
                </Typography>
                <Typography level="body-sm" color="danger">
                  {loadError.message}
                </Typography>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        {loadingStats || loadingTenants ? (
          <JoyCard>
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack
                minHeight="36vh"
                alignItems="center"
                justifyContent="center"
                spacing={2}
              >
                <CircularProgress size="md" />
                <Typography level="body-sm" color="neutral">
                  Building today&apos;s admin dashboard...
                </Typography>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : (
          <Grid container spacing={3}>
            <Grid xs={12} lg={8}>
              <Stack spacing={3}>
                <Grid container spacing={2}>
                  {statCards.map((stat) => (
                    <Grid key={stat.label} xs={12} sm={6} xl={3}>
                      <JoyStatCard
                        change={stat.change}
                        icon={stat.icon}
                        iconColor={stat.iconColor}
                        label={stat.label}
                        value={stat.value}
                      />
                    </Grid>
                  ))}
                </Grid>

                <DateStrip
                  value={selectedDate}
                  onDateSelect={setSelectedDate}
                />

                <JoyCard>
                  <JoyCardHeader
                    title={
                      isToday(selectedDate)
                        ? "Today’s Operations"
                        : format(selectedDate, "EEEE, MMMM d")
                    }
                    description="Derived from recent tenant activity, onboarding milestones, trials, and renewal checkpoints."
                    actions={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <JoyChip bloomVariant="outline">
                          {selectedDateItems.length} item
                          {selectedDateItems.length === 1 ? "" : "s"}
                        </JoyChip>
                        <IconButton
                          aria-label="Open tenant operations"
                          color="neutral"
                          onClick={() => navigate("/admin/tenants")}
                          size="sm"
                          variant="plain"
                        >
                          <MoreHorizontal size={18} />
                        </IconButton>
                      </Stack>
                    }
                  />
                  <JoyCardContent sx={{ pt: 2 }}>
                    {selectedDateItems.length === 0 ? (
                      <Sheet
                        color="neutral"
                        variant="soft"
                        sx={{
                          p: 3,
                          borderRadius: "var(--joy-radius-lg)",
                        }}
                      >
                        <Stack spacing={1} alignItems="flex-start">
                          <Typography level="title-sm">
                            No operations queued for this day
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            Move across the week strip to inspect upcoming
                            reviews, billing checkpoints, and tenant follow-ups.
                          </Typography>
                        </Stack>
                      </Sheet>
                    ) : (
                      <Stack spacing={1.5}>
                        {selectedDateItems.map((item) => {
                          const isSelected = item.id === selectedItemId;
                          const ItemIcon = item.icon;

                          return (
                            <JoyCard
                              key={item.id}
                              interactive
                              onClick={() => setSelectedItemId(item.id)}
                              sx={{
                                borderLeft: "4px solid",
                                borderLeftColor: isSelected
                                  ? "primary.500"
                                  : `${item.accentColor}.400`,
                                backgroundColor: isSelected
                                  ? "primary.50"
                                  : "#FFFFFF",
                                borderColor: isSelected
                                  ? "primary.200"
                                  : "neutral.200",
                                boxShadow: isSelected
                                  ? "var(--joy-shadow-md)"
                                  : "var(--joy-shadow-xs)",
                              }}
                            >
                              <JoyCardContent sx={{ pt: 2.5 }}>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={2}
                                  alignItems={{
                                    xs: "flex-start",
                                    sm: "center",
                                  }}
                                  justifyContent="space-between"
                                >
                                  <Stack
                                    spacing={0.25}
                                    sx={{ minWidth: { sm: 120 } }}
                                  >
                                    <Typography level="body-xs" color="neutral">
                                      {format(
                                        item.scheduledStart,
                                        "EEE, MMM d",
                                      )}
                                    </Typography>
                                    <Typography level="title-sm">
                                      {formatTimeRange(
                                        item.scheduledStart,
                                        item.scheduledEnd,
                                      )}
                                    </Typography>
                                  </Stack>

                                  <Stack
                                    spacing={0.5}
                                    sx={{ flex: 1, minWidth: 0 }}
                                  >
                                    <Typography level="title-sm">
                                      {item.title}
                                    </Typography>
                                    <Typography level="body-sm" color="neutral">
                                      {item.subtitle}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      useFlexGap
                                      flexWrap="wrap"
                                    >
                                      <JoyStatusChip
                                        label={item.statusLabel}
                                        status={item.statusLabel}
                                        tone={item.statusTone}
                                      />
                                      <JoyChip bloomVariant="outline">
                                        {item.categoryLabel}
                                      </JoyChip>
                                    </Stack>
                                  </Stack>

                                  <Sheet
                                    color={item.iconColor}
                                    variant="soft"
                                    sx={{
                                      width: 42,
                                      height: 42,
                                      borderRadius: "50%",
                                      display: "grid",
                                      placeItems: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <ItemIcon size={18} />
                                  </Sheet>
                                </Stack>
                              </JoyCardContent>
                            </JoyCard>
                          );
                        })}
                      </Stack>
                    )}
                  </JoyCardContent>
                </JoyCard>
              </Stack>
            </Grid>

            <Grid xs={12} lg={4}>
              <Box sx={{ position: { lg: "sticky" }, top: { lg: 0 } }}>
                <JoyCard sx={{ minHeight: { lg: 720 } }}>
                  <JoyCardHeader
                    title={rightPanelTitle}
                    description={
                      selectedItem
                        ? "Selected operational detail"
                        : "Pick an item from the queue to inspect its context"
                    }
                  />
                  <JoyCardContent sx={{ pt: 2 }}>
                    {selectedItem ? (
                      (() => {
                        const DetailIcon = selectedItem.icon;

                        return (
                          <Stack spacing={3}>
                            <Sheet
                              color={selectedItem.iconColor}
                              variant="soft"
                              sx={{
                                position: "relative",
                                overflow: "hidden",
                                p: 3,
                                borderRadius: "24px",
                                minHeight: 180,
                              }}
                            >
                              <Box
                                sx={{
                                  position: "absolute",
                                  right: -24,
                                  top: -16,
                                  width: 140,
                                  height: 140,
                                  borderRadius: "50%",
                                  backgroundColor: "rgba(255, 255, 255, 0.22)",
                                }}
                              />
                              <Box
                                sx={{
                                  position: "absolute",
                                  right: 32,
                                  bottom: -30,
                                  width: 90,
                                  height: 90,
                                  borderRadius: "50%",
                                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                                }}
                              />
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                spacing={2}
                                sx={{ position: "relative", zIndex: 1 }}
                              >
                                <Stack spacing={1.25}>
                                  <JoyChip bloomVariant="outline">
                                    {selectedItem.categoryLabel}
                                  </JoyChip>
                                  <Typography level="title-sm">
                                    {format(
                                      selectedItem.scheduledStart,
                                      "EEEE, MMM d",
                                    )}
                                  </Typography>
                                  <Typography level="body-sm">
                                    {formatTimeRange(
                                      selectedItem.scheduledStart,
                                      selectedItem.scheduledEnd,
                                    )}
                                  </Typography>
                                </Stack>
                                <Sheet
                                  color={selectedItem.iconColor}
                                  variant="solid"
                                  sx={{
                                    width: 74,
                                    height: 74,
                                    borderRadius: "50%",
                                    display: "grid",
                                    placeItems: "center",
                                    boxShadow: "var(--joy-shadow-md)",
                                    flexShrink: 0,
                                  }}
                                >
                                  <DetailIcon size={30} />
                                </Sheet>
                              </Stack>
                            </Sheet>

                            <Stack spacing={1.25}>
                              <Typography level="title-lg">
                                {selectedItem.title}
                              </Typography>
                              <Typography level="body-sm" color="neutral">
                                {selectedItem.description}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                <JoyStatusChip
                                  label={selectedItem.statusLabel}
                                  status={selectedItem.statusLabel}
                                  tone={selectedItem.statusTone}
                                />
                                <JoyChip bloomVariant="outline">
                                  {format(selectedItem.signalDate, "MMM d")}
                                </JoyChip>
                              </Stack>
                            </Stack>

                            <Tabs
                              value={detailTab}
                              onChange={(_event, value) =>
                                setDetailTab(String(value ?? "description"))
                              }
                            >
                              <TabList
                                sx={{
                                  borderRadius: "var(--joy-radius-lg)",
                                  backgroundColor: "neutral.50",
                                  p: 0.5,
                                  gap: 0.5,
                                }}
                              >
                                <Tab disableIndicator value="description">
                                  Description
                                </Tab>
                                <Tab disableIndicator value="content">
                                  Content
                                </Tab>
                                <Tab disableIndicator value="details">
                                  Details
                                </Tab>
                              </TabList>

                              <TabPanel
                                value="description"
                                sx={{ px: 0, pt: 2.5 }}
                              >
                                <Stack spacing={1.25}>
                                  <Typography level="body-sm" color="neutral">
                                    {selectedItem.description}
                                  </Typography>
                                  <Sheet
                                    color="neutral"
                                    variant="soft"
                                    sx={{
                                      p: 1.5,
                                      borderRadius: "var(--joy-radius-lg)",
                                    }}
                                  >
                                    <Typography level="body-sm">
                                      Source signal landed{" "}
                                      {formatDistanceToNow(
                                        selectedItem.signalDate,
                                        { addSuffix: true },
                                      )}
                                      . This queue item schedules the follow-up
                                      in a dedicated admin review window.
                                    </Typography>
                                  </Sheet>
                                </Stack>
                              </TabPanel>

                              <TabPanel value="content" sx={{ px: 0, pt: 2.5 }}>
                                <Stack spacing={1.25}>
                                  {selectedItem.highlights.map((highlight) => (
                                    <Sheet
                                      key={highlight}
                                      color="neutral"
                                      variant="soft"
                                      sx={{
                                        p: 1.5,
                                        borderRadius: "var(--joy-radius-lg)",
                                      }}
                                    >
                                      <Typography level="body-sm">
                                        {highlight}
                                      </Typography>
                                    </Sheet>
                                  ))}
                                </Stack>
                              </TabPanel>

                              <TabPanel value="details" sx={{ px: 0, pt: 2.5 }}>
                                <Stack spacing={1.25}>
                                  {selectedItem.metadata.map((row) => (
                                    <Stack
                                      key={row.label}
                                      direction="row"
                                      justifyContent="space-between"
                                      spacing={2}
                                    >
                                      <Typography
                                        level="body-xs"
                                        color="neutral"
                                      >
                                        {row.label}
                                      </Typography>
                                      <Typography
                                        level="body-sm"
                                        fontWeight="lg"
                                        sx={{ textAlign: "right" }}
                                      >
                                        {row.value}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                              </TabPanel>
                            </Tabs>

                            <JoyButton
                              bloomVariant="outline"
                              fullWidth
                              onClick={() => navigate(selectedItem.actionHref)}
                              startDecorator={<ArrowRight size={16} />}
                            >
                              {selectedItem.actionLabel}
                            </JoyButton>

                            <Stack spacing={1.25}>
                              <Typography level="title-sm">
                                Resources
                              </Typography>
                              {detailResources.map((resource) => (
                                <Sheet
                                  key={resource.fileName}
                                  color="neutral"
                                  variant="soft"
                                  sx={{
                                    p: 1.5,
                                    borderRadius: "var(--joy-radius-lg)",
                                  }}
                                >
                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    spacing={2}
                                  >
                                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                      >
                                        <FileDown size={16} />
                                        <Typography
                                          level="body-sm"
                                          fontWeight="lg"
                                        >
                                          {resource.fileName}
                                        </Typography>
                                      </Stack>
                                      <Typography
                                        level="body-xs"
                                        color="neutral"
                                      >
                                        {resource.sizeLabel}
                                      </Typography>
                                    </Stack>
                                    <IconButton
                                      aria-label={`Download ${resource.fileName}`}
                                      color="primary"
                                      onClick={() => triggerDownload(resource)}
                                      size="sm"
                                      variant="plain"
                                    >
                                      <Download size={18} />
                                    </IconButton>
                                  </Stack>
                                </Sheet>
                              ))}
                            </Stack>
                          </Stack>
                        );
                      })()
                    ) : (
                      <Sheet
                        color="neutral"
                        variant="soft"
                        sx={{
                          p: 3,
                          borderRadius: "var(--joy-radius-xl)",
                          minHeight: 360,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Stack
                          spacing={1.5}
                          alignItems="center"
                          sx={{ maxWidth: 280 }}
                        >
                          <Sheet
                            color="neutral"
                            variant="outlined"
                            sx={{
                              width: 72,
                              height: 72,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <CalendarDays size={28} />
                          </Sheet>
                          <Typography level="title-md" textAlign="center">
                            Select an item to view details
                          </Typography>
                          <Typography
                            level="body-sm"
                            color="neutral"
                            textAlign="center"
                          >
                            The right panel shows description, context,
                            metadata, and downloadable notes for the item you
                            pick from the queue.
                          </Typography>
                        </Stack>
                      </Sheet>
                    )}
                  </JoyCardContent>
                </JoyCard>
              </Box>
            </Grid>
          </Grid>
        )}

        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={1}
          >
            <Typography level="title-lg">Quick Actions</Typography>
            <Typography level="body-sm" color="neutral">
              Preserve the existing admin entry points without leaving the
              dashboard view.
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {quickActions.map((action) => {
              const ActionIcon = action.icon;

              return (
                <Grid key={action.title} xs={12} md={4}>
                  <JoyCard interactive onClick={action.action}>
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="flex-start"
                      >
                        <Sheet
                          variant="soft"
                          color={action.iconColor}
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "var(--joy-radius-lg)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ActionIcon size={20} />
                        </Sheet>
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography level="title-sm">
                            {action.title}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {action.description}
                          </Typography>
                        </Stack>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
              );
            })}
          </Grid>
        </Stack>

        {adminTools.map((category) => (
          <Stack key={category.category} spacing={2}>
            <Typography level="title-lg">{category.category}</Typography>
            <Grid container spacing={2}>
              {category.tools.map((tool) => (
                <Grid key={tool.title} xs={12} md={6} lg={4}>
                  <JoyCard
                    interactive
                    onClick={() => {
                      if (tool.href) {
                        navigate(tool.href);
                      }
                    }}
                  >
                    <JoyCardHeader
                      title={tool.title}
                      description={tool.description}
                      startDecorator={
                        <Sheet
                          variant="soft"
                          color={tool.iconColor}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "var(--joy-radius-md)",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <tool.icon size={18} />
                        </Sheet>
                      }
                    />
                    <JoyCardContent>
                      <JoyButton
                        bloomVariant="outline"
                        fullWidth
                        onClick={() => navigate(tool.href)}
                      >
                        Open Tool
                      </JoyButton>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
              ))}
            </Grid>
          </Stack>
        ))}
      </Stack>
    </PageContainer>
  );
}
