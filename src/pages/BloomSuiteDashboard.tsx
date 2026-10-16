import { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  Eye,
  HelpCircle,
  Mail,
  MessageSquare,
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
          <Typography level="body-sm" sx={{ color: "neutral.700", fontWeight: 600 }}>
            {label}
          </Typography>
        </Stack>
        {loading ? (
          <Skeleton sx={{ width: 96, height: 36 }} />
        ) : (
          <Typography level="h2" sx={{
            fontWeight: 700,
            color: "neutral.900",
            letterSpacing: "-0.035em",
          }}>
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
  const { tenant } = useTenant();
  const { hasPermission } = useUserRole();
  const { isCompleted, hasEverCompleted, isLoading: onboardingLoading } =
    useOnboardingStatus();
  const [showTour, setShowTour] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const canSeeCustomers = hasPermission("customers.read");
  const canSeeReports = hasPermission("reports.read");
  const canSend = hasPermission("campaigns.write");
  const audience = useTenantAudienceHealth(tenant?.id, {
    enabled: canSeeCustomers,
  });
  const performance = useCampaignDeliveryMetrics(30);
  const latestCampaign = performance.campaigns[0];
  const hasEmailData = performance.summary.totalDelivered > 0;
  const displayName = useMemo(() => {
    const name = typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user?.email?.split("@")[0] ?? "";
    return name.trim().split(/\s+/)[0] || "there";
  }, [user?.email, user?.user_metadata]);

  const metrics = [
    ...(canSeeCustomers ? [{
      key: "audience",
      icon: <Users size={18} aria-hidden="true" />,
      label: "Reachable customers",
      value: audience.isError || !audience.data ? "—" : audience.data.eligible.toLocaleString(),
      description: "Confirmed and not suppressed for email",
      loading: audience.isLoading,
      destination: "/crm/customers",
    }] : []),
    ...(canSeeReports ? [
      {
        key: "clicks",
        icon: <MousePointerClick size={18} aria-hidden="true" />,
        label: "Click-through rate",
        value: !performance.error && hasEmailData ? formatPercent(performance.summary.avgClickRate) : "—",
        description: "Last 30 days · up to 10 recent sends",
        loading: performance.loading,
        destination: "/analytics",
      },
      {
        key: "opens",
        icon: <Eye size={18} aria-hidden="true" />,
        label: "Reported open rate",
        value: !performance.error && hasEmailData ? formatPercent(performance.summary.avgOpenRate) : "—",
        description: "Opens are estimates due to email privacy",
        loading: performance.loading,
        destination: "/analytics",
      },
    ] : []),
  ];

  if (onboardingLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" sx={{ height: 160, borderRadius: "lg" }} />
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
            <Typography level="h3" sx={{ fontWeight: 700, color: "neutral.900" }}>
              Welcome back, {displayName}
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Your customers, campaigns, and next steps in one place.
            </Typography>
          </Stack>
          <JoyButton
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<HelpCircle size={16} aria-hidden="true" />}
            onClick={() => setShowTour(true)}
          >
            Take a tour
          </JoyButton>
        </Stack>

        <SetupNextStepsBanner />

        {!isCompleted && !hasEverCompleted ? (
          <JoyButton
            variant="soft"
            color="primary"
            size="sm"
            onClick={() => setShowSetupWizard(true)}
          >
            Complete business setup
          </JoyButton>
        ) : null}

        <Stack spacing={1.25}>
          <Typography level="title-md" sx={{ fontWeight: 600 }}>What would you like to do?</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            {canSend ? (
              <>
                <JoyButton
                  size="md"
                  color="primary"
                  startDecorator={<Mail size={18} aria-hidden="true" />}
                  onClick={() => navigate("/newsletters/new")}
                >
                  Create an email
                </JoyButton>
                <JoyButton
                  size="md"
                  color="neutral"
                  variant="outlined"
                  startDecorator={<MessageSquare size={18} aria-hidden="true" />}
                  onClick={() => navigate("/sms/new")}
                >
                  Send a text
                </JoyButton>
              </>
            ) : null}
            {canSeeCustomers ? (
              <JoyButton
                size="md"
                color="neutral"
                variant={canSend ? "plain" : "solid"}
                startDecorator={<Users size={18} aria-hidden="true" />}
                onClick={() => navigate("/crm/customers")}
              >
                Customers
              </JoyButton>
            ) : null}
          </Stack>
        </Stack>

        {metrics.length > 0 ? (
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-md" sx={{ fontWeight: 600 }}>Recent performance</Typography>
              {canSeeReports ? (
                <JoyButton size="sm" variant="plain" color="primary"
                  onClick={() => navigate("/analytics")}>
                  Explore analytics <ArrowRight size={15} aria-hidden="true" />
                </JoyButton>
              ) : null}
            </Stack>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: `repeat(${metrics.length}, minmax(0, 1fr))`,
              },
              gap: 1.5,
            }}>
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

        {canSeeReports ? (
          <Sheet variant="outlined" sx={{
            borderColor: "neutral.200", borderRadius: "lg", p: 2.5,
          }}>
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
                      {latestCampaign.computedDelivered.toLocaleString()} delivered
                      {" · "}Click-through {formatPercent(latestCampaign.clickRate)}
                    </Typography>
                  </>
                ) : (
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    {performance.error ? "Campaign results aren't available right now."
                      : "Your first campaign results will appear here."}
                  </Typography>
                )}
              </Stack>
              <JoyButton
                size="sm"
                color="neutral"
                variant="outlined"
                onClick={() => navigate(latestCampaign
                  ? `/crm/campaigns/${latestCampaign.campaignId}/report`
                  : "/crm/campaigns")}
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
