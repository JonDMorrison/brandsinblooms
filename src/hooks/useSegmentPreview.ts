import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useTenant } from "@/hooks/useTenant";
import {
  buildCustomerName,
  deriveCustomSegmentFields,
  evaluateSegmentRule,
  getCustomerComparableValue,
  getCustomerEngagementScore,
  getCustomerHealthScore,
  getCustomerLifecycleStage,
  getCustomerRiskScore,
  normalizeSegmentRuleGroup,
  type SegmentDependencySource,
  type SegmentField,
  type SegmentPreviewCustomer,
  type SegmentRuleGroup,
} from "@/lib/segmentFields";
import type { SegmentKind, SegmentListItem } from "@/hooks/useSegments";

export interface SegmentPreviewSampleMember {
  id: string;
  name: string;
  email: string;
  preferredChannel: string | null;
  lifecycleStage: string;
}

export interface SegmentPreviewDistributionItem {
  label: string;
  count: number;
  percentage: number;
}

export interface SegmentPreviewResult {
  audienceMode: "empty" | "static" | "rules" | "all-customers";
  count: number;
  countLabel: string;
  percentage: number;
  sampleMembers: SegmentPreviewSampleMember[];
  lifecycleBreakdown: SegmentPreviewDistributionItem[];
  engagementBreakdown: SegmentPreviewDistributionItem[];
  preferredChannelBreakdown: SegmentPreviewDistributionItem[];
  averageLifetimeValue: number;
  averageLifetimeValueDelta: number;
  updatedLabel: string;
  customFields: SegmentField[];
  /**
   * True if the customer fetch hit the per-page cap. The preview metrics
   * are then computed off the first PREVIEW_PAGE_LIMIT × PREVIEW_PAGE_SIZE
   * rows rather than the full tenant — accurate-ish but not exact.
   */
  basedOnSample: boolean;
  sampleSize: number;
}

/**
 * Page size for the paginated customer fetch. Mirrors the chunk size used
 * by the materializer (`recompute-segment-memberships/index.ts` line 83)
 * so the browser path and the server path see the same shape of batches.
 */
const PREVIEW_PAGE_SIZE = 1000;

/**
 * Hard ceiling on how many pages the preview will accumulate before
 * declaring its metrics a sample. 50 pages × 1000 rows = 50,000 customers,
 * which covers ~99% of BloomSuite tenants. Past that we surface
 * `basedOnSample` so the UI can show a notice.
 */
const PREVIEW_MAX_PAGES = 50;

/**
 * Pages through a Supabase query in `.range(from, to)` chunks until either
 * the result returns fewer rows than `pageSize` (we've reached the end) or
 * `maxPages` is hit (we cap and flag the result as a sample).
 *
 * This exists because PostgREST silently caps single requests at
 * `db-max-rows = 1000` (Supabase default) — the original single-shot
 * fetch in this hook was returning ~1000 unordered heap rows for tenants
 * above that size, which made every preview metric (count, percentage,
 * lifecycle distribution, average LTV) wrong above 1000 customers.
 * Specifically caught Jeff at Brands in Blooms (tenant 0a626809…, 1,965
 * customers): preview showed 427/573 for two segments whose true
 * membership was 618/1,347.
 */
export async function fetchAllPaginated<T>(
  buildPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = PREVIEW_PAGE_SIZE,
  maxPages: number = PREVIEW_MAX_PAGES,
): Promise<{ data: T[]; truncated: boolean }> {
  const all: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await buildPage(from, to);
    if (error) {
      throw error;
    }

    const batch = data ?? [];
    all.push(...batch);

    if (batch.length < pageSize) {
      return { data: all, truncated: false };
    }
  }

  return { data: all, truncated: true };
}

export interface UseSegmentPreviewOptions {
  group: SegmentRuleGroup;
  segmentType: SegmentKind;
  segmentId?: string | null;
  includeAllCustomers?: boolean;
  staticMemberIds?: string[];
  enabled?: boolean;
  segments?: SegmentDependencySource[];
}

function formatCountLabel(count: number) {
  return count.toLocaleString();
}

function isEligibleAllCustomersMatch(customer: SegmentPreviewCustomer) {
  return (
    Boolean(customer.email?.trim()) &&
    customer.email_opt_in !== false &&
    customer.suppressed !== true &&
    customer.opt_out !== true
  );
}

function buildBreakdown(values: string[]) {
  const total = values.length || 1;
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
}

export function useSegmentPreview({
  group,
  segmentType,
  segmentId,
  includeAllCustomers = false,
  staticMemberIds = [],
  enabled = true,
}: UseSegmentPreviewOptions) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const debouncedGroup = useDebounce(group, 500);

  const baseQuery = useQuery({
    queryKey: ["segment-preview-base", tenantId],
    enabled: Boolean(tenantId && enabled),
    queryFn: async () => {
      if (!tenantId) {
        return {
          customers: [] as SegmentPreviewCustomer[],
          membershipsByCustomerId: new Map<string, Set<string>>(),
          customFields: [] as SegmentField[],
        };
      }

      const { data: segments, error: segmentError } = await supabase
        .from("crm_segments")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

      if (segmentError) {
        throw segmentError;
      }

      const segmentIds = (segments ?? []).map((segment) => segment.id);

      // Both fetches must paginate. PostgREST's default `db-max-rows = 1000`
      // would otherwise silently truncate the customer list (and the
      // membership list, on tenants with >1000 memberships per segment),
      // producing a preview where every count, percentage, and average is
      // computed off a partial heap-order page.
      const [customersResult, membershipsResult] = await Promise.all([
        fetchAllPaginated<SegmentPreviewCustomer>((from, to) =>
          supabase
            .from("crm_customers")
            .select(
              `
                id,
                tenant_id,
                created_at,
                updated_at,
                first_name,
                last_name,
                email,
                phone,
                email_opt_in,
                sms_opt_in,
                last_open_at,
                last_email_clicked_at,
                total_emails_opened,
                total_emails_clicked,
                total_emails_sent,
                email_click_rate,
                email_engagement_score,
                first_purchase_date,
                last_purchase_date,
                lifetime_value,
                total_spent,
                pos_order_count,
                persona,
                persona_id,
                preferred_channel,
                tags,
                product_tags,
                suppressed,
                opt_out,
                is_vip,
                custom_fields,
                deleted_at
              `,
            )
            .eq("tenant_id", tenantId)
            .is("deleted_at", null)
            .order("id")
            .range(from, to) as PromiseLike<{
            data: SegmentPreviewCustomer[] | null;
            error: unknown;
          }>,
        ),
        segmentIds.length
          ? fetchAllPaginated<{ customer_id: string; segment_id: string }>(
              (from, to) =>
                supabase
                  .from("customer_segments")
                  .select("customer_id, segment_id")
                  .in("segment_id", segmentIds)
                  .order("customer_id")
                  .range(from, to),
            )
          : Promise.resolve({
              data: [] as Array<{ customer_id: string; segment_id: string }>,
              truncated: false,
            }),
      ]);

      const membershipsByCustomerId = new Map<string, Set<string>>();
      for (const membership of membershipsResult.data) {
        const next =
          membershipsByCustomerId.get(membership.customer_id) ??
          new Set<string>();
        next.add(membership.segment_id);
        membershipsByCustomerId.set(membership.customer_id, next);
      }

      const customers = customersResult.data;

      return {
        customers,
        membershipsByCustomerId,
        basedOnSample:
          customersResult.truncated || membershipsResult.truncated,
        sampleSize: customers.length,
        customFields: deriveCustomSegmentFields(
          customers.map((customer) => customer.custom_fields),
        ),
      };
    },
    staleTime: 60_000,
  });

  const preview = useMemo<SegmentPreviewResult>(() => {
    const customers = baseQuery.data?.customers ?? [];
    const membershipsByCustomerId =
      baseQuery.data?.membershipsByCustomerId ?? new Map<string, Set<string>>();
    const customFields = baseQuery.data?.customFields ?? [];

    let matchedCustomers: SegmentPreviewCustomer[] = [];
    let audienceMode: SegmentPreviewResult["audienceMode"] = "empty";

    if (segmentType === "static") {
      audienceMode = "static";
      const selectedIds = new Set(staticMemberIds);
      matchedCustomers = customers.filter((customer) =>
        selectedIds.has(customer.id),
      );
    } else if (includeAllCustomers) {
      audienceMode = "all-customers";
      matchedCustomers = customers.filter(isEligibleAllCustomersMatch);
    } else {
      const normalizedGroup = normalizeSegmentRuleGroup(debouncedGroup);
      const hasRules = normalizedGroup.children.length > 0;
      audienceMode = hasRules ? "rules" : "empty";
      matchedCustomers = hasRules
        ? customers.filter((customer) =>
            evaluateSegmentRule(normalizedGroup, customer, {
              customerSegmentsByCustomerId: membershipsByCustomerId,
              currentSegmentId: segmentId ?? null,
            }),
          )
        : [];
    }

    const totalCustomers = customers.length || 1;
    const count = matchedCustomers.length;
    const percentage = Math.round((count / totalCustomers) * 1000) / 10;
    const sampleMembers = matchedCustomers.slice(0, 10).map((customer) => ({
      id: customer.id,
      name: buildCustomerName(customer),
      email: customer.email,
      preferredChannel: customer.preferred_channel,
      lifecycleStage: getCustomerLifecycleStage(customer),
    }));
    const lifecycleBreakdown = buildBreakdown(
      matchedCustomers.map((customer) => getCustomerLifecycleStage(customer)),
    );
    const engagementBreakdown = buildBreakdown(
      matchedCustomers.map((customer) => {
        const score = getCustomerEngagementScore(customer);
        if (score >= 70) return "High";
        if (score >= 40) return "Medium";
        return "Low";
      }),
    );
    const preferredChannelBreakdown = buildBreakdown(
      matchedCustomers.map((customer) => customer.preferred_channel || "none"),
    );
    const averageLifetimeValue = matchedCustomers.length
      ? matchedCustomers.reduce(
          (sum, customer) =>
            sum +
            Number(
              getCustomerComparableValue(customer, "lifetime_value", {}) ?? 0,
            ),
          0,
        ) / matchedCustomers.length
      : 0;
    const allAverageLifetimeValue = customers.length
      ? customers.reduce(
          (sum, customer) =>
            sum +
            Number(
              getCustomerComparableValue(customer, "lifetime_value", {}) ?? 0,
            ),
          0,
        ) / customers.length
      : 0;

    return {
      audienceMode,
      count,
      countLabel: formatCountLabel(count),
      percentage,
      sampleMembers,
      lifecycleBreakdown,
      engagementBreakdown,
      preferredChannelBreakdown,
      averageLifetimeValue,
      averageLifetimeValueDelta: averageLifetimeValue - allAverageLifetimeValue,
      updatedLabel: baseQuery.isFetching ? "Updating..." : "Updated just now",
      customFields,
      basedOnSample: baseQuery.data?.basedOnSample ?? false,
      sampleSize: baseQuery.data?.sampleSize ?? customers.length,
    };
  }, [
    baseQuery.data?.customers,
    baseQuery.data?.customFields,
    baseQuery.data?.membershipsByCustomerId,
    baseQuery.data?.basedOnSample,
    baseQuery.data?.sampleSize,
    baseQuery.isFetching,
    debouncedGroup,
    includeAllCustomers,
    segmentId,
    segmentType,
    staticMemberIds,
  ]);

  return {
    ...baseQuery,
    preview,
    customFields: preview.customFields,
  };
}
