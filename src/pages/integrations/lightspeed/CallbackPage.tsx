import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading');
  const [message, setMessage] = useState('Processing your Lightspeed connection...');
  const [step, setStep] = useState<string>('Validating OAuth response...');

  // Robust session waiting with exponential backoff
  const waitForSession = async (maxRetries = 15): Promise<Session | null> => {
    const delays = [100, 250, 500, 1000, 2000, 3000];
    let attempt = 0;
    
    console.log('[LS-Session] Starting session initialization with retry...');
    
    while (attempt < maxRetries) {
      console.log(`[LS-Session] Attempt ${attempt + 1}/${maxRetries}`);
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Validate token structure
        try {
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length === 3) {
            // Decode and verify JWT claims
            const payload = JSON.parse(atob(tokenParts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            if (payload.sub && payload.exp && payload.exp > now) {
              console.log('[LS-Session] ✅ Valid session found', {
                userId: payload.sub,
                expiresIn: payload.exp - now,
                attempt: attempt + 1
              });
              return session;
            } else {
              console.warn('[LS-Session] Token validation failed', {
                hasSub: !!payload.sub,
                hasExp: !!payload.exp,
                isExpired: payload.exp ? payload.exp <= now : 'unknown'
              });
            }
          }
        } catch (parseError) {
          console.error('[LS-Session] Token parsing error:', parseError);
        }
      } else if (error) {
        console.warn(`[LS-Session] Session error on attempt ${attempt + 1}:`, error);
      }
      
      // Try force refresh at attempt 5 if we have a session but invalid token
      if (attempt === 5 && session) {
        console.log('[LS-Session] 🔄 Forcing session refresh...');
        try {
          const { data: { session: refreshedSession }, error: refreshError } = 
            await supabase.auth.refreshSession();
          
          if (refreshedSession?.access_token) {
            console.log('[LS-Session] ✅ Session refreshed successfully');
            return refreshedSession;
          }
          if (refreshError) {
            console.error('[LS-Session] Refresh error:', refreshError);
          }
        } catch (refreshError) {
          console.error('[LS-Session] Refresh exception:', refreshError);
        }
      }
      
      // Exponential backoff
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.log(`[LS-Session] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
    
    console.error('[LS-Session] ❌ Session initialization timeout after all retries');
    return null;
  };

  // Session state listener for real-time detection
  const waitForSessionWithListener = (): Promise<Session | null> => {
    return new Promise((resolve) => {
      console.log('[LS-Session] Setting up auth state listener...');
      
      const timeout = setTimeout(() => {
        console.warn('[LS-Session] Listener timeout after 20 seconds');
        subscription.unsubscribe();
        resolve(null);
      }, 20000);
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[LS-Session] Auth state change:', event, !!session);
          
          if (session?.access_token && event !== 'SIGNED_OUT') {
            // Validate token
            try {
              const tokenParts = session.access_token.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const now = Math.floor(Date.now() / 1000);
                
                if (payload.sub && payload.exp && payload.exp > now) {
                  console.log('[LS-Session] ✅ Valid session from listener');
                  clearTimeout(timeout);
                  subscription.unsubscribe();
                  resolve(session);
                  return;
                }
              }
            } catch (e) {
              console.error('[LS-Session] Token validation error in listener:', e);
            }
          }
        }
      );
      
      // Also check current session immediately
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          try {
            const tokenParts = session.access_token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const now = Math.floor(Date.now() / 1000);
              
              if (payload.sub && payload.exp && payload.exp > now) {
                console.log('[LS-Session] ✅ Valid session found immediately');
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(session);
              }
            }
          } catch (e) {
            console.error('[LS-Session] Immediate check token error:', e);
          }
        }
      });
    });
  };

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
        // CRITICAL FIX: Manually trigger storage event to sync auth state
        console.log('[LS-Callback] Triggering storage sync...');
        window.dispatchEvent(new StorageEvent('storage', {
          key: `sb-${window.location.hostname.split('.')[0]}-auth-token`,
          newValue: localStorage.getItem(`sb-${window.location.hostname.split('.')[0]}-auth-token`),
          url: window.location.href,
          storageArea: localStorage
        }));
        
        // Small delay to let Supabase client process the storage event
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[LS-Callback] Starting robust session initialization...');
        setStep('Initializing session...');
        
        // Try to get session with multiple approaches
        const session = await Promise.race([
          waitForSession(15),
          waitForSessionWithListener(),
          // Add a third approach: manual localStorage read
          new Promise<Session | null>((resolve) => {
            setTimeout(async () => {
              console.log('[LS-Callback] Attempting manual session retrieval...');
              const { data: { session: manualSession } } = await supabase.auth.getSession();
              if (manualSession?.access_token) {
                console.log('[LS-Callback] ✓ Manual retrieval successful');
                resolve(manualSession);
              } else {
                console.log('[LS-Callback] Manual retrieval failed');
                resolve(null);
              }
            }, 2000);
          })
        ]);
        
        if (!session) {
          clearTimeout(timeoutId);
          console.error('[LS-Callback] ❌ Session initialization failed after all attempts');
          setStatus('error');
          setMessage('Authentication Session Timeout');
          setStep('Could not establish authenticated session. Please log in and try again.');
          
          broadcastResult({
            status: 'error',
            message: 'Session initialization timeout',
            code: 'SESSION_TIMEOUT',
            timestamp: Date.now()
          });
          
          setTimeout(() => window.close(), 3000);
          return;
        }
        
        console.log('[LS-Callback] ✅ Session ready and validated');
        setStep('Processing OAuth callback...');
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
