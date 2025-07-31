import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SocialConnection {
  id: string;
  platform: string;
  is_active: boolean;
}

export const useConnectedAccounts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['social-connections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('social_connections')
        .select('id, platform, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data as SocialConnection[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const getConnectionStatus = (connections: SocialConnection[]) => {
  const hasConnections = connections.length > 0;
  const connectedPlatforms = connections.map(c => c.platform);
  
  return {
    hasConnections,
    connectedPlatforms,
    statusMessage: hasConnections 
      ? `Connected to ${connectedPlatforms.join(', ')}`
      : 'No social accounts connected',
    status: hasConnections ? 'connected' as const : 'setup-needed' as const
  };
};