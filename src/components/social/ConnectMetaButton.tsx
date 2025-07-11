
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOAuthConfig } from '@/lib/api/oauth';
import { OAuthLoadingOverlay } from './OAuthLoadingOverlay';
import { showConnectionSuccessToast } from './ConnectionSuccessToast';
import { AgeVerificationModal } from './AgeVerificationModal';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'preparing' | 'redirecting'>('preparing');
  const [unavailable, setUnavailable] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [ageError, setAgeError] = useState(false);
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

    // Clear any previous age error and show age verification modal
    setAgeError(false);
    setShowAgeModal(true);
  };

  const handleAgeConfirm = async () => {
    setShowAgeModal(false);
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

  const handleAgeDeny = () => {
    setShowAgeModal(false);
    setAgeError(true);
  };

  const handleAgeModalClose = () => {
    setShowAgeModal(false);
  };

  if (unavailable) {
    return (
      <div className="w-full p-4 rounded-lg bg-background/50 border border-border/50">
        <p className="text-sm text-muted-foreground text-center">
          Social posting temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <>
      <AgeVerificationModal
        isOpen={showAgeModal}
        onConfirm={handleAgeConfirm}
        onDeny={handleAgeDeny}
        onClose={handleAgeModalClose}
      />
      <OAuthLoadingOverlay isVisible={loading} step={loadingStep} />
      <div className="space-y-3">
        {ageError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive text-center">
              Sorry, you must be at least 13 years old to connect your Meta account.
            </p>
          </div>
        )}
        <Button
          onClick={handleConnect} 
          disabled={loading || !user}
          className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white px-8 w-full shadow-2xl hover:shadow-blue-500/25 backdrop-blur-sm border border-white/20 transition-all duration-500 hover:scale-105 group"
          size="lg"
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg transition-opacity duration-300 group-hover:bg-white/20"></div>
          
          {/* Icon container with animations */}
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
              <Facebook className="h-4 w-4 text-white" />
            </div>
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
              <Instagram className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white ml-2 transition-all duration-300 group-hover:text-white/90">
              {loading ? 'Connecting...' : 'Connect Meta'}
            </span>
          </div>
          
          {/* Animated gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
        </Button>
      </div>
    </>
  );
};
