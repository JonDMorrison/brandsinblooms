import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, Settings, Globe, Mail, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DataSource {
  id: string;
  name: string;
  icon: React.ElementType;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  description: string;
}

interface DataSourceManagerProps {
  gaConnected?: boolean;
  onSyncComplete?: () => void;
  syncing?: boolean;
}

export const DataSourceManager = ({
  gaConnected = false,
  onSyncComplete,
  syncing = false
}: DataSourceManagerProps) => {
  const dataSources: DataSource[] = [
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      icon: Globe,
      status: gaConnected ? 'connected' : 'disconnected',
      lastSync: gaConnected ? '2 minutes ago' : undefined,
      description: 'Website traffic and visitor behavior'
    },
    {
      id: 'social-media',
      name: 'Social Media',
      icon: Share2,
      status: 'connected',
      lastSync: '5 minutes ago',
      description: 'Facebook, Instagram, and other platforms'
    },
    {
      id: 'email-crm',
      name: 'Email & CRM',
      icon: Mail,
      status: 'connected',
      lastSync: '1 minute ago',
      description: 'Customer data and email campaigns'
    }
  ];

  const handleSyncAll = async () => {
    try {
      toast.info("Syncing all data sources...");
      
      const { error } = await supabase.functions.invoke('sync-analytics');
      
      if (error) {
        throw error;
      }
      
      toast.success("All data sources synced successfully");
      onSyncComplete?.();
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error("Failed to sync data sources");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Setup Required
          </Badge>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'border-l-green-500';
      case 'error': return 'border-l-red-500';
      default: return 'border-l-yellow-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Sources</h2>
          <p className="text-muted-foreground">Manage your analytics integrations</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {dataSources.map((source) => {
          const Icon = source.icon;
          
          return (
            <Card 
              key={source.id}
              className={`border-l-4 transition-all hover:shadow-md ${getStatusColor(source.status)}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{source.name}</CardTitle>
                  </div>
                  {getStatusBadge(source.status)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  {source.description}
                </p>
                
                {source.lastSync && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Last sync: {source.lastSync}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => toast.info(`Syncing ${source.name}...`)}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {!source.lastSync && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => toast.info(`Setting up ${source.name}...`)}
                  >
                    Setup Integration
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sync Status */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <RefreshCw className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Automatic Data Refresh</p>
                <p className="text-sm text-muted-foreground">
                  Your data is automatically updated every 15 minutes
                </p>
              </div>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};