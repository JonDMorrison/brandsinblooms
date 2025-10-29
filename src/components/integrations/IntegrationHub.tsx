import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Zap, 
  Plus, 
  Settings, 
  Webhook,
  Mail,
  Users,
  BarChart3,
  Smartphone,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  Facebook,
  Instagram,
  Store,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GoogleAnalyticsConnection } from './GoogleAnalyticsConnection';
import { LightspeedIntegration } from './LightspeedIntegration';
import { LightspeedDebug } from './LightspeedDebug';
import { useQuery } from '@tanstack/react-query';

const APP_ORIGIN = window.location.origin;

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'social' | 'automation' | 'email' | 'crm' | 'analytics';
  icon: React.ReactNode;
  isConnected: boolean;
  provider: string;
  setupUrl?: string;
  webhookUrl?: string;
  apiKey?: string;
  isActive: boolean;
}

interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: string;
  provider: string;
  configuration: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const IntegrationHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [providerConnections, setProviderConnections] = useState<any[]>([]);
  const oauthPopupRef = useRef<Window | null>(null);

  // Check for Lightspeed connection status
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

  // Available integrations marketplace
  const availableIntegrations: Integration[] = [
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Publish posts and manage your Facebook Pages',
      category: 'social',
      icon: <Facebook className="w-6 h-6 text-blue-600" />,
      isConnected: false,
      provider: 'facebook',
      setupUrl: '/social-accounts',
      isActive: true
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Share photos and stories to your Instagram Business account',
      category: 'social',
      icon: <Instagram className="w-6 h-6 text-pink-600" />,
      isConnected: false,
      provider: 'instagram',
      setupUrl: '/social-accounts',
      isActive: true
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect to 6000+ apps with automated workflows',
      category: 'automation',
      icon: <Zap className="w-6 h-6 text-orange-600" />,
      isConnected: false,
      provider: 'zapier',
      setupUrl: '/integrations/zapier',
      isActive: true
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Sync leads and send targeted email campaigns',
      category: 'email',
      icon: <Mail className="w-6 h-6 text-yellow-600" />,
      isConnected: false,
      provider: 'mailchimp',
      isActive: true
    },
    {
      id: 'pos_sync',
      name: 'Point of Sale (POS) Sync',
      description: 'Connect Shopify, Square, and other POS systems to sync customer data',
      category: 'crm',
      icon: <Store className="w-6 h-6 text-green-600" />,
      isConnected: false,
      provider: 'pos',
      setupUrl: '/crm/pos',
      isActive: true
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts and track lead engagement',
      category: 'crm',
      icon: <Users className="w-6 h-6 text-orange-500" />,
      isConnected: false,
      provider: 'hubspot',
      isActive: true
    },
    {
      id: 'google_analytics',
      name: 'Google Analytics',
      description: 'Track website traffic from social media',
      category: 'analytics',
      icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
      isConnected: false,
      provider: 'google',
      isActive: true
    },
    {
      id: 'webhook_custom',
      name: 'Custom Webhooks',
      description: 'Create custom webhook endpoints for any integration',
      category: 'automation',
      icon: <Webhook className="w-6 h-6 text-purple-600" />,
      isConnected: false,
      provider: 'custom',
      isActive: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and manage content in Slack',
      category: 'automation',
      icon: <Smartphone className="w-6 h-6 text-purple-500" />,
      isConnected: false,
      provider: 'slack',
      isActive: true
    }
  ];

  const fetchProviderConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('status', 'connected');

      if (error) throw error;
      setProviderConnections(data || []);
    } catch (error) {
      console.error('Error fetching provider connections:', error);
    }
  };

  const fetchUserIntegrations = async () => {
    if (!user) return;

    try {
      await fetchProviderConnections();
      // TODO: Replace with actual database call once migration is applied
      setUserIntegrations([]);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMailchimp = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('oauth-authorize', {
        body: { provider: 'mailchimp' }
      });

      if (error) throw error;

      const { authUrl } = data;
      const popup = window.open(authUrl, 'oauth', 'width=600,height=700');
      oauthPopupRef.current = popup;
    } catch (error: any) {
      console.error('Error initiating Mailchimp OAuth:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Mailchimp",
        variant: "destructive",
      });
    }
  };

  const handleConnectIntegration = async (integration: Integration) => {
    if (integration.provider === 'mailchimp') {
      await handleConnectMailchimp();
    } else if (integration.setupUrl) {
      // Navigate to specific setup page
      window.location.href = integration.setupUrl;
    } else {
      // Generic connection flow
      toast({
        title: "Coming Soon",
        description: `${integration.name} integration coming soon!`,
      });
    }
  };

  const handleDisconnectIntegration = async (integrationId: string) => {
    // TODO: Replace with actual database call once migration is applied
    toast({
      title: "Coming Soon",
      description: "Integrations will be available once database setup is complete",
    });
  };

  const getConnectionStatus = (providerId: string) => {
    // Check provider_connections first
    const providerConnection = providerConnections.find(
      conn => conn.provider === providerId
    );
    if (providerConnection) return providerConnection;

    // Fallback to user_integrations
    return userIntegrations.find(
      int => int.provider === providerId && int.is_active
    );
  };

  useEffect(() => {
    fetchUserIntegrations();
  }, [user]);

  useEffect(() => {
    const handleOAuthMessage = (e: MessageEvent) => {
      if (e.origin !== APP_ORIGIN) return;

      if (e.data.type === 'oauth-success') {
        toast({
          title: "Connected!",
          description: `Successfully connected to ${e.data.provider}`,
        });
        fetchProviderConnections();
      } else if (e.data.type === 'oauth-error') {
        toast({
          title: "Connection Failed",
          description: e.data.message || "Failed to connect",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [toast]);

  const getIntegrationsByCategory = (category: string) => {
    return availableIntegrations.filter(int => int.category === category);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  const connectedCount = userIntegrations.filter(int => int.is_active).length;

  const categories = [
    { id: 'data-sync', label: 'Data & CRM Sync', icon: <Download className="w-5 h-5" /> },
    { id: 'social', label: 'Social Media', icon: <Smartphone className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'automation', label: 'Automation', icon: <Zap className="w-5 h-5" /> },
    { id: 'email', label: 'Email & Marketing', icon: <Mail className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your tools to sync data, automate workflows, and grow your business
          </p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            {connectedCount} Active
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {availableIntegrations.length} Available
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="marketplace">All Integrations</TabsTrigger>
          <TabsTrigger value="connected">My Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-8">
          {/* Data & CRM Sync Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Data & CRM Sync</h2>
            </div>

            <div className="grid gap-4">
              {/* One-Time Migration */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Download className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">Data Migration Tool</CardTitle>
                          <Badge className="bg-primary">New</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          One-time import from Mailchimp or Klaviyo with AI-powered mapping
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => window.location.href = '/integrations/migrations'}>
                      <Download className="w-4 h-4 mr-2" />
                      Start Migration
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>✓ Contacts & Consent</span>
                    <span>•</span>
                    <span>✓ Tags & Segments</span>
                    <span>•</span>
                    <span>✓ AI Auto-Mapping</span>
                    <span>•</span>
                    <span>✓ Reconciliation Report</span>
                  </div>
                </CardContent>
              </Card>

              {/* POS Integration */}
              <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center shrink-0">
                        <Store className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">Point of Sale (POS) Sync</CardTitle>
                          <Badge className="bg-green-600">Popular</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Ongoing sync from Shopify, Square, Counterpoint, VMX & more
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => window.location.href = '/crm/pos'} className="bg-green-600 hover:bg-green-700">
                      <Store className="w-4 h-4 mr-2" />
                      Setup POS
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>✓ Customer Sync</span>
                    <span>•</span>
                    <span>✓ Order History</span>
                    <span>•</span>
                    <span>✓ Purchase Data</span>
                    <span>•</span>
                    <span>✓ Real-time Updates</span>
                  </div>
                </CardContent>
              </Card>

              {/* Lightspeed X-Series */}
              <LightspeedIntegration />

              {/* Lightspeed Debug Tools - Only show when not connected */}
              {!hasValidLightspeedConnection && <LightspeedDebug />}
            </div>
          </section>

          {/* Social Media Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Social Media</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getIntegrationsByCategory('social').map((integration) => {
                const connection = getConnectionStatus(integration.provider);
                const isConnected = !!connection;

                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {integration.icon}
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {isConnected && (
                            <Badge variant="secondary" className="mt-1">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                      <Button
                        size="sm"
                        onClick={() => handleConnectIntegration(integration)}
                        className="w-full"
                        variant={isConnected ? "outline" : "default"}
                      >
                        {isConnected ? (
                          <>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Analytics Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Analytics & Tracking</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <GoogleAnalyticsConnection />
              
              {getIntegrationsByCategory('analytics').filter(i => i.id !== 'google_analytics').map((integration) => {
                const connection = getConnectionStatus(integration.provider);
                const isConnected = !!connection;

                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {integration.icon}
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {isConnected && (
                            <Badge variant="secondary" className="mt-1">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                      <Button
                        size="sm"
                        onClick={() => handleConnectIntegration(integration)}
                        className="w-full"
                        variant={isConnected ? "outline" : "default"}
                      >
                        {isConnected ? (
                          <>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Automation Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Automation & Workflows</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getIntegrationsByCategory('automation').map((integration) => {
                const connection = getConnectionStatus(integration.provider);
                const isConnected = !!connection;

                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {integration.icon}
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {isConnected && (
                            <Badge variant="secondary" className="mt-1">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                      <Button
                        size="sm"
                        onClick={() => handleConnectIntegration(integration)}
                        className="w-full"
                        variant={isConnected ? "outline" : "default"}
                      >
                        {isConnected ? (
                          <>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Email & Marketing Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Email & Marketing</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getIntegrationsByCategory('email').map((integration) => {
                const connection = getConnectionStatus(integration.provider);
                const isConnected = !!connection;

                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {integration.icon}
                        <div className="flex-1">
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          {isConnected && (
                            <Badge variant="secondary" className="mt-1">
                              <Check className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                      <Button
                        size="sm"
                        onClick={() => handleConnectIntegration(integration)}
                        className="w-full"
                        variant={isConnected ? "outline" : "default"}
                      >
                        {isConnected ? (
                          <>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* CRM Section */}
          {getIntegrationsByCategory('crm').filter(i => i.id !== 'pos_sync').length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h2 className="text-xl font-semibold">CRM Platforms</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getIntegrationsByCategory('crm').filter(i => i.id !== 'pos_sync').map((integration) => {
                  const connection = getConnectionStatus(integration.provider);
                  const isConnected = !!connection;

                  return (
                    <Card key={integration.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          {integration.icon}
                          <div className="flex-1">
                            <CardTitle className="text-base">{integration.name}</CardTitle>
                            {isConnected && (
                              <Badge variant="secondary" className="mt-1">
                                <Check className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{integration.description}</p>
                        <Button
                          size="sm"
                          onClick={() => handleConnectIntegration(integration)}
                          className="w-full"
                          variant={isConnected ? "outline" : "default"}
                        >
                          {isConnected ? (
                            <>
                              <Settings className="w-4 h-4 mr-2" />
                              Manage
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="connected" className="space-y-4">
          {userIntegrations.filter(int => int.is_active).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Connected Integrations
                </h3>
                <p className="text-gray-600 mb-4">
                  Connect your first integration to start automating your workflow
                </p>
                <Button onClick={() => setActiveTab('marketplace')}>
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {userIntegrations.filter(int => int.is_active).map((integration) => (
                <Card key={integration.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium capitalize">
                            {integration.provider} Integration
                          </h3>
                          <p className="text-sm text-gray-500">
                            Connected on {new Date(integration.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnectIntegration(integration.id)}
                        >
                          Disconnect
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Custom Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Create custom webhook endpoints to integrate with any external service.
                Coming soon!
              </p>
              <Button disabled>
                <Plus className="w-4 h-4 mr-2" />
                Create Webhook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};