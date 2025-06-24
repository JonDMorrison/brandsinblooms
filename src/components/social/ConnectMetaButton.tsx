
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
      
      // Use the actual Facebook App ID
      const clientId = '2527232767625484';
      
      console.log('Initiating OAuth with:', {
        clientId,
        redirectUri,
        scopes,
        state
      });
      
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      console.log('Redirecting to:', authUrl.toString());
      
      // Show loading message
      toast.info('Redirecting to Facebook for authentication...');
      
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
      disabled={loading || !user}
      className="w-full bg-garden-green hover:bg-garden-green-dark text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
      size="lg"
    >
      <Facebook className="h-4 w-4" />
      <Instagram className="h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Meta'}
    </Button>
  );
};
