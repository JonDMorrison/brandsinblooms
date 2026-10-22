import { useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Mail,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnalyticsKPIStrip } from "@/components/analytics/AnalyticsKPIStrip";
import { DataSourcesSection } from "@/components/analytics/DataSourcesSection";
import { EmailCampaignSection } from "@/components/analytics/EmailCampaignSection";
import { InsightsSection } from "@/components/analytics/InsightsSection";
import { ListHealthCard } from "@/components/analytics/ListHealthCard";
import { MarketingPerformanceSection } from "@/components/analytics/MarketingPerformanceSection";
import {
  ANALYTICS_PERIOD_OPTIONS,
  type AnalyticsPeriod,
} from "@/components/analytics/analyticsUtils";
import { RevenueSalesSection } from "@/components/analytics/RevenueSalesSection";
import { CampaignAnalyticsDashboard } from "@/components/crm/CampaignAnalyticsDashboard";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySelect } from "@/components/joy/JoySelect";
import { PageContainer } from "@/components/joy/PageContainer";
import { useGASettings } from "@/hooks/useGASettings";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { usePOSAnalytics } from "@/hooks/usePOSAnalytics";
import { useTenant } from "@/hooks/useTenant";
import { useTenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";
import { useUserRole } from "@/hooks/useUserRole";

type AnalyticsView = "overview" | "campaigns" | "customers" | "sales";

const views: Array<{
  id: AnalyticsView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "overview", label: "Overview", icon: <BarChart3 size={16} aria-hidden="true" /> },
  { id: "campaigns", label: "Campaigns", icon: <Mail size={16} aria-hidden="true" /> },
  { id: "customers", label: "Customers", icon: <Users size={16} aria-hidden="true" /> },
  { id: "sales", label: "Sales", icon: <ShoppingBag size={16} aria-hidden="true" /> },
];

/** Detailed requests are mounted only when someone explicitly opens this section. */
function ChannelDetails({ period }: { period: AnalyticsPeriod }) {
  const ga = useGASettings();
  const overview = useAnalyticsOverview(period);
  return (
    <Stack spacing={3}>
      <MarketingPerformanceSection
        dateRange={period}
        gaConnected={ga.isConnected}
        overview={overview}
        propertyId={ga.propertyId}
      />
      <InsightsSection
        clicks={overview.clicks}
        conversions={overview.conversions}
        engagementRate={overview.engagementRate}
        growth={overview.growth}
        totalRevenue={0}
        showRevenueInsight={false}
        totalViews={overview.totalViews}
      />
      <DataSourcesSection gaError={ga.error} gaLoading={ga.loading} gaSettings={ga.settings} />
    </Stack>
  );
}

function CustomerAnalytics() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { hasPermission } = useUserRole();
  const canReadCustomers = hasPermission("customers.read");
  const audience = useTenantAudienceHealth(tenant?.id, { enabled: canReadCustomers });
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography level="title-lg">Customer health</Typography>
        <Typography level="body-sm" sx={{ color: "neutral.600" }}>
          Your reachable audience and list quality. These counts cover your CRM,
          independent of the selected campaign period.
        </Typography>
      </Stack>
      {canReadCustomers ? (
        <Box sx={{
          border: "1px solid",
          borderColor: "neutral.200",
          borderRadius: "lg",
          backgroundColor: "background.surface",
          p: 2.5,
        }}>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>Reachable by email</Typography>
          <Typography level="h2" sx={{ fontWeight: 700, my: 0.5 }}>
            {audience.isFetching ? "—" : audience.isError || !audience.data
              ? "Unavailable" : audience.data.eligible.toLocaleString()}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            Confirmed opt-in, excluding suppressed contacts
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
            <JoyButton size="sm" variant="outlined" color="neutral"
              onClick={() => navigate("/crm/customers")}>View customers</JoyButton>
            {hasPermission("segments.manage") ? (
              <JoyButton size="sm" variant="plain" color="neutral"
                onClick={() => navigate("/crm/segments")}>Segments</JoyButton>
            ) : null}
          </Stack>
        </Box>
      ) : (
        <Typography level="body-sm" sx={{ color: "neutral.600" }}>
          Customer detail requires customer read permission.
        </Typography>
      )}
      {canReadCustomers ? <ListHealthCard /> : null}
    </Stack>
  );
}

function SalesAnalytics({ period }: { period: AnalyticsPeriod }) {
  const { data, error, isLoading, refetch } = usePOSAnalytics(period);
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between" spacing={1}>
        <Typography level="title-lg">Sales overview</Typography>
        <JoyButton color="neutral" size="sm" variant="outlined"
          onClick={() => void refetch()}>
          Refresh sales
        </JoyButton>
      </Stack>
      <AnalyticsKPIStrip
        posData={data}
        posError={error instanceof Error ? error.message : null}
        posLoading={isLoading}
      />
      <RevenueSalesSection
        period={period}
        posData={data}
        posError={error instanceof Error ? error.message : null}
        posLoading={isLoading}
      />
      <Typography level="body-xs" sx={{ color: "neutral.600" }}>
        Orders are counted across all normalized providers, for the selected period,
        after excluding incomplete, cancelled, and refunded orders. Revenue is
        never combined across currencies.
      </Typography>
    </Stack>
  );
}

const AnalyticsPage = () => {
  const navigate=useNavigate();
  const {hasPermission}=useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const activeView: AnalyticsView = views.some((view) => view.id === requestedView)
    ? (requestedView as AnalyticsView)
    : "overview";
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>(30);
  const [showChannels, setShowChannels] = useState(false);

  const selectView = (view: AnalyticsView) => {
    setSearchParams(view === "overview" ? {} : { view });
  };
  const hasPeriodSelector = activeView === "overview" || activeView === "sales";

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack spacing={0.5}>
          <Typography level="h3" sx={{ fontWeight: 700 }}>Analytics</Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            Understand what is working, without hunting through reports.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap"
          role="group" aria-label="Analytics sections">
          {views.map((view) => (
            <JoyButton
              key={view.id}
              color={activeView === view.id ? "primary" : "neutral"}
              variant={activeView === view.id ? "solid" : "soft"}
              size="sm"
              aria-pressed={activeView === view.id}
              startDecorator={view.icon}
              onClick={() => selectView(view.id)}
            >
              {view.label}
            </JoyButton>
          ))}
        </Stack>

        {hasPermission("reports.read")&&<Stack spacing={0.5}>
          <Typography level="body-sm">IdealPOS report totals are available separately from connected POS orders. An empty order chart does not mean imported sales are missing.</Typography>
          <JoyButton variant="outlined" onClick={()=>navigate("/crm/intelligence?view=growth")}>View imported report spending</JoyButton>
        </Stack>}

        {hasPeriodSelector ? (
          <Stack direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }} spacing={1.5}>
            <Typography level="body-xs" sx={{ color: "neutral.600", fontWeight: 600 }}>
              Reporting period
            </Typography>
            <Stack direction="row" spacing={0.75}
              sx={{ display: { xs: "none", sm: "flex" } }}>
              {ANALYTICS_PERIOD_OPTIONS.map((option) => (
                <JoyButton
                  key={option.value} size="sm"
                  color={selectedPeriod === option.value ? "primary" : "neutral"}
                  variant={selectedPeriod === option.value ? "solid" : "soft"}
                  onClick={() => setSelectedPeriod(option.value)}
                >
                  {option.label}
                </JoyButton>
              ))}
            </Stack>
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              <JoySelect
                value={String(selectedPeriod)}
                onValueChange={(value) => setSelectedPeriod(Number(value) as AnalyticsPeriod)}
                options={ANALYTICS_PERIOD_OPTIONS.map((option) => ({
                  label: option.label, value: String(option.value),
                }))}
              />
            </Box>
          </Stack>
        ) : null}

        {activeView === "overview" ? (
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography level="title-lg">Email engagement</Typography>
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                Recent campaign results, with clicks first and reported opens
                clearly distinguished from privacy-adjusted opens.
              </Typography>
            </Stack>
            <EmailCampaignSection dateRange={selectedPeriod} />
            <JoyButton size="sm" variant="outlined" color="neutral"
              onClick={() => selectView("campaigns")}>
              Explore all campaign reports
            </JoyButton>
            <Stack spacing={1} sx={{ pt: 1, alignItems: "flex-start" }}>
              <JoyButton size="sm" variant="plain" color="neutral"
                onClick={() => setShowChannels(!showChannels)}
                aria-expanded={showChannels}>
                {showChannels ? "Hide" : "Show"} channel details & recommendations
              </JoyButton>
              {showChannels ? <ChannelDetails period={selectedPeriod} /> : null}
            </Stack>
          </Stack>
        ) : null}

        {activeView === "campaigns" ? (
          <Stack spacing={1}>
            <CampaignAnalyticsDashboard />
          </Stack>
        ) : null}
        {activeView === "customers" ? <CustomerAnalytics /> : null}
        {activeView === "sales" ? <SalesAnalytics period={selectedPeriod} /> : null}
      </Stack>
    </PageContainer>
  );
};

export default AnalyticsPage;
