import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading');
  const [message, setMessage] = useState('Processing your Lightspeed connection...');
  const [step, setStep] = useState<string>('Validating OAuth response...');

  useEffect(() => {
    const handleCallback = async () => {
      const timeoutId = setTimeout(() => {
        setStatus('timeout');
        setMessage('Connection timeout - please try again');
        setStep('The request took too long to complete');
        
        // Broadcast timeout via multiple channels
        broadcastResult({
          status: 'error',
          message: 'Connection timeout',
          timestamp: Date.now()
        });
        
        setTimeout(() => window.close(), 3000);
      }, 30000); // 30 second timeout

      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const domainPrefix = searchParams.get('domain_prefix') || searchParams.get('domainPrefix');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('[LS-Callback] Processing callback:', { 
          hasCode: !!code, 
          hasState: !!state, 
          domainPrefix,
          error,
          timestamp: new Date().toISOString()
        });

        // Handle OAuth errors
        if (error) {
          clearTimeout(timeoutId);
          const errorMsg = errorDescription || error || 'Authorization failed';
          console.error('[LS-Callback] OAuth error:', errorMsg);
          setStatus('error');
          setMessage('Authorization Failed');
          setStep(errorMsg);
          
          broadcastResult({
            status: 'error',
            message: errorMsg,
            timestamp: Date.now()
          });
          
          setTimeout(() => window.close(), 3000);
          return;
        }

        // Validate required parameters
        if (!code || !state || !domainPrefix) {
          clearTimeout(timeoutId);
          const errorMsg = 'Missing required OAuth parameters';
          console.error('[LS-Callback] Missing params:', { code: !!code, state: !!state, domainPrefix });
          setStatus('error');
          setMessage('Invalid OAuth Response');
          setStep('Missing authorization code or state parameter');
          
          broadcastResult({
            status: 'error',
            message: errorMsg,
            timestamp: Date.now()
          });
          
          setTimeout(() => window.close(), 3000);
          return;
        }

        console.log('[LS-Callback] Step 1: Invoking callback edge function...');
        setStep('Exchanging authorization code for access tokens...');

        // Get the current origin for redirect URI
        const redirectUri = `${window.location.origin}/integrations/lightspeed/callback`;

        // Call the edge function to exchange code for tokens
        const { data, error: callbackError } = await supabase.functions.invoke(
          'lightspeed-oauth-callback',
          {
            body: {
              code,
              state,
              domainPrefix,
              redirectUri,
            },
          }
        );

        clearTimeout(timeoutId);

        if (callbackError) {
          console.error('[LS-Callback] Edge function error:', callbackError);
          setStatus('error');
          setMessage('Connection Failed');
          setStep(callbackError.message || 'Failed to exchange authorization code');
          
          broadcastResult({
            status: 'error',
            message: callbackError.message || 'Failed to complete connection',
            details: callbackError,
            timestamp: Date.now()
          });
          
          setTimeout(() => window.close(), 3000);
          return;
        }

        // Validate response
        if (!data?.success) {
          console.error('[LS-Callback] Invalid response:', data);
          setStatus('error');
          setMessage('Connection Failed');
          setStep(data?.error || 'Invalid response from server');
          
          broadcastResult({
            status: 'error',
            message: data?.error || 'Invalid server response',
            timestamp: Date.now()
          });
          
          setTimeout(() => window.close(), 3000);
          return;
        }

        // Success!
        console.log('[LS-Callback] Connection successful:', data);
        setStatus('success');
        setMessage('Connected Successfully!');
        setStep(`Connected to ${data.retailerName || domainPrefix}`);
        
        broadcastResult({
          status: 'success',
          message: data?.message || 'Connection successful',
          retailerName: data?.retailerName,
          timestamp: Date.now()
        });
        
        // Close tab after showing success message
        setTimeout(() => window.close(), 2000);
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[LS-Callback] Unexpected error:', error);
        setStatus('error');
        setMessage('Unexpected Error');
        setStep(error.message || 'An unexpected error occurred');
        
        broadcastResult({
          status: 'error',
          message: error.message || 'Unexpected error',
          timestamp: Date.now()
        });
        
        setTimeout(() => window.close(), 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  // Broadcast result via multiple channels for reliability
  const broadcastResult = (result: any) => {
    // Method 1: localStorage (works cross-domain)
    localStorage.setItem('lightspeed_oauth_result', JSON.stringify(result));
    
    // Method 2: BroadcastChannel (more reliable, same-origin only)
    try {
      const channel = new BroadcastChannel('lightspeed_oauth');
      channel.postMessage(result);
      channel.close();
    } catch (e) {
      console.log('[LS-Callback] BroadcastChannel not supported, using localStorage only');
    }
    
    // Method 3: Try to message opener window
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: 'lightspeed_oauth_result', data: result }, window.location.origin);
      } catch (e) {
        console.log('[LS-Callback] Could not message opener window');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              This window will close automatically...
            </div>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              Closing in 2 seconds...
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-red-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              Closing in 3 seconds... You can try connecting again.
            </div>
          </>
        )}
        
        {status === 'timeout' && (
          <>
            <Clock className="h-12 w-12 mx-auto text-yellow-500" />
            <h2 className="text-xl font-semibold text-yellow-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              The connection request took too long. Please try again.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;
