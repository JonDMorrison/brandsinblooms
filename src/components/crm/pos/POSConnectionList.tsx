import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw, Trash2, Play } from 'lucide-react';
import { usePOSConnections } from '@/hooks/usePOSConnections';
import { formatDistanceToNow } from 'date-fns';

export const POSConnectionList: React.FC = () => {
  const { connections, isLoading, isSyncing, runSync, disconnectPOS } = usePOSConnections();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">No POS Connections</h3>
            <p>Connect your first Point of Sale system to get started with customer data sync.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (connection: any) => {
    if (!connection.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    switch (connection.sync_status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge variant="secondary">Syncing...</Badge>;
      default:
        return <Badge variant="outline">Not Synced</Badge>;
    }
  };

  const getStatusIcon = (connection: any) => {
    if (!connection.is_active) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    
    switch (connection.sync_status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <Card key={connection.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(connection)}
                <div>
                  <CardTitle className="text-lg">{connection.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {connection.platform.toUpperCase()}
                    </Badge>
                    {getStatusBadge(connection)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runSync(connection.id)}
                  disabled={isSyncing || connection.sync_status === 'running'}
                  className="flex items-center gap-2"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectPOS(connection.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Last Sync:</span>
                <p className="font-medium">
                  {connection.last_sync_at 
                    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
                    : 'Never'
                  }
                </p>
              </div>
              
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium capitalize">
                  {connection.sync_status || 'Not started'}
                </p>
              </div>
              
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(connection.created_at), { addSuffix: true })}
                </p>
              </div>
              
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <p className="font-medium capitalize">{connection.platform}</p>
              </div>
            </div>

            {/* Sync Log Summary */}
            {connection.sync_status && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Connection Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className="font-medium capitalize">{connection.sync_status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Sync:</span>
                    <p className="font-medium">
                      {connection.last_sync_at 
                        ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Platform:</span>
                    <p className="font-medium capitalize">{connection.platform}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};