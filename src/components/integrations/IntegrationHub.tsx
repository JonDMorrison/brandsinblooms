import React, { useState, useEffect } from 'react';
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
  Store
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GoogleAnalyticsConnection } from './GoogleAnalyticsConnection';

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

  const fetchUserIntegrations = async () => {
    if (!user) return;

    try {
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

  const handleConnectIntegration = async (integration: Integration) => {
    if (integration.setupUrl) {
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
    return userIntegrations.find(
      int => int.provider === providerId && int.is_active
    );
  };

  useEffect(() => {
    fetchUserIntegrations();
  }, [user]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Integration Hub
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect your favorite tools and automate your workflow. 
          Build custom integrations or choose from our marketplace.
        </p>
        
        <div className="flex justify-center gap-4 mt-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            {connectedCount} Connected
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-600" />
            {availableIntegrations.length} Available
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="connected">Connected</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="marketplace" className="space-y-6">
          {/* Featured POS Integration */}
          <div className="space-y-4">
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Store className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-green-900">
                        Point of Sale (POS) Sync
                      </CardTitle>
                      <p className="text-green-700 mt-1">
                        Connect your POS system to automatically sync customer data with your CRM
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-600 text-white">
                    Popular
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-green-800">
                      <strong>Supported platforms:</strong> Shopify, Square, Counterpoint, VMX CSV Import, and more
                    </p>
                    <p className="text-sm text-green-700">
                      Automatically import customers, orders, and purchase history
                    </p>
                  </div>
                  <Button 
                    onClick={() => window.location.href = '/crm/pos'}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Connect POS System
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Special Analytics Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analytics Integrations
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GoogleAnalyticsConnection />
            </div>
          </div>

          {/* Categories */}
          {['social', 'automation', 'email', 'crm'].map(category => {
            const categoryIntegrations = getIntegrationsByCategory(category);
            if (categoryIntegrations.length === 0) return null;

            return (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                  {category === 'social' && <Smartphone className="w-5 h-5" />}
                  {category === 'automation' && <Zap className="w-5 h-5" />}
                  {category === 'email' && <Mail className="w-5 h-5" />}
                  {category === 'crm' && <Users className="w-5 h-5" />}
                  {category} Integrations
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryIntegrations.map((integration) => {
                    const connection = getConnectionStatus(integration.provider);
                    const isConnected = !!connection;

                    return (
                      <Card key={integration.id} className={`transition-all hover:shadow-md ${
                        isConnected ? 'border-green-200 bg-green-50' : ''
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {integration.icon}
                              <div>
                                <CardTitle className="text-base">
                                  {integration.name}
                                </CardTitle>
                                {isConnected && (
                                  <Badge variant="secondary" className="mt-1">
                                    <Check className="w-3 h-3 mr-1" />
                                    Connected
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 mb-4">
                            {integration.description}
                          </p>
                          
                          <div className="flex gap-2">
                            {isConnected ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDisconnectIntegration(connection.id)}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Disconnect
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Settings className="w-4 h-4 mr-1" />
                                  Configure
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnectIntegration(integration)}
                                className="w-full"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Connect
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
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