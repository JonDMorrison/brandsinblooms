import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting to Meta platform...');
  const [waitingForAuth, setWaitingForAuth] = useState(false);

  // Immediate debug logging when component mounts
  console.log('🚀 AuthCallbackPage mounted:', {
    searchParams: Object.fromEntries(searchParams.entries()),
    user: user?.email || 'none',
    authLoading,
    currentUrl: window.location.href,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    console.log('🔄 AuthCallbackPage useEffect triggered:', {
      hasParams: !!searchParams.get('code') || !!searchParams.get('error'),
      user: user?.email || 'none',
      authLoading
    });

    const handleCallback = async () => {
      console.log('🎯 handleCallback function started');
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Store debug info immediately when callback is reached
      const callbackDebug = {
        step: 'callback_reached',
        timestamp: new Date().toISOString(),
        hasCode: !!code,
        hasState: !!state,
        hasError: !!error,
        error: error,
        errorDescription: errorDescription,
        user: user?.email || 'none',
        authLoading
      };
      localStorage.setItem('oauth_debug', JSON.stringify(callbackDebug));

      console.log('🔄 Auth callback received:', { 
        hasCode: !!code, 
        hasState: !!state, 
        state,
        error, 
        errorDescription,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        authLoading,
        hasUser: !!user
      });

      // Clear URL parameters immediately to prevent reuse
      if (code || error) {
        const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }

      if (error) {
        console.error('❌ OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(`Authorization failed: ${errorDescription || error}`);
        toast.error(`Connection failed: ${errorDescription || error}`);
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      if (!code || !state) {
        console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        toast.error('Invalid authorization response');
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      // Check if we've already processed this code
      const processedCodes = sessionStorage.getItem('processed_oauth_codes');
      const processedCodesArray = processedCodes ? JSON.parse(processedCodes) : [];
      
      if (processedCodesArray.includes(code)) {
        console.warn('⚠️ OAuth code already processed, redirecting...');
        setStatus('error');
        setMessage('This authorization has already been processed');
        toast.error('Authorization already processed - please try connecting again');
        setTimeout(() => navigate('/social-accounts'), 2000);
        return;
      }

      // Mark this code as processed
      processedCodesArray.push(code);
      sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodesArray.slice(-10))); // Keep only last 10

      // Enhanced state verification with multiple fallbacks
      const storedState = sessionStorage.getItem('oauth_state');
      const backupState = localStorage.getItem('oauth_state_backup');
      
      console.log('🔍 Enhanced state verification:', { 
        received: state, 
        stored: storedState,
        backup: backupState,
        sessionMatch: state === storedState,
        backupMatch: state === backupState
      });

      // Allow if either state matches
      const stateValid = state === storedState || state === backupState;
      
      if (!stateValid) {
        console.warn('⚠️ State mismatch detected');
        
        if (!user) {
          console.error('❌ State mismatch AND no authenticated user');
          setStatus('error');
          setMessage('Security verification failed - please try connecting again');
          toast.error('Connection failed - please try again');
          setTimeout(() => navigate('/social-accounts'), 3000);
          return;
        }
        
        console.log('✅ State mismatch but user is authenticated, proceeding with caution...');
      }

      // Clear stored states
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');

      // Wait for auth to load if it's still loading
      if (authLoading) {
        console.log('⏳ Waiting for auth to load...', { authLoading, user: !!user });
        setWaitingForAuth(true);
        setMessage('Verifying authentication...');
        return;
      }

      if (!user) {
        console.error('❌ No authenticated user after auth loaded', { 
          authLoading, 
          user: !!user,
          userObject: user 
        });
        setStatus('error');
        setMessage('You must be logged in to connect social media accounts');
        toast.error('Please log in first');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      console.log('✅ User authenticated, proceeding with OAuth exchange:', {
        userId: user.id,
        email: user.email
      });

      try {
        console.log('🔗 Attempting OAuth code exchange...');
        setMessage('Connecting to Meta platform...');
        
        const exchangePayload = {
          code,
          state,
          redirect_uri: `${window.location.origin}/auth/callback`
        };
        
        console.log('🔗 About to call exchange-oauth-code with:', {
          code: code ? `present (${code.substring(0, 10)}...)` : 'missing',
          state: state ? `present (${state.substring(0, 8)}...)` : 'missing',
          redirect_uri: `${window.location.origin}/auth/callback`,
          hasUser: !!user,
          payload: exchangePayload
        });

        console.log('🔗 Calling exchange-oauth-code edge function...');
        const { data, error: exchangeError } = await supabase.functions.invoke('exchange-oauth-code', {
          body: exchangePayload
        });
        console.log('📡 Edge function response:', { data, error: exchangeError });

        console.log('📡 Edge function response received:', {
          data,
          error: exchangeError,
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : [],
          errorDetails: exchangeError
        });

        if (exchangeError) {
          console.error('❌ Edge function error details:', {
            message: exchangeError.message,
            context: exchangeError.context,
            details: exchangeError.details,
            fullError: exchangeError
          });
          throw new Error(`Edge function failed: ${exchangeError.message || JSON.stringify(exchangeError)}`);
        }

        if (!data) {
          throw new Error('No response data received from edge function');
        }

        if (data?.success) {
          setStatus('success');
          const successMessage = data.message || 'Successfully connected to Meta platform!';
          setMessage(successMessage);
          
          // Set a persistent success flag for the social accounts page
          sessionStorage.setItem('social_connection_success', JSON.stringify({
            message: successMessage,
            timestamp: Date.now()
          }));
          
          console.log('🎯 OAuth success, redirecting to social accounts page');
          setTimeout(() => navigate('/social-accounts'), 2000);
        } else {
          throw new Error(data?.error || 'Failed to connect - no success response');
        }
      } catch (error: any) {
        console.error('❌ Final OAuth callback error:', {
          message: error?.message,
          details: error?.details,
          code: error?.code,
          stack: error?.stack
        });
        
        setStatus('error');
        let errorMessage = 'Connection failed';
        
        console.error('❌ Final OAuth callback error details:', {
          message: error?.message,
          details: error?.details,
          code: error?.code,
          stack: error?.stack,
          fullError: error
        });
        
        if (error?.message?.includes('Edge function failed')) {
          // Try to extract more specific error info
          const match = error.message.match(/Edge function failed: (.+)/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              errorMessage = `Connection failed: ${parsed.message || parsed.error || 'Unknown error'}`;
            } catch {
              errorMessage = `Connection failed: ${match[1]}`;
            }
          } else {
            errorMessage = 'Unable to connect to Meta platform. Please check your internet connection and try again.';
          }
        } else if (error?.message?.includes('No response data')) {
          errorMessage = 'Connection service is temporarily unavailable. Please try again in a few minutes.';
        } else {
          errorMessage = `Connection failed: ${error?.message || 'Unknown error'}`;
        }
        
        setMessage(errorMessage);
        toast.error(errorMessage);
        setTimeout(() => navigate('/social-accounts'), 5000);
      }
    };

    // Only run the callback handling if we have the necessary URL parameters
    const hasOAuthParams = searchParams.get('code') || searchParams.get('error');
    console.log('🔍 Checking OAuth parameters:', {
      hasCode: !!searchParams.get('code'),
      hasError: !!searchParams.get('error'),
      hasOAuthParams,
      allParams: Object.fromEntries(searchParams.entries())
    });

    if (hasOAuthParams) {
      console.log('📋 OAuth parameters found, starting handleCallback');
      handleCallback().catch(error => {
        console.error('💥 Uncaught error in handleCallback:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
        toast.error('Connection failed unexpectedly');
        setTimeout(() => navigate('/social-accounts'), 3000);
      });
    } else {
      console.log('ℹ️ No OAuth parameters found, redirecting to social page');
      navigate('/social-accounts');
    }
  }, [searchParams, navigate, user, authLoading]);

  // Handle the case where we're waiting for auth to load
  useEffect(() => {
    if (waitingForAuth && !authLoading) {
      console.log('🔄 Auth loading completed, retrying callback...');
      setWaitingForAuth(false);
      // Re-trigger the callback handling now that auth is loaded
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      if (code || error) {
        window.location.reload(); // Simple reload to restart the process
      }
    }
  }, [waitingForAuth, authLoading, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          {status === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connecting...</h2>
              <p className="text-gray-600 text-center">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Success!</h2>
              <p className="text-gray-600 text-center">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Taking you to your content...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
              <p className="text-gray-600 text-center">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Taking you back to try again...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallbackPage;
