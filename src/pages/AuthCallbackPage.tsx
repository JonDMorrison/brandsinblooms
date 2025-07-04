import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const AuthCallbackPage = () => {
  // ──────────────────────────────────────────────
  // HOT-FIX: Facebook sometimes returns /auth/callback#/?code=…&state=…
  // Values after "#" are invisible to window.location.search.
  // Move them back into the querystring **before** we parse params.
  if (window.location.hash.startsWith('#/?')) {
    const fixed = window.location.hash.replace(/^#\/?/, '?');
    window.history.replaceState(null, '', window.location.pathname + fixed);
  }
  // ──────────────────────────────────────────────

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting to Meta platform...');

  useEffect(() => {
    // Only handle OAuth callback logic if we're actually on the callback route
    if (window.location.pathname !== '/auth/callback') {
      return;
    }

    const handleCallback = async () => {
      // Get parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('🔍 OAuth callback received:', { 
        hasCode: !!code, 
        hasState: !!state, 
        error,
        fullUrl: window.location.href,
        allParams: Object.fromEntries(searchParams.entries()),
        timestamp: new Date().toISOString()
      });

      // Clear URL parameters to prevent reuse
      if (code || error) {
        const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }

      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(`Authorization failed: ${errorDescription || error}`);
        toast.error(`Connection failed: ${errorDescription || error}`);
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('Missing required parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        toast.error('Invalid authorization response');
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      // Check if code already processed
      const processedCodes = sessionStorage.getItem('processed_oauth_codes');
      const processedCodesArray = processedCodes ? JSON.parse(processedCodes) : [];
      
      if (processedCodesArray.includes(code)) {
        console.warn('OAuth code already processed');
        setStatus('error');
        setMessage('This authorization has already been processed');
        toast.error('Authorization already processed - please try connecting again');
        setTimeout(() => navigate('/social-accounts'), 2000);
        return;
      }

      // Verify state parameter
      const storedState = sessionStorage.getItem('oauth_state');
      const backupState = localStorage.getItem('oauth_state_backup');
      const stateValid = state === storedState || state === backupState;
      
      console.log('State verification:', { 
        received: state.substring(0, 12) + '...', 
        stored: storedState?.substring(0, 12) + '...',
        valid: stateValid
      });

      if (!stateValid && !user) {
        console.error('State mismatch and no authenticated user');
        setStatus('error');
        setMessage('Security verification failed - please try connecting again');
        toast.error('Connection failed - please try again');
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      // Clear stored states
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');

      // Wait for auth to load if needed
      if (authLoading) {
        setMessage('Verifying authentication...');
        return;
      }

      // Verify user is authenticated
      if (!user) {
        console.error('No authenticated user');
        setStatus('error');
        setMessage('You must be logged in to connect social media accounts');
        toast.error('Please log in first');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      console.log('Starting OAuth exchange for authenticated user');

      try {
        setMessage('Exchanging authorization code...');
        
        const exchangePayload = {
          code,
          state,
          redirect_uri: `${window.location.origin}/auth/callback`
        };
        
        console.log('Calling exchange-oauth-code function');
        const { data, error: exchangeError } = await supabase.functions.invoke('exchange-oauth-code', {
          body: exchangePayload
        });

        console.log('Exchange response:', { 
          success: data?.success, 
          error: exchangeError,
          connectionsCount: data?.connections?.length 
        });

        if (exchangeError) {
          throw new Error(`Exchange failed: ${exchangeError.message || JSON.stringify(exchangeError)}`);
        }

        if (!data || !data.success) {
          throw new Error(data?.error || 'Failed to connect - no success response');
        }

        // Success!
        setStatus('success');
        const successMessage = data.message || 'Successfully connected to Meta platform!';
        setMessage(successMessage);
        
        // Set success flag for social accounts page
        sessionStorage.setItem('social_connection_success', JSON.stringify({
          message: successMessage,
          timestamp: Date.now()
        }));
        
        // Mark code as processed ONLY after successful exchange
        const processedCodes = sessionStorage.getItem('processed_oauth_codes');
        const processedCodesArray = processedCodes ? JSON.parse(processedCodes) : [];
        processedCodesArray.push(code);
        sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodesArray.slice(-10)));
        
        console.log('OAuth success, redirecting to social accounts');
        setTimeout(() => navigate(`/social-accounts${window.location.search}`), 2000);
        
      } catch (error: any) {
        console.error('OAuth exchange error:', error);
        
        setStatus('error');
        let errorMessage = 'Connection failed';
        
        if (error?.message?.includes('Exchange failed')) {
          errorMessage = 'Unable to connect to Meta platform. Please try again.';
        } else if (error?.message?.includes('No response data')) {
          errorMessage = 'Connection service temporarily unavailable. Please try again.';
        } else {
          errorMessage = `Connection failed: ${error?.message || 'Unknown error'}`;
        }
        
        setMessage(errorMessage);
        toast.error(errorMessage);
        setTimeout(() => navigate('/social-accounts'), 5000);
      }
    };

    // Only handle callback if we have OAuth parameters
    const hasOAuthParams = searchParams.get('code') || searchParams.get('error');
    
    console.log('🔍 AuthCallback useEffect:', {
      hasOAuthParams,
      currentUrl: window.location.href,
      allSearchParams: Object.fromEntries(searchParams.entries()),
      hasCode: !!searchParams.get('code'),
      hasError: !!searchParams.get('error'),
      timestamp: new Date().toISOString()
    });
    
    if (hasOAuthParams) {
      console.log('✅ OAuth parameters detected, handling callback');
      handleCallback().catch(error => {
        console.error('❌ Uncaught callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
        toast.error('Connection failed unexpectedly');
        setTimeout(() => navigate('/social-accounts'), 3000);
      });
    } else {
      console.log('❌ No OAuth parameters found, redirecting to social accounts');
      setTimeout(() => navigate('/social-accounts'), 2000);
    }
  }, [searchParams, navigate, user, authLoading]);

  // Retry callback when auth loading completes
  useEffect(() => {
    if (!authLoading && searchParams.get('code')) {
      // Trigger re-processing if auth just finished loading
      const timer = setTimeout(() => {
        window.location.reload();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, searchParams]);

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
              <p className="text-sm text-gray-500 mt-2">Taking you to your accounts...</p>
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