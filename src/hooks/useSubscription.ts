
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Subscription {
  plan: string;
  max_posts_per_month: number;
  max_connections: number;
  end_date: string;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('plan, max_posts_per_month, max_connections, end_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          // If multiple subscriptions exist, log and use the most recent one
          if (data.length > 1) {
            console.warn(`Found ${data.length} subscriptions for user ${user.id}, using most recent`);
          }
          setSubscription(data[0]);
        } else {
          // No subscription found, create default
          setSubscription({
            plan: 'free',
            max_posts_per_month: 200,
            max_connections: 4,
            end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        // Default subscription for free users
        setSubscription({
          plan: 'free',
          max_posts_per_month: 200,
          max_connections: 4,
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  return { subscription, loading };
};
