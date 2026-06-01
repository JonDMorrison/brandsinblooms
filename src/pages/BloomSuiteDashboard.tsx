import { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { LaunchpadModal } from "@/components/dashboard/LaunchpadModal";
import { QuickStartTour } from "@/components/dashboard/QuickStartTour";
import { PostComposerModal } from "@/components/dashboard/PostComposerModal";
import {
  useConnectedAccounts,
  getConnectionStatus,
} from "@/components/dashboard/ConnectedAccountChecker";
import {
  useTwilioSetup,
  getTwilioStatus,
} from "@/components/dashboard/TwilioSetupChecker";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { useCRMDashboardMetrics } from "@/hooks/useCRMDashboardMetrics";
import { usePOSAnalytics } from "@/hooks/usePOSAnalytics";
import { useTenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";
import { useTenantCustomerSummary } from "@/hooks/useTenantCustomerSummary";
import { useTenant } from "@/hooks/useTenant";
import {
  ArrowRight,
  BarChart3,
  Mail,
  Megaphone,
  Calendar,
  Share2,
  HelpCircle,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CreateFlowDialog } from "@/components/create-flow/CreateFlowDialog";
import { DashboardSetupWizard } from "@/components/dashboard/DashboardSetupWizard";
import { SetupNextStepsBanner } from "@/components/dashboard/SetupNextStepsBanner";
import { POSInsightsCard } from "@/components/dashboard/POSInsightsCard";

const panelSurfaceSx = {
  borderRadius: "12px",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "none",
  p: 2,
} as const;

const actionCardSx = {
  borderRadius: "12px",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "none",
  p: 2,
  height: "100%",
} as const;

const subtleDividerSx = {
  "--Divider-lineColor": "var(--joy-palette-neutral-100)",
} as const;

const capitalizeStatusText = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const getHeaderStatusChipMessage = (label: string, message: string) => {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return label;
  }

  const normalizedLabel = label.trim().toLowerCase();
  if (normalizedMessage.toLowerCase().startsWith(`${normalizedLabel} `)) {
    return capitalizeStatusText(
      normalizedMessage.slice(label.trim().length).trim(),
    );
  }

  return normalizedMessage;
};

function StatLabelWithInfo({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <Stack
      component="span"
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{ display: "inline-flex" }}
    >
      <span>{label}</span>
      <JoyTooltip
        title={tooltip}
        placement="top"
        variant="outlined"
        color="neutral"
        arrow
        sx={{
          maxWidth: 320,
          backgroundColor: "#FFFFFF",
          color: "#1F4341",
          fontSize: "13px",
          lineHeight: 1.45,
          boxShadow: "var(--joy-shadow-md)",
          border: "1px solid",
          borderColor: "neutral.200",
          p: 1.25,
          "--variant-borderWidth": "1px",
        }}
      >
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label={`What does ${label} mean?`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            color: "neutral.500",
            cursor: "help",
            borderRadius: "50%",
            "&:hover": { color: "neutral.700" },
            "&:focus-visible": {
              outline: "2px solid var(--joy-palette-primary-400)",
              outlineOffset: "1px",
            },
            "& > .lucide": {
              width: 14,
              height: 14,
            },
          }}
        >
          <Info aria-hidden="true" />
        </Box>
      </JoyTooltip>
    </Stack>
  );
}

const CUSTOMERS_TOOLTIP_COPY =
  "This shows customers who have a profile in BloomSuite. Walk-in cash transactions don't create profiles automatically.";

const REVENUE_TOOLTIP_COPY =
  "This shows revenue from sales linked to a named customer in your contact list. Walk-in cash sales and customers without a profile are not included here. To see total revenue including walk-ins, check the main reporting view.";

type DashboardStatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: React.ReactNode;
  change?: {
    value: string;
    direction: "up" | "down";
  };
  loading?: boolean;
  onClick?: () => void;
};

const statCardLabelSx = {
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.4,
  color: "neutral.500",
} as const;

const statCardValueSx = {
  fontFamily: "var(--joy-fontFamily-display)",
  fontSize: "28px",
  fontWeight: 700,
  lineHeight: 1.05,
  letterSpacing: "-0.03em",
  color: "neutral.900",
} as const;

const statCardFooterSx = {
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.4,
} as const;

function DashboardStatCard({
  label,
  value,
  icon,
  change,
  loading = false,
  onClick,
}: DashboardStatCardProps) {
  const isInteractive = Boolean(onClick);
  const Component = isInteractive ? "button" : "div";
  const ChangeIcon = change?.direction === "down" ? TrendingDown : TrendingUp;
  const changeColor =
    change?.direction === "down" ? "danger.600" : "success.600";

  return (
    <Box
      component={Component}
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        appearance: "none",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "12px",
        backgroundColor: "#FFFFFF",
        boxShadow: "var(--joy-shadow-xs)",
        p: 2,
        textAlign: "left",
        transition:
          "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        cursor: isInteractive ? "pointer" : "default",
        ...(isInteractive
          ? {
              "&:hover": {
                transform: "translateY(-1px)",
                boxShadow: "var(--joy-shadow-sm)",
                borderColor: "neutral.300",
              },
              "&:focus-visible": {
                outline: "2px solid var(--joy-palette-primary-400)",
                outlineOffset: "1px",
              },
            }
          : null),
      }}
    >
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Typography sx={statCardLabelSx}>
            {loading ? (
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: 76, display: "block", transform: "none" }}
              >
                Customers
              </Skeleton>
            ) : (
              label
            )}
          </Typography>

          <Box
            sx={{
              width: 20,
              height: 20,
              color: "neutral.400",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              "& > .lucide": {
                width: 20,
                height: 20,
              },
              "& > *": {
                flexShrink: 0,
              },
            }}
          >
            {loading ? (
              <Skeleton
                variant="circular"
                animation="wave"
                sx={{ width: 20, height: 20 }}
              />
            ) : (
              icon
            )}
          </Box>
        </Stack>

        <Typography sx={statCardValueSx}>
          {loading ? (
            <Skeleton
              variant="text"
              animation="wave"
              sx={{ width: 112, display: "block", transform: "none" }}
            >
              00,000
            </Skeleton>
          ) : (
            value
          )}
        </Typography>

        <Box sx={{ minHeight: 18, display: "flex", alignItems: "center" }}>
          {loading ? (
            <Typography sx={{ ...statCardFooterSx, color: "neutral.400" }}>
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: 152, display: "block", transform: "none" }}
              >
                100.0% vs last month
              </Skeleton>
            </Typography>
          ) : change ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ChangeIcon
                className="h-3 w-3"
                style={{
                  color: `var(--joy-palette-${change.direction === "down" ? "danger" : "success"}-600)`,
                }}
              />
              <Typography sx={{ ...statCardFooterSx, color: changeColor }}>
                {change.value}
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}

export const BloomSuiteDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    isCompleted,
    hasEverCompleted,
    isLoading: onboardingLoading,
  } = useOnboardingStatus();
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const { data: socialConnections = [], isLoading: loadingConnections } =
    useConnectedAccounts();
  const { data: twilioData, isLoading: loadingTwilio } = useTwilioSetup();
  const { data: crmMetrics, isLoading: loadingMetrics } =
    useCRMDashboardMetrics();
  const { data: posAnalytics, isLoading: loadingPOSAnalytics } =
    usePOSAnalytics();
  const { tenant } = useTenant();
  const {
    data: tenantSummary,
    isLoading: loadingTenantSummary,
    error: tenantSummaryError,
  } = useTenantCustomerSummary(tenant?.id);
  const audienceHealthQuery = useTenantAudienceHealth(tenant?.id);

  const displayName = useMemo(() => {
    const fullName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user?.email?.split("@")[0];

    return fullName?.split(" ")[0] || "there";
  }, [user?.email, user?.user_metadata]);

  // OnboardingGuard redirects incomplete users to /onboarding,
  // so if we reach the dashboard, onboarding is complete.
  // The setup wizard can still be opened manually via the "Complete Your Setup" button.

  // Check if user should see the quick start tour
  useEffect(() => {
    const tourDone = localStorage.getItem("dashboardTourDone");
    if (!tourDone && !showQuickTour) {
      // Show tour after a brief delay to let the page load
      setTimeout(() => {
        setShowQuickTour(true);
      }, 1000);
    }
  }, [showQuickTour]);

  // Show loading while checking onboarding status
  if (onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-gray-50/30">
        <div className="text-center">
          <CircularProgress size="md" sx={{ mb: 2 }} />
          <p className="text-primary font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const socialStatus = getConnectionStatus(socialConnections);
  const twilioStatus = getTwilioStatus(twilioData?.isSetup || false);
  const cardsLoading = loadingMetrics || loadingPOSAnalytics;
  const focusLoading =
    loadingConnections || loadingTwilio || loadingPOSAnalytics;

  const handleSelectAction = (action: string) => {
    switch (action) {
      case "website-setup":
        setShowSetupWizard(true);
        break;
      case "newsletter":
        // Route to the newsletter picker page (NewsletterNewPage)
        // where users choose how to build — Start from Scratch /
        // Pick an Idea / template — instead of dropping them into
        // a blank CRMCampaignEditorPage with no decisions made.
        navigate("/newsletters/new");
        break;
      case "social-post":
        setShowPostComposer(true);
        break;
      case "campaign":
        // /crm/automations/new mounts AutomationWizardLandingPage
        // (the picker with Guided Setup / From Template / From
        // Scratch options) — already a picker, not a blank editor.
        // ?mode=quick is the convention used by QuickStartTour,
        // DashboardCard, and the dashboard quickActions row; the
        // landing page itself ignores the param (only "guided"
        // mode is consumed downstream in CRMAutomationGuidePage),
        // so it's effectively a no-op marker preserved for
        // consistency.
        navigate("/crm/automations/new?mode=quick");
        break;
      case "content-calendar":
        navigate("/calendar");
        // Set flag for first-time calendar onboarding
        if (!localStorage.getItem("calendarOnboard")) {
          localStorage.setItem("calendarOnboard", "true");
        }
        break;
      case "dashboard":
      default:
        break;
    }
  };

  const quickActions = [
    {
      id: "newsletter",
      title: "Send a Newsletter",
      description:
        "Create an email campaign, review templates, and keep seasonal sends moving.",
      icon: Mail,
      primaryAction: {
        label: "Create newsletter",
        onClick: () => navigate("/newsletters/new"),
      },
      secondaryAction: {
        label: "View campaigns",
        onClick: () => navigate("/crm/campaigns"),
      },
    },
    {
      id: "create-flow",
      title: "Create Any Content",
      description:
        "Generate social posts, newsletters, and campaign ideas without leaving the dashboard.",
      icon: Sparkles,
      primaryAction: {
        label: "Open assistant",
        onClick: () => setShowCreateFlow(true),
      },
      secondaryAction: {
        label: "Browse content",
        onClick: () => navigate("/content/library"),
      },
    },
    {
      id: "campaign",
      title: "Build an Automation",
      description:
        "Design automated customer journeys with SMS and email sequences tied to customer behavior.",
      icon: Megaphone,
      primaryAction: {
        label: "Build campaign",
        onClick: () => navigate("/crm/automations/new?mode=quick"),
      },
      secondaryAction: {
        label: "View automations",
        onClick: () => navigate("/crm/automations"),
      },
    },
    {
      id: "social",
      title: "Post on Social Media",
      description:
        "Create, schedule, and publish content across your connected social channels.",
      icon: Share2,
      primaryAction: {
        label: "Create post",
        onClick: () => setShowPostComposer(true),
      },
      secondaryAction: {
        label: "Manage Accounts",
        onClick: () => navigate("/social-accounts"),
      },
    },
    {
      id: "planner",
      title: "Plan the Month",
      description:
        "Map campaigns, content, and timing for the next month from the planning workspace.",
      icon: Calendar,
      primaryAction: {
        label: "Open planner",
        onClick: () => navigate("/plan"),
      },
      secondaryAction: {
        label: "View calendar",
        onClick: () => navigate("/calendar"),
      },
    },
  ];

  const tenantSummaryUnavailable = Boolean(tenantSummaryError) || !tenantSummary;
  const customersValue = tenantSummary
    ? tenantSummary.total_customers.toLocaleString()
    : tenantSummaryUnavailable && !loadingTenantSummary
      ? "—"
      : "0";
  const revenueFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const revenueValue = tenantSummary
    ? revenueFormatter.format(tenantSummary.total_revenue)
    : tenantSummaryUnavailable && !loadingTenantSummary
      ? "—"
      : revenueFormatter.format(0);

  const overviewStats = [
    {
      label: (
        <StatLabelWithInfo
          label="Customers"
          tooltip={CUSTOMERS_TOOLTIP_COPY}
        />
      ),
      value: customersValue,
      icon: <Mail />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.totalCustomersGrowth)
          ? {
              value: `${Math.abs(crmMetrics.totalCustomersGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.totalCustomersGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/crm/customers"),
      loading: loadingTenantSummary,
    },
    {
      label: "Orders",
      value: (posAnalytics?.totalOrders ?? 0).toLocaleString(),
      icon: <Calendar />,
      change: posAnalytics?.hasIntegration
        ? {
            value: `${posAnalytics.integrationName ?? "POS"} connected`,
            direction: "up" as const,
          }
        : undefined,
      onClick: () => navigate("/products"),
    },
    {
      label: "Active campaigns",
      value: (crmMetrics?.activeCampaigns ?? 0).toLocaleString(),
      icon: <Megaphone />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.activeCampaignsGrowth)
          ? {
              value: `${Math.abs(crmMetrics.activeCampaignsGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.activeCampaignsGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/crm/campaigns"),
    },
    {
      label: (
        <StatLabelWithInfo label="Revenue" tooltip={REVENUE_TOOLTIP_COPY} />
      ),
      value: revenueValue,
      icon: <BarChart3 />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.totalRevenueGrowth)
          ? {
              value: `${Math.abs(crmMetrics.totalRevenueGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.totalRevenueGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/analytics"),
      loading: loadingTenantSummary,
    },
  ];

  const todayItems = [
    {
      label: "Social accounts",
      value: socialStatus.statusMessage,
      tone: socialStatus.status === "connected" ? "success" : "warning",
      statusLabel:
        socialStatus.status === "connected" ? "Ready" : "Needs attention",
      highlighted: false,
    },
    {
      label: "SMS readiness",
      value: twilioStatus.statusMessage,
      tone: twilioStatus.status === "connected" ? "success" : "warning",
      statusLabel:
        twilioStatus.status === "connected" ? "Ready" : "Needs attention",
      highlighted: false,
    },
    {
      label: "POS sync",
      value: posAnalytics?.hasIntegration
        ? `${posAnalytics.integrationName ?? "POS"} connected`
        : "No POS integration connected",
      tone: posAnalytics?.hasIntegration ? "success" : "warning",
      statusLabel: posAnalytics?.hasIntegration ? "Ready" : "Needs attention",
      highlighted: false,
    },
    {
      label: "Website tools",
      value: "Website builder remains available from the workspace shell.",
      tone: "primary",
      statusLabel: "Info",
      highlighted: true,
    },
  ] as const;

  const quickLinks = [
    { label: "Open analytics", to: "/analytics" },
    { label: "Review products", to: "/products" },
    { label: "Update settings", to: "/settings" },
    { label: "Website workspace", to: "/website/app" },
  ] as const;

  const headerStatusChips = [
    {
      key: "social",
      label: "Social",
      message: loadingConnections
        ? "Checking connection"
        : socialStatus.statusMessage,
      color: loadingConnections
        ? ("neutral" as const)
        : socialStatus.status === "connected"
          ? ("success" as const)
          : ("warning" as const),
    },
    {
      key: "sms",
      label: "SMS",
      message: loadingTwilio
        ? "Checking readiness"
        : twilioStatus.statusMessage,
      color: loadingTwilio
        ? ("neutral" as const)
        : twilioStatus.status === "connected"
          ? ("success" as const)
          : ("warning" as const),
    },
  ] as const;

  return (
    <Stack spacing={3}>
      <SetupNextStepsBanner />
      <POSInsightsCard />
      <Sheet
        variant="plain"
        sx={{
          px: { xs: 2.5, md: 3 },
          py: { xs: 2.5, md: 3 },
          borderRadius: "16px",
          background:
            "linear-gradient(135deg, rgba(240, 255, 254, 0.96) 0%, rgba(240, 255, 254, 0.42) 42%, rgba(255, 255, 255, 0) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "flex-start" }}
        >
          <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              component="p"
              sx={{
                fontSize: "11px",
                fontWeight: 700,
                lineHeight: 1.4,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "primary.600",
              }}
            >
              TENANT DASHBOARD
            </Typography>
            <Typography
              level="h3"
              sx={{
                fontSize: "24px",
                fontWeight: 700,
                lineHeight: 1.2,
                color: "neutral.900",
              }}
            >
              Welcome back, {displayName}
            </Typography>
            <Typography
              sx={{
                fontSize: "14px",
                lineHeight: 1.5,
                color: "neutral.500",
                maxWidth: "42rem",
              }}
            >
              Keep customers, campaigns, and store operations moving from one
              premium workspace.
            </Typography>
            <Stack
              direction="row"
              spacing={1.25}
              useFlexGap
              flexWrap="wrap"
              sx={{ columnGap: 1.25, rowGap: 1 }}
            >
              {headerStatusChips.map((chip) => (
                <JoyChip
                  key={chip.key}
                  size="sm"
                  variant="soft"
                  color={chip.color}
                  sx={{
                    fontSize: "12px",
                    fontWeight: 600,
                    lineHeight: 1.3,
                    px: 1.25,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      columnGap: 0.75,
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {chip.label}
                    </Box>
                    <Box
                      component="span"
                      sx={{ color: "currentColor", opacity: 0.55 }}
                    >
                      ·
                    </Box>
                    <Box component="span">
                      {getHeaderStatusChipMessage(chip.label, chip.message)}
                    </Box>
                  </Box>
                </JoyChip>
              ))}
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              alignSelf: { xs: "stretch", lg: "flex-start" },
              width: { xs: "100%", lg: "auto" },
            }}
          >
            <JoyButton
              variant="soft"
              color="neutral"
              size="sm"
              onClick={() => setShowLaunchpad(true)}
              startDecorator={<HelpCircle />}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Open launchpad
            </JoyButton>
            {!isCompleted && !hasEverCompleted ? (
              <JoyButton
                variant="solid"
                color="primary"
                size="sm"
                onClick={() => setShowSetupWizard(true)}
                startDecorator={<Sparkles />}
                sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
              >
                Complete setup
              </JoyButton>
            ) : null}
          </Stack>
        </Stack>
      </Sheet>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 1.5,
          gridAutoRows: "1fr",
        }}
      >
        {overviewStats.map((stat) => (
          <DashboardStatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            loading={stat.loading ?? cardsLoading}
            onClick={stat.onClick}
          />
        ))}
      </Box>

      {audienceHealthQuery.data && audienceHealthQuery.data.total > 0 ? (
        <Sheet
          variant="outlined"
          data-testid="dashboard-audience-health-card"
          sx={{ borderRadius: "12px", p: 2, backgroundColor: "#FFFFFF" }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack spacing={0.25}>
                <Typography
                  level="title-md"
                  sx={{ fontSize: "16px", fontWeight: 600 }}
                >
                  Audience health
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Consent status across your{" "}
                  {audienceHealthQuery.data.total.toLocaleString()} contacts
                </Typography>
              </Stack>
              <Box
                component="button"
                type="button"
                onClick={() => navigate("/crm/customers")}
                sx={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "primary.600",
                  fontSize: "13px",
                  fontWeight: 500,
                  textDecoration: "underline",
                  "&:hover": { color: "primary.700" },
                }}
              >
                View contacts
              </Box>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1.5,
              }}
            >
              <Box>
                <Typography
                  level="h4"
                  sx={{ color: "success.700", lineHeight: 1, fontWeight: 700 }}
                >
                  {audienceHealthQuery.data.eligible.toLocaleString()}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", mt: 0.5 }}
                >
                  Eligible for email
                </Typography>
              </Box>
              <Box>
                <Typography
                  level="h4"
                  sx={{
                    color:
                      audienceHealthQuery.data.pending > 0
                        ? "warning.700"
                        : "neutral.700",
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  {audienceHealthQuery.data.pending.toLocaleString()}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", mt: 0.5 }}
                >
                  Pending confirmation
                </Typography>
              </Box>
              <Box>
                <Typography
                  level="h4"
                  sx={{ color: "neutral.700", lineHeight: 1, fontWeight: 700 }}
                >
                  {audienceHealthQuery.data.optedOut.toLocaleString()}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", mt: 0.5 }}
                >
                  Opted out
                </Typography>
              </Box>
              <Box>
                <Typography
                  level="h4"
                  sx={{ color: "neutral.700", lineHeight: 1, fontWeight: 700 }}
                >
                  {audienceHealthQuery.data.suppressed.toLocaleString()}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", mt: 0.5 }}
                >
                  Suppressed
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Sheet>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            xl: "minmax(0, 2fr) minmax(320px, 1fr)",
          },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography
              level="title-md"
              sx={{ fontSize: "18px", fontWeight: 600, color: "neutral.900" }}
            >
              What would you like to do today?
            </Typography>
            <Typography
              sx={{ fontSize: "14px", lineHeight: 1.5, color: "neutral.500" }}
            >
              Jump straight into the most common tenant workflows.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.5,
              gridAutoRows: "1fr",
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Sheet key={action.id} variant="outlined" sx={actionCardSx}>
                  <Stack
                    spacing={1.5}
                    sx={{ height: "100%", justifyContent: "space-between" }}
                  >
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "999px",
                          display: "grid",
                          placeItems: "center",
                          backgroundColor: "primary.50",
                          color: "primary.700",
                          flexShrink: 0,
                          "& > .lucide": {
                            width: 18,
                            height: 18,
                          },
                        }}
                      >
                        <Icon />
                      </Box>

                      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "15px",
                            fontWeight: 600,
                            lineHeight: 1.35,
                            color: "neutral.800",
                          }}
                        >
                          {action.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "13px",
                            lineHeight: 1.5,
                            color: "neutral.500",
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                          }}
                        >
                          {action.description}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <JoyButton
                        variant="solid"
                        color="primary"
                        size="sm"
                        onClick={action.primaryAction.onClick}
                        sx={{ borderRadius: "var(--joy-radius-sm)" }}
                      >
                        {action.primaryAction.label}
                      </JoyButton>
                      <JoyButton
                        variant="plain"
                        color="neutral"
                        size="sm"
                        onClick={action.secondaryAction.onClick}
                        sx={{ borderRadius: "var(--joy-radius-sm)" }}
                      >
                        {action.secondaryAction.label}
                      </JoyButton>
                    </Stack>
                  </Stack>
                </Sheet>
              );
            })}
          </Box>
        </Stack>

        <Stack spacing={3}>
          <Sheet variant="outlined" sx={panelSurfaceSx}>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography
                  level="title-md"
                  sx={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "neutral.900",
                  }}
                >
                  Today&apos;s focus
                </Typography>
                <Typography
                  sx={{
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "neutral.500",
                  }}
                >
                  A quick tenant-level readiness check across the main channels.
                </Typography>
              </Stack>

              <Stack spacing={0} divider={<Divider sx={subtleDividerSx} />}>
                {focusLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <Box
                        key={`focus-skeleton-${index}`}
                        sx={{
                          py: 1.5,
                          px: 1.25,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 1.5,
                          alignItems: "center",
                        }}
                      >
                        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                          <Skeleton
                            sx={{
                              width: 120,
                              height: 14,
                              borderRadius: "999px",
                            }}
                          />
                          <Skeleton
                            sx={{
                              width: "80%",
                              maxWidth: 220,
                              height: 12,
                              borderRadius: "999px",
                            }}
                          />
                        </Stack>
                        <Skeleton
                          sx={{ width: 92, height: 24, borderRadius: "999px" }}
                        />
                      </Box>
                    ))
                  : todayItems.map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          py: 1.5,
                          px: 1.25,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 1.5,
                          alignItems: "center",
                          borderRadius: "12px",
                          backgroundColor: item.highlighted
                            ? "primary.50"
                            : "transparent",
                        }}
                      >
                        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            sx={{
                              fontSize: "14px",
                              fontWeight: 500,
                              lineHeight: 1.4,
                              color: "neutral.800",
                            }}
                          >
                            {item.label}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "12px",
                              lineHeight: 1.5,
                              color: "neutral.500",
                            }}
                          >
                            {item.value}
                          </Typography>
                        </Stack>
                        <JoyChip size="sm" variant="soft" color={item.tone}>
                          {item.statusLabel}
                        </JoyChip>
                      </Box>
                    ))}
              </Stack>
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={panelSurfaceSx}>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography
                  level="title-md"
                  sx={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "neutral.900",
                  }}
                >
                  Quick links
                </Typography>
                <Typography
                  sx={{
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "neutral.500",
                  }}
                >
                  Tenant actions that are usually a click away after login.
                </Typography>
              </Stack>

              <Stack spacing={0} divider={<Divider sx={subtleDividerSx} />}>
                {quickLinks.map((item) => (
                  <Box
                    key={item.to}
                    component="button"
                    type="button"
                    onClick={() => navigate(item.to)}
                    sx={{
                      width: "100%",
                      appearance: "none",
                      border: 0,
                      backgroundColor: "transparent",
                      px: 1.25,
                      py: 1.5,
                      mx: -1.25,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1.5,
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "background-color 0.18s ease",
                      "&:hover": {
                        backgroundColor: "neutral.50",
                      },
                      "&:focus-visible": {
                        outline: "2px solid var(--joy-palette-primary-400)",
                        outlineOffset: "1px",
                      },
                      "&:hover .dashboard-quick-link-label": {
                        color: "var(--joy-palette-neutral-900)",
                      },
                      "&:hover .dashboard-quick-link-icon": {
                        color: "var(--joy-palette-neutral-600)",
                        transform: "translateX(1px)",
                      },
                    }}
                  >
                    <Typography
                      className="dashboard-quick-link-label"
                      sx={{
                        fontSize: "14px",
                        fontWeight: 500,
                        lineHeight: 1.4,
                        color: "neutral.700",
                        transition: "color 0.18s ease",
                        textAlign: "left",
                      }}
                    >
                      {item.label}
                    </Typography>
                    <ArrowRight
                      className="dashboard-quick-link-icon h-4 w-4"
                      style={{
                        color: "var(--joy-palette-neutral-400)",
                        transition: "color 0.18s ease, transform 0.18s ease",
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Sheet>
        </Stack>
      </Box>

      <LaunchpadModal
        isOpen={showLaunchpad}
        onClose={() => setShowLaunchpad(false)}
        onSelectAction={handleSelectAction}
      />

      <PostComposerModal
        isOpen={showPostComposer}
        onClose={() => setShowPostComposer(false)}
      />

      <QuickStartTour
        isOpen={showQuickTour}
        onClose={() => setShowQuickTour(false)}
      />

      <CreateFlowDialog
        open={showCreateFlow}
        onOpenChange={setShowCreateFlow}
      />

      <DashboardSetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
      />
    </Stack>
  );
};
