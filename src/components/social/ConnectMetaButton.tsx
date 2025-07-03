
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in to connect your social media accounts');
      return;
    }

    setLoading(true);
    
    try {
      // Generate a cryptographically secure random state parameter
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const combinedState = `${state}-${timestamp}`;
      
      console.log('🔐 Generated OAuth state:', { state, timestamp, combined: combinedState });
      
      // Store the state in multiple locations for redundancy
      sessionStorage.setItem('oauth_state', combinedState);
      localStorage.setItem('oauth_state_backup', combinedState);
      
      // Also store individual components for debugging
      sessionStorage.setItem('oauth_state_uuid', state);
      sessionStorage.setItem('oauth_state_timestamp', timestamp);
      
      console.log('💾 Stored OAuth state in multiple locations');
      
      // Clear any previous completion flags
      sessionStorage.removeItem('oauth_just_completed');
      
      // Required permissions for Facebook Pages and Instagram Business
      const scopes = [
        'pages_read_engagement',
        'pages_show_list',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights'
      ].join(',');
      
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      // Use your configured Facebook App ID from secrets
      const clientId = '2527232767625484'; // This should match your FB_CLIENT_ID secret
      
      console.log('🚀 Initiating OAuth with enhanced parameters:', {
        clientId,
        redirectUri,
        scopes,
        state: combinedState,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', combinedState);
      
      console.log('🔗 Final OAuth URL:', authUrl.toString());
      
      // Show loading message
      toast.info('Redirecting to Meta for authentication...', {
        duration: 3000
      });
      
      // Small delay to ensure state is stored
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to Facebook OAuth
      window.location.href = authUrl.toString();
      
    } catch (error) {
      console.error('❌ OAuth initiation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      toast.error('Failed to initiate connection. Please try again.');
      setLoading(false);
      
      // Clean up stored state on error
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');
      sessionStorage.removeItem('oauth_state_uuid');
      sessionStorage.removeItem('oauth_state_timestamp');
    }
  };

  return (
    <Button 
      onClick={handleConnect} 
      disabled={loading || !user}
      className="w-full"
      size="lg"
    >
      <Facebook className="h-4 w-4" />
      <Instagram className="h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Meta'}
    </Button>
  );
};
