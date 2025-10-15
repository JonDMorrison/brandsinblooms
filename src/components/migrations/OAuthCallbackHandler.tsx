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
      // New flow: when server handled token exchange and redirected back
      if (status && provider && window.opener) {
        window.opener.postMessage({
          type: status === 'success' ? 'oauth-success' : 'oauth-error',
          provider,
          message: status === 'success' ? 'Connected successfully' : 'Connection failed'
        }, window.location.origin);
        
        // Try to close the window, show fallback if it fails
        try {
          window.close();
          // If window.close() doesn't work, show fallback after a delay
          setTimeout(() => {
            setShowFallback(true);
          }, 500);
        } catch (error) {
          setShowFallback(true);
        }
        return;
      }

      // Legacy flow: when provider redirected directly with code/state
      if (code && state && provider && window.opener) {
        window.opener.postMessage({
          type: 'oauth-callback',
          provider,
          code,
          state
        }, window.location.origin);

        // Try to close the window, show fallback if it fails
        try {
          window.close();
          setTimeout(() => {
            setShowFallback(true);
          }, 500);
        } catch (error) {
          setShowFallback(true);
        }
      }
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
