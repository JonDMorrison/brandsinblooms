import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { LightspeedIntegration } from '@/components/integrations/LightspeedIntegration';
import { SquareIntegration } from '@/components/integrations/SquareIntegration';
import { LightspeedDebug } from '@/components/integrations/LightspeedDebug';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function POSIntegrationsPage() {
  const { user } = useAuth();

  const { data: lightspeedConnection } = useQuery({
    queryKey: ['lightspeed-connection-status'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord?.tenant_id) return null;

      const { data, error } = await supabase
        .from('lightspeed_connections')
        .select('*')
        .eq('tenant_id', userRecord.tenant_id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const hasValidLightspeedConnection = lightspeedConnection && lightspeedConnection.encrypted_access_token !== 'pending';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link 
        to="/integrations" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">
            Connect your POS to sync customers, orders, and purchase data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LightspeedIntegration />
        <SquareIntegration />
      </div>

      {!hasValidLightspeedConnection && (
        <LightspeedDebug />
      )}
    </div>
  );
}
