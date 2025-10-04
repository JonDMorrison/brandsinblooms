import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ImageUpdate {
  imageUrl: string | null;
  status: string | null;
  error: string | null;
}

export const useRealtimeImageUpdates = (taskId: string) => {
  const [imageData, setImageData] = useState<ImageUpdate>({
    imageUrl: null,
    status: 'pending',
    error: null
  });

  useEffect(() => {
    if (!taskId) return;

    console.log('[RealtimeImageUpdates] Setting up subscription for task:', taskId);

    // Subscribe to real-time updates for this specific task
    const channel = supabase
      .channel(`image-updates-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_tasks',
          filter: `id=eq.${taskId}`
        },
        (payload) => {
          console.log('[RealtimeImageUpdates] Received update:', payload);
          const newData = payload.new as any;
          
          setImageData({
            imageUrl: newData.image_url,
            status: newData.image_generation_status,
            error: newData.image_generation_error
          });
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeImageUpdates] Subscription status:', status);
      });

    return () => {
      console.log('[RealtimeImageUpdates] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return imageData;
};
