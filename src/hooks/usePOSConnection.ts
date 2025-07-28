import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const usePOSConnection = () => {
  const [hasPOSConnection, setHasPOSConnection] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkPOSConnection = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('pos_connections')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) throw error;
        setHasPOSConnection((data?.length || 0) > 0);
      } catch (error) {
        console.error('Error checking POS connections:', error);
        setHasPOSConnection(false);
      } finally {
        setLoading(false);
      }
    };

    checkPOSConnection();
  }, [user]);

  return { hasPOSConnection, loading };
};