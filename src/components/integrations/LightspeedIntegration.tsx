import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, Plug } from 'lucide-react';

export const LightspeedIntegration = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [domainPrefix, setDomainPrefix] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const connectMutation = useMutation({
    mutationFn: async (prefix: string) => {
      const { data, error } = await supabase.functions.invoke('lightspeed-oauth-initiate', {
        body: { domainPrefix: prefix },
      });

      if (error) throw error;
      if (!data?.authUrl) throw new Error('No auth URL returned');

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        data.authUrl,
        'Lightspeed OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'lightspeed-success') {
            window.removeEventListener('message', handleMessage);
            authWindow?.close();
            resolve(true);
          } else if (event.data?.type === 'lightspeed-error') {
            window.removeEventListener('message', handleMessage);
            authWindow?.close();
            reject(new Error(event.data.error || 'OAuth failed'));
          }
        };

        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('OAuth window closed'));
          }
        }, 500);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lightspeed-connection'] });
      setShowConnectModal(false);
      setDomainPrefix('');
      toast({ title: 'Lightspeed connected successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' });
    },
  });

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
    if (!domainPrefix.trim()) {
      toast({ title: 'Please enter a domain prefix', variant: 'destructive' });
      return;
    }
    connectMutation.mutate(domainPrefix.trim());
  };

  if (isLoading) {
    return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>;
  }

  const isConnected = connection && connection.encrypted_access_token !== 'pending';

  return (
    <>
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
                <p className="text-muted-foreground">Retailer ID</p>
                <p className="font-medium">{connection.retailer_id || 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending} size="sm">
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
              </Button>
              <Button onClick={() => setShowConnectModal(true)} variant="outline" size="sm">
                Reconnect
              </Button>
              <Button 
                onClick={() => disconnectMutation.mutate()} 
                disabled={disconnectMutation.isPending}
                variant="destructive" 
                size="sm"
              >
                {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
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
                disabled={connectMutation.isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: if your store URL is mystoreprefix.retail.lightspeed.app, enter "mystoreprefix"
              </p>
            </div>
            <Button 
              onClick={handleConnect} 
              disabled={connectMutation.isPending}
              className="w-full"
            >
              {connectMutation.isPending ? (
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
