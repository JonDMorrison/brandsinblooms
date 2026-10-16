import { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  Building2,
  Eye,
  HelpCircle,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  MousePointerClick,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SetupNextStepsBanner } from "@/components/dashboard/SetupNextStepsBanner";
import { DashboardSetupWizard } from "@/components/dashboard/DashboardSetupWizard";
import { QuickStartTour } from "@/components/dashboard/QuickStartTour";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useCampaignDeliveryMetrics } from "@/hooks/analytics/useCampaignDeliveryMetrics";
import { useTenant } from "@/hooks/useTenant";
import { useTenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";
import { useUserRole } from "@/hooks/useUserRole";
import { formatPercent } from "@/components/analytics/analyticsUtils";

function HomeMetric({
  icon,
  label,
  value,
  description,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Sheet
      component="button"
      type="button"
      variant="outlined"
      onClick={onClick}
      sx={{
        width: "100%",
        minWidth: 0,
        borderColor: "neutral.200",
        borderRadius: "lg",
        backgroundColor: "background.surface",
        boxShadow: "none",
        p: 2,
        cursor: "pointer",
        textAlign: "left",
        "&:hover": { borderColor: "neutral.400" },
        "&:focus-visible": {
          outline: "2px solid var(--joy-palette-primary-400)",
          outlineOffset: 2,
        },
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: "neutral.600", display: "flex" }}>{icon}</Box>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.700", fontWeight: 600 }}
          >
            {label}
          </Typography>
        </Stack>
        {loading ? (
          <Skeleton sx={{ width: 96, height: 36 }} />
        ) : (
          <Typography
            level="h2"
            sx={{
              fontWeight: 700,
              color: "neutral.900",
              letterSpacing: "-0.035em",
            }}
          >
            {value}
          </Typography>
        )}
        <Typography level="body-xs" sx={{ color: "neutral.600" }}>
          {description}
        </Typography>
      </Stack>
    </Sheet>
  );
}

/** A task-first home screen. Deep intelligence lives with the relevant feature. */
export const BloomSuiteDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const {
    isMasterAdmin,
    activeTenantId,
    hasHydratedTenantContext,
    availableTenants,
    setActiveTenantId,
    refreshTenants,
  } = useAdmin();
  const {
    hasPermission,
    isLoading: accessLoading,
    isError: accessError,
    refetch: refreshAccess,
  } = useUserRole();
  const {
    isCompleted,
    hasEverCompleted,
    isLoading: onboardingLoading,
  } = useOnboardingStatus();
  const [showTour, setShowTour] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const canSeeCustomers = hasPermission("customers.read");
  const canSeeReports = hasPermission("reports.read");
  const canSend = hasPermission("campaigns.write");
  const needsCompanySelection =
    isMasterAdmin && hasHydratedTenantContext && !activeTenantId;
  const permissionsPending =
    !needsCompanySelection &&
    (Boolean(accessLoading) || Boolean(tenantLoading));
  const permissionsUnavailable =
    !needsCompanySelection &&
    !permissionsPending &&
    !accessError &&
    !canSeeCustomers &&
    !canSeeReports &&
    !canSend;
  const showDashboardTasks =
    !needsCompanySelection &&
    !permissionsPending &&
    !accessError &&
    !permissionsUnavailable;
  const quickActions = [
    ...(canSend
      ? [
          {
            title: "Create an email",
            detail: "Design a newsletter",
            icon: Mail,
            destination: "/newsletters/new",
            primary: true,
          },
          {
            title: "Send a text",
            detail: "Reach customers with SMS",
            icon: MessageSquare,
            destination: "/sms/new",
            primary: false,
          },
        ]
      : []),
    ...(canSeeCustomers
      ? [
          {
            title: "Customers",
            detail: "Find and understand people",
            icon: Users,
            destination: "/crm/customers",
            primary: false,
          },
        ]
      : []),
    ...(!canSend && !canSeeCustomers && canSeeReports
      ? [
          {
            title: "View analytics",
            detail: "Explore campaign performance",
            icon: MousePointerClick,
            destination: "/analytics",
            primary: true,
          },
        ]
      : []),
  ];
  const audience = useTenantAudienceHealth(tenant?.id, {
    enabled: canSeeCustomers,
  });
  const performance = useCampaignDeliveryMetrics(30, {
    enabled: canSeeReports,
  });
  const latestCampaign = performance.campaigns[0];
  const hasEmailData = performance.summary.totalDelivered > 0;
  const displayName = useMemo(() => {
    const name =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : (user?.email?.split("@")[0] ?? "");
    return name.trim().split(/\s+/)[0] || "there";
  }, [user?.email, user?.user_metadata]);

  const metrics = [
    ...(canSeeCustomers
      ? [
          {
            key: "audience",
            icon: <Users size={18} aria-hidden="true" />,
            label: "Reachable customers",
            value:
              audience.isError || !audience.data
                ? "—"
                : audience.data.eligible.toLocaleString(),
            description: "Confirmed and not suppressed for email",
            loading: audience.isLoading,
            destination: "/crm/customers",
          },
        ]
      : []),
    ...(canSeeReports
      ? [
          {
            key: "clicks",
            icon: <MousePointerClick size={18} aria-hidden="true" />,
            label: "Click-through rate",
            value:
              !performance.error && hasEmailData
                ? formatPercent(performance.summary.avgClickRate)
                : "—",
            description: "Last 30 days · up to 10 recent sends",
            loading: performance.loading,
            destination: "/analytics",
          },
          {
            key: "opens",
            icon: <Eye size={18} aria-hidden="true" />,
            label: "Reported open rate",
            value:
              !performance.error && hasEmailData
                ? formatPercent(performance.summary.avgOpenRate)
                : "—",
            description: "Opens are estimates due to email privacy",
            loading: performance.loading,
            destination: "/analytics",
          },
        ]
      : []),
  ];

  if (onboardingLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton
          variant="rectangular"
          sx={{ height: 160, borderRadius: "lg" }}
        />
      </Box>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack spacing={0.5}>
            <Typography
              level="h3"
              sx={{ fontWeight: 700, color: "neutral.900" }}
            >
              Welcome back, {displayName}
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Your customers, campaigns, and next steps in one place.
            </Typography>
          </Stack>
          {canSend ? (
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              startDecorator={<HelpCircle size={16} aria-hidden="true" />}
              onClick={() => setShowTour(true)}
            >
              Take a tour
            </JoyButton>
          ) : (
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              startDecorator={<HelpCircle size={16} aria-hidden="true" />}
              onClick={() => navigate("/support")}
            >
              Help
            </JoyButton>
          )}
        </Stack>

        {showDashboardTasks && tenant?.id ? <SetupNextStepsBanner /> : null}

        {showDashboardTasks && !isCompleted && !hasEverCompleted ? (
          <JoyButton
            variant="soft"
            color="primary"
            size="sm"
            onClick={() => setShowSetupWizard(true)}
          >
            Complete business setup
          </JoyButton>
        ) : null}

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography
            level="title-lg"
            sx={{ fontWeight: 700, color: "neutral.900" }}
          >
            What would you like to do?
          </Typography>

          {needsCompanySelection ? (
            <Sheet
              variant="outlined"
              sx={{
                p: { xs: 2.25, sm: 3 },
                borderRadius: "lg",
                borderColor: "neutral.300",
                bgcolor: "background.surface",
              }}
            >
              <Stack spacing={1.5} sx={{ maxWidth: 570 }}>
                <Stack direction="row" gap={1.25} alignItems="flex-start">
                  <Building2
                    size={23}
                    color="var(--joy-palette-neutral-600)"
                    aria-hidden="true"
                  />
                  <Stack spacing={0.5}>
                    <Typography level="title-lg">
                      Choose a company to get started
                    </Typography>
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.700", lineHeight: 1.6 }}
                    >
                      Your dashboard actions and campaign data are tied to the
                      company you're managing. Select one to see its tools.
                      Nothing has been deleted or hidden permanently.
                    </Typography>
                  </Stack>
                </Stack>
                <Select
                  aria-label="Company to manage"
                  placeholder="Select a garden centre"
                  value={activeTenantId ?? null}
                  onChange={(_, companyId) => {
                    if (companyId) void setActiveTenantId(companyId);
                  }}
                  sx={{ minHeight: 48, width: "100%" }}
                >
                  {availableTenants.map((company) => (
                    <Option key={company.id} value={company.id}>
                      {company.name}
                    </Option>
                  ))}
                </Select>
                {availableTenants.length === 0 ? (
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    startDecorator={<RefreshCw size={15} aria-hidden="true" />}
                    onClick={() => void refreshTenants()}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Refresh company list
                  </JoyButton>
                ) : null}
              </Stack>
            </Sheet>
          ) : permissionsPending ? (
            <Sheet
              variant="outlined"
              role="status"
              aria-label="Loading dashboard actions"
              sx={{
                p: 2,
                borderRadius: "lg",
                borderColor: "neutral.200",
              }}
            >
              <Stack spacing={1.25}>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  Loading your company tools…
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  {[0, 1, 2].map((item) => (
                    <Skeleton
                      key={item}
                      variant="rectangular"
                      sx={{ height: 78, borderRadius: "lg" }}
                    />
                  ))}
                </Box>
              </Stack>
            </Sheet>
          ) : accessError || permissionsUnavailable ? (
            <Alert
              role="alert"
              color={accessError ? "danger" : "neutral"}
              variant="soft"
              startDecorator={<ShieldAlert size={21} aria-hidden="true" />}
              sx={{
                borderRadius: "lg",
                alignItems: "flex-start",
                p: 2.25,
              }}
            >
              <Stack spacing={1.5} sx={{ minWidth: 0, width: "100%" }}>
                <Stack spacing={0.5}>
                  <Typography level="title-md">
                    {accessError
                      ? "We couldn't load your dashboard access"
                      : "Your dashboard tools aren't available yet"}
                  </Typography>
                  <Typography level="body-sm" sx={{ lineHeight: 1.6 }}>
                    {accessError
                      ? "Your company permissions couldn't be verified. Try again to restore your dashboard actions."
                      : tenant?.id
                        ? "Your account doesn't currently have access to these CRM tools. An administrator may need to review your permissions."
                        : "We couldn't determine an active company for this account. Please refresh your access or contact your administrator."}
                  </Typography>
                </Stack>
                <JoyButton
                  size="md"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<RefreshCw size={16} aria-hidden="true" />}
                  onClick={() => void refreshAccess()}
                  sx={{ alignSelf: "flex-start", minHeight: 44 }}
                >
                  Retry dashboard access
                </JoyButton>
              </Stack>
            </Alert>
          ) : null}

          {showDashboardTasks ? (
            <Box
              sx={{
                display: "grid",
                width: "100%",
                minWidth: 0,
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
                gap: 1.25,
              }}
            >
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <JoyButton
                    key={action.destination}
                    size="lg"
                    color={action.primary ? "primary" : "neutral"}
                    variant={action.primary ? "solid" : "outlined"}
                    onClick={() => navigate(action.destination)}
                    sx={{
                      width: "100%",
                      minWidth: 0,
                      minHeight: 84,
                      p: 2,
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: 1.5,
                      borderRadius: "lg",
                      textAlign: "left",
                    }}
                  >
                    <Icon
                      size={23}
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    />
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "inherit",
                          lineHeight: 1.3,
                        }}
                      >
                        {action.title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          color: "inherit",
                          opacity: 0.85,
                          fontWeight: 400,
                          lineHeight: 1.4,
                        }}
                      >
                        {action.detail}
                      </Typography>
                    </Stack>
                    <ArrowRight
                      size={17}
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    />
                  </JoyButton>
                );
              })}
            </Box>
          ) : null}
        </Stack>

        {showDashboardTasks && metrics.length > 0 ? (
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography level="title-md" sx={{ fontWeight: 600 }}>
                Recent performance
              </Typography>
              {canSeeReports ? (
                <JoyButton
                  size="sm"
                  variant="plain"
                  color="primary"
                  onClick={() => navigate("/analytics")}
                >
                  Explore analytics <ArrowRight size={15} aria-hidden="true" />
                </JoyButton>
              ) : null}
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: `repeat(${metrics.length}, minmax(0, 1fr))`,
                },
                gap: 1.5,
              }}
            >
              {metrics.map((item) => (
                <HomeMetric
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  description={item.description}
                  loading={item.loading}
                  onClick={() => navigate(item.destination)}
                />
              ))}
            </Box>
          </Stack>
        ) : null}

        {showDashboardTasks && canSeeReports ? (
          <Sheet
            variant="outlined"
            sx={{
              borderColor: "neutral.200",
              borderRadius: "lg",
              p: 2.5,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={2}
            >
              <Stack spacing={0.4}>
                <Typography level="title-md" sx={{ fontWeight: 600 }}>
                  Your latest email campaign
                </Typography>
                {performance.loading ? (
                  <Skeleton sx={{ width: 230, height: 24 }} />
                ) : latestCampaign ? (
                  <>
                    <Typography level="body-sm" sx={{ color: "neutral.800" }}>
                      {latestCampaign.campaignName}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                      {latestCampaign.computedDelivered > 0
                        ? `${latestCampaign.computedDelivered.toLocaleString()} delivered · Click-through ${formatPercent(latestCampaign.clickRate)}`
                        : "Delivery totals are not available yet"}
                    </Typography>
                  </>
                ) : (
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    {performance.error
                      ? "Campaign results aren't available right now."
                      : "Your first campaign results will appear here."}
                  </Typography>
                )}
              </Stack>
              <JoyButton
                size="sm"
                color="neutral"
                variant="outlined"
                onClick={() =>
                  navigate(
                    latestCampaign
                      ? `/crm/campaigns/${latestCampaign.campaignId}/report`
                      : "/crm/campaigns",
                  )
                }
              >
                {latestCampaign ? "View campaign report" : "View campaigns"}
                <ArrowRight size={15} aria-hidden="true" />
              </JoyButton>
            </Stack>
          </Sheet>
        ) : null}
      </Stack>
      <QuickStartTour isOpen={showTour} onClose={() => setShowTour(false)} />
      <DashboardSetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
      />
    </PageContainer>
  );
};
