import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Upload, Store, RefreshCw, Download, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { POSConnectionForm } from '@/components/crm/pos/POSConnectionForm';
import { VMXUploader } from '@/components/crm/pos/VMXUploader';

const POSIntegrations = () => {
  const [selectedPOS, setSelectedPOS] = useState<string>('');
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch POS connections
  const { data: connections } = useQuery({
    queryKey: ['pos-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_connections')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch integration logs  
  const { data: logs } = useQuery({
    queryKey: ['integration-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .order('sync_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const posOptions = [
    { value: 'shopify', label: 'Shopify', description: 'Connect your Shopify store' },
    { value: 'square', label: 'Square', description: 'Connect your Square POS' },
    { value: 'vmx', label: 'VMX (CSV Upload)', description: 'Upload customer data via CSV' },
    { value: 'lightspeed', label: 'Lightspeed', description: 'Coming Soon', disabled: true },
    { value: 'clover', label: 'Clover', description: 'Coming Soon', disabled: true },
  ];

  const handlePOSSelection = (value: string) => {
    setSelectedPOS(value);
    if (value === 'vmx') {
      // VMX uses CSV upload, no connection form needed
      return;
    }
    setShowConnectionForm(true);
  };

  const triggerManualSync = useMutation({
    mutationFn: async (connectionId: string) => {
      const connection = connections?.find(c => c.id === connectionId);
      if (!connection) throw new Error('Connection not found');

      const functionName = `${connection.platform.toLowerCase()}-sync`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { connectionId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-connections'] });
      queryClient.invalidateQueries({ queryKey: ['integration-logs'] });
      toast({ title: "Manual sync triggered successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Sync failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSync = (connectionId: string) => {
    triggerManualSync.mutate(connectionId);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default' as const, label: 'Active' },
      syncing: { variant: 'secondary' as const, label: 'Syncing' },
      error: { variant: 'destructive' as const, label: 'Error' },
      inactive: { variant: 'outline' as const, label: 'Inactive' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">POS Integrations</h1>
        <p className="text-muted-foreground">
          Sync your POS data to send better campaigns based on real purchases.
        </p>
      </div>

      {/* POS Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Connect Your POS System
          </CardTitle>
          <CardDescription>
            Which POS system do you use? Select one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NativeSelect
            value={selectedPOS}
            onChange={(e) => handlePOSSelection(e.target.value)}
            placeholder="Select your POS system"
            options={posOptions.map((option) => ({
              value: option.value,
              label: option.label,
              disabled: option.disabled
            }))}
          />
          
          {selectedPOS === 'vmx' && (
            <div className="mt-4">
              <VMXUploader onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['integration-logs'] });
                toast({
                  title: "Upload Successful",
                  description: "Your customer data has been imported successfully.",
                });
              }} />
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Don't see your POS system? <Button variant="link" className="p-0 h-auto">Contact us</Button> to request it.
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      {connections && connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Systems</CardTitle>
            <CardDescription>
              Manage your connected POS systems and sync data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{connection.name}</h3>
                      {getStatusBadge(connection.sync_status || 'inactive')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Platform: {connection.platform.charAt(0).toUpperCase() + connection.platform.slice(1)}
                    </div>
                    {connection.last_sync_at && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last synced: {formatDate(connection.last_sync_at)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={connection.sync_status === 'syncing' || triggerManualSync.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${(connection.sync_status === 'syncing' || triggerManualSync.isPending) ? 'animate-spin' : ''}`} />
                      {connection.sync_status === 'syncing' || triggerManualSync.isPending ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      {logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>
              Recent sync operations and their results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium capitalize">{log.pos_source}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(log.sync_date)} • 
                      {log.customers_imported} customers • 
                      {log.orders_imported} orders
                    </div>
                    {log.error_message && (
                      <div className="text-sm text-destructive">
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Form Modal */}
      {showConnectionForm && selectedPOS && selectedPOS !== 'vmx' && (
        <POSConnectionForm
          platform={selectedPOS}
          onSuccess={() => {
            setShowConnectionForm(false);
            setSelectedPOS('');
            queryClient.invalidateQueries({ queryKey: ['pos-connections'] });
            toast({
              title: "Connection Successful",
              description: `Successfully connected to ${selectedPOS.charAt(0).toUpperCase() + selectedPOS.slice(1)}`,
            });
          }}
          onCancel={() => {
            setShowConnectionForm(false);
            setSelectedPOS('');
          }}
        />
      )}
    </div>
  );
};

export default POSIntegrations;