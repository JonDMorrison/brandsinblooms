
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOAuthConfig } from '@/lib/api/oauth';
import { OAuthLoadingOverlay } from './OAuthLoadingOverlay';
import { showConnectionSuccessToast } from './ConnectionSuccessToast';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'preparing' | 'redirecting'>('preparing');
  const [unavailable, setUnavailable] = useState(false);
  const { user } = useAuth();

  // Check for success callback
  useEffect(() => {
    const successData = sessionStorage.getItem('social_connection_success');
    if (successData) {
      try {
        const data = JSON.parse(successData);
        if (Date.now() - data.timestamp < 30000) {
          // Show enhanced success toast
          showConnectionSuccessToast(data);
          onSuccess();
        }
        sessionStorage.removeItem('social_connection_success');
      } catch (error) {
        console.error('Error processing success data:', error);
      }
    }
  }, [onSuccess]);

  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in to connect your social media accounts');
      return;
    }

    setLoading(true);
    setLoadingStep('preparing');
    
    try {
      // Clear any previous OAuth state
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');
      sessionStorage.removeItem('processed_oauth_codes');
      
      // Generate secure state parameter
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const combinedState = `${state}-${timestamp}`;
      
      // Store state with redundancy
      sessionStorage.setItem('oauth_state', combinedState);
      localStorage.setItem('oauth_state_backup', combinedState);
      
      // Define scopes
      const scopes = [
        'pages_read_engagement',
        'pages_show_list', 
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights'
      ].join(',');
      
      // Dynamic redirect URI based on current domain
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      // Fetch OAuth config
      const configData = await fetchOAuthConfig();
      const clientId = configData.clientId;
      
      // Build Facebook OAuth URL with enhanced parameters for App Review
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', combinedState);
      authUrl.searchParams.set('auth_type', 'rerequest'); // Ensures consent screen is shown
      
      console.log('🔗 Redirecting to Meta OAuth:', {
        redirectUri,
        state: combinedState.substring(0, 12) + '...',
        clientId: clientId.substring(0, 8) + '...',
        fullOAuthUrl: authUrl.toString(),
        timestamp: new Date().toISOString()
      });
      
      // Show redirecting step
      setLoadingStep('redirecting');
      
      // Small delay to show the redirecting message
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Redirect to Facebook OAuth
      window.location.href = authUrl.toString();
      
    } catch (error) {
      console.error('OAuth initiation error:', error);
      toast.error('Failed to initiate connection. Please try again.');
      setUnavailable(true);
      setLoading(false);
    }
  };

  if (unavailable) {
    return (
      <div className="relative w-full p-6 rounded-xl bg-gradient-to-br from-surface-secondary/80 to-surface-tertiary/60 backdrop-blur-sm border border-border/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-destructive/10 opacity-50" />
        <div className="relative z-10 text-center">
          <p className="text-sm text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Service Temporarily Unavailable</span>
            <br />
            Please try again in a few moments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OAuthLoadingOverlay isVisible={loading} step={loadingStep} />
      <div className="relative">
        {/* Enhanced Content Area with Glassmorphism */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 overflow-hidden shadow-xl">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.1),transparent_50%)]" />
          </div>
          
          <div className="relative z-10 text-center space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-text-primary">
                Connect Your Meta Platforms
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
                Link your Facebook pages and Instagram business accounts to start publishing content seamlessly.
              </p>
            </div>

            {/* Enhanced Connect Button */}
            <div className="flex justify-center">
              <button
                onClick={handleConnect}
                disabled={loading || !user}
                className={`
                  group relative overflow-hidden px-8 py-4 rounded-xl font-semibold text-white
                  bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
                  hover:from-blue-600 hover:via-purple-600 hover:to-pink-600
                  shadow-lg hover:shadow-xl hover:shadow-purple-500/25
                  transform transition-all duration-300 ease-apple
                  hover:scale-105 hover:-translate-y-0.5
                  focus:outline-none focus:ring-4 focus:ring-purple-500/30 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                  active:scale-95 min-w-[200px]
                `}
              >
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Button content */}
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-sm">
                        {loadingStep === 'preparing' ? 'Preparing...' : 'Redirecting...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Facebook className="h-5 w-5 text-blue-100 group-hover:text-white transition-colors duration-300" />
                        <Instagram className="h-5 w-5 text-pink-100 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <span className="text-base font-medium">Connect Meta</span>
                    </>
                  )}
                </div>

                {/* Enhanced hover effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 animate-pulse" />
                </div>
              </button>
            </div>

            {/* Enhanced Platform Indicators */}
            <div className="flex items-center justify-center gap-6 pt-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Facebook className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Facebook Pages</span>
              </div>
              <div className="w-px h-4 bg-border/30" />
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-pink-500/10 border border-pink-500/20">
                <Instagram className="h-4 w-4 text-pink-600" />
                <span className="text-xs font-medium text-pink-700">Instagram Business</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
