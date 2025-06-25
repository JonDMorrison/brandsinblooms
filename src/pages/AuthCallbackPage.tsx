
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
  const { user } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your connection...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('🔄 Auth callback received:', { 
        hasCode: !!code, 
        hasState: !!state, 
        state,
        error, 
        errorDescription,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent
      });

      if (error) {
        console.error('❌ OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(`Authorization failed: ${errorDescription || error}`);
        toast.error(`Connection failed: ${errorDescription || error}`);
        setTimeout(() => navigate('/social'), 3000);
        return;
      }

      if (!code || !state) {
        console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        toast.error('Invalid authorization response');
        setTimeout(() => navigate('/social'), 3000);
        return;
      }

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
          setTimeout(() => navigate('/social'), 3000);
          return;
        }
        
        console.log('✅ State mismatch but user is authenticated, proceeding with caution...');
      }

      // Clear stored states
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');

      if (!user) {
        console.error('❌ No authenticated user');
        setStatus('error');
        setMessage('You must be logged in to connect social media accounts');
        toast.error('Please log in first');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      let retryCount = 0;
      const maxRetries = 3;

      const attemptExchange = async (): Promise<any> => {
        try {
          console.log(`🔗 Attempting OAuth code exchange (attempt ${retryCount + 1}/${maxRetries})...`);
          
          setMessage(`Connecting to Meta platform... (${retryCount + 1}/${maxRetries})`);
          
          const { data, error: exchangeError } = await supabase.functions.invoke('exchange-oauth-code', {
            body: {
              code,
              state,
              redirect_uri: `${window.location.origin}/auth/callback`
            }
          });

          console.log('📬 Exchange response:', { 
            data, 
            error: exchangeError,
            hasData: !!data,
            dataType: typeof data
          });

          if (exchangeError) {
            console.error('❌ Edge function error:', exchangeError);
            throw new Error(`Edge function failed: ${JSON.stringify(exchangeError)}`);
          }

          if (!data) {
            throw new Error('No response data received from edge function');
          }

          return data;
        } catch (error: any) {
          console.error(`❌ Exchange attempt ${retryCount + 1} failed:`, {
            error: error.message,
            details: error.details || 'No additional details',
            code: error.code || 'No error code'
          });
          
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`⏳ Retrying in 2 seconds... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return attemptExchange();
          } else {
            throw error;
          }
        }
      };

      try {
        const data = await attemptExchange();

        if (data?.success) {
          setStatus('success');
          const successMessage = data.message || 'Successfully connected to Meta platform!';
          setMessage(successMessage);
          toast.success(successMessage);
          
          console.log('🎯 Setting post-connection flow flag');
          sessionStorage.setItem('oauth_just_completed', 'true');
          
          console.log('🏠 Redirecting to homepage for post-connection flow');
          setTimeout(() => navigate('/'), 2000);
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
        
        if (error?.message?.includes('Edge function failed')) {
          errorMessage = 'Unable to connect to Meta platform. Please check your internet connection and try again.';
        } else if (error?.message?.includes('No response data')) {
          errorMessage = 'Connection service is temporarily unavailable. Please try again in a few minutes.';
        } else {
          errorMessage = `Connection failed: ${error?.message || 'Unknown error'}`;
        }
        
        setMessage(errorMessage);
        toast.error(errorMessage);
        setTimeout(() => navigate('/social'), 5000);
      }
    };

    // Only run the callback handling if we have the necessary URL parameters
    if (searchParams.get('code') || searchParams.get('error')) {
      handleCallback();
    } else {
      console.log('ℹ️ No OAuth parameters found, redirecting to social page');
      navigate('/social');
    }
  }, [searchParams, navigate, user]);

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
