import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Store, Activity, History } from 'lucide-react';
import { POSPlatformPicker } from './POSPlatformPicker';
import { POSConnectionList } from './POSConnectionList';
import { POSSyncLogs } from './POSSyncLogs';
import { usePOSConnections } from '@/hooks/usePOSConnections';

export const POSIntegrationHub: React.FC = () => {
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const { connections, isLoading } = usePOSConnections();

  const activeConnections = connections?.filter(c => c.is_active) || [];
  const totalSyncs = connections?.reduce((acc, c) => acc + (c.last_sync_at ? 1 : 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Point of Sale systems to sync customer data with BloomSuite
          </p>
        </div>
        <Button 
          onClick={() => setShowPlatformPicker(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add POS Connection
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeConnections.length}</div>
            <p className="text-xs text-muted-foreground">
              {connections?.length || 0} total connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSyncs}</div>
            <p className="text-xs text-muted-foreground">
              Successful data syncs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={activeConnections.some(c => c.sync_status === 'error') ? 'destructive' : 'default'}>
                {activeConnections.some(c => c.sync_status === 'error') ? 'Issues' : 'Healthy'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall system status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="connections" className="w-full">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <POSConnectionList />
        </TabsContent>

        <TabsContent value="logs">
          <POSSyncLogs />
        </TabsContent>
      </Tabs>

      {/* Platform Picker Modal */}
      {showPlatformPicker && (
        <POSPlatformPicker 
          onSelect={() => setShowPlatformPicker(false)}
          onCancel={() => setShowPlatformPicker(false)}
        />
      )}
    </div>
  );
};