import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  revenue?: number;
}

interface CampaignAnalytics {
  id: string;
  name: string;
  subject_line: string;
  status: string;
  sent_at: string;
  metrics: CampaignMetrics | null;
  created_at: string;
  open_rate: number;
  click_rate: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  delivery_method?: string;
}

interface EmailTrackingEvent {
  id: string;
  campaign_id: string;
  customer_email: string;
  event_type:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "unsubscribed";
  event_data: Record<string, unknown>;
  created_at: string;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export const useCampaignAnalytics = () => {
  const [campaigns, setCampaigns] = useState<CampaignAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const loadCampaigns = useCallback(async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;

    if (!silent) setLoading(true);
    setError(null);

    try {
      const baseColumns = [
        "id",
        "name",
        "subject_line",
        "status",
        "sent_at",
        "created_at",
        "metrics",
        "open_rate",
        "click_rate",
        "total_sent",
        "total_opens",
        "total_clicks",
      ];

      // `delivery_method` is useful for UI but may not exist in some DB envs;
      // fall back to the stable column set if PostgREST complains.
      const preferredColumns = [...baseColumns, "delivery_method"];

      const runQuery = async (columns: string[]) => {
        return await supabase
          .from("crm_campaigns")
          .select(columns.join(","))
          .order("created_at", { ascending: false });
      };

      let query = await runQuery(preferredColumns);
      if (query.error) {
        const maybeError = query.error as {
          code?: string;
          message?: string;
        } | null;
        const code = String(maybeError?.code || "").toLowerCase();
        const message = String(maybeError?.message || "").toLowerCase();
        const looksLikeMissingColumn =
          code === "42703" ||
          message.includes("column") ||
          message.includes("does not exist");

        if (looksLikeMissingColumn) {
          query = await runQuery(baseColumns);
        }
      }

      const { data, error: queryError } = query;
      if (queryError) throw queryError;

      type CampaignRow = {
        id: string;
        name: string;
        subject_line: string | null;
        status: string;
        sent_at: string | null;
        created_at: string;
        metrics: unknown;
        open_rate: number | null;
        click_rate: number | null;
        total_sent: number | null;
        total_opens: number | null;
        total_clicks: number | null;
        delivery_method?: string | null;
      };

      const processedCampaigns: CampaignAnalytics[] = (data || []).map(
        (row) => {
          const campaign = row as unknown as CampaignRow;
          return {
            id: campaign.id,
            name: campaign.name,
            subject_line: campaign.subject_line || "",
            status: campaign.status,
            sent_at: campaign.sent_at || campaign.created_at,
            metrics:
              typeof campaign.metrics === "object" &&
              campaign.metrics !== null &&
              !Array.isArray(campaign.metrics)
                ? (campaign.metrics as CampaignMetrics)
                : null,
            created_at: campaign.created_at,
            open_rate: campaign.open_rate || 0,
            click_rate: campaign.click_rate || 0,
            total_sent: campaign.total_sent || 0,
            total_opens: campaign.total_opens || 0,
            total_clicks: campaign.total_clicks || 0,
            delivery_method: campaign.delivery_method ?? undefined,
          };
        },
      );

      if (!unmountedRef.current) setCampaigns(processedCampaigns);
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error("Error loading campaigns:", err);
      }
      const message = getErrorMessage(err);
      if (!unmountedRef.current)
        setError(message || "Failed to load campaigns");
      if (!silent) toast.error("Failed to load campaign analytics");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const scheduleLoadCampaigns = useCallback(
    (options?: { silent?: boolean; withinMs?: number }) => {
      const withinMs = options?.withinMs ?? 10000;
      const silent = options?.silent ?? true;

      if (reloadTimerRef.current) return;
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        loadCampaigns({ silent });
      }, withinMs);
    },
    [loadCampaigns],
  );

  const loadCampaignEvents = async (
    campaignId: string,
  ): Promise<EmailTrackingEvent[]> => {
    try {
      const { data, error } = await supabase
        .from("email_tracking_events")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((event) => ({
        ...event,
        event_type: event.event_type as EmailTrackingEvent["event_type"],
        event_data: event.event_data as Record<string, unknown>,
      }));
    } catch (err: unknown) {
      console.error("Error loading campaign events:", err);
      toast.error("Failed to load campaign events");
      return [];
    }
  };

  const calculateMetrics = (events: EmailTrackingEvent[]): CampaignMetrics => {
    const metrics: CampaignMetrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      revenue: 0,
    };

    // Count unique emails for each event type
    const uniqueEmails = {
      sent: new Set<string>(),
      delivered: new Set<string>(),
      opened: new Set<string>(),
      clicked: new Set<string>(),
      bounced: new Set<string>(),
      unsubscribed: new Set<string>(),
    };

    events.forEach((event) => {
      switch (event.event_type) {
        case "sent":
          uniqueEmails.sent.add(event.customer_email);
          break;
        case "delivered":
          uniqueEmails.delivered.add(event.customer_email);
          break;
        case "opened":
          uniqueEmails.opened.add(event.customer_email);
          break;
        case "clicked":
          uniqueEmails.clicked.add(event.customer_email);
          break;
        case "bounced":
          uniqueEmails.bounced.add(event.customer_email);
          break;
        case "unsubscribed":
          uniqueEmails.unsubscribed.add(event.customer_email);
          break;
      }
    });

    metrics.sent = uniqueEmails.sent.size;
    metrics.delivered = uniqueEmails.delivered.size;
    metrics.opened = uniqueEmails.opened.size;
    metrics.clicked = uniqueEmails.clicked.size;
    metrics.bounced = uniqueEmails.bounced.size;
    metrics.unsubscribed = uniqueEmails.unsubscribed.size;

    return metrics;
  };

  const refreshCampaignMetrics = async (campaignId: string) => {
    try {
      const events = await loadCampaignEvents(campaignId);
      const calculatedMetrics = calculateMetrics(events);

      const { error } = await supabase
        .from("crm_campaigns")
        .update({
          metrics: calculatedMetrics as unknown as Json,
          total_sent: calculatedMetrics.sent,
          total_opens: calculatedMetrics.opened,
          total_clicks: calculatedMetrics.clicked,
          open_rate:
            calculatedMetrics.sent > 0
              ? (calculatedMetrics.opened / calculatedMetrics.sent) * 100
              : 0,
          click_rate:
            calculatedMetrics.sent > 0
              ? (calculatedMetrics.clicked / calculatedMetrics.sent) * 100
              : 0,
        })
        .eq("id", campaignId);

      if (error) throw error;

      // Reload campaigns to reflect updated metrics
      await loadCampaigns();

      toast.success("Campaign metrics updated");
    } catch (err: unknown) {
      console.error("Error refreshing metrics:", err);
      toast.error("Failed to refresh campaign metrics");
    }
  };

  // Set up real-time subscription for tracking events
  useEffect(() => {
    const channelId = Date.now();
    const channel = supabase
      .channel(`email-tracking-changes-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_tracking_events",
        },
        (payload) => {
          if (import.meta.env.DEV) {
          }
          // Avoid refetching & rerendering for every single tracking insert.
          // Collapse event storms into a periodic background refresh.
          scheduleLoadCampaigns({ silent: true, withinMs: 10000 });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleLoadCampaigns]);

  useEffect(() => {
    loadCampaigns();
    return () => {
      unmountedRef.current = true;
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [loadCampaigns]);

  return {
    campaigns,
    loading,
    error,
    loadCampaigns,
    loadCampaignEvents,
    refreshCampaignMetrics,
    calculateMetrics,
  };
};
