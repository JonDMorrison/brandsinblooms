import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Play, Loader2 } from 'lucide-react';
import { testOAuthSetup, clearOAuthStorage, isOAuthTestEnvironment } from '@/utils/oauthTestUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TestResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, any>;
}

export const SocialMediaIntegrationTest: React.FC = () => {
  const { user } = useAuth();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialConnections, setSocialConnections] = useState<any[]>([]);

  const runTests = async () => {
    setLoading(true);
    try {
      console.log('🧪 Starting comprehensive social media integration test...');
      
      // Run OAuth setup test
      const oauthResult = await testOAuthSetup();
      
      // Test social connections query
      if (user) {
        const { data: connections, error } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id);
        
        if (!error) {
          setSocialConnections(connections || []);
          oauthResult.info.existingConnections = connections?.length || 0;
        }
      }
      
      // Test current user's approved content
      const { data: approvedTasks, error: tasksError } = await supabase
        .from('content_tasks')
        .select('id, status, post_type, user_id, created_at')
        .eq('status', 'approved')
        .eq('user_id', user?.id || '');
        
      if (!tasksError) {
        oauthResult.info.userApprovedTasks = approvedTasks?.length || 0;
        if ((approvedTasks?.length || 0) > 0) {
          oauthResult.warnings.push(`User has ${approvedTasks?.length} approved tasks (should be 0 for new users)`);
        }
      }
      
      // Test global approved content (potential data leakage issue)
      const { data: allApprovedTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select('id, status, post_type, user_id, created_at')
        .eq('status', 'approved')
        .limit(10);
        
      if (!allTasksError) {
        oauthResult.info.totalApprovedTasks = allApprovedTasks?.length || 0;
        if ((allApprovedTasks?.length || 0) > 0) {
          oauthResult.warnings.push(`Found ${allApprovedTasks?.length} total approved tasks in system (may cause data leakage)`);
        }
      }
      
      setTestResult(oauthResult);
      console.log('🧪 Test completed:', oauthResult);
      
    } catch (error) {
      console.error('🧪 Test failed:', error);
      setTestResult({
        success: false,
        errors: [`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        info: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = () => {
    clearOAuthStorage();
    setTestResult(null);
  };

  const canTestOAuth = isOAuthTestEnvironment();

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Social Media Integration Test
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comprehensive test of OAuth setup, database security, and social connections
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Environment Check */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Current Environment:</strong> {window.location.origin}
            {canTestOAuth ? (
              <Badge variant="default" className="ml-2">OAuth Ready</Badge>
            ) : (
              <Badge variant="destructive" className="ml-2">OAuth Not Available</Badge>
            )}
          </AlertDescription>
        </Alert>

        {/* Test Controls */}
        <div className="flex gap-4">
          <Button 
            onClick={runTests} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Integration Test
          </Button>
          
          <Button 
            variant="outline" 
            onClick={clearStorage}
            disabled={loading}
          >
            Clear OAuth Storage
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <h3 className="text-lg font-medium">
                Test {testResult.success ? 'Passed' : 'Failed'}
              </h3>
            </div>

            {/* Errors */}
            {testResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Errors:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {testResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {testResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warnings:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {testResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Test Information</h4>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(testResult.info, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Social Connections Status */}
        <div className="border-t pt-6">
          <h4 className="font-medium mb-3">Current Social Connections</h4>
          {socialConnections.length === 0 ? (
            <p className="text-gray-500 text-sm">No social media accounts connected</p>
          ) : (
            <div className="space-y-2">
              {socialConnections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">{connection.platform}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{connection.platform_account_name}</span>
                    <Badge variant={connection.is_active ? "default" : "secondary"}>
                      {connection.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next Steps */}
        {testResult && !testResult.success && (
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Next Steps:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Fix any errors shown above</li>
                <li>Ensure Facebook app redirect URIs are properly configured</li>
                <li>Test the connection flow by clicking "Connect Meta" in Social Accounts</li>
                <li>Verify social connections are saved correctly</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};