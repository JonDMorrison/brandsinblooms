import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';

interface SyncLog {
  id: string;
  connection_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  customers_synced: number;
  products_synced: number;
  orders_synced: number;
  error_message: string | null;
  metadata: any;
  pos_connections: {
    name: string;
    platform: string;
  };
}

export const POSSyncLogs: React.FC = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [connections, setConnections] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchSyncLogs();
    fetchConnections();
    
    // Set up real-time subscription for sync logs
    const channel = supabase
      .channel('sync-logs')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'pos_sync_logs' 
        }, 
        () => {
          fetchSyncLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConnection]);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      // Get user's tenant
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userData) {
        const { data, error } = await supabase
          .from('pos_connections')
          .select('id, name, platform')
          .eq('tenant_id', userData.tenant_id)
          .order('name');

        if (error) throw error;
        setConnections(data || []);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const fetchSyncLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's tenant
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userData) {
        let query = supabase
          .from('pos_sync_logs')
          .select(`
            id,
            connection_id,
            status,
            started_at,
            completed_at,
            customers_synced,
            products_synced:orders_synced,
            orders_synced,
            error_message,
            metadata,
            pos_connections!inner(
              name,
              platform,
              tenant_id
            )
          `)
          .eq('pos_connections.tenant_id', userData.tenant_id)
          .order('started_at', { ascending: false })
          .limit(50);

        if (selectedConnection !== 'all') {
          query = query.eq('connection_id', selectedConnection);
        }

        const { data, error } = await query;

        if (error) throw error;
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">Queued</Badge>;
    }
  };

  const getDuration = (log: SyncLog) => {
    if (!log.completed_at) return 'Running...';
    
    const start = new Date(log.started_at);
    const end = new Date(log.completed_at);
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    return `${duration}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by connection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name} ({conn.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchSyncLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                <h3 className="text-lg font-semibold mb-2">No Sync Logs</h3>
                <p>No synchronization history found for the selected filters.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <h4 className="font-semibold">{log.pos_connections?.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {log.pos_connections?.platform?.toUpperCase()}
                          </Badge>
                          {getStatusBadge(log.status)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{format(new Date(log.started_at), 'MMM dd, yyyy HH:mm')}</p>
                      <p>{formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customers:</span>
                      <p className="font-medium">{log.customers_synced}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Products:</span>
                      <p className="font-medium">{log.products_synced}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Orders:</span>
                      <p className="font-medium">{log.orders_synced}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="font-medium">{getDuration(log)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p className="font-medium capitalize">{log.status}</p>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-600 text-sm font-medium">Error:</p>
                      <p className="text-red-600 text-sm mt-1">{log.error_message}</p>
                    </div>
                  )}

                  {log.metadata && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Additional Details:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {log.metadata.fetched && (
                          <div>
                            <span className="text-muted-foreground">Fetched:</span>
                            <p className="font-medium">{log.metadata.fetched}</p>
                          </div>
                        )}
                        {log.metadata.upserted && (
                          <div>
                            <span className="text-muted-foreground">Upserted:</span>
                            <p className="font-medium">{log.metadata.upserted}</p>
                          </div>
                        )}
                        {log.metadata.skipped && (
                          <div>
                            <span className="text-muted-foreground">Skipped:</span>
                            <p className="font-medium">{log.metadata.skipped}</p>
                          </div>
                        )}
                        {log.metadata.final_cursor && (
                          <div>
                            <span className="text-muted-foreground">Cursor:</span>
                            <p className="font-medium text-xs truncate">{log.metadata.final_cursor}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};