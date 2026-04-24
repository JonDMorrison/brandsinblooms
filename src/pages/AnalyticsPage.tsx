import { useCallback, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Download, RefreshCw, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnalyticsKPIStrip } from "@/components/analytics/AnalyticsKPIStrip";
import { DataSourcesSection } from "@/components/analytics/DataSourcesSection";
import { EmailCampaignSection } from "@/components/analytics/EmailCampaignSection";
import { InsightsSection } from "@/components/analytics/InsightsSection";
import { ListHealthCard } from "@/components/analytics/ListHealthCard";
import { MarketingPerformanceSection } from "@/components/analytics/MarketingPerformanceSection";
import {
  ANALYTICS_PERIOD_OPTIONS,
  formatCompactNumber,
  formatCurrency,
  type AnalyticsPeriod,
} from "@/components/analytics/analyticsUtils";
import { RevenueSalesSection } from "@/components/analytics/RevenueSalesSection";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import { useGASettings } from "@/hooks/useGASettings";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { usePOSAnalytics } from "@/hooks/usePOSAnalytics";

const AnalyticsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>(30);
  const {
    settings: gaSettings,
    error: gaError,
    isConnected: gaConnected,
    loading: gaLoading,
    propertyId,
    refresh: refreshGASettings,
  } = useGASettings();
  const overview = useAnalyticsOverview(selectedPeriod);
  const {
    data: posData,
    error: posQueryError,
    isFetching: posFetching,
    isLoading: posLoading,
    refetch: refetchPOSAnalytics,
  } = usePOSAnalytics(selectedPeriod);

  const handleExportData = useCallback(() => {
    toast.info("Export feature coming soon");
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      overview.refetch(),
      refetchPOSAnalytics(),
      refreshGASettings(),
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [key] = query.queryKey;

          return (
            typeof key === "string" &&
            (key.startsWith("analytics-") || key === "pos-analytics")
          );
        },
      }),
    ]);
  }, [overview, queryClient, refetchPOSAnalytics, refreshGASettings]);

  const summaryMetrics = useMemo(
    () => [
      {
        label: "customers",
        value: formatCompactNumber(posData?.totalCustomers ?? 0),
      },
      {
        label: "revenue",
        value: formatCurrency(posData?.totalRevenue ?? 0, { compact: true }),
      },
      {
        label: "orders",
        value: formatCompactNumber(posData?.totalOrders ?? 0),
      },
      {
        label: "conversions",
        value: formatCompactNumber(overview.conversions),
      },
    ],
    [
      overview.conversions,
      posData?.totalCustomers,
      posData?.totalOrders,
      posData?.totalRevenue,
    ],
  );

  const isRefreshing = overview.loading || posFetching;

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="h3" fontWeight="bold">
              Business Analytics
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Complete overview of your marketing performance and customer
              insights.
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              {summaryMetrics.map((metric) => (
                <Typography
                  key={metric.label}
                  level="body-xs"
                  sx={{ color: "neutral.500" }}
                >
                  <Box
                    component="span"
                    sx={{ color: "neutral.900", fontWeight: 600 }}
                  >
                    {metric.value}
                  </Box>{" "}
                  {metric.label}
                </Typography>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => {
                void handleRefresh();
              }}
              aria-label="Refresh analytics"
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  animation: isRefreshing
                    ? "analytics-refresh-spin 1s linear infinite"
                    : "none",
                  "@keyframes analytics-refresh-spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCw size={16} />
              </Box>
            </IconButton>

            <Dropdown>
              <MenuButton
                slots={{ root: JoyButton }}
                slotProps={{
                  root: {
                    variant: "solid",
                    color: "primary",
                    size: "sm",
                    startDecorator: <Download size={16} />,
                  },
                }}
              >
                Export
              </MenuButton>
              <Menu placement="bottom-end" sx={{ minWidth: 220, p: 0.5 }}>
                <MenuItem onClick={handleExportData}>Export Data</MenuItem>
                <MenuItem onClick={() => navigate("/settings")}>
                  Analytics Settings
                </MenuItem>
              </Menu>
            </Dropdown>
          </Stack>
        </Stack>

        <AnalyticsKPIStrip
          overview={overview}
          period={selectedPeriod}
          posData={posData}
          posError={
            posQueryError instanceof Error ? posQueryError.message : null
          }
          posLoading={posLoading}
        />

        <Stack spacing={1.25}>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Time range
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1}
          >
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ display: { xs: "none", sm: "flex" } }}
            >
              {ANALYTICS_PERIOD_OPTIONS.map((option) => (
                <JoyButton
                  key={option.value}
                  size="sm"
                  color={
                    selectedPeriod === option.value ? "primary" : "neutral"
                  }
                  variant={selectedPeriod === option.value ? "solid" : "soft"}
                  onClick={() => setSelectedPeriod(option.value)}
                >
                  {option.label}
                </JoyButton>
              ))}
            </Stack>

            <Box sx={{ display: { xs: "block", sm: "none" }, width: "100%" }}>
              <JoySelect
                value={String(selectedPeriod)}
                onValueChange={(value) =>
                  setSelectedPeriod(Number(value) as AnalyticsPeriod)
                }
                options={ANALYTICS_PERIOD_OPTIONS.map((option) => ({
                  label: option.label,
                  value: String(option.value),
                }))}
              />
            </Box>
          </Stack>
        </Stack>

        <RevenueSalesSection
          period={selectedPeriod}
          posData={posData}
          posLoading={posLoading}
        />

        <MarketingPerformanceSection
          dateRange={selectedPeriod}
          gaConnected={gaConnected}
          overview={overview}
          propertyId={propertyId}
        />

        <Grid container spacing={2}>
          <Grid xs={12} md={7} lg={8}>
            <EmailCampaignSection dateRange={selectedPeriod} />
          </Grid>
          <Grid xs={12} md={5} lg={4}>
            <ListHealthCard />
          </Grid>
        </Grid>

        <InsightsSection
          clicks={overview.clicks}
          conversions={overview.conversions}
          engagementRate={overview.engagementRate}
          growth={overview.growth}
          totalRevenue={posData?.totalRevenue ?? 0}
          totalViews={overview.totalViews}
        />

        <DataSourcesSection
          gaError={gaError}
          gaLoading={gaLoading}
          gaSettings={gaSettings}
          onSyncComplete={overview.refetch}
        />
      </Stack>
    </PageContainer>
  );
};

export default AnalyticsPage;
