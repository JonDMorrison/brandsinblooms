import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const APP_ORIGIN = window.location.origin;

interface ConnectStepProps {
  onComplete: () => void;
}

export const ConnectStep = ({ onComplete }: ConnectStepProps) => {
  const { toast } = useToast();
  const [mailchimpStatus, setMailchimpStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [klaviyoStatus, setKlaviyoStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [mailchimpAccount, setMailchimpAccount] = useState<any>(null);
  const [klaviyoAccount, setKlaviyoAccount] = useState<any>(null);
  const popupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentProviderRef = useRef<'mailchimp' | 'klaviyo' | null>(null);

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

      // Clear popup monitoring
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }

      const setStatus = provider === 'mailchimp' ? setMailchimpStatus : setKlaviyoStatus;

      if (type === 'oauth-success') {
        console.log('✅ OAuth success received:', message);
        // Close popup
        try { popupRef.current?.close(); } catch {}
        popupRef.current = null;
        currentProviderRef.current = null;
        
        // Refresh connection state
        refreshConnections();
        
        // Show success toast
        toast({
          title: 'Connected!',
          description: `${provider === 'mailchimp' ? 'Mailchimp' : 'Klaviyo'} connected successfully`,
        });
        
        // Advance wizard if Mailchimp
        if (provider === 'mailchimp') {
          onComplete();
        }
      }
      
      if (type === 'oauth-error') {
        console.error('❌ OAuth error received:', error);
        toast({
          title: 'Connection Failed',
          description: error || `${provider === 'mailchimp' ? 'Mailchimp' : 'Klaviyo'} connection failed`,
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

  const refreshConnections = async () => {
    try {
      const { data: connections } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('status', 'connected')
        .in('provider', ['mailchimp', 'klaviyo']);

      const mailchimp = connections?.find(c => c.provider === 'mailchimp');
      const klaviyo = connections?.find(c => c.provider === 'klaviyo');

      if (mailchimp) {
        setMailchimpStatus('connected');
        setMailchimpAccount(mailchimp.metadata);
      }
      if (klaviyo) {
        setKlaviyoStatus('connected');
        setKlaviyoAccount(klaviyo.metadata);
      }
    } catch (error) {
      console.error('Error refreshing connections:', error);
    }
  };

  const handleConnect = async (provider: 'mailchimp' | 'klaviyo') => {
    const setStatus = provider === 'mailchimp' ? setMailchimpStatus : setKlaviyoStatus;
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
        `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
      );

      if (!popupRef.current || popupRef.current.closed) {
        throw new Error('Failed to open OAuth popup. Please check your popup blocker settings.');
      }

      console.log(`✅ Popup opened successfully for ${provider}`);

      // Start monitoring the popup
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }

      popupCheckIntervalRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          console.log(`🪟 Popup was closed for ${provider}`);
          clearInterval(popupCheckIntervalRef.current!);
          popupCheckIntervalRef.current = null;
          
          // Only show cancellation if we didn't receive a success/error message
          if (currentProviderRef.current === provider) {
            console.log(`⚠️ User closed popup without completing OAuth for ${provider}`);
            toast({
              title: 'Connection Cancelled',
              description: `You closed the ${provider === 'mailchimp' ? 'Mailchimp' : 'Klaviyo'} authorization window`,
            });
            setStatus('idle');
            currentProviderRef.current = null;
          }
          
          popupRef.current = null;
        }
      }, 500); // Check every 500ms

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

  const handleDisconnect = async (provider: 'mailchimp' | 'klaviyo') => {
    const setStatus = provider === 'mailchimp' ? setMailchimpStatus : setKlaviyoStatus;
    const setAccount = provider === 'mailchimp' ? setMailchimpAccount : setKlaviyoAccount;
    
    try {
      setStatus('connecting'); // Show loading state

      // Call revoke-token edge function
      const { data, error } = await supabase.functions.invoke('mailchimp-revoke-token', {
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

  const canProceed = mailchimpStatus === 'connected' || klaviyoStatus === 'connected';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Connect Your Provider</h2>
        <p className="text-muted-foreground">
          Connect to Mailchimp or Klaviyo to begin importing your contacts, segments, and tags.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Mailchimp */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Mailchimp</h3>
              <p className="text-sm text-muted-foreground">Import from Mailchimp lists</p>
            </div>
            {mailchimpStatus === 'connected' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {mailchimpStatus === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
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
            <div>
              <h3 className="font-semibold text-lg">Klaviyo</h3>
              <p className="text-sm text-muted-foreground">Import from Klaviyo lists</p>
            </div>
            {klaviyoStatus === 'connected' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {klaviyoStatus === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
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
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
};
