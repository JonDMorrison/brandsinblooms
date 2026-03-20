import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getOAuthRedirectUri } from '@/utils/environmentUtils';

export const OAuthCallbackHandler = () => {
  const [searchParams] = useSearchParams();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');

    // Add a small delay to ensure component has mounted
    const timer = setTimeout(() => {
      console.log('[OAuthCallbackHandler] params check', {
        href: window.location.href,
        status,
        provider,
        code: !!code,
        state: !!state,
        hasOpener: !!window.opener,
      });

      // New flow: when server handled token exchange and redirected back
      if (status && provider) {
        if (window.opener) {
          try {
            // IMPROVEMENT: Use actual app origin instead of '*' for postMessage security
            window.opener.postMessage({
              type: status === 'success' ? 'oauth-success' : 'oauth-error',
              provider,
              message: status === 'success' ? 'Connected successfully' : 'Connection failed'
            }, window.location.origin);
          } catch (e) {
            console.warn('[OAuthCallbackHandler] postMessage failed', e);
          }
        }
        
        // Try to close the window, show fallback if it fails
        try {
          window.close();
          // If window.close() doesn't work, show fallback after a delay
          setTimeout(() => {
            setShowFallback(true);
          }, 600);
        } catch (error) {
          setShowFallback(true);
        }
        return;
      }

      // Meta OAuth flow: handle exchange directly in the popup
      if (code && state) {
        console.log('[OAuthCallbackHandler] Meta OAuth - exchanging code in popup', {
          code: code.substring(0, 10) + '...',
          state: state.substring(0, 12) + '...',
          hasOpener: !!window.opener
        });

        (async () => {
          try {
            // Call exchange-oauth-code edge function
            const { data, error } = await supabase.functions.invoke('exchange-oauth-code', {
              body: {
                code,
                state,
                redirect_uri: getOAuthRedirectUri()
              }
            });

            if (error) throw error;

            console.log('[OAuthCallbackHandler] Exchange response:', data);

            // Notify opener window of success
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'oauth-success',
                provider: 'meta',
                platforms: data?.connections || [],
                message: data?.message || 'Connected successfully'
              }, window.location.origin);
              
              console.log('[OAuthCallbackHandler] Posted success message to opener');
            }

            // Try to close the popup
            try {
              window.close();
              // If close didn't work, show fallback after a short delay
              setTimeout(() => {
                setShowFallback(true);
              }, 600);
            } catch (e) {
              setShowFallback(true);
            }
          } catch (error: any) {
            console.error('[OAuthCallbackHandler] Exchange failed:', error);

            // Notify opener of failure
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'oauth-error',
                provider: 'meta',
                stage: error.stage || 'exchange_failed',
                error: error.message || 'Failed to connect Meta account'
              }, window.location.origin);
              
              console.log('[OAuthCallbackHandler] Posted error message to opener');
            }

            // Show error in popup
            setShowFallback(true);
          }
        })();

        return;
      }

      // If we reach here, params are missing – show manual fallback
      setShowFallback(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        {showFallback ? (
          <>
            <p className="text-foreground mb-4">Connection complete!</p>
            <Button onClick={() => window.close()}>Close Window</Button>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Completing connection...</p>
          </>
        )}
      </div>
    </div>
  );
};
