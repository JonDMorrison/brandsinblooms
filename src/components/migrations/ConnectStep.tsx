import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useMigrationJobs } from '@/hooks/useMigrationJobs';

const APP_ORIGIN = window.location.origin;

type Provider = 'mailchimp' | 'klaviyo' | 'constant_contact';

interface ConnectStepProps {
  onComplete: () => void;
}

export const ConnectStep = ({ onComplete }: ConnectStepProps) => {
  const { toast } = useToast();
  const { activeJobs } = useMigrationJobs();
  const [mailchimpStatus, setMailchimpStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [klaviyoStatus, setKlaviyoStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [constantContactStatus, setConstantContactStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [mailchimpAccount, setMailchimpAccount] = useState<any>(null);
  const [klaviyoAccount, setKlaviyoAccount] = useState<any>(null);
  const [constantContactAccount, setConstantContactAccount] = useState<any>(null);
  const popupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentProviderRef = useRef<Provider | null>(null);
  // IMPROVEMENT: Grace period timeout ref for popup close detection
  const popupCloseGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Check if there are active imports
  const hasActiveMailchimpImport = activeJobs.some(job => 
    job.source_platform === 'mailchimp' && job.status === 'running'
  );
  const hasActiveKlaviyoImport = activeJobs.some(job => 
    job.source_platform === 'klaviyo' && job.status === 'running'
  );
  const hasActiveConstantContactImport = activeJobs.some(job => 
    job.source_platform === 'constant_contact' && job.status === 'running'
  );

  // Load existing connections on mount
  useEffect(() => {
    refreshConnections();
  }, []);

  // Cleanup popup monitoring on unmount
  useEffect(() => {
    return () => {
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }
      if (popupCloseGraceRef.current) {
        clearTimeout(popupCloseGraceRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  // Listen for OAuth postMessage
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== APP_ORIGIN) return;
      const { type, provider, message, error } = e.data || {};
      
      // Check if this message is for the current provider
      if (provider !== currentProviderRef.current) return;

      console.log(`📨 OAuth message received:`, { type, provider, message, error });

      // Clear popup monitoring and grace period timeout
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }
      // IMPROVEMENT: Clear grace period timeout if postMessage arrives during the window
      if (popupCloseGraceRef.current) {
        clearTimeout(popupCloseGraceRef.current);
        popupCloseGraceRef.current = null;
      }

      const setStatus = provider === 'mailchimp' 
        ? setMailchimpStatus 
        : provider === 'klaviyo' 
          ? setKlaviyoStatus 
          : setConstantContactStatus;

      if (type === 'oauth-success') {
        console.log('✅ OAuth success received:', message);
        // Close popup
        try { popupRef.current?.close(); } catch {}
        popupRef.current = null;
        currentProviderRef.current = null;
        
        // Refresh connection state
        refreshConnections();
        
        // Show success toast
        const providerName = provider === 'mailchimp' ? 'Mailchimp' 
          : provider === 'klaviyo' ? 'Klaviyo' 
          : 'Constant Contact';
        toast({
          title: 'Connected!',
          description: `${providerName} connected successfully`,
        });
        
        // Advance wizard
        onComplete();
      }
      
      if (type === 'oauth-error') {
        console.error('❌ OAuth error received:', error);
        const providerName = provider === 'mailchimp' ? 'Mailchimp' 
          : provider === 'klaviyo' ? 'Klaviyo' 
          : 'Constant Contact';
        toast({
          title: 'Connection Failed',
          description: error || `${providerName} connection failed`,
          variant: 'destructive'
        });
        setStatus('error');
        try { popupRef.current?.close(); } catch {}
        popupRef.current = null;
        currentProviderRef.current = null;
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [toast, onComplete]);

  // IMPROVEMENT: Fallback connection check — query DB to sync UI with actual connection state
  // Runs on mount and after every OAuth flow, so the UI is always in sync with reality
  // regardless of whether postMessage fired
  const refreshConnections = async () => {
    try {
      const { data: connections } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('status', 'connected')
        .in('provider', ['mailchimp', 'klaviyo', 'constant_contact']);

      const mailchimp = connections?.find(c => c.provider === 'mailchimp');
      const klaviyo = connections?.find(c => c.provider === 'klaviyo');
      const constantContact = connections?.find(c => c.provider === 'constant_contact');

      if (mailchimp) {
        setMailchimpStatus('connected');
        setMailchimpAccount(mailchimp.metadata);
        // If this was the provider we were connecting, clear the ref so grace period doesn't cancel
        if (currentProviderRef.current === 'mailchimp') {
          currentProviderRef.current = null;
        }
      }
      if (klaviyo) {
        setKlaviyoStatus('connected');
        setKlaviyoAccount(klaviyo.metadata);
        if (currentProviderRef.current === 'klaviyo') {
          currentProviderRef.current = null;
        }
      }
      if (constantContact) {
        setConstantContactStatus('connected');
        setConstantContactAccount(constantContact.metadata);
        if (currentProviderRef.current === 'constant_contact') {
          currentProviderRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error refreshing connections:', error);
    }
  };

  const handleConnect = async (provider: Provider) => {
    const setStatus = provider === 'mailchimp' 
      ? setMailchimpStatus 
      : provider === 'klaviyo' 
        ? setKlaviyoStatus 
        : setConstantContactStatus;
    setStatus('connecting');
    currentProviderRef.current = provider;

    try {
      // Refresh session to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !session) {
        throw new Error('Your session has expired. Please refresh the page and log in again.');
      }

      // Request OAuth URL with refreshed auth token
      const { data, error } = await supabase.functions.invoke('oauth-authorize', {
        body: { provider }
      });

      if (error) throw error;

      if (data.error) {
        // Handle missing credentials gracefully
        toast({
          title: 'Configuration Needed',
          description: data.message || `Please configure ${provider} OAuth credentials`,
          variant: 'destructive'
        });
        setStatus('error');
        currentProviderRef.current = null;
        return;
      }

      const authUrl = data.authUrl;
      if (!authUrl) {
        throw new Error('Failed to get authorization URL');
      }

      console.log(`🔗 Opening ${provider} OAuth popup:`, authUrl);
      
      // Open OAuth popup
      const width = 520;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      popupRef.current = window.open(
        authUrl,
        `oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popupRef.current || popupRef.current.closed) {
        throw new Error('Failed to open OAuth popup. Please check your popup blocker settings.');
      }

      console.log(`✅ Popup opened successfully for ${provider}`);

      // Start monitoring the popup
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }

      // IMPROVEMENT: Add 1500ms grace period before treating popup close as cancellation
      // This allows time for the postMessage to arrive after the popup navigates and closes
      popupCheckIntervalRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          console.log(`🪟 Popup was closed for ${provider}, starting grace period`);
          clearInterval(popupCheckIntervalRef.current!);
          popupCheckIntervalRef.current = null;

          // Wait 1500ms before treating as cancellation — postMessage may still arrive
          popupCloseGraceRef.current = setTimeout(() => {
            // Only show cancellation if we didn't receive a success/error message during grace period
            if (currentProviderRef.current === provider) {
              console.log(`⚠️ Grace period expired without OAuth message for ${provider}, checking DB`);
              // IMPROVEMENT: Fallback connection check — query DB before declaring cancellation
              refreshConnections().then(() => {
                // Re-check after refresh — if status updated to connected, don't show cancel
                const statusGetter = provider === 'mailchimp' ? mailchimpStatus
                  : provider === 'klaviyo' ? klaviyoStatus
                  : constantContactStatus;
                if (currentProviderRef.current === provider) {
                  const providerName = provider === 'mailchimp' ? 'Mailchimp'
                    : provider === 'klaviyo' ? 'Klaviyo'
                    : 'Constant Contact';
                  toast({
                    title: 'Connection Cancelled',
                    description: `You closed the ${providerName} authorization window`,
                  });
                  setStatus('idle');
                  currentProviderRef.current = null;
                }
              });
            }
            popupCloseGraceRef.current = null;
          }, 1500);

          popupRef.current = null;
        }
      }, 500);

    } catch (error: any) {
      console.error('❌ Connect error:', error);
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive'
      });
      setStatus('error');
      currentProviderRef.current = null;
      
      // Clean up popup monitoring
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    const setStatus = provider === 'mailchimp' 
      ? setMailchimpStatus 
      : provider === 'klaviyo' 
        ? setKlaviyoStatus 
        : setConstantContactStatus;
    const setAccount = provider === 'mailchimp' 
      ? setMailchimpAccount 
      : provider === 'klaviyo' 
        ? setKlaviyoAccount 
        : setConstantContactAccount;
    
    try {
      setStatus('connecting'); // Show loading state

      // Call appropriate revoke-token edge function
      const revokeFunction = provider === 'constant_contact' 
        ? 'constant-contact-revoke-token' 
        : 'mailchimp-revoke-token';
      
      const { data, error } = await supabase.functions.invoke(revokeFunction, {
        body: { provider }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message);

      setStatus('idle');
      setAccount(null);

      toast({
        title: 'Disconnected',
        description: data?.message || `Successfully disconnected from ${provider}`
      });
    } catch (error: any) {
      console.error('Disconnect error:', error);
      setStatus('error');
      toast({
        title: 'Disconnect Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const canProceed = mailchimpStatus === 'connected' || klaviyoStatus === 'connected' || constantContactStatus === 'connected';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Connect Your Provider</h2>
        <p className="text-muted-foreground">
          Connect to Mailchimp, Klaviyo, or Constant Contact to begin importing your contacts, segments, and tags.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Mailchimp */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Mailchimp</h3>
              <p className="text-sm text-muted-foreground">Import from Mailchimp lists</p>
              {hasActiveMailchimpImport && (
                <Badge variant="secondary" className="mt-2 gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Importing in background
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveMailchimpImport && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
              {mailchimpStatus === 'connected' && !hasActiveMailchimpImport && <CheckCircle className="w-5 h-5 text-green-600" />}
              {mailchimpStatus === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
            </div>
          </div>

          {mailchimpAccount && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{mailchimpAccount.accountname || 'Connected Account'}</p>
              <p className="text-xs text-muted-foreground">{mailchimpAccount.login?.email}</p>
            </div>
          )}

          {mailchimpStatus !== 'connected' ? (
            <Button
              onClick={() => handleConnect('mailchimp')}
              disabled={mailchimpStatus === 'connecting'}
              className="w-full"
            >
              {mailchimpStatus === 'connecting' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect Mailchimp
            </Button>
          ) : (
            <Button
              onClick={() => handleDisconnect('mailchimp')}
              variant="outline"
              className="w-full"
            >
              Disconnect
            </Button>
          )}
        </Card>

        {/* Klaviyo */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Klaviyo</h3>
              <p className="text-sm text-muted-foreground">Import from Klaviyo lists</p>
              {hasActiveKlaviyoImport && (
                <Badge variant="secondary" className="mt-2 gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Importing in background
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveKlaviyoImport && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
              {klaviyoStatus === 'connected' && !hasActiveKlaviyoImport && <CheckCircle className="w-5 h-5 text-green-600" />}
              {klaviyoStatus === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
            </div>
          </div>

          {klaviyoAccount && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{klaviyoAccount.name || 'Connected Account'}</p>
              <p className="text-xs text-muted-foreground">{klaviyoAccount.contact_email}</p>
            </div>
          )}

          {klaviyoStatus !== 'connected' ? (
            <Button
              onClick={() => handleConnect('klaviyo')}
              disabled={klaviyoStatus === 'connecting'}
              className="w-full"
            >
              {klaviyoStatus === 'connecting' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect Klaviyo
            </Button>
          ) : (
            <Button
              onClick={() => handleDisconnect('klaviyo')}
              variant="outline"
              className="w-full"
            >
              Disconnect
            </Button>
          )}
        </Card>

        {/* Constant Contact */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Constant Contact</h3>
              <p className="text-sm text-muted-foreground">Import from Constant Contact lists</p>
              {hasActiveConstantContactImport && (
                <Badge variant="secondary" className="mt-2 gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Importing in background
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveConstantContactImport && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
              {constantContactStatus === 'connected' && !hasActiveConstantContactImport && <CheckCircle className="w-5 h-5 text-green-600" />}
              {constantContactStatus === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
            </div>
          </div>

          {constantContactAccount && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{constantContactAccount.name || constantContactAccount.organization_name || 'Connected Account'}</p>
              <p className="text-xs text-muted-foreground">{constantContactAccount.email || constantContactAccount.contact_email}</p>
            </div>
          )}

          {constantContactStatus !== 'connected' ? (
            <Button
              onClick={() => handleConnect('constant_contact')}
              disabled={constantContactStatus === 'connecting'}
              className="w-full"
            >
              {constantContactStatus === 'connecting' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect Constant Contact
            </Button>
          ) : (
            <Button
              onClick={() => handleDisconnect('constant_contact')}
              variant="outline"
              className="w-full"
            >
              Disconnect
            </Button>
          )}
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
};
