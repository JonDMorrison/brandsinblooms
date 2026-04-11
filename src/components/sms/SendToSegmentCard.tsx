import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { SegmentSMSDialog } from "./SegmentSMSDialog";

interface SegmentOption {
  id: string;
  name: string;
  description?: string;
  count: number;
  isSystem: boolean;
}

const SYSTEM_SEGMENTS: Omit<SegmentOption, "count">[] = [
  {
    id: "perks-members",
    name: "Perks Members",
    description: "Loyalty program members",
    isSystem: true,
  },
  {
    id: "high-value",
    name: "High-Value Customers",
    description: "Top spenders",
    isSystem: true,
  },
  {
    id: "new-customers",
    name: "New Customers",
    description: "Recent first purchases",
    isSystem: true,
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "3+ purchases",
    isSystem: true,
  },
];

export const SendToSegmentCard: React.FC = () => {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<SegmentOption | null>(
    null,
  );
  const { tenant } = useTenant();

  const fetchSystemSegmentCount = useCallback(
    async (segmentId: string) => {
      if (!tenant?.id) return 0;

      try {
        let query = supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("sms_opt_in", true)
          .eq("opt_out", false)
          .eq("suppressed", false)
          .not("phone", "is", null);

        switch (segmentId) {
          case "perks-members": {
            const { count } = await supabase
              .from("crm_customers")
              .select("id, customer_loyalty_metrics!inner(is_perks_member)", {
                count: "exact",
                head: true,
              })
              .eq("tenant_id", tenant.id)
              .eq("sms_opt_in", true)
              .eq("opt_out", false)
              .eq("suppressed", false)
              .not("phone", "is", null)
              .eq("customer_loyalty_metrics.is_perks_member", true);

            return count || 0;
          }
          case "high-value":
            query = query.gte("total_spent", 500);
            break;
          case "new-customers": {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.gte("created_at", thirtyDaysAgo.toISOString());
            break;
          }
          case "frequent-buyers":
            query = query.gte("order_count", 3);
            break;
          default:
            break;
        }

        const { count } = await query;
        return count || 0;
      } catch (error) {
        console.error("Error fetching system segment count:", error);
        return 0;
      }
    },
    [tenant?.id],
  );

  const fetchSegments = useCallback(async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      // Fetch custom segments
      const { data: customSegments, error } = await supabase
        .from("crm_segments")
        .select("id, name, description, customer_count")
        .eq("tenant_id", tenant.id)
        .order("name");

      if (error) throw error;

      const customOptions: SegmentOption[] = (customSegments || []).map(
        (s) => ({
          id: s.id,
          name: s.name,
          description: s.description || undefined,
          count: s.customer_count || 0,
          isSystem: false,
        }),
      );

      const systemOptions: SegmentOption[] = await Promise.all(
        SYSTEM_SEGMENTS.map(async (segment) => ({
          ...segment,
          count: await fetchSystemSegmentCount(segment.id),
        })),
      );

      setSegments([...systemOptions, ...customOptions]);
    } catch (error) {
      console.error("Error fetching segments:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchSystemSegmentCount, tenant?.id]);

  useEffect(() => {
    if (tenant?.id) {
      void fetchSegments();
    }
  }, [fetchSegments, tenant?.id]);

  const handleSelectSegment = (segment: SegmentOption) => {
    setSelectedSegment(segment);
  };

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Segments</h3>
          <p className="text-sm text-gray-500">
            Choose a segment to open the send flow with the right audience
            preselected.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-10 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : segments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            No segments available
          </div>
        ) : (
          <div className="space-y-2">
            {segments.slice(0, 6).map((segment) => (
              <button
                key={segment.id}
                onClick={() => handleSelectSegment(segment)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-emerald-50/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 group-hover:bg-white">
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {segment.name}
                    </span>
                    {segment.isSystem ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-gray-200 bg-gray-100 px-2 py-0 text-[10px] uppercase tracking-wide text-gray-500 hover:bg-gray-100"
                      >
                        System
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {segment.description ||
                      (segment.isSystem
                        ? "Rule-based SMS audience"
                        : "Custom customer segment")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {segment.count.toLocaleString()}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                    Subscribers
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            ))}
            {segments.length > 6 ? (
              <p className="pt-1 text-center text-xs text-gray-500">
                +{segments.length - 6} more segments
              </p>
            ) : null}
          </div>
        )}
      </div>

      {selectedSegment && (
        <SegmentSMSDialog
          open={!!selectedSegment}
          onOpenChange={(open) => !open && setSelectedSegment(null)}
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
          customerCount={selectedSegment.count}
          isSystemSegment={selectedSegment.isSystem}
        />
      )}
    </>
  );
};
