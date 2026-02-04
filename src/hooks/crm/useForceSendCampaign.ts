import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ForceSendResult {
  success: boolean;
  message?: string;
  previousStatus?: string;
  previousFailureReason?: string;
  error?: string;
}

export function useForceSendCampaign() {
  const [isLoading, setIsLoading] = useState(false);

  const forceSend = async (campaignId: string): Promise<ForceSendResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-send-campaign', {
        body: { campaignId }
      });

      if (error) {
        const errorMessage = error.message || 'Failed to force send campaign';
        toast.error('Force send failed', { description: errorMessage });
        return { success: false, error: errorMessage };
      }

      if (data?.error) {
        toast.error('Force send failed', { description: data.error });
        return { success: false, error: data.error };
      }

      toast.success('Campaign queued', {
        description: data?.message || 'Campaign has been queued for immediate sending'
      });

      return {
        success: true,
        message: data?.message,
        previousStatus: data?.previousStatus,
        previousFailureReason: data?.previousFailureReason
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Force send failed', { description: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return { forceSend, isLoading };
}
