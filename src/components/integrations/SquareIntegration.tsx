import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, Plug, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatDistanceToNow } from 'date-fns';

export const SquareIntegration = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'preparing' | 'redirecting' | 'completing'>('preparing');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Listen for OAuth completion
  useEffect(() => {
    const handleOAuthResult = (data: any) => {
      if (Date.now() - data.timestamp < 30000) {
        setLoading(false);
        setShowConnectModal(false);
        localStorage.removeItem('square_oauth_result');
        
        if (data.status === 'success') {
          queryClient.invalidateQueries({ queryKey: ['square-connection'] });
          toast({ 
            title: "✓ Square connected successfully",
            description: data.merchantName ? `Connected to ${data.merchantName}` : undefined
          });
        } else if (data.status === 'error') {
          toast({ 
            title: 'Connection failed', 
            description: data.message || 'Please try again',
            variant: 'destructive' 
          });
        }
      }
    };

    const checkLocalStorage = () => {
      const result = localStorage.getItem('square_oauth_result');
      if (result) {
        try {
          const data = JSON.parse(result);
          handleOAuthResult(data);
        } catch (error) {
          console.error('[SQUARE-Integration] Error processing OAuth result:', error);
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('square_oauth');
      channel.onmessage = (event) => {
        handleOAuthResult(event.data);
      };
    } catch (e) {
      console.log('[SQUARE-Integration] BroadcastChannel not supported');
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && 
          event.data?.type === 'square_oauth_result') {
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener('message', handleMessage);

    checkLocalStorage();
    window.addEventListener('storage', checkLocalStorage);
    
    let interval: NodeJS.Timeout | null = null;
    if (loading) {
      interval = setInterval(checkLocalStorage, 500);
    }
    
    return () => {
      window.removeEventListener('storage', checkLocalStorage);
      window.removeEventListener('message', handleMessage);
      if (channel) channel.close();
      if (interval) clearInterval(interval);
    };
  }, [queryClient, toast, loading]);

  const { data: connection, isLoading } = useQuery({
    queryKey: ['square-connection'],
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
        .from('square_connections')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['square-connection'] });
    }, 1500);
    return () => clearInterval(interval);
  }, [loading, queryClient]);

  useEffect(() => {
    if (loading && connection && connection.encrypted_access_token !== 'pending') {
      setLoading(false);
      setShowConnectModal(false);
      toast({ title: '✓ Square connected successfully' });
      queryClient.invalidateQueries({ queryKey: ['square-connection-status'] });
    }
  }, [loading, connection, toast, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('square-full-sync');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['square-connection'] });
      toast({ 
        title: 'Sync completed', 
        description: `Synced ${data?.results?.customers?.customersSynced || 0} customers and ${data?.results?.sales?.salesSynced || 0} sales`
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const initiateOAuthFlow = async (env: 'sandbox' | 'production') => {
    setLoading(true);
    setLoadingStep('preparing');
    setShowConnectModal(false);

    try {
      console.log('[OAuth] Starting Square OAuth for', env);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: user } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', userData.user.id)
          .single();

        if (user?.tenant_id) {
          await supabase
            .from('square_connections')
            .delete()
            .eq('tenant_id', user.tenant_id)
            .eq('encrypted_access_token', 'pending');
        }
      }

      const state = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('square-oauth-start', {
        body: { environment: env, state },
      });

      if (error || !data?.authUrl) {
        throw new Error(error?.message || 'Failed to initiate OAuth');
      }

      setLoadingStep('redirecting');
      localStorage.removeItem('square_oauth_result');

      const link = document.createElement('a');
      link.href = data.authUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoadingStep('completing');

    } catch (error: any) {
      toast({ 
        title: 'Connection failed', 
        description: error.message,
        variant: 'destructive' 
      });
      setLoading(false);
    }
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('square-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Connection test successful', description: `Connected to ${data.merchant.name}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Connection test failed', description: error.message, variant: 'destructive' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error('No connection found');
      const { error } = await supabase
        .from('square_connections')
        .delete()
        .eq('id', connection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['square-connection'] });
      toast({ title: 'Square disconnected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Disconnect failed', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>;
  }

  const isConnected = connection && connection.encrypted_access_token !== 'pending';

  const getTokenExpiryInfo = () => {
    if (!connection?.expires_at) return null;
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    let color = 'text-green-600';
    if (daysRemaining < 7) color = 'text-red-600';
    else if (daysRemaining < 14) color = 'text-yellow-600';
    
    return { text: `${daysRemaining} days`, color, expired: daysRemaining < 0 };
  };
  
  const tokenExpiry = getTokenExpiryInfo();

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="font-semibold mb-2">Connecting to Square</h3>
                <p className="text-sm text-muted-foreground">
                  {loadingStep === 'preparing' && 'Preparing connection...'}
                  {loadingStep === 'redirecting' && 'Opening Square authorization...'}
                  {loadingStep === 'completing' && 'Completing connection...'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLoading(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Plug className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Square</h3>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Merchant</p>
                <p className="font-medium">{connection.merchant_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-medium capitalize">{connection.environment}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-green-600">✓ Connected</p>
              </div>
              {tokenExpiry && (
                <div>
                  <p className="text-muted-foreground">Token Expiry</p>
                  <p className={`font-medium ${tokenExpiry.color}`}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {tokenExpiry.text}
                  </p>
                </div>
              )}
              {connection.last_synced_at && (
                <div>
                  <p className="text-muted-foreground">Last Synced</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || loading} size="sm" variant="default">
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending || loading} size="sm" variant="outline">
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Connection
              </Button>
              <Button onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending || loading} size="sm" variant="destructive">
                {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowConnectModal(true)} className="w-full">
            <Plug className="h-4 w-4 mr-2" />
            Connect Square
          </Button>
        )}
      </Card>

      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Square Account</DialogTitle>
            <DialogDescription>
              Choose your Square environment to connect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={environment} onValueChange={(val) => setEnvironment(val as 'sandbox' | 'production')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="production" id="production" />
                <Label htmlFor="production" className="font-normal cursor-pointer">
                  Production (Live Account)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sandbox" id="sandbox" />
                <Label htmlFor="sandbox" className="font-normal cursor-pointer">
                  Sandbox (Testing)
                </Label>
              </div>
            </RadioGroup>
            <Button onClick={() => initiateOAuthFlow(environment)} className="w-full">
              Connect {environment === 'sandbox' ? 'Sandbox' : 'Production'} Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};