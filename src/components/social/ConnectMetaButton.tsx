
import React, { useState } from 'react';
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
  const [oauthUnavailable, setOauthUnavailable] = useState(false);
  const { user } = useAuth();

  // Check for success on component Mount
  React.useEffect(() => {
    const successData = sessionStorage.getItem('social_connection_success');
    if (successData) {
      try {
        const { message, timestamp } = JSON.parse(successData);
        // Only show success if it's recent (within 30 seconds)
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
    console.log('🚀 Connect Meta button clicked!', { user: !!user });
    alert('🚀 Connect Meta button clicked! Check console for details.');
    
    // Store debug info that persists across redirects
    const debugInfo = {
      step: 'button_clicked',
      timestamp: new Date().toISOString(),
      user: user?.email || 'none',
      currentUrl: window.location.href
    };
    localStorage.setItem('oauth_debug', JSON.stringify(debugInfo));
    
    toast.info('Starting Meta connection...', { duration: 2000 });
    
    if (!user) {
      console.error('❌ No authenticated user found');
      toast.error('Please log in to connect your social media accounts');
      return;
    }

    setLoading(true);
    
    try {
      // Clear any previous OAuth state to start fresh
      const beforeClear = {
        oauth_state: sessionStorage.getItem('oauth_state'),
        oauth_state_backup: localStorage.getItem('oauth_state_backup'),
        oauth_just_completed: sessionStorage.getItem('oauth_just_completed'),
        processed_oauth_codes: sessionStorage.getItem('processed_oauth_codes')
      };
      
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');
      sessionStorage.removeItem('oauth_just_completed');
      sessionStorage.removeItem('processed_oauth_codes');
      sessionStorage.removeItem('oauth_state_uuid');
      sessionStorage.removeItem('oauth_state_timestamp');
      
      // Update debug info
      const debugInfo = { step: 'cleared_state', timestamp: new Date().toISOString(), beforeClear };
      localStorage.setItem('oauth_debug', JSON.stringify(debugInfo));
      
      console.log('🧹 Cleared OAuth state:', { before: beforeClear, cleared: true });
      toast.info('Clearing previous connection state...', { duration: 5000 });
      
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
      
      // Force redirect to current domain (Lovable preview vs production)
      const redirectUri = `${window.location.origin}/auth/callback`;
      console.log('🎯 FORCING redirect to current domain:', redirectUri);
      
      // Get the Facebook Client ID from our backend to ensure consistency
      let clientId: string;
      try {
        console.log('📡 Fetching OAuth config...');
        toast.info('Getting OAuth configuration...', { duration: 5000 });
        
        // Update debug info
        const debugInfo = { step: 'fetching_config', timestamp: new Date().toISOString() };
        localStorage.setItem('oauth_debug', JSON.stringify(debugInfo));
        
        const configData = await fetchOAuthConfig();
        clientId = configData.clientId;
        console.log('✅ OAuth config received successfully');
        toast.info('OAuth config received, redirecting to Meta...', { duration: 5000 });
        
        // Update debug info
        const debugInfo2 = { step: 'config_received', timestamp: new Date().toISOString(), clientId: clientId ? 'present' : 'missing' };
        localStorage.setItem('oauth_debug', JSON.stringify(debugInfo2));
        
      } catch (configError) {
        console.error('❌ Failed to get OAuth config:', configError);
        
        // Store detailed error info
        const errorDebug = { 
          step: 'config_failed', 
          timestamp: new Date().toISOString(), 
          error: configError instanceof Error ? configError.message : 'Unknown error',
          errorDetails: configError
        };
        localStorage.setItem('oauth_debug', JSON.stringify(errorDebug));
        
        toast.error('Social posting temporarily unavailable. Please try again later.');
        setOauthUnavailable(true);
        setLoading(false);
        return;
      }
      
      console.log('🚀 Initiating OAuth with enhanced parameters:', {
        clientId,
        redirectUri,
        scopes,
        state: combinedState,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      try {
        const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', combinedState);
        
        console.log('🔗 Final OAuth URL:', authUrl.toString());
        console.log('🔗 About to redirect to Facebook...');
        console.log('🔍 CRITICAL: Redirect URI being sent to Facebook:', redirectUri);
        console.log('🔍 CRITICAL: Current domain:', window.location.origin);
        alert(`🔗 About to redirect to Facebook OAuth. URL: ${authUrl.toString().substring(0, 100)}...`);
        alert(`🔍 REDIRECT URI: ${redirectUri} - Make sure this EXACTLY matches your Facebook app settings!`);
        
        // Update debug info before redirect
        const debugInfo3 = { 
          step: 'redirecting_to_facebook', 
          timestamp: new Date().toISOString(), 
          authUrl: authUrl.toString(),
          state: combinedState
        };
        localStorage.setItem('oauth_debug', JSON.stringify(debugInfo3));
        
        // Show loading message
        toast.info('Redirecting to Meta for authentication...', {
          duration: 8000
        });
        
        // Small delay to ensure state is stored
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect to Facebook OAuth
        window.location.href = authUrl.toString();
        
      } catch (redirectError) {
        console.error('❌ Error during redirect preparation:', redirectError);
        
        // Store detailed error info
        const errorDebug = { 
          step: 'redirect_failed', 
          timestamp: new Date().toISOString(), 
          error: redirectError instanceof Error ? redirectError.message : 'Unknown redirect error',
          errorDetails: redirectError,
          clientId: clientId ? 'present' : 'missing',
          redirectUri,
          scopes,
          state: combinedState
        };
        localStorage.setItem('oauth_debug', JSON.stringify(errorDebug));
        
        toast.error('Failed to initiate connection. Please try again.');
        setOauthUnavailable(true);
        setLoading(false);
        return;
      }
      
    } catch (error) {
      console.error('❌ OAuth initiation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      toast.error('Failed to initiate connection. Please try again.');
      setOauthUnavailable(true);
      setLoading(false);
      
      // Clean up stored state on error
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state_backup');
      sessionStorage.removeItem('oauth_state_uuid');
      sessionStorage.removeItem('oauth_state_timestamp');
    }
  };

  if (oauthUnavailable) {
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
      disabled={loading || !user || oauthUnavailable}
      className="w-full bg-primary hover:bg-primary/90"
      size="lg"
    >
      <Facebook className="h-4 w-4" />
      <Instagram className="h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Meta'}
    </Button>
  );
};
