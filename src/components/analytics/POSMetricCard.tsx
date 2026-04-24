import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { CheckCircle, AlertCircle, RefreshCw, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SyncStatus = 'synced' | 'needs-sync' | 'not-connected';

interface POSMetricCardProps {
  title: string;
  value: string;
  changeLabel: string;
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  syncStatus: SyncStatus;
  lastSyncedAt?: string | null;
  syncAction?: 'loyalty' | 'sales' | 'customers';
  onSyncComplete?: () => void;
}

export const POSMetricCard = ({
  title,
  value,
  changeLabel,
  icon: Icon,
  priority,
  syncStatus,
  lastSyncedAt,
  syncAction,
  onSyncComplete
}: POSMetricCardProps) => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-primary';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      default: return 'border-l-4 border-l-muted';
    }
  };

  const getLastSyncLabel = () => {
    if (!lastSyncedAt) return null;
    const syncDate = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleSync = async () => {
    if (!syncAction) return;
    
    setSyncing(true);
    try {
      let functionName = '';
      switch (syncAction) {
        case 'loyalty':
          functionName = 'square-loyalty-backfill';
          break;
        case 'sales':
          functionName = 'square-sync-sales';
          break;
        case 'customers':
          functionName = 'square-sync-customers';
          break;
      }
      
      const { error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      
      toast.success(`${title} data synced successfully`);
      onSyncComplete?.();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(`Failed to sync ${title.toLowerCase()}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectPOS = () => {
    navigate('/integrations/pos');
  };

  const renderStatusIndicator = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>Synced</span>
          </div>
        );
      case 'needs-sync':
        return (
          <Badge variant="outline" className="text-xs gap-1 border-yellow-500 text-yellow-700">
            <AlertCircle className="h-3 w-3" />
            Sync Required
          </Badge>
        );
      case 'not-connected':
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <Plug className="h-3 w-3" />
            Connect POS
          </Badge>
        );
    }
  };

  const renderAction = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <span>{getLastSyncLabel() ? `Last synced ${getLastSyncLabel()}` : changeLabel}</span>
            {syncAction && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              </Button>
            )}
          </div>
        );
      case 'needs-sync':
        return (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </>
            )}
          </Button>
        );
      case 'not-connected':
        return (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={handleConnectPOS}
          >
            <Plug className="h-3 w-3 mr-1" />
            Connect POS →
          </Button>
        );
    }
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", getPriorityBorder(priority))}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {renderStatusIndicator()}
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-1">
          {syncStatus === 'not-connected' ? '--' : value}
        </div>
        {renderAction()}
      </CardContent>
    </Card>
  );
};