import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Facebook, Instagram, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';


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
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

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
        
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('Missing required parameters:', { code: !!code, state: !!state });
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        
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
        
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      console.log('Starting OAuth exchange for authenticated user');

      try {
        setMessage('Exchanging authorization code...');
        
          const exchangePayload = {
            code,
            state,
            // Must match the URL authorized with Facebook
            redirect_uri: `https://bloomsuite.app/oauth/callback`
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
        
        // Extract connected platforms from response
        if (data.connections && Array.isArray(data.connections)) {
          setConnectedPlatforms(data.connections);
        }
        
        // Check if opened in popup and communicate with parent
        const isPopup = window.opener && !window.opener.closed;
        
        if (isPopup) {
          console.log('✅ Running in popup, posting success message to parent');
          try {
            window.opener.postMessage({
              type: 'oauth-success',
              platforms: data.connections || [],
              message: successMessage
            }, '*');
            
            // Mark code as processed
            const processedCodes = sessionStorage.getItem('processed_oauth_codes');
            const processedCodesArray = processedCodes ? JSON.parse(processedCodes) : [];
            processedCodesArray.push(code);
            sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodesArray.slice(-10)));
            
            // Close popup after short delay
            setTimeout(() => {
              window.close();
            }, 1500);
          } catch (error) {
            console.error('Failed to post message to parent:', error);
          }
        } else {
          // Fallback: Set success flag for social accounts page with platform details
          sessionStorage.setItem('social_connection_success', JSON.stringify({
            message: successMessage,
            platforms: data.connections || [],
            timestamp: Date.now()
          }));
          
          // Mark code as processed ONLY after successful exchange
          const processedCodes = sessionStorage.getItem('processed_oauth_codes');
          const processedCodesArray = processedCodes ? JSON.parse(processedCodes) : [];
          processedCodesArray.push(code);
          sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodesArray.slice(-10)));
          
          console.log('OAuth success, redirecting to social accounts');
          setTimeout(() => navigate(`/social-accounts${window.location.search}`), 3000);
        }
        
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
        
        // Check if opened in popup and communicate error to parent
        const isPopup = window.opener && !window.opener.closed;
        
        if (isPopup) {
          console.log('❌ Running in popup, posting error message to parent');
          try {
            window.opener.postMessage({
              type: 'oauth-error',
              message: errorMessage
            }, '*');
            
            // Close popup after short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          } catch (error) {
            console.error('Failed to post error message to parent:', error);
          }
        } else {
          // Fallback: redirect
          setTimeout(() => navigate('/social-accounts'), 5000);
        }
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardContent className="p-6 md:p-8">
          {status === 'processing' && (
            <div className="text-center space-y-6">
              {/* Meta Branding */}
              <div className="flex justify-center items-center space-x-3">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Facebook className="w-8 h-8 text-white" />
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                  <Instagram className="w-8 h-8 text-white" />
                </div>
              </div>
              
              {/* Loading Animation */}
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-background rounded-full" />
                </div>
              </div>
              
              {/* Progress Text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Connecting to Meta</h2>
                <p className="text-muted-foreground text-lg">{message}</p>
              </div>
              
              {/* Progress Steps */}
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-primary/25 animate-pulse delay-150" />
              </div>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center space-y-6">
              {/* Success Animation */}
              <div className="relative">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                {/* Celebration Effect */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border-4 border-green-200 rounded-full animate-ping opacity-75" />
                </div>
              </div>
              
              {/* Success Message */}
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-green-700">Successfully Connected!</h2>
                <p className="text-muted-foreground">{message}</p>
                
                {/* Connected Platforms */}
                {connectedPlatforms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Connected platforms:</p>
                    <div className="flex justify-center gap-2">
                      {connectedPlatforms.map((platform) => (
                        <div key={platform} className="flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full">
                          {platform === 'facebook' && <Facebook className="w-4 h-4 text-blue-600" />}
                          {platform === 'instagram' && <Instagram className="w-4 h-4 text-purple-600" />}
                          <span className="text-sm font-medium capitalize">{platform}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Taking you to your accounts...</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/social-accounts')}
                  className="w-full"
                >
                  Continue to Accounts
                </Button>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center space-y-6">
              {/* Error Icon */}
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              
              {/* Error Message */}
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-red-700">Connection Failed</h2>
                <p className="text-muted-foreground">{message}</p>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/social-accounts')}
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/social-accounts')}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Accounts
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Redirecting automatically in a few seconds...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallbackPage;