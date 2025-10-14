import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ConnectStepProps {
  onComplete: () => void;
}

export const ConnectStep = ({ onComplete }: ConnectStepProps) => {
  const { toast } = useToast();
  const [mailchimpStatus, setMailchimpStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [klaviyoStatus, setKlaviyoStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [mailchimpAccount, setMailchimpAccount] = useState<any>(null);
  const [klaviyoAccount, setKlaviyoAccount] = useState<any>(null);

  const handleConnect = async (provider: 'mailchimp' | 'klaviyo') => {
    const setStatus = provider === 'mailchimp' ? setMailchimpStatus : setKlaviyoStatus;
    setStatus('connecting');

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
        return;
      }

      // Open OAuth popup
      const popup = window.open(data.authUrl, `${provider}-oauth`, 'width=600,height=700');
      
      // Listen for OAuth callback
      const handleCallback = async (event: MessageEvent) => {
        if (event.data.type === 'oauth-callback' && event.data.provider === provider) {
          popup?.close();
          
          try {
            // Exchange code for tokens
            const { data: callbackData, error: callbackError } = await supabase.functions.invoke('migrations-oauth-callback', {
              body: {
                code: event.data.code,
                state: data.state,
                provider
              }
            });

            if (callbackError) throw callbackError;

            if (provider === 'mailchimp') {
              setMailchimpAccount(callbackData.accountInfo);
              setMailchimpStatus('connected');
            } else {
              setKlaviyoAccount(callbackData.accountInfo);
              setKlaviyoStatus('connected');
            }

            toast({
              title: 'Connected!',
              description: `Successfully connected to ${provider}`
            });

          } catch (error: any) {
            console.error('OAuth callback error:', error);
            toast({
              title: 'Connection Failed',
              description: error.message,
              variant: 'destructive'
            });
            setStatus('error');
          }
        }
      };

      window.addEventListener('message', handleCallback);

      // Cleanup
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleCallback);
          if (provider === 'mailchimp' && mailchimpStatus === 'connecting') {
            setMailchimpStatus('idle');
          } else if (provider === 'klaviyo' && klaviyoStatus === 'connecting') {
            setKlaviyoStatus('idle');
          }
        }
      }, 500);

    } catch (error: any) {
      console.error('Connect error:', error);
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive'
      });
      setStatus('error');
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
