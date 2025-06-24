
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    
    try {
      // Generate a random state parameter for security
      const state = crypto.randomUUID();
      
      // Store the state in sessionStorage to verify later
      sessionStorage.setItem('oauth_state', state);
      
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
      
      // Use environment variable or hardcoded client ID for OAuth
      // The client ID is safe to expose in frontend code
      const clientId = '1051205399952993'; // Your Facebook App ID
      
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      // Redirect to Facebook OAuth
      window.location.href = authUrl.toString();
      
    } catch (error) {
      console.error('OAuth initiation error:', error);
      toast.error('Failed to initiate connection');
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleConnect} 
      disabled={loading}
      className="flex items-center gap-2"
    >
      <Facebook className="h-4 w-4" />
      <Instagram className="h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Meta'}
    </Button>
  );
};
