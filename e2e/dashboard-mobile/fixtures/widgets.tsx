export function SetupNextStepsBanner() {
  return null;
}
export function DashboardSetupWizard() {
  return null;
}
export function QuickStartTour() {
  return null;
}
export function useTenantAudienceHealth() {
  return {
    data: { eligible: 1250, total: 1700 },
    isLoading: false,
    isError: false,
  };
}
export function useCampaignDeliveryMetrics() {
  return {
    summary: { totalDelivered: 2000, avgClickRate: 3.2, avgOpenRate: 20.5 },
    campaigns: [
      {
        campaignId: "example-campaign",
        campaignName: "Example spring newsletter",
        computedDelivered: 2000,
        clickRate: 3.2,
      },
    ],
    loading: false,
    error: null,
  };
}
