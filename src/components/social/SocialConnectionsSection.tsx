
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
      <div className="relative">
        {/* Gradient Hero Header */}
        <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50/30 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl overflow-hidden mb-8">
          {/* Decorative Background Pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5">
              <Wifi className="w-64 h-64 text-gray-400" />
            </div>
          </div>
          
          {/* Header Content */}
          <div className="relative z-10 p-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                <Facebook className="w-8 h-8 text-white" />
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl shadow-lg">
                <Instagram className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent mb-3">
              Meta Platforms
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Manage your Facebook and Instagram connections with enterprise-grade security and seamless integration
            </p>
            
            {/* Status Badge */}
            {bothConnected && (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 backdrop-blur-sm border border-emerald-200/50 rounded-full text-emerald-700 font-medium mt-4 shadow-lg">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-pulse shadow-sm"></div>
                All platforms connected
              </div>
            )}
          </div>
        </div>

        {/* Individual Platform Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Facebook Card */}
          <div className={`group relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
            facebookConnection ? 'ring-2 ring-blue-500/20' : ''
          }`}>
            {/* Card Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Platform Header */}
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Facebook className="w-8 h-8 text-white" />
                  </div>
                  {facebookConnection && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full border-3 border-white flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">Facebook</h3>
                  <p className="text-slate-600">Connect your Facebook pages</p>
                </div>
              </div>
              
              {/* Connection Status */}
              <div className={`px-4 py-2 rounded-xl font-medium text-sm backdrop-blur-sm transition-all duration-300 ${
                facebookConnection 
                  ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50' 
                  : 'bg-slate-100/80 text-slate-600 border border-slate-200/50'
              }`}>
                {facebookConnection ? 'Connected' : 'Not Connected'}
              </div>
            </div>
            
            {/* Account Details */}
            {facebookConnection && (
              <div className="relative z-10 mb-6 p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30">
                <p className="text-sm text-slate-500 mb-1">Connected Account</p>
                <p className="font-semibold text-slate-800">{facebookConnection.platform_account_name}</p>
              </div>
            )}
            
            {/* Actions */}
            <div className="relative z-10 flex gap-3">
              {!facebookConnection && !bothConnected && (
                <ConnectMetaButton onSuccess={handleConnectionSuccess} />
              )}
              
              {facebookConnection && (
                <Button
                  variant="outline"
                  onClick={() => handleDisconnectClick('facebook', facebookConnection.id, 'Facebook')}
                  className="group/btn bg-white/80 backdrop-blur-sm border-red-200/50 text-red-600 hover:bg-red-50/80 hover:border-red-300 hover:text-red-700 transition-all duration-300 hover:shadow-lg"
                >
                  <Facebook className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Instagram Card */}
          <div className={`group relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
            instagramConnection ? 'ring-2 ring-purple-500/20' : ''
          }`}>
            {/* Card Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-orange-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Platform Header */}
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Instagram className="w-8 h-8 text-white" />
                  </div>
                  {instagramConnection && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full border-3 border-white flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">Instagram</h3>
                  <p className="text-slate-600">Connect your Instagram business</p>
                </div>
              </div>
              
              {/* Connection Status */}
              <div className={`px-4 py-2 rounded-xl font-medium text-sm backdrop-blur-sm transition-all duration-300 ${
                instagramConnection 
                  ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50' 
                  : 'bg-slate-100/80 text-slate-600 border border-slate-200/50'
              }`}>
                {instagramConnection ? 'Connected' : 'Not Connected'}
              </div>
            </div>
            
            {/* Account Details */}
            {instagramConnection && (
              <div className="relative z-10 mb-6 p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30">
                <p className="text-sm text-slate-500 mb-1">Connected Account</p>
                <p className="font-semibold text-slate-800">{instagramConnection.platform_account_name}</p>
              </div>
            )}
            
            {/* Actions */}
            <div className="relative z-10 flex gap-3">
              {!instagramConnection && !bothConnected && (
                <ConnectMetaButton onSuccess={handleConnectionSuccess} />
              )}
              
              {instagramConnection && (
                <Button
                  variant="outline"
                  onClick={() => handleDisconnectClick('instagram', instagramConnection.id, 'Instagram')}
                  className="group/btn bg-white/80 backdrop-blur-sm border-red-200/50 text-red-600 hover:bg-red-50/80 hover:border-red-300 hover:text-red-700 transition-all duration-300 hover:shadow-lg"
                >
                  <Instagram className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </div>

        {!bothConnected && (
          <Card className="max-w-2xl mx-auto mt-8 border-blue-200/50 bg-gradient-to-r from-blue-50/80 to-sky-50/60 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-blue-500/20 to-sky-500/10">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <span className="font-semibold">Pro Tip:</span> The "Connect Meta" button will seamlessly link both your Facebook pages and Instagram business accounts in one streamlined process. You don't need to connect them separately!
                  </p>
                </div>
              </div>
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
