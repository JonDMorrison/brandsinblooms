import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Facebook, Instagram, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FacebookAppSetupGuide } from '@/components/social/FacebookAppSetupGuide';
import { getOAuthRedirectUri } from '@/utils/environmentUtils';


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
  const [showAppSetupGuide, setShowAppSetupGuide] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);

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
        
        // Detect specific Facebook errors
        if (error === 'access_denied' && errorDescription?.toLowerCase().includes('not active')) {
          setMessage('The Facebook app is not active or you need to be added as a test user.');
          setShowAppSetupGuide(true);
        } else if (error === 'access_denied') {
          setMessage('You declined to authorize the connection. Please try again if you want to connect your accounts.');
        } else {
          setMessage(`Authorization failed: ${errorDescription || error}`);
        }
        
        setTimeout(() => navigate('/social-accounts'), 8000);
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

      // CRITICAL: Prevent duplicate exchanges with state flag
      if (isExchanging) {
        console.warn('⚠️ Exchange already in progress, ignoring duplicate call');
        return;
      }

      // Note: Duplicate exchanges are now guarded by the isExchanging flag
      // and backend idempotency / code-usage tracking in the exchange-oauth-code function.

      // CHECK 1: Wait for auth to load FIRST (before state validation)
      if (authLoading) {
        console.log('⏳ Waiting for authentication to complete...');
        setMessage('Verifying authentication...');
        return;
      }

      // CHECK 2: Verify user is authenticated BEFORE state validation
      if (!user) {
        console.error('❌ No authenticated user during OAuth callback');
        setStatus('error');
        setMessage('You must be logged in to connect social media accounts');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      // CHECK 3: ONLY NOW validate state (user is confirmed authenticated)
      const storedState = sessionStorage.getItem('oauth_state');
      const backupState = localStorage.getItem('oauth_state_backup');
      const primaryBackup = localStorage.getItem('oauth_state_primary');

      const hasStoredState = !!(storedState || backupState || primaryBackup);
      const stateMatches = state === storedState || state === backupState || state === primaryBackup;
      const stateValid = !hasStoredState || stateMatches; // If we have no stored state, allow but log a warning
      
      // ═══════════════════════════════════════════════════════════
      // 🔍 CALLBACK PAGE - REDIRECT URI VERIFICATION
      // ═══════════════════════════════════════════════════════════
      console.log('🔗 Callback Page - Redirect URI Received:', {
        fullUrl: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        expectedPath: '/auth/callback',
        matchesExpected: window.location.pathname === '/auth/callback',
        timestamp: new Date().toISOString()
      });
      
      console.log('🔐 State validation (detailed):', { 
        receivedState: state?.substring(0, 20) + '...',
        sessionStorageState: storedState?.substring(0, 20) + '...',
        localStorageBackup: backupState?.substring(0, 20) + '...',
        localStoragePrimary: primaryBackup?.substring(0, 20) + '...',
        hasStoredState,
        stateMatches,
        isValid: stateValid,
        hasUser: !!user,
        authLoading,
        timestamp: new Date().toISOString()
      });

      if (hasStoredState && !stateMatches) {
        console.error('❌ State mismatch - security verification failed (stored state exists but does not match)');
        setStatus('error');
        setMessage('Security verification failed. Please try connecting again from Social Accounts.');
        setTimeout(() => navigate('/social-accounts'), 3000);
        return;
      }

      if (!hasStoredState) {
        console.warn('⚠️ No stored OAuth state found. Proceeding because user is authenticated and redirect URI is trusted.');
      }

      // Clear stored states after successful validation
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');
      localStorage.removeItem('oauth_state_primary');

      console.log('Starting OAuth exchange for authenticated user');
      
      // Set exchange flag to prevent concurrent calls
      setIsExchanging(true);

      try {
        setMessage('Exchanging authorization code...');
        
          const exchangePayload = {
            code,
            state,
            // Must match the URL authorized with Facebook
            redirect_uri: getOAuthRedirectUri()
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
        
        // Set success flag for social accounts page with platform details
        sessionStorage.setItem('social_connection_success', JSON.stringify({
          message: successMessage,
          platforms: data.connections || [],
          timestamp: Date.now()
        }));
        
        console.log('OAuth success, redirecting to social accounts');
        setTimeout(() => navigate(`/social-accounts${window.location.search}`), 3000);
        
      } catch (error: any) {
        console.error('OAuth exchange error:', error);
        
        setStatus('error');
        
        // Map backend errors to user-friendly messages
        let errorMessage = 'Failed to connect Meta account. Please try again.';
        if (error?.message) {
          const errorText = error.message.toLowerCase();
          if (errorText.includes('already been processed') || 
              errorText.includes('no longer valid') ||
              errorText.includes('expired') ||
              errorText.includes('already been used') ||
              errorText.includes('duplicate')) {
            errorMessage = 'This authorization link has expired. Please click Connect Meta again from your Social Accounts page.';
          } else if (errorText.includes('unauthorized') || errorText.includes('authentication')) {
            errorMessage = 'Authentication failed. Please log in and try again.';
          } else if (errorText.includes('exchange failed')) {
            errorMessage = 'Unable to connect to Meta platform. Please try again.';
          } else if (errorText.includes('no response data')) {
            errorMessage = 'Connection service temporarily unavailable. Please try again.';
          } else if (errorText.includes('internal server error')) {
            errorMessage = 'A server error occurred. This may be due to an expired authorization. Please try connecting again.';
          } else {
            errorMessage = `Connection failed: ${error.message || 'Unknown error'}`;
          }
        }
        
        setMessage(errorMessage);
        setTimeout(() => navigate('/social-accounts'), 5000);
      } finally {
        // Always reset the exchanging flag
        setIsExchanging(false);
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
  }, [searchParams, navigate, user, authLoading, isExchanging]);

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
                <p className="text-muted-foreground whitespace-pre-line">{message}</p>
              </div>

              {/* Show Facebook App Setup Guide for specific errors */}
              {showAppSetupGuide && (
                <div className="mt-6 text-left">
                  <FacebookAppSetupGuide isAdmin={true} />
                </div>
              )}
              
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