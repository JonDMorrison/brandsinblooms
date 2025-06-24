
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialConnectionCard } from './SocialConnectionCard';
import { ConnectMetaButton } from './ConnectMetaButton';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { AlertCircle, Wifi } from 'lucide-react';

interface SocialConnectionsSectionProps {
  connections: any[];
  onConnectionSuccess: () => void;
}

export const SocialConnectionsSection: React.FC<SocialConnectionsSectionProps> = ({
  connections,
  onConnectionSuccess
}) => {
  const facebookConnection = connections.find(conn => conn.platform === 'facebook');
  const instagramConnection = connections.find(conn => conn.platform === 'instagram');

  if (connections.length === 0) {
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

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto opacity-50">
              <SocialConnectionCard
                platform="facebook"
                isConnected={false}
                onConnect={() => {}}
                disabled={true}
              />
              <SocialConnectionCard
                platform="instagram"
                isConnected={false}
                onConnect={() => {}}
                disabled={true}
              />
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
              <h2 className="text-3xl font-bold text-gray-900">Connect Your Social Media</h2>
              <p className="text-lg text-gray-600 mt-2 max-w-2xl mx-auto">
                Connect your Facebook and Instagram accounts to start scheduling and managing your social media content from one place.
              </p>
            </div>
          </div>

          {/* Connection Cards with Connect Button */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <SocialConnectionCard
              platform="facebook"
              isConnected={false}
              onConnect={() => {}}
              connectButton={<ConnectMetaButton onSuccess={onConnectionSuccess} />}
            />
            <SocialConnectionCard
              platform="instagram"
              isConnected={false}
              onConnect={() => {}}
              connectButton={<ConnectMetaButton onSuccess={onConnectionSuccess} />}
            />
          </div>

          {/* Help Text */}
          <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-800 font-medium">
                    How to connect your accounts:
                  </p>
                  <ol className="text-sm text-amber-700 space-y-1 ml-4 list-decimal">
                    <li>Click "Connect Meta" above</li>
                    <li>Log in with your Facebook account</li>
                    <li>Select the Facebook Pages and Instagram accounts you want to connect</li>
                    <li>Grant the necessary permissions</li>
                    <li>Start creating and scheduling your content!</li>
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
          <h2 className="text-2xl font-bold text-gray-900">Your Connected Accounts</h2>
          <p className="text-gray-600">
            Manage your social media connections
          </p>
        </div>

        {/* Connection Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <SocialConnectionCard
            platform="facebook"
            isConnected={!!facebookConnection}
            accountName={facebookConnection?.platform_account_name}
            onConnect={() => {}}
            connectButton={!facebookConnection ? <ConnectMetaButton onSuccess={onConnectionSuccess} /> : undefined}
          />
          <SocialConnectionCard
            platform="instagram"
            isConnected={!!instagramConnection}
            accountName={instagramConnection?.platform_account_name}
            onConnect={() => {}}
            connectButton={!instagramConnection ? <ConnectMetaButton onSuccess={onConnectionSuccess} /> : undefined}
          />
        </div>
      </div>
    </SubscriptionGate>
  );
};
