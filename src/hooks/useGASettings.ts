import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GASettings {
  id: string;
  property_id: string;
  connection_status: string;
  service_account_configured: boolean;
  last_test_at?: string;
}

export const useGASettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GASettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('google_analytics_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      setSettings(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading GA settings:', err);
      setError(err.message || 'Failed to load Google Analytics settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  return {
    settings,
    loading,
    error,
    refresh: loadSettings,
    isConnected: settings?.connection_status === 'connected',
    propertyId: settings?.property_id
  };
};