import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  EmailTrackingEventRow,
  RealtimeBannerState,
} from "@/lib/crm/emailTrackingRealtime";
import {
  normalizeTrackingEventType,
  toRecipientKey,
} from "@/lib/crm/emailTrackingRealtime";

type ConnectionState = "connecting" | "live" | "paused";

interface UseCampaignEventRealtimeOptions {
  campaignId?: string;
  tenantId?: string;
  recipientEmail?: string | null;
  providerMessageId?: string | null;
  enabled?: boolean;
  channelName: string;
  onEvent?: (
    event: EmailTrackingEventRow,
    options: { animate: boolean },
  ) => void;
}

interface UseCampaignEventRealtimeResult {
  connectionState: ConnectionState;
  isLive: boolean;
  bannerState: RealtimeBannerState;
  dismissBanner: () => void;
}

function buildFilter({
  campaignId,
  tenantId,
  recipientEmail,
  providerMessageId,
}: UseCampaignEventRealtimeOptions) {
  const filters = [`tenant_id=eq.${tenantId}`, `campaign_id=eq.${campaignId}`];

  const normalizedEmail = toRecipientKey(recipientEmail);
  if (normalizedEmail) {
    filters.push(`customer_email=eq.${normalizedEmail}`);
  }

  if (providerMessageId?.trim()) {
    filters.push(`provider_message_id=eq.${providerMessageId.trim()}`);
  }

  return filters.join(",");
}

export function useCampaignEventRealtime({
  campaignId,
  tenantId,
  recipientEmail,
  providerMessageId,
  enabled = true,
  channelName,
  onEvent,
}: UseCampaignEventRealtimeOptions): UseCampaignEventRealtimeResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    enabled ? "connecting" : "paused",
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const queuedEventsRef = useRef<EmailTrackingEventRow[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelInstanceIdRef = useRef(Math.random().toString(36).slice(2));

  const filter = useMemo(() => {
    if (!enabled || !campaignId || !tenantId) return null;
    return buildFilter({
      campaignId,
      tenantId,
      recipientEmail,
      providerMessageId,
      enabled,
      channelName,
      onEvent,
    });
  }, [
    campaignId,
    tenantId,
    recipientEmail,
    providerMessageId,
    enabled,
    channelName,
    onEvent,
  ]);

  useEffect(() => {
    if (!enabled || !campaignId || !tenantId || !filter) {
      setConnectionState("paused");
      return;
    }

    let isMounted = true;

    const flushQueuedEvents = () => {
      if (!queuedEventsRef.current.length || !onEvent) return;
      const queued = [...queuedEventsRef.current];
      queuedEventsRef.current = [];
      queued.forEach((event) => onEvent(event, { animate: false }));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        flushQueuedEvents();
      }
    };

    const createChannel = async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setConnectionState("connecting");
      const subscriptionChannelName = `${channelName}-${channelInstanceIdRef.current}`;

      const channel = supabase
        .channel(subscriptionChannelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "email_tracking_events",
            filter,
          } as any,
          (payload) => {
            const nextEvent = payload.new as EmailTrackingEventRow;
            const normalizedType = normalizeTrackingEventType(
              nextEvent.event_type,
            );
            if (normalizedType === "unknown") return;

            if (document.visibilityState !== "visible") {
              queuedEventsRef.current.push(nextEvent);
              return;
            }

            onEvent?.(nextEvent, { animate: true });
          },
        )
        .subscribe((status) => {
          if (!isMounted) return;
          if (status === "SUBSCRIBED") {
            setConnectionState("live");
            setBannerDismissed(false);
            flushQueuedEvents();
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConnectionState("paused");
            setBannerDismissed(false);
          }
        });

      channelRef.current = channel;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void createChannel();

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      queuedEventsRef.current = [];
    };
  }, [enabled, campaignId, tenantId, filter, channelName, onEvent]);

  return {
    connectionState,
    isLive: connectionState === "live",
    bannerState:
      connectionState === "paused" && !bannerDismissed ? "paused" : "hidden",
    dismissBanner: () => setBannerDismissed(true),
  };
}
