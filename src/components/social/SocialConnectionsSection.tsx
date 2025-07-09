
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SocialConnectionCard } from './SocialConnectionCard';
import { ConnectMetaButton } from './ConnectMetaButton';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { AlertCircle, Wifi, Facebook, Instagram } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SocialConnectionsSectionProps {
  connections: any[];
  onConnectionSuccess: () => void;
}

export const SocialConnectionsSection: React.FC<SocialConnectionsSectionProps> = ({
  connections,
  onConnectionSuccess
}) => {
  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    platform: string;
    connectionId: string;
    platformName: string;
  }>({ open: false, platform: '', connectionId: '', platformName: '' });
  const [disconnecting, setDisconnecting] = useState(false);
  const [showReconnectFlow, setShowReconnectFlow] = useState(false);

  const facebookConnection = connections.find(conn => conn.platform === 'facebook');
  const instagramConnection = connections.find(conn => conn.platform === 'instagram');
  const isConnected = facebookConnection || instagramConnection;
  const bothConnected = facebookConnection && instagramConnection;

  const handleConnectionSuccess = () => {
    setShowReconnectFlow(false); // Reset reconnect flow when successfully connected
    onConnectionSuccess();
  };

  const handleDisconnectClick = (platform: string, connectionId: string, platformName: string) => {
    setDisconnectDialog({
      open: true,
      platform,
      connectionId,
      platformName
    });
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', disconnectDialog.connectionId);

      if (error) throw error;

      toast.success(`${disconnectDialog.platformName} disconnected successfully`);
      onConnectionSuccess(); // Refresh connections
      
      // Check if this was the last connection and show reconnect flow
      const remainingConnections = connections.filter(conn => conn.id !== disconnectDialog.connectionId);
      if (remainingConnections.length === 0) {
        setShowReconnectFlow(true);
      }
      
      setDisconnectDialog({ open: false, platform: '', connectionId: '', platformName: '' });
    } catch (error) {
      console.error('Error disconnecting platform:', error);
      toast.error(`Failed to disconnect ${disconnectDialog.platformName}`);
    } finally {
      setDisconnecting(false);
    }
  };

  // Show reconnection flow if user just disconnected all accounts or has no connections
  if (connections.length === 0 || showReconnectFlow) {
    return (
      <SubscriptionGate 
        requiredPlan="bloom" 
        feature="Social Media Connections"
        fallback={
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
                <Wifi className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Social Media Connections</h2>
                <p className="text-lg text-gray-600 mt-2 max-w-2xl mx-auto">
                  Connect your Facebook and Instagram accounts to start scheduling and managing your social media content from one place.
                </p>
                <p className="text-sm text-amber-600 mt-4 font-medium">
                  Upgrade to Bloom plan to connect your social media accounts
                </p>
              </div>
            </div>

            {/* Single Meta Connection Card */}
            <div className="max-w-2xl mx-auto opacity-50">
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="p-8 text-center">
                  <div className="flex justify-center items-center space-x-3 mb-4">
                    <div className="p-3 bg-blue-600 rounded-xl">
                      <Facebook className="w-8 h-8 text-white" />
                    </div>
                    <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                      <Instagram className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Connect Meta Accounts</h3>
                  <p className="text-gray-600 mb-6">
                    One login connects both your Facebook pages and Instagram business accounts
                  </p>
                  <div className="w-full bg-gray-200 h-12 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">Requires Bloom Plan</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        }
      >
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
              <Wifi className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              {showReconnectFlow ? (
                <>
                  <h2 className="text-3xl font-bold text-gray-900">Ready to Reconnect?</h2>
                  <p className="text-lg text-gray-600 mt-2 max-w-2xl mx-auto">
                    Your accounts have been disconnected. You can reconnect your Facebook and Instagram accounts anytime to continue managing your social media content.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-gray-900">Connect Your Social Media</h2>
                  <p className="text-lg text-gray-600 mt-2 max-w-2xl mx-auto">
                    Connect your Facebook and Instagram accounts to start scheduling and managing your social media content from one place.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Single Meta Connection Card */}
          <div className="max-w-2xl mx-auto">
            <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center items-center space-x-3 mb-4">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <Facebook className="w-8 h-8 text-white" />
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                    <Instagram className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Connect Meta Accounts</h3>
                <p className="text-gray-600 mb-4">
                  One simple login connects both your Facebook pages and Instagram business accounts
                </p>
                
                {/* Privacy Policy Notice */}
                <div className="mb-6 p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs italic text-muted-foreground text-center">
                    By connecting you agree to our{' '}
                    <a 
                      href="https://brandsinblooms.com/pages/bloomsuite-privacy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Privacy Policy
                    </a>
                    {' '}and{' '}
                    <a 
                      href="https://brandsinblooms.com/pages/terms-of-service" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Terms of Service
                    </a>
                    .
                  </p>
                </div>
                
                <ConnectMetaButton onSuccess={handleConnectionSuccess} />
              </CardContent>
            </Card>
          </div>

          {/* Help Text */}
          <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-800 font-medium">
                    How the connection works:
                  </p>
                  <ol className="text-sm text-amber-700 space-y-1 ml-4 list-decimal">
                    <li>Click "Connect Meta" above</li>
                    <li>Log in with your Facebook account</li>
                    <li>Select the Facebook Pages and Instagram accounts you want to connect</li>
                    <li>Grant the necessary permissions</li>
                    <li>Both platforms will be connected automatically!</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SubscriptionGate>
    );
  }

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Social Media Connections"
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Your Meta Accounts</h2>
          <p className="text-gray-600">
            Manage your Facebook and Instagram connections
          </p>
        </div>

        {/* Connection Status */}
        <div className="max-w-2xl mx-auto">
          <Card className={`border-2 ${bothConnected ? 'border-green-200 bg-green-50' : isConnected ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Facebook className="w-6 h-6 text-white" />
                    </div>
                    <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                      <Instagram className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Meta Platforms</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1">
                        <Facebook className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Facebook</span>
                        {facebookConnection ? (
                          <span className="text-xs text-green-600 font-medium">✓ Connected</span>
                        ) : (
                          <span className="text-xs text-gray-500">Not connected</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Instagram className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Instagram</span>
                        {instagramConnection ? (
                          <span className="text-xs text-green-600 font-medium">✓ Connected</span>
                        ) : (
                          <span className="text-xs text-gray-500">Not connected</span>
                        )}
                      </div>
                    </div>
                    
                    {(facebookConnection || instagramConnection) && (
                      <div className="mt-2 text-xs text-gray-600">
                        {facebookConnection && (
                          <div>Facebook: {facebookConnection.platform_account_name}</div>
                        )}
                        {instagramConnection && (
                          <div>Instagram: {instagramConnection.platform_account_name}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!bothConnected && (
                    <ConnectMetaButton onSuccess={handleConnectionSuccess} />
                  )}
                  {bothConnected && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium text-sm">
                        Both platforms connected!
                      </span>
                      <div className="flex gap-1">
                        {facebookConnection && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnectClick('facebook', facebookConnection.id, 'Facebook')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Disconnect Facebook
                          </Button>
                        )}
                        {instagramConnection && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnectClick('instagram', instagramConnection.id, 'Instagram')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Disconnect Instagram
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!bothConnected && (
          <Card className="max-w-2xl mx-auto border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> The "Connect Meta" button will link both your Facebook pages and Instagram business accounts in one go. 
                You don't need to connect them separately!
              </p>
            </CardContent>
          </Card>
        )}

        <ConfirmationDialog
          open={disconnectDialog.open}
          onOpenChange={(open) => setDisconnectDialog(prev => ({ ...prev, open }))}
          title={`Disconnect ${disconnectDialog.platformName}?`}
          description={`Are you sure you want to disconnect your ${disconnectDialog.platformName} account? You can reconnect it anytime.`}
          confirmText="Disconnect"
          onConfirm={handleDisconnectConfirm}
          loading={disconnecting}
        />
      </div>
    </SubscriptionGate>
  );
};
