import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Zap,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { ImportProgressDialog } from '@/components/integrations/ImportProgressDialog';

type SupportedProvider = 'mailchimp' | 'klaviyo' | 'constant_contact';

interface ProviderConfig {
  id: SupportedProvider;
  label: string;
  description: string;
  icon: typeof Mail;
  fetchListsFn: string;
  importFn: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'mailchimp',
    label: 'Mailchimp',
    description: 'Sync contacts from your Mailchimp audiences and segments.',
    icon: Send,
    fetchListsFn: 'mailchimp-fetch-lists',
    importFn: 'mailchimp-import',
  },
  {
    id: 'klaviyo',
    label: 'Klaviyo',
    description: 'Sync contacts from your Klaviyo lists and segments.',
    icon: Zap,
    fetchListsFn: 'klaviyo-fetch-lists',
    importFn: 'klaviyo-import',
  },
  {
    id: 'constant_contact',
    label: 'Constant Contact',
    description: 'Sync contacts from your Constant Contact lists.',
    icon: Mail,
    fetchListsFn: 'constant-contact-fetch-lists',
    importFn: 'constant-contact-import',
  },
];

interface SyncFromCRMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete?: () => void;
}

function extractListIds(fetchListsResponse: unknown): string[] {
  if (!fetchListsResponse || typeof fetchListsResponse !== 'object') return [];
  const lists = (fetchListsResponse as { lists?: unknown }).lists;
  if (!Array.isArray(lists)) return [];
  return lists
    .map((list) => {
      if (!list || typeof list !== 'object') return null;
      const id = (list as { id?: unknown }).id;
      return typeof id === 'string' && id.length > 0 ? id : null;
    })
    .filter((id): id is string => id !== null);
}

export function SyncFromCRMModal({
  open,
  onOpenChange,
  onSyncComplete,
}: SyncFromCRMModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [syncingProvider, setSyncingProvider] = useState<SupportedProvider | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  const connectionsQuery = useQuery({
    queryKey: ['sync-from-crm-connections', tenant?.id ?? null, user?.id ?? null],
    enabled: Boolean(open && tenant?.id && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_connections')
        .select('provider, status, provider_account_name')
        .eq('tenant_id', tenant!.id)
        .eq('user_id', user!.id)
        .in('provider', ['mailchimp', 'klaviyo', 'constant_contact'])
        .eq('status', 'connected')
        .is('revoked_at', null);

      if (error) throw error;

      const byProvider: Record<string, { accountName: string | null }> = {};
      for (const row of data ?? []) {
        byProvider[row.provider] = {
          accountName: (row as { provider_account_name: string | null }).provider_account_name,
        };
      }
      return byProvider;
    },
  });

  const connectionMap = connectionsQuery.data ?? {};
  const isLoadingConnections = connectionsQuery.isLoading;

  const providerStatuses = useMemo(
    () =>
      PROVIDERS.map((provider) => ({
        ...provider,
        isConnected: Boolean(connectionMap[provider.id]),
        accountName: connectionMap[provider.id]?.accountName ?? null,
      })),
    [connectionMap],
  );

  const handleConnect = () => {
    onOpenChange(false);
    navigate('/integrations/crm');
  };

  const handleSync = async (provider: ProviderConfig) => {
    if (!user?.id || !tenant?.id) {
      toast({
        title: 'Session loading',
        description: 'Your session is still loading. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setSyncingProvider(provider.id);

    try {
      // 1. Fetch available lists from the provider
      const { data: listsData, error: listsError } = await supabase.functions.invoke(
        provider.fetchListsFn,
      );
      if (listsError) throw listsError;
      if ((listsData as { error?: string })?.error) {
        throw new Error((listsData as { error: string }).error);
      }

      const listIds = extractListIds(listsData);
      if (listIds.length === 0) {
        toast({
          title: 'No lists to sync',
          description: `No contact lists were found in your ${provider.label} account.`,
          variant: 'destructive',
        });
        return;
      }

      // 2. Create an import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          provider: provider.id,
          status: 'pending',
          config: { listIds, segmentIds: [] },
        })
        .select('id')
        .single();

      if (jobError || !job) {
        throw jobError ?? new Error('Could not create import job');
      }

      const jobId = String((job as { id: string | number }).id);

      // 3. Invoke the provider-specific import function
      const importBody =
        provider.id === 'constant_contact'
          ? { listIds, importJobId: jobId }
          : { jobId };

      const { error: invokeError } = await supabase.functions.invoke(provider.importFn, {
        body: importBody,
      });
      if (invokeError) throw invokeError;

      // 4. Hand off to the shared progress dialog
      setActiveJobId(jobId);
      setProgressOpen(true);
    } catch (err) {
      toast({
        title: `${provider.label} sync failed`,
        description: err instanceof Error ? err.message : 'Unknown error starting sync.',
        variant: 'destructive',
      });
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleProgressClose = () => {
    setProgressOpen(false);
    setActiveJobId(null);
  };

  const handleProgressComplete = () => {
    toast({
      title: 'Sync complete',
      description: 'Your contacts have been imported from the connected CRM.',
    });
    onSyncComplete?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync From CRM
            </DialogTitle>
            <DialogDescription>
              Pull contacts from a connected marketing platform into BloomSuite.
              Not seeing your provider? Connect it under Integrations first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {isLoadingConnections ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking connections...
              </div>
            ) : (
              providerStatuses.map((provider) => {
                const Icon = provider.icon;
                const isSyncingThis = syncingProvider === provider.id;
                const isSyncingOther =
                  syncingProvider !== null && syncingProvider !== provider.id;

                return (
                  <Card key={provider.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{provider.label}</p>
                          {provider.isConnected ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not connected</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {provider.isConnected && provider.accountName
                            ? provider.accountName
                            : provider.description}
                        </p>
                      </div>

                      {provider.isConnected ? (
                        <Button
                          size="sm"
                          onClick={() => handleSync(provider)}
                          disabled={isSyncingThis || isSyncingOther}
                        >
                          {isSyncingThis ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sync Contacts
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={handleConnect}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        jobId={activeJobId}
        open={progressOpen}
        onClose={handleProgressClose}
        onComplete={handleProgressComplete}
      />
    </>
  );
}

export default SyncFromCRMModal;
