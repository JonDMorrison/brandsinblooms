import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTwilioSetup = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['twilio-setup', user?.id],
    queryFn: async () => {
      if (!user) return { isSetup: false, hasCredentials: false };
      
      // Check if user has any SMS campaigns or automations
      const { data: smsData } = await supabase
        .from('crm_automations')
        .select('id')
        .eq('user_id', user.id)
        .contains('steps', [{ type: 'sms' }])
        .limit(1);

      // For now, we'll assume Twilio is setup if they have SMS automations
      // In a real implementation, you'd check environment variables or settings
      const hasCredentials = Boolean(smsData && smsData.length > 0);
      
      return {
        isSetup: hasCredentials,
        hasCredentials,
        statusMessage: hasCredentials 
          ? 'SMS campaigns ready' 
          : 'SMS setup needed for campaigns'
      };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};

export const getTwilioStatus = (isSetup: boolean) => {
  return {
    status: isSetup ? 'connected' as const : 'setup-needed' as const,
    statusMessage: isSetup 
      ? 'SMS campaigns ready'
      : 'SMS setup needed for campaigns'
  };
};