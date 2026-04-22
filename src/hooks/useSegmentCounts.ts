import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

const ID_CHUNK_SIZE = 200;

function chunkIds(ids: string[], size = ID_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

interface SegmentCounts {
  "perks-members": number;
  "loyalty-members": number;
  "high-value": number;
  "new-customers": number;
  "lapsed-customers": number;
  "seasonal-shoppers": number;
  "frequent-buyers": number;
}

export const useSegmentCounts = () => {
  const [counts, setCounts] = useState<SegmentCounts>({
    "perks-members": 0,
    "loyalty-members": 0,
    "high-value": 0,
    "new-customers": 0,
    "lapsed-customers": 0,
    "seasonal-shoppers": 0,
    "frequent-buyers": 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchSegmentCounts = useCallback(async () => {
    if (!user || !tenant) {
      return;
    }

    setLoading(true);
    try {
      // FIX: [issue #38] - Select only columns needed for categorization instead of select('*')
      const { data: customers, error } = await supabase
        .from("crm_customers")
        .select(
          "id, tags, total_spent, created_at, last_purchase_date, order_history, loyalty_member",
        )
        .eq("tenant_id", tenant.id);

      if (error) throw error;

      if (!customers) {
        setCounts({
          "perks-members": 0,
          "loyalty-members": 0,
          "high-value": 0,
          "new-customers": 0,
          "lapsed-customers": 0,
          "seasonal-shoppers": 0,
          "frequent-buyers": 0,
        });
        return;
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Calculate automatic segment qualifications
      const newCustomers = customers.filter(
        (customer) => new Date(customer.created_at) >= thirtyDaysAgo,
      );
      const loyaltyCustomers = customers.filter(
        (customer) => customer.loyalty_member === true || (customer.tags && customer.tags.includes("loyalty")),
      );
      const highValueCustomers = customers.filter(
        (customer) => customer.total_spent && customer.total_spent > 500,
      );
      const lapsedCustomers = customers.filter(
        (customer) =>
          customer.last_purchase_date &&
          new Date(customer.last_purchase_date) < ninetyDaysAgo,
      );
      const seasonalCustomers = customers.filter(
        (customer) =>
          customer.tags &&
          customer.tags.some((tag: string) =>
            [
              "seasonal",
              "holiday",
              "christmas",
              "valentine",
              "easter",
              "summer",
              "winter",
            ].includes(tag.toLowerCase()),
          ),
      );
      const frequentBuyers = customers.filter(
        (customer) =>
          customer.order_history &&
          Array.isArray(customer.order_history) &&
          customer.order_history.length >= 3,
      );

      // Get perks members from customer_loyalty_metrics
      const customerIds = customers.map((c) => c.id);

      const perksMembers: Array<{ customer_id: string }> = [];
      for (const idChunk of chunkIds(customerIds)) {
        const { data: perksMetricsChunk, error: perksMetricsError } =
          await supabase
            .from("customer_loyalty_metrics")
            .select("customer_id")
            .eq("is_perks_member", true)
            .in("customer_id", idChunk);

        if (perksMetricsError) {
          console.error(
            "Error fetching perks members chunk:",
            perksMetricsError,
          );
          continue;
        }

        if (perksMetricsChunk?.length) {
          perksMembers.push(...perksMetricsChunk);
        }
      }

      // Get manual segment assignments for predefined segments
      let manualAssignments: Record<string, Set<string>> = {};

      // First, try to get ALL customer segments for this tenant
      const allCustomerSegments: Array<{
        customer_id: string;
        segment_id: string;
      }> = [];
      let segmentsError: any = null;

      for (const idChunk of chunkIds(customerIds)) {
        const { data: customerSegmentsChunk, error: customerSegmentsError } =
          await supabase
            .from("customer_segments")
            .select("customer_id, segment_id")
            .in("customer_id", idChunk);

        if (customerSegmentsError) {
          segmentsError = customerSegmentsError;
          console.error(
            "Error fetching customer segments chunk:",
            customerSegmentsError,
          );
          continue;
        }

        if (customerSegmentsChunk?.length) {
          allCustomerSegments.push(...customerSegmentsChunk);
        }
      }

      if (segmentsError) {
        console.error("Error fetching customer segments:", segmentsError);
      } else if (allCustomerSegments && allCustomerSegments.length > 0) {
        // Get the corresponding segment details
        const segmentIds = [
          ...new Set(allCustomerSegments.map((cs) => cs.segment_id)),
        ];
        const { data: segmentDetails, error: detailsError } = await supabase
          .from("crm_segments")
          .select("id, name")
          .in("id", segmentIds)
          .eq("tenant_id", tenant.id);

        if (detailsError) {
          console.error("Error fetching segment details:", detailsError);
        } else if (segmentDetails) {
          // Build manual assignments by segment name
          allCustomerSegments.forEach((assignment) => {
            const segment = segmentDetails.find(
              (s) => s.id === assignment.segment_id,
            );
            if (segment && segment.name) {
              if (!manualAssignments[segment.name]) {
                manualAssignments[segment.name] = new Set();
              }
              manualAssignments[segment.name].add(assignment.customer_id);
            }
          });
        }
      }
      // Calculate segment counts (combining automatic + manual assignments)
      const segmentCounts: SegmentCounts = {
        "perks-members": new Set([
          ...perksMembers.map((m) => m.customer_id),
          ...(manualAssignments["Perks Members"] || []),
        ]).size,

        "loyalty-members": new Set([
          ...loyaltyCustomers.map((c) => c.id),
          ...(manualAssignments["Loyalty Members"] || []),
        ]).size,

        "high-value": new Set([
          ...highValueCustomers.map((c) => c.id),
          ...(manualAssignments["High-Value Customers"] || []),
        ]).size,

        "new-customers": new Set([
          ...newCustomers.map((c) => c.id),
          ...(manualAssignments["New Customers"] || []),
        ]).size,

        "lapsed-customers": new Set([
          ...lapsedCustomers.map((c) => c.id),
          ...(manualAssignments["Lapsed Customers"] || []),
        ]).size,

        "seasonal-shoppers": new Set([
          ...seasonalCustomers.map((c) => c.id),
          ...(manualAssignments["Seasonal Shoppers"] || []),
        ]).size,

        "frequent-buyers": new Set([
          ...frequentBuyers.map((c) => c.id),
          ...(manualAssignments["Frequent Buyers"] || []),
        ]).size,
      };
      setCounts(segmentCounts);
    } catch (error) {
      console.error("Error fetching segment counts:", error);
      // Keep counts at 0 on error
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  useEffect(() => {
    fetchSegmentCounts();
  }, [fetchSegmentCounts, refreshKey]);

  const refreshCounts = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return { counts, loading, refreshCounts };
};
