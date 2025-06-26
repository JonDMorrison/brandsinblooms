
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface SocialConnectionStatusProps {
  connections: any[];
  onConnectPlatform: (platform: string) => void;
  onRefreshConnections: () => void;
}

export const SocialConnectionStatus: React.FC<SocialConnectionStatusProps> = ({
  connections,
  onConnectPlatform,
  onRefreshConnections
}) => {
  const facebookConnection = connections.find(conn => conn.platform === 'facebook');
  const instagramConnection = connections.find(conn => conn.platform === 'instagram');

  const isConnectionExpired = (connection: any) => {
    return connection && connection.expires_at && new Date(connection.expires_at) < new Date();
  };

  if (connections.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-yellow-800">Connect Social Media</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Connect your Facebook and Instagram accounts to start posting content directly.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onConnectPlatform('facebook')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Connect Facebook
              </Button>
              <Button
                size="sm"
                onClick={() => onConnectPlatform('instagram')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                Connect Instagram
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Connected Accounts</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefreshConnections}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>
      
      <div className="flex gap-2 flex-wrap">
        {facebookConnection && (
          <Badge
            variant={isConnectionExpired(facebookConnection) ? "destructive" : "default"}
            className="flex items-center gap-1"
          >
            {isConnectionExpired(facebookConnection) ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            Facebook
            {isConnectionExpired(facebookConnection) ? ' (Expired)' : ' Connected'}
          </Badge>
        )}
        
        {instagramConnection && (
          <Badge
            variant={isConnectionExpired(instagramConnection) ? "destructive" : "default"}
            className="flex items-center gap-1"
          >
            {isConnectionExpired(instagramConnection) ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            Instagram
            {isConnectionExpired(instagramConnection) ? ' (Expired)' : ' Connected'}
          </Badge>
        )}
        
        {!facebookConnection && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConnectPlatform('facebook')}
            className="text-xs"
          >
            + Facebook
          </Button>
        )}
        
        {!instagramConnection && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConnectPlatform('instagram')}
            className="text-xs"
          >
            + Instagram
          </Button>
        )}
      </div>
    </div>
  );
};
