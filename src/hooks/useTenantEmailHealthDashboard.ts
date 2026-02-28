import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantEmailHealthDashboard {
  tenant_id: string;
  as_of: string;
  reputation_score: number;
  reputation_tier: string;
  reputation_action: string;
  trend_direction: "up" | "down" | "flat";
  trend_delta: number;
  baseline_score_7d: number;
  sent_24h: number;
  delivered_24h: number;
  bounced_24h: number;
  complained_24h: number;
  unsubscribed_24h: number;
  bounce_rate_24h: number;
  complaint_rate_24h: number;
  sent_30d: number;
  delivered_30d: number;
  bounced_30d: number;
  complained_30d: number;
  unsubscribed_30d: number;
  bounce_rate_30d: number;
  complaint_rate_30d: number;
}

export const useTenantEmailHealthDashboard = (
  tenantId: string | null | undefined,
) => {
  return useQuery({
    queryKey: ["tenant-email-health-dashboard", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantEmailHealthDashboard | null> => {
      const { data, error } = await supabase.rpc(
        "get_tenant_email_health_dashboard" as never,
        {
          p_tenant_id: tenantId,
        } as never,
      );

      if (error) throw error;

      if (!data) return null;

      const row = (Array.isArray(data) ? data[0] : data) as
        | TenantEmailHealthDashboard
        | null;

      return row || null;
    },
  });
};
