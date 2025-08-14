import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
// Note: Select component is deprecated, using regular HTML select
import { 
  MessageSquare, 
  Zap, 
  ExternalLink, 
  QrCode, 
  Copy, 
  Phone, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Users,
  Settings
} from 'lucide-react';
import { useSMSProcessor } from '@/hooks/useSMSProcessor';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SMSTestingPanelProps {
  campaignId?: string;
  campaignSlug?: string;
}

export const ComprehensiveSMSTestingPanel: React.FC<SMSTestingPanelProps> = ({
  campaignId,
  campaignSlug
}) => {
  const { toast } = useToast();
  const { processSMSMessage, generateQRCode, processing } = useSMSProcessor();
  
  // Message Testing State
  const [testMessage, setTestMessage] = useState('Check out our special offer! {{HUB}} Use code SAVE20');
  const [processedResult, setProcessedResult] = useState<any>(null);
  
  // QR Code Testing State
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('SAVE20');
  
  // Individual SMS Testing State
  const [testPhoneNumber, setTestPhoneNumber] = useState('+1234567890');
  const [directSMSMessage, setDirectSMSMessage] = useState('Hello! This is a test SMS from our system.');
  const [smsStatus, setSMSStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  
  // Compliance Testing State
  const [complianceTestPhone, setComplianceTestPhone] = useState('+1234567890');
  const [complianceResults, setComplianceResults] = useState<any>(null);
  
  // Campaign Testing State
  const [testCampaignName, setTestCampaignName] = useState('Test Campaign');
  const [testSegment, setTestSegment] = useState('test_segment');
  const [testRecipientCount, setTestRecipientCount] = useState(1);
  
  // Advanced Testing Options
  const [skipOptOutCheck, setSkipOptOutCheck] = useState(false);
  const [skipQuietHours, setSkipQuietHours] = useState(false);
  const [forceFooter, setForceFooter] = useState(false);

  const handleProcessMessage = async () => {
    if (!campaignId) {
      toast({
        title: "Error",
        description: "Campaign ID is required for SMS processing.",
        variant: "destructive"
      });
      return;
    }

    const result = await processSMSMessage(testMessage, campaignId);
    if (result) {
      setProcessedResult(result);
      toast({
        title: "Success",
        description: "SMS message processed successfully."
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to process SMS message.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateQR = async () => {
    const qrData = await generateQRCode(couponCode);
    if (qrData) {
      setQrCode(qrData);
      toast({
        title: "Success",
        description: "QR code generated successfully."
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to generate QR code.",
        variant: "destructive"
      });
    }
  };

  const handleSendTestSMS = async () => {
    setSMSStatus('sending');
    
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: testPhoneNumber,
          body: directSMSMessage,
          skipOptOutCheck,
          skipQuietHours,
          forceFooter
        }
      });

      if (error) throw error;

      setSMSStatus('sent');
      toast({
        title: "SMS Sent!",
        description: `Test message sent to ${testPhoneNumber}`,
      });
    } catch (error: any) {
      setSMSStatus('failed');
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send test SMS",
        variant: "destructive"
      });
    }
  };

  const handleComplianceTest = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('compliance-sms-send', {
        body: {
          to: complianceTestPhone,
          body: "Compliance test message",
          dryRun: true // Don't actually send, just check compliance
        }
      });

      if (error) throw error;

      setComplianceResults(data);
      toast({
        title: "Compliance Check Complete",
        description: "Compliance test results are ready"
      });
    } catch (error: any) {
      toast({
        title: "Compliance Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard."
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'sending': return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      default: return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Comprehensive SMS Testing</h3>
        <p className="text-sm text-muted-foreground">
          Complete testing suite for SMS functionality including macro processing, compliance, and delivery testing.
        </p>
      </div>

      <Tabs defaultValue="message-processing" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="message-processing">Message Processing</TabsTrigger>
          <TabsTrigger value="individual-sms">Individual SMS</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="campaign">Campaign Testing</TabsTrigger>
          <TabsTrigger value="qr-codes">QR Codes</TabsTrigger>
        </TabsList>

        {/* Message Processing Tab */}
        <TabsContent value="message-processing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                SMS Macro Processing
              </CardTitle>
              <CardDescription>
                Test how your SMS messages will be processed with macros like {'{{HUB}}'}, {'{{BUSINESS_NAME}}'}, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-message">Test Message</Label>
                <Textarea
                  id="test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter your SMS message with macros..."
                  rows={3}
                />
                <div className="text-xs text-muted-foreground">
                  Available macros: <code>{'{{HUB}}'}</code>, <code>{'{{BUSINESS_NAME}}'}</code>, 
                  <code>{'{{CURRENT_DATE}}'}</code>, <code>{'{{CURRENT_TIME}}'}</code>
                </div>
                <div className="text-xs">
                  Character count: <span className={testMessage.length > 160 ? 'text-red-500' : 'text-green-500'}>
                    {testMessage.length}/160
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleProcessMessage}
                disabled={processing || !campaignId}
                className="w-full"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Processing...' : 'Process Message'}
              </Button>

              {processedResult && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Original Message</Label>
                    <div className="p-3 bg-muted rounded-md font-mono text-sm">
                      {processedResult.original_message}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Processed Message</Label>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md font-mono text-sm">
                      {processedResult.processed_message}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(processedResult.processed_message)}
                        className="ml-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {processedResult.hub_url && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Generated Hub URL</Label>
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <code className="flex-1 text-sm">{processedResult.hub_url}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(processedResult.hub_url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Badge variant={processedResult.macro_usage.hub_used ? "default" : "secondary"}>
                      Hub Macro: {processedResult.macro_usage.hub_used ? 'Used' : 'Not Used'}
                    </Badge>
                    <Badge variant="outline">
                      Total Macros: {processedResult.macro_usage.total_macros}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual SMS Tab */}
        <TabsContent value="individual-sms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Individual SMS Testing
              </CardTitle>
              <CardDescription>
                Send test SMS messages directly to specific phone numbers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test-phone">Test Phone Number</Label>
                  <Input
                    id="test-phone"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMS Status</Label>
                  <div className="flex items-center gap-2 p-2 border rounded">
                    {getStatusIcon(smsStatus)}
                    <span className="capitalize">{smsStatus}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-sms">SMS Message</Label>
                <Textarea
                  id="direct-sms"
                  value={directSMSMessage}
                  onChange={(e) => setDirectSMSMessage(e.target.value)}
                  placeholder="Enter your test SMS message..."
                  rows={3}
                />
                <div className="text-xs">
                  Character count: <span className={directSMSMessage.length > 160 ? 'text-red-500' : 'text-green-500'}>
                    {directSMSMessage.length}/160
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Advanced Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="skip-optout" className="text-sm">Skip Opt-out Check</Label>
                    <Switch
                      id="skip-optout"
                      checked={skipOptOutCheck}
                      onCheckedChange={setSkipOptOutCheck}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="skip-quiet" className="text-sm">Skip Quiet Hours</Label>
                    <Switch
                      id="skip-quiet"
                      checked={skipQuietHours}
                      onCheckedChange={setSkipQuietHours}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="force-footer" className="text-sm">Force Footer Injection</Label>
                    <Switch
                      id="force-footer"
                      checked={forceFooter}
                      onCheckedChange={setForceFooter}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSendTestSMS}
                disabled={smsStatus === 'sending' || !testPhoneNumber || !directSMSMessage}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {smsStatus === 'sending' ? 'Sending...' : 'Send Test SMS'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Compliance Testing
              </CardTitle>
              <CardDescription>
                Test opt-out checking, quiet hours, and compliance features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="compliance-phone">Phone Number to Test</Label>
                <Input
                  id="compliance-phone"
                  value={complianceTestPhone}
                  onChange={(e) => setComplianceTestPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <Button 
                onClick={handleComplianceTest}
                className="w-full"
              >
                <Shield className="w-4 h-4 mr-2" />
                Run Compliance Check
              </Button>

              {complianceResults && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {complianceResults.isOptedOut ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">Opt-out Status</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {complianceResults.isOptedOut ? 'Customer has opted out' : 'Customer has not opted out'}
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {complianceResults.isQuietHours ? (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">Quiet Hours</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {complianceResults.isQuietHours ? 'Currently in quiet hours' : 'Not in quiet hours'}
                      </p>
                    </div>
                  </div>

                  {complianceResults.nextSendTime && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Next available send time: {new Date(complianceResults.nextSendTime).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaign Testing Tab */}
        <TabsContent value="campaign">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Campaign Testing
              </CardTitle>
              <CardDescription>
                Test complete SMS campaign workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test-campaign-name">Campaign Name</Label>
                  <Input
                    id="test-campaign-name"
                    value={testCampaignName}
                    onChange={(e) => setTestCampaignName(e.target.value)}
                    placeholder="Test Campaign"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-segment">Target Segment</Label>
                  <select
                    id="test-segment"
                    value={testSegment}
                    onChange={(e) => setTestSegment(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="test_segment">Test Segment</option>
                    <option value="all_customers">All Customers</option>
                    <option value="recent_buyers">Recent Buyers</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient-count">Test Recipient Count</Label>
                <Input
                  id="recipient-count"
                  type="number"
                  value={testRecipientCount}
                  onChange={(e) => setTestRecipientCount(parseInt(e.target.value) || 1)}
                  min="1"
                  max="10"
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Campaign testing will create actual SMS messages in the queue. Use test phone numbers only.
                </AlertDescription>
              </Alert>

              <Button className="w-full" variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Create Test Campaign (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Codes Tab */}
        <TabsContent value="qr-codes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                QR Code Testing
              </CardTitle>
              <CardDescription>
                Generate and test QR codes for campaigns and promotions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Code or Text to Encode</Label>
                <Input
                  id="coupon-code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="SAVE20"
                />
              </div>

              <Button 
                onClick={handleGenerateQR}
                disabled={!couponCode.trim()}
                className="w-full"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code
              </Button>

              {qrCode && (
                <div className="text-center space-y-3">
                  <div className="inline-block p-4 bg-white border rounded-lg">
                    <img 
                      src={qrCode} 
                      alt={`QR code for ${couponCode}`}
                      className="w-32 h-32"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    QR code for: <code className="bg-muted px-1 rounded">{couponCode}</code>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(qrCode)}
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy QR Code Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!campaignId && (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Some features require a campaign context. Create or select a campaign to enable full testing capabilities.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};