import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, Plug, BookOpen, Clock, Package as PackageIcon, Bug } from 'lucide-react';
import { LightspeedOAuthOverlay } from './LightspeedOAuthOverlay';
import { LightspeedDashboard } from './LightspeedDashboard';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export const LightspeedIntegration = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [domainPrefix, setDomainPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'preparing' | 'redirecting' | 'completing'>('preparing');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Listen for OAuth completion via multiple channels (from callback tab)
  useEffect(() => {
    const handleOAuthResult = (data: any) => {
      // Only process recent results (within 30 seconds)
      if (Date.now() - data.timestamp < 30000) {
        setLoading(false);
        setShowConnectModal(false);
        localStorage.removeItem('lightspeed_oauth_result');
        
        if (data.status === 'success') {
          queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
          queryClient.invalidateQueries({ queryKey: ['lightspeed-connection-status'] });
          toast({ 
            title: "✓ Lightspeed connected successfully",
            description: data.retailerName ? `Connected to ${data.retailerName}` : undefined
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

    // Method 1: Check localStorage
    const checkLocalStorage = () => {
      const result = localStorage.getItem('lightspeed_oauth_result');
      if (result) {
        try {
          const data = JSON.parse(result);
          handleOAuthResult(data);
        } catch (error) {
          console.error('[LS-Integration] Error processing OAuth result:', error);
        }
      }
    };

    // Method 2: Listen to BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('lightspeed_oauth');
      channel.onmessage = (event) => {
        console.log('[LS-Integration] Received via BroadcastChannel:', event.data);
        handleOAuthResult(event.data);
      };
    } catch (e) {
      console.log('[LS-Integration] BroadcastChannel not supported');
    }

    // Method 3: Listen to postMessage
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && 
          event.data?.type === 'lightspeed_oauth_result') {
        console.log('[LS-Integration] Received via postMessage:', event.data.data);
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener('message', handleMessage);

    // Check immediately
    checkLocalStorage();
    
    // Listen for storage events from other tabs
    window.addEventListener('storage', checkLocalStorage);
    
    // Poll more frequently while loading (every 500ms)
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

  // While the OAuth flow is in progress, poll the server for connection status
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
    }, 1500);
    return () => clearInterval(interval);
  }, [loading, queryClient]);

  // If we detect the DB shows a connected state, finish the flow even if the
  // callback message was missed (robust fallback)
  useEffect(() => {
    if (loading && connection && connection.encrypted_access_token !== 'pending') {
      setLoading(false);
      setShowConnectModal(false);
      toast({ title: '✓ Lightspeed connected successfully' });
      // Ensure any dependent views refresh
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection-status'] });
    }
  }, [loading, connection, toast, queryClient]);

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
      console.log('[OAuth] Starting Lightspeed OAuth with server-side state management');

      // Clean up old pending connections first
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: user } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', userData.user.id)
          .single();

        if (user?.tenant_id) {
          // Delete old pending connections for this tenant
          await supabase
            .from('lightspeed_connections')
            .delete()
            .eq('tenant_id', user.tenant_id)
            .eq('encrypted_access_token', 'pending');
          console.log('[OAuth] Cleaned up old pending connections');
        }
      }

      // Use the actual origin - edge function will handle environment detection
      const redirectOrigin = window.location.origin;

      // Call the new OAuth start function (no client-side state management)
      const { data, error } = await supabase.functions.invoke('lightspeed-oauth-start', {
        body: { domainPrefix: prefix, redirectOrigin },
      });

      if (error) {
        console.error('[OAuth] Edge function error:', error);
        throw new Error(error.message || 'Failed to initiate OAuth');
      }

      if (!data?.authUrl) {
        console.error('[OAuth] No auth URL in response:', data);
        throw new Error('No authorization URL received');
      }

      console.log('[OAuth] Redirecting to Lightspeed authorization...');
      setLoadingStep('redirecting');

      // Clear any old OAuth results
      localStorage.removeItem('lightspeed_oauth_result');

      // Open OAuth in a new tab using anchor element (more reliable than window.open)
      const link = document.createElement('a');
      link.href = data.authUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Keep loading state active - user will return via callback
      console.log('[OAuth] Opened authorization in new tab, waiting for callback...');
      setLoadingStep('completing');

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

  const loadProductsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('lightspeed-get-products');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setProducts(data.products || []);
      setShowProductsModal(true);
      toast({ title: 'Products loaded', description: `Fetched ${data.count} products` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to load products', description: error.message, variant: 'destructive' });
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
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection-status'] });
      toast({ title: 'Lightspeed disconnected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Disconnect failed', description: error.message, variant: 'destructive' });
    },
  });

  // Clean up old pending connections
  const cleanupPendingMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!user?.tenant_id) throw new Error('No tenant found');

      // Delete pending connections older than 20 minutes
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('lightspeed_connections')
        .delete()
        .eq('tenant_id', user.tenant_id)
        .eq('encrypted_access_token', 'pending')
        .lt('created_at', twentyMinutesAgo);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
      toast({ title: 'Old pending connections cleaned up' });
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

  const hasPendingConnection = connection && connection.encrypted_access_token === 'pending';
  const isConnected = connection && connection.encrypted_access_token !== 'pending';
  
  // Calculate token expiry
  const getTokenExpiryInfo = () => {
    if (!connection?.expires_at) return null;
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    const minutesRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
    const hoursRemaining = Math.floor(minutesRemaining / 60);
    
    let color = 'text-green-600';
    if (minutesRemaining < 60) color = 'text-red-600';
    else if (minutesRemaining < 1440) color = 'text-yellow-600'; // < 24 hours
    
    let text = '';
    if (minutesRemaining < 0) text = 'Expired';
    else if (hoursRemaining > 0) text = `${hoursRemaining}h ${minutesRemaining % 60}m`;
    else text = `${minutesRemaining}m`;
    
    return { text, color, expired: minutesRemaining < 0 };
  };
  
  const tokenExpiry = getTokenExpiryInfo();

  return (
    <>
      <LightspeedOAuthOverlay 
        isVisible={loading} 
        step={loadingStep} 
        onCancel={() => setLoading(false)}
      />
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Domain</p>
                <p className="font-medium">{connection.domain_prefix}.retail.lightspeed.app</p>
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
            
            {tokenExpiry?.expired && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-sm text-red-600">
                  <strong>Token expired.</strong> Please reconnect your account to continue syncing.
                </p>
              </div>
            )}
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || loading || tokenExpiry?.expired} size="sm" variant="default">
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending || loading} size="sm" variant="outline">
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Connection
              </Button>
              <Button onClick={() => loadProductsMutation.mutate()} disabled={loadProductsMutation.isPending || loading} size="sm" variant="outline">
                {loadProductsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageIcon className="h-4 w-4 mr-2" />}
                Load Products
              </Button>
              <Button onClick={() => navigate('/integrations/lightspeed/guide')} variant="outline" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                Guide
              </Button>
              <Button onClick={() => navigate('/integrations/lightspeed/debug')} variant="default" size="sm">
                <Bug className="h-4 w-4 mr-2" />
                Debug
              </Button>
              {tokenExpiry?.expired && (
                <Button onClick={() => setShowConnectModal(true)} variant="outline" size="sm" disabled={loading}>
                  Reconnect
                </Button>
              )}
              <Button 
                onClick={() => disconnectMutation.mutate()} 
                disabled={disconnectMutation.isPending || loading}
                variant="destructive" 
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
        ) : hasPendingConnection ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Connection Incomplete
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                Your Lightspeed connection was initiated but not completed. The OAuth flow may have been interrupted or timed out.
              </p>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                <p>• Domain: {connection?.domain_prefix}.retail.lightspeed.app</p>
                <p>• Status: Awaiting authorization completion</p>
                <p>• Created: {connection?.created_at ? formatDistanceToNow(new Date(connection.created_at), { addSuffix: true }) : 'Unknown'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setDomainPrefix(connection?.domain_prefix || '');
                  setShowConnectModal(true);
                }} 
                className="flex-1"
              >
                Retry Connection
              </Button>
              <Button 
                onClick={() => disconnectMutation.mutate()} 
                disabled={disconnectMutation.isPending}
                variant="outline"
              >
                {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
              </Button>
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

      {/* Products Modal */}
      <Dialog open={showProductsModal} onOpenChange={setShowProductsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Lightspeed Products</DialogTitle>
            <DialogDescription>
              Sample of {products.length} products from your Lightspeed catalog
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {products.length > 0 ? (
              products.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold">{product.name}</h4>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {product.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-muted-foreground">
                          SKU: <span className="font-medium text-foreground">{product.sku}</span>
                        </span>
                        {product.inventory !== undefined && (
                          <span className="text-muted-foreground">
                            Stock: <span className="font-medium text-foreground">{product.inventory}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        ${(product.price / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No products found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
