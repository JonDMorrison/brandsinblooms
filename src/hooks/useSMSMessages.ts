import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SMSMessageRecord {
  attempts: number;
  id: string;
  phone: string;
  content: string;
  customer_id: string | null;
  customer_name: string | null;
  dead_lettered_at: string | null;
  direction: "inbound" | "outbound";
  status: string;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  from_phone: string | null;
  error_message: string | null;
  error_code: string | null;
  failure_type: string | null;
  last_attempt_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  media_urls: string[];
  twilio_sid: string | null;
}

interface RawSMSMessageRecord {
  attempts: number | null;
  id: string;
  phone: string;
  content: string;
  customer_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  dead_lettered_at: string | null;
  from_phone: string | null;
  error_message: string | null;
  error_code: string | null;
  failure_type: string | null;
  last_attempt_at: string | null;
  campaign_id: string | null;
  twilio_sid: string | null;
  media_urls: unknown;
  crm_sms_campaigns?: {
    name?: string | null;
  } | null;
  crm_customers?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

function getCustomerName(customer: RawSMSMessageRecord["crm_customers"]) {
  const firstName = customer?.first_name?.trim();
  const lastName = customer?.last_name?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || null;
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
          attempts,
          id,
          phone,
          content,
          customer_id,
          status,
          created_at,
          updated_at,
          scheduled_at,
          sent_at,
          delivered_at,
          dead_lettered_at,
          from_phone,
          error_message,
          error_code,
          failure_type,
          last_attempt_at,
          campaign_id,
          twilio_sid,
          media_urls,
          crm_sms_campaigns(name),
          crm_customers(first_name, last_name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) {
        throw error;
      }

      return ((data || []) as RawSMSMessageRecord[]).map((message) => ({
        attempts: message.attempts || 0,
        id: message.id,
        phone: message.phone,
        content: message.content,
        customer_id: message.customer_id,
        customer_name: getCustomerName(message.crm_customers),
        dead_lettered_at: message.dead_lettered_at,
        direction: message.status === "received" ? "inbound" : "outbound",
        status: message.status || "queued",
        created_at: message.created_at,
        updated_at: message.updated_at,
        scheduled_at: message.scheduled_at,
        sent_at: message.sent_at,
        delivered_at: message.delivered_at,
        from_phone: message.from_phone,
        error_message: message.error_message,
        error_code: message.error_code,
        failure_type: message.failure_type,
        last_attempt_at: message.last_attempt_at,
        campaign_id: message.campaign_id,
        campaign_name: message.crm_sms_campaigns?.name || null,
        media_urls: Array.isArray(message.media_urls)
          ? message.media_urls.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        twilio_sid: message.twilio_sid,
      }));
    },
  });
};
