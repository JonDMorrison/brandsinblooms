import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Store, 
  Users, 
  Plug2, 
  Plus, 
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  ExternalLink,
  Square,
  FileText,
  Facebook,
  Instagram,
  Zap,
  HelpCircle
} from 'lucide-react';

// Import POS related components and hooks
import { POSSetupWizard } from '@/components/crm/pos/POSSetupWizard';
import { POSConnectionHelp } from '@/components/crm/pos/POSConnectionHelp';
import { usePOSConnections } from '@/hooks/usePOSConnections';
import { useConnectedAccounts, getConnectionStatus } from '@/components/dashboard/ConnectedAccountChecker';
import { useToast } from '@/hooks/use-toast';

interface POSPlatform {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'pos' | 'social' | 'integration';
}

export const ConnectionsSettings = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const { connections: posConnections, isLoading: posLoading, runSync, disconnectPOS } = usePOSConnections();
  const { data: socialConnections = [], isLoading: socialLoading } = useConnectedAccounts();
  const { toast } = useToast();

  const availablePlatforms: POSPlatform[] = [
    {
      id: 'shopify',
      name: 'Shopify',
      icon: <Store className="h-6 w-6 text-green-600" />,
      description: 'Connect your Shopify store to sync customers and orders',
      category: 'pos'
    },
    {
      id: 'square',
      name: 'Square',
      icon: <Square className="h-6 w-6 text-blue-600" />,
      description: 'Connect your Square POS to sync customer and transaction data',
      category: 'pos'
    },
    {
      id: 'vmx',
      name: 'VMX / CSV Upload',
      icon: <FileText className="h-6 w-6 text-purple-600" />,
      description: 'Upload customer data via CSV files',
      category: 'pos'
    }
  ];

  const socialPlatforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <Facebook className="h-6 w-6 text-blue-600" />,
      description: 'Publish posts and manage your Facebook Pages',
      setupUrl: '/social-accounts'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <Instagram className="h-6 w-6 text-pink-600" />,
      description: 'Share photos and stories to your Instagram Business account',
      setupUrl: '/social-accounts'
    }
  ];

  const handleConnectPOS = (platform: string) => {
    setSelectedPlatform(platform);
    setShowConnectionForm(true);
  };

  const handlePOSConnectionSuccess = () => {
    setShowConnectionForm(false);
    setSelectedPlatform(null);
    toast({
      title: "POS Connected",
      description: "Your POS system has been successfully connected and is ready to sync data.",
    });
  };

  const handleSyncPOS = async (connectionId: string) => {
    try {
      await runSync(connectionId);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleDisconnectPOS = async (connectionId: string) => {
    try {
      await disconnectPOS(connectionId);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const connectedPOSIds = posConnections?.map(conn => conn.platform) || [];
  const connectionStatusData = getConnectionStatus(socialConnections);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug2 className="h-5 w-5" />
            Connections & Integrations
          </CardTitle>
          <CardDescription>
            Connect your POS systems, social media accounts, and third-party services to streamline your business operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pos" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pos">POS Systems</TabsTrigger>
              <TabsTrigger value="social">Social Media</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>

            {/* POS Systems Tab */}
            <TabsContent value="pos" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Point of Sale Systems</h3>
                  <Badge variant={posConnections?.length ? "default" : "secondary"}>
                    {posConnections?.length || 0} Connected
                  </Badge>
                </div>

                {/* Connected POS Systems */}
                {posConnections && posConnections.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Connected Systems</h4>
                    {posConnections.map((connection) => (
                      <Card key={connection.id} className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <Store className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <div className="font-medium">{connection.name}</div>
                                <div className="text-sm text-muted-foreground capitalize">
                                  {connection.platform} • {connection.is_active ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSyncPOS(connection.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Sync
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDisconnectPOS(connection.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Available POS Systems */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Available Systems</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availablePlatforms.map((platform) => {
                      const isConnected = connectedPOSIds.includes(platform.id);
                      
                      return (
                        <Card key={platform.id} className={isConnected ? 'opacity-50' : 'hover:shadow-md transition-shadow'}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {platform.icon}
                                <div>
                                  <div className="font-medium">{platform.name}</div>
                                  {isConnected && (
                                    <Badge variant="secondary" className="mt-1">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Connected
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {platform.description}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleConnectPOS(platform.id)}
                                disabled={isConnected}
                                className="flex-1"
                              >
                                {isConnected ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Connected
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Connect
                                  </>
                                )}
                              </Button>
                              {!isConnected && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPlatform(platform.id);
                                    setShowHelp(true);
                                  }}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Social Media Tab */}
            <TabsContent value="social" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Social Media Accounts</h3>
                  <Badge variant={socialConnections.length ? "default" : "secondary"}>
                    {connectionStatusData.statusMessage}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {socialPlatforms.map((platform) => {
                    const isConnected = connectionStatusData.connectedPlatforms.includes(platform.id);
                    
                    return (
                      <Card key={platform.id} className={isConnected ? 'border-green-200 bg-green-50' : 'hover:shadow-md transition-shadow'}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {platform.icon}
                              <div>
                                <div className="font-medium">{platform.name}</div>
                                {isConnected && (
                                  <Badge variant="secondary" className="mt-1">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Connected
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {platform.description}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => window.location.href = platform.setupUrl}
                            variant={isConnected ? "outline" : "default"}
                            className="w-full"
                          >
                            {isConnected ? (
                              <>
                                <SettingsIcon className="h-4 w-4 mr-1" />
                                Manage
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Connect
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Need to connect other social platforms?
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/social-accounts'}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Go to Social Accounts
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Third-Party Integrations</h3>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Zap className="h-6 w-6 text-orange-600" />
                        <div className="font-medium">Zapier</div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Connect to 6000+ apps with automated workflows
                      </p>
                      <Button size="sm" variant="outline" disabled className="w-full">
                        <Plus className="h-4 w-4 mr-1" />
                        Connect
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Users className="h-6 w-6 text-blue-600" />
                        <div className="font-medium">Mailchimp</div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sync leads and send targeted email campaigns
                      </p>
                      <Button size="sm" variant="outline" disabled className="w-full">
                        <Plus className="h-4 w-4 mr-1" />
                        Connect
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Want to explore more integrations?
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/integrations'}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Integration Hub
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* POS Setup Wizard */}
      {showConnectionForm && selectedPlatform && (
        <POSSetupWizard
          platform={selectedPlatform}
          onSuccess={handlePOSConnectionSuccess}
          onCancel={() => {
            setShowConnectionForm(false);
            setSelectedPlatform(null);
          }}
        />
      )}

      {/* POS Help Modal */}
      {showHelp && selectedPlatform && (
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Setup Guide</DialogTitle>
              <DialogDescription>
                Step-by-step instructions for connecting your POS system
              </DialogDescription>
            </DialogHeader>
            <POSConnectionHelp platform={selectedPlatform} />
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setShowHelp(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setShowHelp(false);
                handleConnectPOS(selectedPlatform);
              }}>
                Start Setup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};