import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ExternalLink, Settings, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FacebookAppSetupGuideProps {
  isAdmin?: boolean;
}

export const FacebookAppSetupGuide: React.FC<FacebookAppSetupGuideProps> = ({ isAdmin = false }) => {
  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-warning mt-0.5" />
          <div>
            <CardTitle className="text-lg">Facebook App Configuration Required</CardTitle>
            <CardDescription className="mt-1">
              The Facebook app is currently in Development Mode
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>What does "App not active" mean?</AlertTitle>
          <AlertDescription>
            This error occurs when the Facebook app is in <strong>Development Mode</strong> and not published to the public. 
            Only users added as test users can connect until the app is published.
          </AlertDescription>
        </Alert>

        {isAdmin && (
          <div className="space-y-4 pt-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Admin: How to Fix This
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="pl-4 border-l-2 border-primary/30">
                <h4 className="font-medium mb-1">Option 1: Add Test Users (Temporary)</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to Facebook Developer Console</li>
                  <li>Select your app → <strong>Roles</strong> → <strong>Test Users</strong></li>
                  <li>Click <strong>Add Test Users</strong> or add email addresses</li>
                  <li>Users can now connect while app is in Development Mode</li>
                </ol>
              </div>

              <div className="pl-4 border-l-2 border-green-500/30">
                <h4 className="font-medium mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Option 2: Publish App (Recommended)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to Facebook Developer Console → Your App</li>
                  <li>Navigate to <strong>App Review</strong> → <strong>Permissions and Features</strong></li>
                  <li>Request permissions needed (pages_read_engagement, pages_manage_posts, instagram_basic, etc.)</li>
                  <li>Complete Business Verification if required</li>
                  <li>Once approved, switch app to <strong>Live Mode</strong></li>
                  <li>Go to <strong>Settings</strong> → <strong>Basic</strong> and toggle "App Mode" to Live</li>
                </ol>
              </div>

              <Alert>
                <Users className="h-4 w-4" />
                <AlertTitle>Required Configuration</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Ensure these are configured in your Facebook App:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Valid OAuth Redirect URIs:</strong> https://bloomsuite.app/oauth/callback</li>
                    <li><strong>App Domain:</strong> bloomsuite.app</li>
                    <li><strong>Required Permissions:</strong> pages_read_engagement, pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish, instagram_manage_insights</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Facebook Developer Console
              </Button>
            </div>
          </div>
        )}

        {!isAdmin && (
          <Alert>
            <AlertDescription>
              If you're seeing this error, please contact your administrator or support team. 
              They will need to configure the Facebook app in the Facebook Developer Console.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
