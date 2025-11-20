import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface OAuthCodeUsage {
  id: string;
  user_id: string;
  code_hash: string;
  used_at: string;
  created_at: string;
}

interface UserConnection {
  platform: string;
  platform_account_name: string;
  is_active: boolean;
}

interface OAuthDebugEntry {
  codeUsage: OAuthCodeUsage;
  userEmail: string;
  connections: UserConnection[];
  isStale: boolean;
}

export const OAuthDebugPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<OAuthDebugEntry[]>([]);
  const [cleaningUp, setCleaningUp] = useState<string | null>(null);

  const loadOAuthData = async () => {
    setLoading(true);
    try {
      // Fetch all OAuth code usage (last 100)
      const { data: codeUsages, error: codeError } = await supabase
        .from('oauth_code_usage')
        .select('*')
        .order('used_at', { ascending: false })
        .limit(100);

      if (codeError) throw codeError;

      if (!codeUsages || codeUsages.length === 0) {
        setEntries([]);
        return;
      }

      // Fetch user emails and connections for each code usage
      const enrichedEntries: OAuthDebugEntry[] = [];

      for (const usage of codeUsages) {
        // Get user email from auth
        const { data: { user } } = await supabase.auth.admin.getUserById(usage.user_id);
        const userEmail = user?.email || 'Unknown';

        // Get user's social connections
        const { data: connections } = await supabase
          .from('social_connections')
          .select('platform, platform_account_name, is_active')
          .eq('user_id', usage.user_id)
          .in('platform', ['facebook', 'instagram']);

        // Determine if this is a stale entry (>10 min old with no active connections)
        const ageMinutes = (Date.now() - new Date(usage.used_at).getTime()) / 60000;
        const hasActiveConnections = connections?.some(c => c.is_active) || false;
        const isStale = ageMinutes > 10 && !hasActiveConnections;

        enrichedEntries.push({
          codeUsage: usage,
          userEmail,
          connections: connections || [],
          isStale
        });
      }

      setEntries(enrichedEntries);
    } catch (error) {
      console.error('❌ Error loading OAuth debug data:', error);
      toast.error('Failed to load OAuth data');
    } finally {
      setLoading(false);
    }
  };

  const cleanupStaleEntry = async (userId: string, codeUsageId: string) => {
    setCleaningUp(codeUsageId);
    try {
      const { error } = await supabase
        .from('oauth_code_usage')
        .delete()
        .eq('id', codeUsageId);

      if (error) throw error;

      toast.success('Stale OAuth entry cleaned up');
      await loadOAuthData(); // Refresh
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      toast.error('Failed to clean up entry');
    } finally {
      setCleaningUp(null);
    }
  };

  useEffect(() => {
    loadOAuthData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">OAuth Debug Panel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage OAuth authorization attempts
          </p>
        </div>
        <Button onClick={loadOAuthData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No OAuth attempts found
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.codeUsage.id}
              className={`p-4 rounded-lg border ${
                entry.isStale
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.userEmail}</span>
                    {entry.isStale && (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        Stale
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium">Code Hash:</span>{' '}
                      {entry.codeUsage.code_hash.substring(0, 12)}...
                    </div>
                    <div>
                      <span className="font-medium">Used:</span>{' '}
                      {formatDistanceToNow(new Date(entry.codeUsage.used_at), { addSuffix: true })}
                    </div>
                    <div>
                      <span className="font-medium">Connections:</span>{' '}
                      {entry.connections.length === 0 ? (
                        <span className="text-red-600 dark:text-red-400">None (Failed)</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          {entry.connections.map(c => `${c.platform} (${c.platform_account_name})`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {entry.isStale && (
                  <Button
                    onClick={() => cleanupStaleEntry(entry.codeUsage.user_id, entry.codeUsage.id)}
                    disabled={cleaningUp === entry.codeUsage.id}
                    variant="outline"
                    size="sm"
                    className="border-yellow-300 dark:border-yellow-700"
                  >
                    {cleaningUp === entry.codeUsage.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clean Up
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 rounded-lg bg-muted/50">
        <h3 className="font-medium mb-2">Legend</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Stale:</strong> OAuth attempt older than 10 minutes with no successful connections</li>
          <li>• <strong>Clean Up:</strong> Remove stale entries to allow users to retry connection</li>
          <li>• <strong>Connections:</strong> Shows if the OAuth flow successfully created social media connections</li>
        </ul>
      </div>
    </Card>
  );
};
