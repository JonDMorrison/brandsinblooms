import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Info, Play, Loader2, RefreshCw } from 'lucide-react';
import { fetchOAuthConfig } from '@/lib/api/oauth';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const OAuthDebugger: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runDebugTest = async () => {
    setLoading(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      environment: {
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        userAgent: navigator.userAgent.substring(0, 100)
      },
      user: user ? {
        id: user.id,
        email: user.email
      } : null,
      tests: {}
    };

    try {
      // Test 1: OAuth Config Fetch
      console.log('🧪 Testing OAuth config fetch...');
      try {
        const config = await fetchOAuthConfig();
        results.tests.oauthConfig = {
          success: true,
          data: {
            hasClientId: !!config.clientId,
            clientIdPrefix: config.clientId?.substring(0, 8) + '...',
            provider: config.provider
          }
        };
        console.log('✅ OAuth config test passed');
      } catch (error) {
        results.tests.oauthConfig = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error('❌ OAuth config test failed:', error);
      }

      // Test 2: Direct Edge Function Call
      console.log('🧪 Testing get-oauth-config edge function directly...');
      try {
        const { data, error } = await supabase.functions.invoke('get-oauth-config');
        results.tests.edgeFunction = {
          success: !error,
          data: data,
          error: error?.message
        };
        console.log('✅ Edge function test completed');
      } catch (error) {
        results.tests.edgeFunction = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error('❌ Edge function test failed:', error);
      }

      // Test 3: Check Browser Storage
      const storageState = {
        sessionStorage: {
          oauth_state: sessionStorage.getItem('oauth_state'),
          oauth_state_backup: localStorage.getItem('oauth_state_backup'),
          processed_oauth_codes: sessionStorage.getItem('processed_oauth_codes'),
          social_connection_success: sessionStorage.getItem('social_connection_success')
        }
      };
      results.tests.browserStorage = {
        success: true,
        data: storageState
      };

      // Test 4: Social Connections Query
      if (user) {
        try {
          const { data: connections, error } = await supabase
            .from('social_connections')
            .select('*')
            .eq('user_id', user.id);
            
          results.tests.socialConnections = {
            success: !error,
            data: {
              count: connections?.length || 0,
              connections: connections?.map(c => ({
                platform: c.platform,
                account_name: c.platform_account_name,
                is_active: c.is_active,
                created_at: c.created_at
              }))
            },
            error: error?.message
          };
        } catch (error) {
          results.tests.socialConnections = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      setTestResults(results);
      console.log('🧪 Debug test completed:', results);

    } catch (error) {
      console.error('🧪 Debug test failed:', error);
      setTestResults({
        ...results,
        globalError: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAllStorage = () => {
    // Clear OAuth storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_state_uuid');
    sessionStorage.removeItem('oauth_state_timestamp');
    sessionStorage.removeItem('oauth_just_completed');
    sessionStorage.removeItem('processed_oauth_codes');
    sessionStorage.removeItem('social_connection_success');
    localStorage.removeItem('oauth_state_backup');
    localStorage.removeItem('oauth_debug');
    localStorage.removeItem('oauth_mount_debug');
    
    console.log('🧹 All OAuth storage cleared');
    setTestResults(null);
  };

  const generateFacebookUrl = async () => {
    try {
      const config = await fetchOAuthConfig();
      const state = crypto.randomUUID();
      const redirectUri = `${window.location.origin}/auth/callback`;
      const scopes = [
        'pages_read_engagement',
        'pages_show_list', 
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights'
      ].join(',');

      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);

      setDebugInfo({
        generatedUrl: authUrl.toString(),
        clientId: config.clientId,
        redirectUri,
        state,
        scopes
      });

      console.log('🔗 Generated Facebook OAuth URL:', authUrl.toString());
    } catch (error) {
      console.error('Failed to generate Facebook URL:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            OAuth Integration Debugger
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runDebugTest} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Full Debug Test
            </Button>
            
            <Button 
              variant="outline" 
              onClick={generateFacebookUrl}
            >
              Generate Facebook URL
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={clearAllStorage}
            >
              Clear Storage
            </Button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Debug Results</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-96">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>

              {/* Test Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(testResults.tests || {}).map(([testName, result]: [string, any]) => (
                  <div key={testName} className="flex items-center gap-2 p-2 border rounded">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">{testName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {debugInfo && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                <strong>Generated OAuth Info:</strong>
                <pre className="text-xs mt-2 whitespace-pre-wrap">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};