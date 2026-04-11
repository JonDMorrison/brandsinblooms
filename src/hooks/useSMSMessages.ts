import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SMSMessageRecord {
  id: string;
  phone: string;
  content: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  from_phone: string | null;
  error_message: string | null;
  error_code: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  media_urls: string[];
}

interface RawSMSMessageRecord {
  id: string;
  phone: string;
  content: string;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  from_phone: string | null;
  error_message: string | null;
  error_code: string | null;
  campaign_id: string | null;
  media_urls: unknown;
  crm_sms_campaigns?: {
    name?: string | null;
  } | null;
}

export const useSMSMessages = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sms-messages", user?.id],
    enabled: !!user,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<SMSMessageRecord[]> => {
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("sms_messages")
        .select(
          `
          id,
          phone,
          content,
          status,
          created_at,
          sent_at,
          delivered_at,
          from_phone,
          error_message,
          error_code,
          campaign_id,
          media_urls,
          crm_sms_campaigns(name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) {
        throw error;
      }

      return ((data || []) as RawSMSMessageRecord[]).map((message) => ({
        id: message.id,
        phone: message.phone,
        content: message.content,
        status: message.status || "queued",
        created_at: message.created_at,
        sent_at: message.sent_at,
        delivered_at: message.delivered_at,
        from_phone: message.from_phone,
        error_message: message.error_message,
        error_code: message.error_code,
        campaign_id: message.campaign_id,
        campaign_name: message.crm_sms_campaigns?.name || null,
        media_urls: Array.isArray(message.media_urls)
          ? message.media_urls.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      }));
    },
  });
};
