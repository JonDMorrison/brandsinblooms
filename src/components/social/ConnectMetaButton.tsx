import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOAuthConfig } from '@/lib/api/oauth';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const { user } = useAuth();

  // Check for success callback
  useEffect(() => {
    const successData = sessionStorage.getItem('social_connection_success');
    if (successData) {
      try {
        const { message, timestamp } = JSON.parse(successData);
        if (Date.now() - timestamp < 30000) {
          toast.success(message);
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
      
      // Build Facebook OAuth URL
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', combinedState);
      
      console.log('🔗 Redirecting to Meta OAuth:', {
        redirectUri,
        state: combinedState.substring(0, 12) + '...',
        clientId: clientId.substring(0, 8) + '...',
        fullOAuthUrl: authUrl.toString(),
        timestamp: new Date().toISOString()
      });
      
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
      <div className="w-full p-4 rounded-lg bg-background/50 border border-border/50">
        <p className="text-sm text-muted-foreground text-center">
          Social posting temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleConnect} 
      disabled={loading || !user}
      className="w-full bg-primary hover:bg-primary/90"
      size="lg"
    >
      <Facebook className="h-4 w-4" />
      <Instagram className="h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Meta'}
    </Button>
  );
};