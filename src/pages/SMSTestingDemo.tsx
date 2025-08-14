import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ComprehensiveSMSTestingPanel } from '@/components/sms/ComprehensiveSMSTestingPanel';
import { 
  MessageSquare, 
  Shield, 
  Phone, 
  Users, 
  QrCode, 
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

const SMSTestingDemo = () => {
  // Mock campaign data for testing
  const mockCampaignId = 'test-campaign-123';
  const mockCampaignSlug = 'test-campaign';

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">SMS Testing Demo</h1>
        <p className="text-muted-foreground">
          Comprehensive testing environment for SMS functionality, compliance, and delivery validation.
        </p>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>
            Follow these steps to comprehensively test your SMS infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">1</Badge>
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">Message Processing</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Test macro replacement ({`{{HUB}}, {{BUSINESS_NAME}}`}) and message composition
              </p>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">2</Badge>
                <Phone className="w-4 h-4" />
                <span className="font-medium">Individual SMS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send test messages to specific numbers with advanced options
              </p>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">3</Badge>
                <Shield className="w-4 h-4" />
                <span className="font-medium">Compliance</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify opt-out status, quiet hours, and regulatory compliance
              </p>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">4</Badge>
                <Users className="w-4 h-4" />
                <span className="font-medium">Campaign Testing</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Test complete campaign workflows and segment targeting
              </p>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">5</Badge>
                <QrCode className="w-4 h-4" />
                <span className="font-medium">QR Codes</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate and test QR codes for campaigns and promotions
              </p>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">6</Badge>
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Validation</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor logs and validate delivery status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Notices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Use Test Numbers Only:</strong> Always use your own phone numbers or dedicated test numbers. 
            Real SMS charges will apply for actual sends.
          </AlertDescription>
        </Alert>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Twilio Integration:</strong> Your Twilio credentials are configured and ready for testing. 
            Check the edge function logs for detailed delivery status.
          </AlertDescription>
        </Alert>
      </div>

      {/* Testing Infrastructure Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Infrastructure</CardTitle>
          <CardDescription>
            Available tools and services for comprehensive SMS testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h4 className="font-medium">SMS Processor</h4>
              <p className="text-sm text-muted-foreground">Macro replacement & content processing</p>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Phone className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-medium">Twilio Integration</h4>
              <p className="text-sm text-muted-foreground">SMS delivery & status tracking</p>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Shield className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-medium">Compliance Engine</h4>
              <p className="text-sm text-muted-foreground">Opt-out & quiet hours validation</p>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <QrCode className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-medium">QR Generator</h4>
              <p className="text-sm text-muted-foreground">Dynamic QR code creation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Testing Panel */}
      <ComprehensiveSMSTestingPanel 
        campaignId={mockCampaignId}
        campaignSlug={mockCampaignSlug}
      />

      {/* Backend Testing Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Backend Testing Resources</CardTitle>
          <CardDescription>
            Direct access to edge functions and database monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Edge Functions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code>send-sms</code> - Direct SMS sending</li>
                  <li>• <code>compliance-sms-send</code> - Compliance checking</li>
                  <li>• <code>sms-processor</code> - Macro processing</li>
                  <li>• <code>qr-generator</code> - QR code generation</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Database Tables</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code>sms_messages</code> - Message queue</li>
                  <li>• <code>crm_customers</code> - Customer data</li>
                  <li>• <code>crm_sms_campaigns</code> - Campaign data</li>
                  <li>• <code>compliance_logs</code> - Compliance events</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Monitoring</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Supabase Edge Function logs</li>
                  <li>• Real-time delivery status</li>
                  <li>• Error tracking & debugging</li>
                  <li>• Performance metrics</li>
                </ul>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Pro Tip:</strong> Monitor the Supabase dashboard during testing to see real-time 
                function invocations, database changes, and error logs. This provides complete visibility 
                into the SMS delivery pipeline.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSTestingDemo;