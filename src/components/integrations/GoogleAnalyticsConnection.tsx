import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleAnalyticsSettings {
  id: string;
  property_id: string;
  connection_status: string;
  service_account_configured: boolean;
  last_test_at?: string;
}

export const GoogleAnalyticsConnection = () => {
  const { user } = useAuth();
  const [propertyId, setPropertyId] = useState("");
  const [settings, setSettings] = useState<GoogleAnalyticsSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSettings();
    
    // Check for OAuth callback results
    const urlParams = new URLSearchParams(window.location.search);
    const gaSuccess = urlParams.get('ga_success');
    const gaError = urlParams.get('ga_error');
    
    if (gaSuccess) {
      setSuccess("Google Analytics connected successfully!");
      loadSettings();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (gaError) {
      const errorMessages: Record<string, string> = {
        'invalid_callback': 'Invalid OAuth callback',
        'invalid_state': 'Invalid OAuth state',
        'token_exchange_failed': 'Failed to exchange authorization code',
        'callback_failed': 'OAuth callback failed'
      };
      setError(errorMessages[gaError] || `OAuth error: ${gaError}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('google_analytics_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
        setPropertyId(data.property_id);
      }
    } catch (err) {
      console.error('Error loading GA settings:', err);
    }
  };

  const initiateOAuth = async () => {
    if (!propertyId.trim()) {
      setError("Please enter a Google Analytics Property ID");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.functions.invoke('oauth-initiate', {
        body: { propertyId: propertyId.trim() }
      });

      if (error) throw error;

      if (data.success && data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('Invalid response from OAuth initiation');
      }
    } catch (err: any) {
      console.error('OAuth initiation error:', err);
      setError(err.message || 'Failed to initiate Google Analytics connection');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!settings) return;

    setTestLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.functions.invoke('ga-report-data', {
        body: { 
          propertyId: settings.property_id,
          dateRange: 7 
        }
      });

      if (error) throw error;

      if (data.success) {
        setSuccess("Connection test successful!");
        // Update last test time
        await supabase
          .from('google_analytics_settings')
          .update({ last_test_at: new Date().toISOString() })
          .eq('id', settings.id);
        
        loadSettings();
      } else {
        throw new Error('Connection test failed');
      }
    } catch (err: any) {
      console.error('Connection test error:', err);
      setError(err.message || 'Connection test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const disconnect = async () => {
    if (!settings) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from('google_analytics_settings')
        .delete()
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(null);
      setPropertyId("");
      setSuccess("Google Analytics disconnected successfully");
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError(err.message || 'Failed to disconnect Google Analytics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'authorizing': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Google Analytics 4
          {settings && getStatusIcon(settings.connection_status)}
        </CardTitle>
        <CardDescription>
          Connect your Google Analytics 4 property to display website analytics data
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property-id">GA4 Property ID</Label>
            <Input
              id="property-id"
              placeholder="e.g., 123456789"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              disabled={loading || !!settings}
            />
            <p className="text-sm text-muted-foreground">
              Find this in Google Analytics under Admin → Property Settings
            </p>
          </div>

          {settings ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Property ID: {settings.property_id}</p>
                  <p className={`text-sm ${getStatusColor(settings.connection_status)}`}>
                    Status: {settings.connection_status}
                  </p>
                  {settings.last_test_at && (
                    <p className="text-xs text-muted-foreground">
                      Last tested: {new Date(settings.last_test_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testLoading || settings.connection_status !== 'connected'}
                  >
                    {testLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={disconnect}
                    disabled={loading}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={initiateOAuth}
              disabled={loading || !propertyId.trim()}
              className="w-full"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Connect with Google Analytics
            </Button>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Setup Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Go to your Google Analytics 4 property</li>
            <li>Navigate to Admin → Property Settings</li>
            <li>Copy your Property ID (numeric value)</li>
            <li>Paste it above and click "Connect with Google Analytics"</li>
            <li>Authorize access to your analytics data</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};