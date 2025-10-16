
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, MapPin, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOAuthConfig } from "@/lib/api/oauth";
import { MetaConnectionSuccess } from "../social/MetaConnectionSuccess";

interface SocialConnection {
  id: string;
  platform: string;
  platform_account_name: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export const SocialConnectionManager = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-success') {
        console.log('✅ OAuth success message received from popup');
        toast.success('Successfully connected to Meta platforms!');
        fetchConnections();
        setConnecting(null);
      } else if (event.data?.type === 'oauth-error') {
        console.error('❌ OAuth error message received from popup:', event.data.message);
        toast.error(event.data.message || 'Failed to connect');
        setConnecting(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check for successful connection and refresh
  useEffect(() => {
    const successData = sessionStorage.getItem('social_connection_success');
    if (successData) {
      try {
        const data = JSON.parse(successData);
        // Only refresh if it's recent (within 30 seconds)
        if (Date.now() - data.timestamp < 30000) {
          
          fetchConnections(); // Refresh connections
          
          // Check if there's a returnTo URL parameter and set connected=true
          const currentUrl = new URL(window.location.href);
          const returnTo = currentUrl.searchParams.get('returnTo');
          
          if (returnTo) {
            // Set connected=true to trigger success message and redirect
            currentUrl.searchParams.set('connected', 'true');
            window.history.replaceState({}, '', currentUrl.toString());
          }
        }
        sessionStorage.removeItem('social_connection_success');
      } catch (error) {
        console.error('Error processing success data:', error);
      }
    }
  }, []);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectMeta = async (platformId: string) => {
    setConnecting(platformId);
    
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
      
      // Fetch OAuth config dynamically
      const configData = await fetchOAuthConfig();
      const clientId = configData.clientId;
      
      const redirectUri = `https://bloomsuite.app/oauth/callback`;
      const scope = 'pages_read_engagement,pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights';
      
      // Build Facebook OAuth URL with enhanced parameters for App Review
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', combinedState);
      authUrl.searchParams.set('auth_type', 'rerequest');
      
      console.log(`🔗 Opening ${platformId} OAuth in popup:`, {
        redirectUri,
        state: combinedState.substring(0, 12) + '...',
        timestamp: new Date().toISOString()
      });
      
      // Open OAuth in popup window with centered positioning
      const oauthUrlStr = authUrl.toString();
      const width = 600;
      const height = 700;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);
      
      const oauthPopup = window.open(
        oauthUrlStr, 
        'facebookOAuth', 
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
      
      if (!oauthPopup) {
        console.warn('❌ Popup blocked. Please allow popups for Facebook login.');
        toast.error('Please allow popups to connect Facebook. Click the button again after allowing.');
        setConnecting(null);
      }
    } catch (error) {
      console.error(`Failed to connect ${platformId}:`, error);
      toast.error(`Failed to connect ${platformId}. Please try again.`);
      setConnecting(null);
    }
  };

  const connectGoogleBusiness = async () => {
    setConnecting('google_my_business');
    
    const clientId = 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/business.manage';
    
    const authUrl = `https://accounts.google.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline`;
    
    
    setConnecting(null);
  };

  const disconnectPlatform = async (connectionId: string, platform: string) => {
    try {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      fetchConnections();
    } catch (error) {
      console.error('Error disconnecting platform:', error);
    }
  };

  const syncAnalytics = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('sync-analytics');
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error syncing analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      description: 'Connect your Facebook page to track post performance and audience insights',
      color: 'bg-blue-600'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      description: 'Monitor your Instagram business account engagement and reach',
      color: 'bg-gradient-to-r from-purple-600 to-pink-600'
    },
    {
      id: 'google_my_business',
      name: 'Google My Business',
      icon: MapPin,
      description: 'Track local search performance, calls, and direction requests',
      color: 'bg-green-600'
    }
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Media Connections</CardTitle>
          <CardDescription>Loading your connected accounts...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if both Facebook and Instagram are connected
  const facebookConnection = connections.find(c => c.platform === 'facebook' && c.is_active);
  const instagramConnection = connections.find(c => c.platform === 'instagram' && c.is_active);
  const bothMetaConnected = facebookConnection && instagramConnection;

  // Show success section if both Meta platforms are connected and showSuccessView is true
  if (bothMetaConnected && showSuccessView) {
    return (
      <div className="space-y-6">
        <MetaConnectionSuccess
          facebookConnection={facebookConnection}
          instagramConnection={instagramConnection}
          onSyncAnalytics={syncAnalytics}
          onManageConnections={() => {
            setShowSuccessView(false);
          }}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Social Media Connections</CardTitle>
          <CardDescription>
            Connect your social media accounts to track real analytics data
          </CardDescription>
        </div>
        
        <div className="flex items-center gap-2">
          {bothMetaConnected && (
            <Button 
              onClick={() => setShowSuccessView(true)}
              variant="default"
              size="sm"
            >
              Back to Overview
            </Button>
          )}
          {connections.length > 0 && (
            <Button 
              onClick={syncAnalytics}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Data
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {platforms.map((platform) => {
          const connection = connections.find(c => c.platform === platform.id);
          const isConnected = !!connection;
          const isExpired = connection && new Date(connection.expires_at) < new Date();
          const Icon = platform.icon;

          return (
            <div key={platform.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{platform.name}</h3>
                    {isConnected && (
                      <Badge variant={isExpired ? "destructive" : "default"} className="text-xs">
                        {isExpired ? (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Token Expired
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{platform.description}</p>
                  {isConnected && (
                    <p className="text-xs text-gray-500 mt-1">
                      Connected as: {connection.platform_account_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Privacy Policy Notice for Facebook/Instagram */}
                {(platform.id === 'facebook' || platform.id === 'instagram') && !isConnected && (
                  <div className="text-right max-w-xs">
                    <p className="text-xs italic text-muted-foreground">
                      By connecting you agree to our{' '}
                      <a 
                        href="https://brandsinblooms.com/pages/bloomsuite-privacy" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline"
                      >
                        Privacy Policy
                      </a>
                      {' '}and{' '}
                      <a 
                        href="https://brandsinblooms.com/pages/terms-of-service" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline"
                      >
                        Terms
                      </a>
                      .
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      {isExpired && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (platform.id === 'facebook') connectMeta(platform.id);
                            else if (platform.id === 'instagram') connectMeta(platform.id);
                            else if (platform.id === 'google_my_business') connectGoogleBusiness();
                          }}
                          disabled={connecting === platform.id}
                        >
                          Reconnect
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectPlatform(connection.id, platform.name)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (platform.id === 'facebook') connectMeta(platform.id);
                        else if (platform.id === 'instagram') connectMeta(platform.id);
                        else if (platform.id === 'google_my_business') connectGoogleBusiness();
                      }}
                      disabled={connecting === platform.id}
                    >
                      {connecting === platform.id ? 'Connecting...' : 'Connect'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
