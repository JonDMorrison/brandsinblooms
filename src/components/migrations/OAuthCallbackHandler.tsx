import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
            window.opener.postMessage({
              type: status === 'success' ? 'oauth-success' : 'oauth-error',
              provider,
              message: status === 'success' ? 'Connected successfully' : 'Connection failed'
            }, '*');
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

      // Legacy or static-domain flow: provider may be absent.
      // If we have code & state, forward to /auth/callback to perform the exchange
      if (code && state) {
        const params = new URLSearchParams({ code, state }).toString();
        const target = `/auth/callback?${params}`;
        window.location.replace(target);
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
