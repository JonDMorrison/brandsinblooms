import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const OAuthCallbackHandler = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const provider = searchParams.get('provider');

    if (code && state && provider && window.opener) {
      // Send message to parent window
      window.opener.postMessage({
        type: 'oauth-callback',
        provider,
        code,
        state
      }, window.location.origin);

      // Close popup
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing connection...</p>
      </div>
    </div>
  );
};
