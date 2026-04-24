import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeActivityEventRow } from "@/lib/activityEventNormalizer";

export function useActivityEvent(eventId?: string) {
  return useQuery({
    queryKey: ["activity-event", eventId],
    enabled: !!eventId,
    retry: false,
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .rpc("get_activity_event", {
          p_event_id: decodeURIComponent(eventId),
        })
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return normalizeActivityEventRow(data);
    },
  });
}
