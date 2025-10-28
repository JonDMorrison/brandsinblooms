import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, Plug, BookOpen } from 'lucide-react';
import { LightspeedOAuthOverlay } from './LightspeedOAuthOverlay';
import { LightspeedDashboard } from './LightspeedDashboard';
import { useNavigate } from 'react-router-dom';

export const LightspeedIntegration = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [domainPrefix, setDomainPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'preparing' | 'redirecting' | 'completing'>('preparing');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check for OAuth callback success
  useEffect(() => {
    const checkCallback = () => {
      const lightspeedSuccess = sessionStorage.getItem('lightspeed_oauth_success');
      if (lightspeedSuccess) {
        try {
          const data = JSON.parse(lightspeedSuccess);
          if (Date.now() - data.timestamp < 30000) {
            setLoading(false);
            queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
            toast({ title: "Lightspeed connected successfully" });
          }
          sessionStorage.removeItem('lightspeed_oauth_success');
        } catch (error) {
          console.error('Error processing success data:', error);
        }
      }
    };

    checkCallback();
    // Listen for storage events from callback page
    window.addEventListener('storage', checkCallback);
    return () => window.removeEventListener('storage', checkCallback);
  }, [queryClient, toast]);

  const { data: connection, isLoading } = useQuery({
    queryKey: ['lightspeed-connection'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!user?.tenant_id) return null;

      const { data, error } = await supabase
        .from('lightspeed_connections')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('lightspeed-full-sync');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
      toast({ 
        title: 'Sync completed', 
        description: `Synced ${data?.results?.customers?.customersSynced || 0} customers and ${data?.results?.sales?.salesSynced || 0} sales`
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const initiateOAuthFlow = async (prefix: string) => {
    setLoading(true);
    setLoadingStep('preparing');
    setShowConnectModal(false);

    try {
      // Clear any previous OAuth state
      sessionStorage.removeItem('lightspeed_oauth_state');
      localStorage.removeItem('lightspeed_oauth_state_backup');
      sessionStorage.removeItem('lightspeed_oauth_success');

      // Generate secure state parameter (simple UUID + timestamp, no JWT signing)
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const combinedState = `${state}-${timestamp}`;

      // Store state with redundancy (like Facebook pattern)
      sessionStorage.setItem('lightspeed_oauth_state', combinedState);
      sessionStorage.setItem('lightspeed_domain_prefix', prefix);
      localStorage.setItem('lightspeed_oauth_state_backup', combinedState);

      console.log('[OAuth] Initiating Lightspeed OAuth:', {
        domainPrefix: prefix,
        state: combinedState.substring(0, 12) + '...',
        timestamp: new Date().toISOString()
      });

      const { data, error } = await supabase.functions.invoke('lightspeed-oauth-initiate', {
        body: { domainPrefix: prefix, state: combinedState },
      });

      if (error) {
        console.error('[OAuth] Edge function error:', error);
        throw new Error(error.message || 'Failed to initiate OAuth');
      }

      if (!data?.authUrl) {
        console.error('[OAuth] No auth URL in response:', data);
        throw new Error('No authorization URL received');
      }

      // Show redirecting step
      setLoadingStep('redirecting');

      console.log('[OAuth] Opening Lightspeed authorization in new tab');

      // Open OAuth in new tab (like Facebook pattern)
      const oauthTab = window.open(data.authUrl, '_blank', 'noopener,noreferrer');

      if (!oauthTab) {
        console.warn('[OAuth] New tab blocked - please allow popups');
        toast({ 
          title: 'Popup blocked', 
          description: 'Please allow popups to connect Lightspeed. Click the button again after allowing.',
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }

      // Keep loading overlay visible until callback completes
      console.log('[OAuth] Waiting for OAuth callback...');

    } catch (error: any) {
      console.error('[OAuth] Initiation error:', error);
      toast({ 
        title: 'Connection failed', 
        description: error.message || 'Failed to start OAuth flow',
        variant: 'destructive' 
      });
      setLoading(false);
    }
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('lightspeed-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Connection test successful', description: `Connected to ${data.retailer.name}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Connection test failed', description: error.message, variant: 'destructive' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error('No connection found');
      const { error } = await supabase
        .from('lightspeed_connections')
        .delete()
        .eq('id', connection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
      toast({ title: 'Lightspeed disconnected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Disconnect failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleConnect = () => {
    const prefix = domainPrefix.trim();
    if (!prefix) {
      toast({ title: 'Please enter a domain prefix', variant: 'destructive' });
      return;
    }
    if (!/^[a-z0-9-]+$/i.test(prefix)) {
      toast({ 
        title: 'Invalid format', 
        description: 'Use only letters, numbers, and dashes',
        variant: 'destructive' 
      });
      return;
    }
    if (prefix.length < 3 || prefix.length > 50) {
      toast({ 
        title: 'Invalid length', 
        description: 'Domain prefix must be 3-50 characters',
        variant: 'destructive' 
      });
      return;
    }
    initiateOAuthFlow(prefix);
  };

  if (isLoading) {
    return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>;
  }

  const isConnected = connection && connection.encrypted_access_token !== 'pending';

  return (
    <>
      <LightspeedOAuthOverlay isVisible={loading} step={loadingStep} />
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Plug className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Lightspeed X-Series</h3>
              <p className="text-sm text-muted-foreground">POS Integration</p>
            </div>
          </div>
          {isConnected ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Domain</p>
                <p className="font-medium">{connection.domain_prefix}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-green-600">Connected</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || loading} size="sm" variant="default">
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button onClick={() => navigate('/integrations/lightspeed/guide')} variant="outline" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                View Guide
              </Button>
              <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending || loading} size="sm" variant="outline">
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
              </Button>
              <Button onClick={() => setShowConnectModal(true)} variant="outline" size="sm" disabled={loading}>
                Reconnect
              </Button>
              <Button 
                onClick={() => disconnectMutation.mutate()} 
                disabled={disconnectMutation.isPending || loading}
                variant="ghost" 
                size="sm"
              >
                {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>

            {/* Dashboard */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-4">Lightspeed Data Overview</h4>
              <LightspeedDashboard />
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowConnectModal(true)} className="w-full">
            Connect Lightspeed
          </Button>
        )}
      </Card>

      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Lightspeed X-Series</DialogTitle>
            <DialogDescription>
              Enter your Lightspeed store domain prefix to connect your POS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="domain">Domain Prefix</Label>
              <Input
                id="domain"
                placeholder="mystoreprefix"
                value={domainPrefix}
                onChange={(e) => setDomainPrefix(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: if your store URL is mystoreprefix.retail.lightspeed.app, enter "mystoreprefix"
              </p>
            </div>
            <Button 
              onClick={handleConnect} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting...</>
              ) : (
                'Continue to Authorization'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
