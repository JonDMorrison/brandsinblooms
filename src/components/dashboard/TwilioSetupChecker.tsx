import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTwilioSetup = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['twilio-setup', user?.id],
    queryFn: async () => {
      if (!user) return { isSetup: false, hasCredentials: false };
      
      // Check if SMS setup has been completed via the setup wizard
      const { data: profileData } = await supabase
        .from('company_profiles')
        .select('feature_flags')
        .eq('user_id', user.id)
        .single();

      const isSetupCompleted = (profileData?.feature_flags as any)?.sms_setup_completed === true;
      
      return {
        isSetup: isSetupCompleted,
        hasCredentials: isSetupCompleted,
        statusMessage: isSetupCompleted 
          ? 'SMS Ready' 
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