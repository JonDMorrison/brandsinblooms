import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Check, Settings, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProviderIntegration {
  id: string;
  provider_type: string;
  provider_config: any;
  is_active: boolean;
  last_sync_at?: string;
  created_at: string;
}

export const ProviderIntegrationsTab = () => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'cloudflare' | 'route53'>('cloudflare');

  // Fetch existing integrations
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['domain-provider-integrations', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('domain_provider_integrations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProviderIntegration[];
    },
    enabled: !!tenant?.id,
  });

  // Add integration mutation
  const addIntegrationMutation = useMutation({
    mutationFn: async (config: any) => {
      const { data, error } = await supabase
        .from('domain_provider_integrations')
        .insert({
          tenant_id: tenant?.id,
          provider_type: selectedProvider,
          provider_config: config,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-provider-integrations'] });
      setShowAddForm(false);
      toast({
        title: 'Integration Added',
        description: `${selectedProvider} integration configured successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle integration mutation
  const toggleIntegrationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('domain_provider_integrations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-provider-integrations'] });
    },
  });

  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('domain_provider_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-provider-integrations'] });
      toast({
        title: 'Integration Deleted',
        description: 'Provider integration removed successfully.',
      });
    },
  });

  const handleAddIntegration = async (formData: FormData) => {
    const config: any = {};
    
    if (selectedProvider === 'cloudflare') {
      config.api_token = formData.get('api_token');
      config.email = formData.get('email');
    } else if (selectedProvider === 'route53') {
      config.access_key_id = formData.get('access_key_id');
      config.secret_access_key = formData.get('secret_access_key');
      config.region = formData.get('region') || 'us-east-1';
    }

    addIntegrationMutation.mutate(config);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">DNS Provider Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connect your DNS providers for automatic record management
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Add Integration Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add DNS Provider Integration</CardTitle>
            <CardDescription>
              Configure automatic DNS management with your provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddIntegration(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <Tabs value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as any)}>
                <TabsList>
                  <TabsTrigger value="cloudflare">Cloudflare</TabsTrigger>
                  <TabsTrigger value="route53">AWS Route 53</TabsTrigger>
                </TabsList>

                <TabsContent value="cloudflare" className="space-y-4">
                  <div>
                    <Label htmlFor="api_token">API Token</Label>
                    <Input
                      id="api_token"
                      name="api_token"
                      type="password"
                      placeholder="Your Cloudflare API token"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a token with Zone:Edit permissions at Cloudflare dashboard
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Account Email (Optional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="route53" className="space-y-4">
                  <div>
                    <Label htmlFor="access_key_id">Access Key ID</Label>
                    <Input
                      id="access_key_id"
                      name="access_key_id"
                      placeholder="AKIA..."
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="secret_access_key">Secret Access Key</Label>
                    <Input
                      id="secret_access_key"
                      name="secret_access_key"
                      type="password"
                      placeholder="Your secret key"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      name="region"
                      placeholder="us-east-1"
                      defaultValue="us-east-1"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={addIntegrationMutation.isPending}>
                  {addIntegrationMutation.isPending ? 'Adding...' : 'Add Integration'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Integrations */}
      <div className="space-y-4">
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Settings className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No DNS Provider Integrations</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Connect your DNS provider to enable automatic record management and one-click domain setup.
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                Add Your First Integration
              </Button>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    integration.is_active ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  
                  <div>
                    <h4 className="font-semibold capitalize">
                      {integration.provider_type}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {integration.provider_type === 'cloudflare' && 
                        `Token: ${integration.provider_config.api_token?.slice(0, 8)}...`
                      }
                      {integration.provider_type === 'route53' && 
                        `Key: ${integration.provider_config.access_key_id?.slice(0, 8)}...`
                      }
                    </p>
                    {integration.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={integration.is_active ? 'default' : 'secondary'}>
                    {integration.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={(checked) => 
                      toggleIntegrationMutation.mutate({ 
                        id: integration.id, 
                        isActive: checked 
                      })
                    }
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteIntegrationMutation.mutate(integration.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Cloudflare Setup:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to Cloudflare Dashboard → My Profile → API Tokens</li>
              <li>Create a Custom Token with Zone:Edit permissions</li>
              <li>Copy the token and paste it above</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">AWS Route 53 Setup:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to AWS IAM Console → Users → Create User</li>
              <li>Attach Route53FullAccess policy or create custom policy</li>
              <li>Generate Access Key and Secret Key</li>
              <li>Enter credentials above</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
