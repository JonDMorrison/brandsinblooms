import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface POSConnection {
  id: string;
  name: string;
  platform: string;
  credentials_encrypted: string | null;
  settings: any;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface SyncResult {
  success: boolean;
  new_customers?: number;
  new_orders?: number;
  error?: string;
  duration_ms?: number;
}

export const usePOSConnections = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch POS connections with latest sync status
  const { data: connections, isLoading } = useQuery({
    queryKey: ['pos-connections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('pos_connections')
        .select(`
          *,
          pos_sync_logs!inner(
            status,
            started_at,
            completed_at,
            customers_synced,
            orders_synced,
            error_message
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as POSConnection[];
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Track analytics events - simplified without database logging for now
  const trackSyncEvent = async (
    eventType: string, 
    properties: Record<string, any>
  ) => {
    // Log to console for debugging - in production this could be sent to analytics service
    console.log(`POS Analytics: ${eventType}`, properties);
  };

  // Run manual sync
  const runSyncMutation = useMutation({
    mutationFn: async (connectionId: string): Promise<SyncResult> => {
      const connection = connections?.find(c => c.id === connectionId);
      if (!connection) throw new Error('Connection not found');

      const startTime = Date.now();
      
      // Track sync start
      await trackSyncEvent('pos_sync_started', {
        pos_type: connection.platform,
        connection_id: connectionId,
      });

      // Call appropriate sync function based on platform
      const functionName = `${connection.platform}-sync`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { connection_id: connectionId },
      });

      const duration = Date.now() - startTime;

      if (error) {
        await trackSyncEvent('pos_sync_failed', {
          pos_type: connection.platform,
          connection_id: connectionId,
          error: error.message,
          duration_ms: duration,
        });
        throw error;
      }

      // Track successful sync
      await trackSyncEvent('pos_sync_completed', {
        pos_type: connection.platform,
        connection_id: connectionId,
        new_customers: data.new_customers || 0,
        new_orders: data.new_orders || 0,
        duration_ms: duration,
      });

      return {
        success: data.success,
        new_customers: data.new_customers,
        new_orders: data.new_orders,
        duration_ms: duration,
      };
    },
    onMutate: () => {
      setIsSyncing(true);
      toast({
        title: "Sync Started",
        description: "Syncing your POS data...",
      });
    },
    onSuccess: (result) => {
      setIsSyncing(false);
      toast({
        title: "Sync Completed ✓",
        description: `Imported ${result.new_customers || 0} customers and ${result.new_orders || 0} orders`,
      });
      
      // Refresh connections data
      queryClient.invalidateQueries({ queryKey: ['pos-connections'] });
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
    },
    onError: (error: any) => {
      setIsSyncing(false);
      toast({
        title: "Sync Failed",
        description: `Sync failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Disconnect POS system
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('pos_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "POS system has been disconnected successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['pos-connections'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Disconnect",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    connections,
    isLoading,
    isSyncing,
    runSync: (connectionId: string) => runSyncMutation.mutate(connectionId),
    disconnectPOS: (connectionId: string) => disconnectMutation.mutate(connectionId),
  };
};