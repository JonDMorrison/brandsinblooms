
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
    return null;
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
