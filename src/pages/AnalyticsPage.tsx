import { useCallback, useState } from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BarChart3, ChevronDown, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

  const isRefreshing = overview.loading || posFetching;

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="h3" fontWeight="bold">
              Analytics
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Start with email engagement. Explore your store, audience and channels when you need more detail.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => void handleRefresh()}
              aria-label="Refresh analytics"
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  animation: isRefreshing ? "analytics-refresh-spin 1s linear infinite" : "none",
                  "@keyframes analytics-refresh-spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </Box>
            </IconButton>
            <JoyButton
              variant="outlined"
              color="neutral"
              size="sm"
              startDecorator={<BarChart3 size={16} aria-hidden="true" />}
              onClick={() => navigate("/crm/analytics")}
            >
              Campaign reports
            </JoyButton>
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Typography level="body-xs" sx={{ color: "neutral.600", fontWeight: 600 }}>
            Reporting period
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ display: { xs: "none", sm: "flex" } }}
          >
            {ANALYTICS_PERIOD_OPTIONS.map((option) => (
              <JoyButton
                key={option.value}
                size="sm"
                color={selectedPeriod === option.value ? "primary" : "neutral"}
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

        <Stack spacing={1.25}>
          <Typography level="title-lg" sx={{ color: "neutral.900" }}>
            Email engagement
          </Typography>
          <EmailCampaignSection dateRange={selectedPeriod} />
        </Stack>

        <Stack spacing={1.25}>
          <Typography level="title-lg" sx={{ color: "neutral.900" }}>
            Business at a glance
          </Typography>
          <AnalyticsKPIStrip
            overview={overview}
            period={selectedPeriod}
            posData={posData}
            posError={posQueryError instanceof Error ? posQueryError.message : null}
            posLoading={posLoading}
          />
        </Stack>

        <Box
          component="details"
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
            borderRadius: "lg",
            p: { xs: 2, md: 2.5 },
            "&[open] .analytics-details-chevron": {
              transform: "rotate(180deg)",
            },
          }}
        >
          <Box
            component="summary"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              cursor: "pointer",
              listStyle: "none",
              "&::-webkit-details-marker": { display: "none" },
              "&:focus-visible": {
                outline: "2px solid var(--joy-palette-primary-400)",
                outlineOffset: 2,
              },
            }}
          >
            <Stack spacing={0.5}>
              <Typography level="title-md" sx={{ fontWeight: 600 }}>
                Explore detailed analytics
              </Typography>
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                Revenue, channels, list health, recommendations and connections
              </Typography>
            </Stack>
            <ChevronDown
              className="analytics-details-chevron"
              size={20}
              aria-hidden="true"
              style={{ flexShrink: 0, transition: "transform 150ms ease" }}
            />
          </Box>
          <Stack spacing={3} sx={{ pt: 3 }}>
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
            <ListHealthCard />
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
            />
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
};

export default AnalyticsPage;
