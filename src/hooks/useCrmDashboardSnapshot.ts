import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SegmentCounts {
  "perks-members": number;
  "loyalty-members": number;
  "high-value": number;
  "new-customers": number;
  "lapsed-customers": number;
  "seasonal-shoppers": number;
  "frequent-buyers": number;
}

export interface CrmDashboardScope {
  tenantId?: string | null;
  userId?: string | null;
}

export interface CrmDashboardSnapshot {
  totalCustomers: number;
  recentCustomers30d: number;
  totalCustomerRevenue: number;
  currentMonthCustomers: number;
  previousMonthCustomers: number;
  currentMonthCustomerRevenue: number;
  previousMonthCustomerRevenue: number;
  totalCampaigns: number;
  activeCampaigns: number;
  currentMonthCampaigns: number;
  previousMonthCampaigns: number;
  avgOpenRate: number;
  avgClickRate: number;
  overallConversionRate: number;
  currentMonthConversionRate: number;
  previousMonthConversionRate: number;
  segmentCounts: SegmentCounts;
  personaCounts: Record<string, number>;
}

interface DashboardSnapshotRpcRow {
  total_customers: unknown;
  recent_customers_30d: unknown;
  total_customer_revenue: unknown;
  current_month_customers: unknown;
  previous_month_customers: unknown;
  current_month_customer_revenue: unknown;
  previous_month_customer_revenue: unknown;
  total_campaigns: unknown;
  active_campaigns: unknown;
  current_month_campaigns: unknown;
  previous_month_campaigns: unknown;
  avg_open_rate: unknown;
  avg_click_rate: unknown;
  overall_conversion_rate: unknown;
  current_month_conversion_rate: unknown;
  previous_month_conversion_rate: unknown;
  segment_counts: unknown;
  persona_counts: unknown;
}

const SNAPSHOT_STALE_TIME_MS = 5 * 60 * 1000;

export const EMPTY_SEGMENT_COUNTS: SegmentCounts = {
  "perks-members": 0,
  "loyalty-members": 0,
  "high-value": 0,
  "new-customers": 0,
  "lapsed-customers": 0,
  "seasonal-shoppers": 0,
  "frequent-buyers": 0,
};

export const EMPTY_CRM_DASHBOARD_SNAPSHOT: CrmDashboardSnapshot = {
  totalCustomers: 0,
  recentCustomers30d: 0,
  totalCustomerRevenue: 0,
  currentMonthCustomers: 0,
  previousMonthCustomers: 0,
  currentMonthCustomerRevenue: 0,
  previousMonthCustomerRevenue: 0,
  totalCampaigns: 0,
  activeCampaigns: 0,
  currentMonthCampaigns: 0,
  previousMonthCampaigns: 0,
  avgOpenRate: 0,
  avgClickRate: 0,
  overallConversionRate: 0,
  currentMonthConversionRate: 0,
  previousMonthConversionRate: 0,
  segmentCounts: EMPTY_SEGMENT_COUNTS,
  personaCounts: {},
};

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function parseSegmentCounts(value: unknown): SegmentCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_SEGMENT_COUNTS;
  }

  const rawCounts = value as Record<string, unknown>;

  return {
    "perks-members": toFiniteNumber(rawCounts["perks-members"]),
    "loyalty-members": toFiniteNumber(rawCounts["loyalty-members"]),
    "high-value": toFiniteNumber(rawCounts["high-value"]),
    "new-customers": toFiniteNumber(rawCounts["new-customers"]),
    "lapsed-customers": toFiniteNumber(rawCounts["lapsed-customers"]),
    "seasonal-shoppers": toFiniteNumber(rawCounts["seasonal-shoppers"]),
    "frequent-buyers": toFiniteNumber(rawCounts["frequent-buyers"]),
  };
}

function parsePersonaCounts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, number>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([personaId, count]) => [
      personaId,
      toFiniteNumber(count),
    ]),
  );
}

export async function fetchCrmDashboardSnapshot(
  scope: CrmDashboardScope,
): Promise<CrmDashboardSnapshot> {
  const tenantId = scope.tenantId ?? null;
  const userId = scope.userId ?? null;

  const { data, error } = await supabase.rpc(
    "get_crm_dashboard_snapshot" as never,
    {
      p_tenant_id: tenantId,
      p_user_id: userId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | DashboardSnapshotRpcRow
    | null;

  if (!row) {
    return EMPTY_CRM_DASHBOARD_SNAPSHOT;
  }

  return {
    totalCustomers: toFiniteNumber(row.total_customers),
    recentCustomers30d: toFiniteNumber(row.recent_customers_30d),
    totalCustomerRevenue: toFiniteNumber(row.total_customer_revenue),
    currentMonthCustomers: toFiniteNumber(row.current_month_customers),
    previousMonthCustomers: toFiniteNumber(row.previous_month_customers),
    currentMonthCustomerRevenue: toFiniteNumber(
      row.current_month_customer_revenue,
    ),
    previousMonthCustomerRevenue: toFiniteNumber(
      row.previous_month_customer_revenue,
    ),
    totalCampaigns: toFiniteNumber(row.total_campaigns),
    activeCampaigns: toFiniteNumber(row.active_campaigns),
    currentMonthCampaigns: toFiniteNumber(row.current_month_campaigns),
    previousMonthCampaigns: toFiniteNumber(row.previous_month_campaigns),
    avgOpenRate: toFiniteNumber(row.avg_open_rate),
    avgClickRate: toFiniteNumber(row.avg_click_rate),
    overallConversionRate: toFiniteNumber(row.overall_conversion_rate),
    currentMonthConversionRate: toFiniteNumber(
      row.current_month_conversion_rate,
    ),
    previousMonthConversionRate: toFiniteNumber(
      row.previous_month_conversion_rate,
    ),
    segmentCounts: parseSegmentCounts(row.segment_counts),
    personaCounts: parsePersonaCounts(row.persona_counts),
  };
}

export function useCrmDashboardSnapshot(
  scope: CrmDashboardScope,
  options?: { enabled?: boolean },
) {
  const tenantId = scope.tenantId ?? null;
  const userId = scope.userId ?? null;

  return useQuery({
    queryKey: ["crm-dashboard-snapshot", tenantId, userId],
    enabled: Boolean(tenantId || userId) && (options?.enabled ?? true),
    queryFn: () => fetchCrmDashboardSnapshot({ tenantId, userId }),
    staleTime: SNAPSHOT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}