
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement

interface PublishUpdate {
  id: string;
  status: 'QUEUED' | 'PUBLISHED' | 'ERROR';
  error_message?: string;
  published_id?: string;
}

export const useRealtimePublishUpdates = (onUpdate?: (update: PublishUpdate) => void) => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<PublishUpdate[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('publish_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scheduled_posts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const update = payload.new as PublishUpdate;
          
          setUpdates(prev => [...prev, update]);
          
          // Only show error toasts for critical publishing failures
          if (update.status === 'ERROR') {
            toast.error(`Publishing failed: ${update.error_message}`);
          }
          // Remove success toast - users can see status in the UI
          
          if (onUpdate) {
            onUpdate(update);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onUpdate]);

  return { updates };
};
