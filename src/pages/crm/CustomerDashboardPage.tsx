import * as React from "react";
import Box from "@mui/joy/Box";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  HeartPulse,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CustomerActivityPanel } from "@/components/activity/CustomerActivityPanel";
import { AIInsightsActions } from "@/components/crm/customer-dashboard/AIInsightsActions";
import { ChannelDeepDive } from "@/components/crm/customer-dashboard/ChannelDeepDive";
import { CrossChannelIntelligence } from "@/components/crm/customer-dashboard/CrossChannelIntelligence";
import { CustomerContactCard } from "@/components/crm/customer-dashboard/CustomerContactCard";
import { CustomerEventTimeline } from "@/components/crm/customer-dashboard/CustomerEventTimeline";
import { CustomerProfileHeader } from "@/components/crm/customer-dashboard/CustomerProfileHeader";
import { CustomerQuickStats } from "@/components/crm/customer-dashboard/CustomerQuickStats";
import { CustomerSegmentsCard } from "@/components/crm/customer-dashboard/CustomerSegmentsCard";
import { CustomerSnapshot } from "@/components/crm/customer-dashboard/CustomerSnapshot";
import { EditCustomerDialog } from "@/components/crm/customer-dashboard/EditCustomerDialog";
import { EngagementHealthOverview } from "@/components/crm/customer-dashboard/EngagementHealthOverview";
import { LoyaltyIncentivesImpact } from "@/components/crm/customer-dashboard/LoyaltyIncentivesImpact";
import { PurchaseValueBehavior } from "@/components/crm/customer-dashboard/PurchaseValueBehavior";
import { RiskNegativeSignals } from "@/components/crm/customer-dashboard/RiskNegativeSignals";
import {
  buildCustomerName,
  getPersonaLabel,
} from "@/components/crm/customer-dashboard/customerDashboardUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTabs, JoyTabsList, JoyTabsTrigger } from "@/components/joy/JoyTabs";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import type { CustomerDashboardTimeRange } from "@/hooks/customerDashboardQueryTypes";
import {
  useCustomerDashboard,
  type CustomerData,
} from "@/hooks/useCustomerDashboard";
import { useCustomerPersonas } from "@/hooks/useCustomerPersonas";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";
import { useDeleteCustomer } from "@/hooks/useDeleteCustomer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  transformToCrossChannelMetrics,
  transformToEmailMetrics,
  transformToEngagementMetrics,
  transformToLoyaltyMetrics,
  transformToPurchaseMetrics,
  transformToRecentRiskEvents,
  transformToRiskMetrics,
  transformToSnapshotMetrics,
  transformToSmsMetrics,
  transformToTimelineEvents,
} from "@/lib/customerDashboardTransformers";
import { logActivity } from "@/lib/activityLogger";

type DashboardTab =
  | "overview"
  | "activity"
  | "engagement"
  | "purchase"
  | "insights";
type ActivityStatusFilter =
  | "all"
  | "success"
  | "failed"
  | "pending"
  | "warning";
type ActivityTypeFilter = "all" | "customer" | "persona" | "notes";

const TAB_OPTIONS: Array<{
  value: DashboardTab;
  label: string;
  icon: React.ElementType;
}> = [
  { value: "overview", label: "Overview", icon: UserCircle2 },
  { value: "activity", label: "Activity", icon: Activity },
  { value: "engagement", label: "Engagement", icon: HeartPulse },
  { value: "purchase", label: "Purchase", icon: ShoppingBag },
  { value: "insights", label: "Insights", icon: Sparkles },
];

const RANGE_OPTIONS: CustomerDashboardTimeRange[] = ["7d", "30d", "90d", "all"];
const ACTIVITY_TYPE_OPTIONS: Array<{
  value: ActivityTypeFilter;
  label: string;
}> = [
  { value: "all", label: "All types" },
  { value: "customer", label: "Customer changes" },
  { value: "persona", label: "Persona changes" },
  { value: "notes", label: "Notes" },
];

const ACTIVITY_TYPE_FILTERS: Record<ActivityTypeFilter, string[] | undefined> =
  {
    all: undefined,
    customer: [
      "customer.created",
      "customer.updated",
      "customer.deleted",
      "customer.bulk_deleted",
    ],
    persona: ["persona.assigned", "persona.removed"],
    notes: ["customer.note_added"],
  };

const STATUS_OPTIONS: Array<{ value: ActivityStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
  { value: "warning", label: "Warning" },
];

const validTabs = new Set<DashboardTab>([
  "overview",
  "activity",
  "engagement",
  "purchase",
  "insights",
]);
const validRanges = new Set<CustomerDashboardTimeRange>([
  "7d",
  "30d",
  "90d",
  "all",
]);

function LoadingShell() {
  return (
    <PageContainer sx={{ py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Skeleton
          variant="rectangular"
          sx={{ height: 120, borderRadius: "xl" }}
        />
        <Skeleton
          variant="rectangular"
          sx={{ height: 92, borderRadius: "xl" }}
        />
        <Skeleton
          variant="rectangular"
          sx={{ height: 52, borderRadius: "xl" }}
        />
        <Skeleton
          variant="rectangular"
          sx={{ height: 480, borderRadius: "xl" }}
        />
      </Stack>
    </PageContainer>
  );
}

function FatalState({ onRetry }: { onRetry: () => Promise<void> | void }) {
  return (
    <PageContainer sx={{ py: { xs: 6, md: 8 } }}>
      <Sheet
        variant="soft"
        color="danger"
        sx={{ borderRadius: "2xl", p: { xs: 3, md: 4 }, textAlign: "center" }}
      >
        <Stack spacing={1.5} alignItems="center">
          <AlertCircle size={40} />
          <Typography level="h3">Unable to load customer</Typography>
          <Typography level="body-md" color="danger">
            The requested customer could not be loaded, or you no longer have
            access to this record.
          </Typography>
          <JoyButton
            onClick={() => void onRetry()}
            startDecorator={<RefreshCw size={14} />}
          >
            Try again
          </JoyButton>
        </Stack>
      </Sheet>
    </PageContainer>
  );
}

const CustomerDashboardPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [localCustomer, setLocalCustomer] = React.useState<CustomerData | null>(
    null,
  );
  const [activityStatus, setActivityStatus] =
    React.useState<ActivityStatusFilter>("all");
  const [activityType, setActivityType] =
    React.useState<ActivityTypeFilter>("all");

  const tabParam = searchParams.get("tab");
  const rangeParam = searchParams.get("range");
  const activeTab: DashboardTab = validTabs.has(tabParam as DashboardTab)
    ? (tabParam as DashboardTab)
    : "overview";
  const timeRange: CustomerDashboardTimeRange = validRanges.has(
    rangeParam as CustomerDashboardTimeRange,
  )
    ? (rangeParam as CustomerDashboardTimeRange)
    : "30d";

  const {
    customer,
    crossChannelMetrics,
    purchaseMetrics,
    postPurchaseMetrics,
    loyaltyMetrics,
    lifecycleMetrics,
    contentIntentMetrics,
    riskSignals,
    negativeEvents,
    timelineEvents,
    timelineError,
    engagementTimeline,
    purchaseTimeline,
    emailHeatmapData,
    smsHeatmapData,
    channelTrend,
    engagementDecay,
    chartErrors,
    rangeStartDate,
    aiInsights,
    aiError,
    isAILoading,
    isAIRegenerating,
    regenerateAIInsights,
    isLoading,
    isCustomerLoading,
    isMetricsLoading,
    isChartDataLoading,
    hasError,
    errors,
    refetch,
  } = useCustomerDashboard(customerId, { timeRange });

  const deleteCustomer = useDeleteCustomer();
  const { personas: allPersonas } = useAllPersonas();
  const { assignments } = useCustomerPersonas(customerId ?? "");
  const { customerSegments } = useCustomerSegments(customerId);

  React.useEffect(() => {
    setLocalCustomer(customer ?? null);
  }, [customer]);

  const displayCustomer = localCustomer ?? customer;

  const updateSearchParam = React.useCallback(
    (updates: Partial<Record<"tab" | "range", string>>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleCustomerPatched = React.useCallback(
    (patch: Partial<CustomerData>) => {
      setLocalCustomer((current) =>
        current ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const snapshotMetrics = React.useMemo(
    () =>
      transformToSnapshotMetrics(
        displayCustomer,
        lifecycleMetrics ?? null,
        contentIntentMetrics ?? null,
        crossChannelMetrics ?? null,
      ),
    [
      contentIntentMetrics,
      crossChannelMetrics,
      displayCustomer,
      lifecycleMetrics,
    ],
  );

  const engagementMetrics = React.useMemo(
    () =>
      transformToEngagementMetrics(
        displayCustomer,
        crossChannelMetrics ?? null,
        lifecycleMetrics ?? null,
      ),
    [crossChannelMetrics, displayCustomer, lifecycleMetrics],
  );

  const emailMetrics = React.useMemo(
    () => transformToEmailMetrics(displayCustomer),
    [displayCustomer],
  );
  const smsMetrics = React.useMemo(
    () => transformToSmsMetrics(displayCustomer),
    [displayCustomer],
  );
  const crossChannelDisplayMetrics = React.useMemo(
    () =>
      transformToCrossChannelMetrics(
        crossChannelMetrics ?? null,
        displayCustomer,
        loyaltyMetrics ?? null,
      ),
    [crossChannelMetrics, displayCustomer, loyaltyMetrics],
  );
  const purchaseDisplayMetrics = React.useMemo(
    () =>
      transformToPurchaseMetrics(
        purchaseMetrics ?? null,
        postPurchaseMetrics ?? null,
      ),
    [postPurchaseMetrics, purchaseMetrics],
  );
  const loyaltyDisplayMetrics = React.useMemo(
    () =>
      transformToLoyaltyMetrics(
        loyaltyMetrics ?? null,
        purchaseMetrics ?? null,
      ),
    [loyaltyMetrics, purchaseMetrics],
  );
  const riskDisplayMetrics = React.useMemo(
    () => transformToRiskMetrics(riskSignals ?? null),
    [riskSignals],
  );
  const recentRiskEvents = React.useMemo(
    () => transformToRecentRiskEvents(negativeEvents),
    [negativeEvents],
  );
  const timelineDisplayEvents = React.useMemo(
    () => transformToTimelineEvents(timelineEvents),
    [timelineEvents],
  );

  const customerName = buildCustomerName(displayCustomer);
  const isVip =
    String(displayCustomer?.engagement_tier ?? "").toLowerCase() === "vip" ||
    purchaseDisplayMetrics.ltv >= 1000;

  const segmentLabels = React.useMemo(
    () =>
      (customerSegments as Array<{ segment?: { name?: string } }>)
        .map((item) => item.segment?.name)
        .filter(Boolean) as string[],
    [customerSegments],
  );

  const primaryPersona = React.useMemo(() => {
    const primaryAssignment = assignments[0];
    if (!primaryAssignment) {
      return null;
    }

    const personaId =
      primaryAssignment.predefined_persona_id || primaryAssignment.persona_id;
    const match = allPersonas.find((persona) => persona.id === personaId);
    return match?.persona_name ?? null;
  }, [allPersonas, assignments]);

  const handleRefresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleDelete = React.useCallback(async () => {
    if (!customerId) return;

    await deleteCustomer.mutateAsync(customerId);
    navigate("/crm/customers");
  }, [customerId, deleteCustomer, navigate]);

  const handleAddNote = React.useCallback(
    async (note: string) => {
      if (!displayCustomer) return;

      await logActivity({
        tenantId: displayCustomer.tenant_id,
        customerId: displayCustomer.id,
        actorType: "user",
        actorId: user?.id ?? null,
        source: "ui",
        activityType: "customer.note_added",
        status: "success",
        title: "Note added",
        description: {
          parts: [{ type: "text", text: note }],
        },
        metadata: {
          customer_name: customerName,
          customer_first_name: displayCustomer.first_name ?? null,
          customer_last_name: displayCustomer.last_name ?? null,
        },
        relatedEntities: {
          customer_id: displayCustomer.id,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
      toast({
        title: "Note saved",
        description: `Added a note for ${customerName}.`,
      });
    },
    [customerName, displayCustomer, queryClient, toast, user?.id],
  );

  if (isCustomerLoading) {
    return <LoadingShell />;
  }

  if (!displayCustomer) {
    return <FatalState onRetry={handleRefresh} />;
  }

  const activityFilters = {
    start: rangeStartDate,
    status: activityStatus === "all" ? undefined : [activityStatus],
    activityTypes: ACTIVITY_TYPE_FILTERS[activityType],
  };

  return (
    <>
      <PageContainer sx={{ py: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          <CustomerProfileHeader
            customerName={customerName}
            email={displayCustomer.email}
            phone={displayCustomer.phone}
            emailOptIn={displayCustomer.email_opt_in}
            smsOptIn={displayCustomer.sms_opt_in}
            lifecycleStage={lifecycleMetrics?.lifecycle_stage}
            createdAt={displayCustomer.created_at}
            lastActiveAt={
              displayCustomer.last_seen_at || displayCustomer.updated_at
            }
            primaryPersona={getPersonaLabel(primaryPersona)}
            segmentLabels={segmentLabels}
            isVip={isVip}
            isDeleting={deleteCustomer.isPending}
            onBack={() => navigate("/crm/customers")}
            onEdit={() => setIsEditDialogOpen(true)}
            onViewActivity={() => updateSearchParam({ tab: "activity" })}
            onDelete={handleDelete}
            onAddNote={handleAddNote}
            onRefresh={handleRefresh}
          />

          {(isLoading ||
            isMetricsLoading ||
            isChartDataLoading ||
            isAILoading) &&
          !isCustomerLoading ? (
            <LinearProgress sx={{ borderRadius: 999 }} />
          ) : null}

          <CustomerQuickStats
            healthScore={snapshotMetrics.engagementHealthScore}
            engagementScore={engagementMetrics.engagementScore}
            lifetimeValue={purchaseDisplayMetrics.ltv}
            totalOrders={purchaseDisplayMetrics.totalPurchases}
            preferredChannel={snapshotMetrics.preferredChannel}
            accountAgeDays={snapshotMetrics.accountAgeDays}
          />

          {hasError && errors.length > 0 ? (
            <Sheet
              color="warning"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="title-sm">
                Some intelligence modules did not load cleanly
              </Typography>
              <Typography level="body-sm" color="warning">
                The page is still usable, but one or more data sources returned
                errors. Affected cards show their own retry states.
              </Typography>
            </Sheet>
          ) : null}

          <Sheet
            variant="outlined"
            sx={{ borderRadius: "xl", p: 1.25, borderColor: "neutral.200" }}
          >
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", lg: "center" }}
            >
              <JoyTabs
                value={activeTab}
                onValueChange={(value) =>
                  updateSearchParam({ tab: String(value || "overview") })
                }
              >
                <JoyTabsList>
                  {TAB_OPTIONS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <JoyTabsTrigger key={tab.value} value={tab.value}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                        >
                          <Icon size={14} />
                          <span>{tab.label}</span>
                        </Stack>
                      </JoyTabsTrigger>
                    );
                  })}
                </JoyTabsList>
              </JoyTabs>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {RANGE_OPTIONS.map((range) => (
                  <JoyButton
                    key={range}
                    size="sm"
                    variant={timeRange === range ? "solid" : "plain"}
                    color={timeRange === range ? "primary" : "neutral"}
                    onClick={() => updateSearchParam({ range })}
                  >
                    {range === "all" ? "All time" : range.toUpperCase()}
                  </JoyButton>
                ))}
              </Stack>
            </Stack>
          </Sheet>

          {activeTab === "overview" ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl: "minmax(0, 360px) minmax(0, 1fr)",
                },
                gap: 2,
              }}
            >
              <Stack spacing={2}>
                <CustomerContactCard
                  customerId={displayCustomer.id}
                  customer={{
                    first_name: displayCustomer.first_name,
                    last_name: displayCustomer.last_name,
                    email: displayCustomer.email,
                    phone: displayCustomer.phone,
                    email_opt_in: displayCustomer.email_opt_in,
                    sms_opt_in: displayCustomer.sms_opt_in,
                  }}
                  onCustomerPatched={handleCustomerPatched}
                  onOpenBatchEdit={() => setIsEditDialogOpen(true)}
                />
                <CustomerSegmentsCard customerId={displayCustomer.id} />
                <CustomerSnapshot
                  customer={{
                    name: customerName,
                    email: displayCustomer.email,
                    city: displayCustomer.city,
                    stateRegion: displayCustomer.state_region,
                    countryCode: displayCustomer.country_code,
                    signupSource: displayCustomer.signup_source,
                    storeName: displayCustomer.store_name,
                    engagementTier: displayCustomer.engagement_tier,
                  }}
                  metrics={snapshotMetrics}
                />
              </Stack>

              <Stack spacing={2}>
                <CustomerEventTimeline
                  events={timelineDisplayEvents}
                  compact
                  maxItems={8}
                  hasMore={timelineDisplayEvents.length >= 8}
                  errorMessage={timelineError}
                  onRetry={() => void handleRefresh()}
                  onViewAll={() => updateSearchParam({ tab: "activity" })}
                />
                <RiskNegativeSignals
                  metrics={riskDisplayMetrics}
                  recentEvents={recentRiskEvents}
                  engagementDecay={engagementDecay}
                />
              </Stack>
            </Box>
          ) : null}

          {activeTab === "activity" ? (
            <Stack spacing={2}>
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "xl", p: 2, borderColor: "neutral.200" }}
              >
                <Stack spacing={1.5}>
                  <Typography level="title-sm">Activity filters</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {RANGE_OPTIONS.map((range) => (
                      <JoyButton
                        key={`activity-${range}`}
                        size="sm"
                        variant={timeRange === range ? "solid" : "plain"}
                        color={timeRange === range ? "primary" : "neutral"}
                        onClick={() => updateSearchParam({ range })}
                      >
                        {range === "all" ? "All time" : range.toUpperCase()}
                      </JoyButton>
                    ))}
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }}
                  >
                    <JoySelect
                      label="Status"
                      value={activityStatus}
                      options={STATUS_OPTIONS}
                      onValueChange={(value) =>
                        setActivityStatus(
                          (value as ActivityStatusFilter) || "all",
                        )
                      }
                    />
                    <JoySelect
                      label="Type"
                      value={activityType}
                      options={ACTIVITY_TYPE_OPTIONS}
                      onValueChange={(value) =>
                        setActivityType((value as ActivityTypeFilter) || "all")
                      }
                    />
                  </Box>
                </Stack>
              </Sheet>

              <CustomerActivityPanel
                customerId={displayCustomer.id}
                customerName={customerName}
                pageSize={25}
                title="Customer activity"
                description="Filtered customer activity across CRM edits, automations, campaigns, and operational events."
                filters={activityFilters}
              />
            </Stack>
          ) : null}

          {activeTab === "engagement" ? (
            <Stack spacing={2}>
              <EngagementHealthOverview
                metrics={engagementMetrics}
                timelineData={engagementTimeline}
                errorMessage={chartErrors.engagementTimeline}
                onRetry={() => void handleRefresh()}
              />
              <ChannelDeepDive
                emailMetrics={emailMetrics}
                smsMetrics={smsMetrics}
                emailHeatmapData={emailHeatmapData}
                smsHeatmapData={smsHeatmapData}
                emailError={chartErrors.emailHeatmap}
                smsError={chartErrors.smsHeatmap}
                onRetry={() => void handleRefresh()}
              />
            </Stack>
          ) : null}

          {activeTab === "purchase" ? (
            <Stack spacing={2}>
              <PurchaseValueBehavior
                metrics={purchaseDisplayMetrics}
                purchaseTimeline={purchaseTimeline}
                errorMessage={chartErrors.purchaseTimeline}
                onRetry={() => void handleRefresh()}
              />
              <LoyaltyIncentivesImpact metrics={loyaltyDisplayMetrics} />
            </Stack>
          ) : null}

          {activeTab === "insights" ? (
            <Stack spacing={2}>
              <CrossChannelIntelligence
                metrics={crossChannelDisplayMetrics}
                channelTrend={channelTrend}
                engagementDecay={engagementDecay}
                errorMessage={
                  chartErrors.channelTrend || chartErrors.engagementDecay
                }
                onRetry={() => void handleRefresh()}
              />
              <AIInsightsActions
                insights={aiInsights}
                loading={isAILoading}
                regenerating={isAIRegenerating}
                errorMessage={aiError?.message ?? null}
                onRegenerate={regenerateAIInsights}
              />
            </Stack>
          ) : null}
        </Stack>
      </PageContainer>

      {customerId ? (
        <EditCustomerDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          customerId={customerId}
          initialData={{
            first_name: displayCustomer.first_name,
            last_name: displayCustomer.last_name,
            email: displayCustomer.email,
            phone: displayCustomer.phone,
            email_opt_in: displayCustomer.email_opt_in,
            sms_opt_in: displayCustomer.sms_opt_in,
          }}
          onSuccess={(updatedCustomer) => {
            handleCustomerPatched(updatedCustomer);
            void handleRefresh();
          }}
        />
      ) : null}
    </>
  );
};

export default CustomerDashboardPage;
