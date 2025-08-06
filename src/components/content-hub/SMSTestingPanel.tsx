import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Zap, ExternalLink, QrCode, Copy } from 'lucide-react';
import { useSMSProcessor } from '@/hooks/useSMSProcessor';
import { useToast } from '@/hooks/use-toast';

interface SMSTestingPanelProps {
  campaignId?: string;
  campaignSlug?: string;
}

export const SMSTestingPanel: React.FC<SMSTestingPanelProps> = ({
  campaignId,
  campaignSlug
}) => {
  const { toast } = useToast();
  const { processSMSMessage, generateQRCode, processing } = useSMSProcessor();
  
  const [testMessage, setTestMessage] = useState('Check out our special offer! {{HUB}}');
  const [processedResult, setProcessedResult] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('SAVE20');

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard."
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">SMS & QR Testing</h3>
        <p className="text-sm text-muted-foreground">
          Test SMS macro processing and QR code generation for your content hub.
        </p>
      </div>

      {/* SMS Message Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Macro Processing
          </CardTitle>
          <CardDescription>
            Test how your SMS messages will be processed with macros like {'{{HUB}}'}
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

      {/* QR Code Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code Generator
          </CardTitle>
          <CardDescription>
            Generate QR codes for coupon codes or other text content
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
            </div>
          )}
        </CardContent>
      </Card>

      {!campaignId && (
        <Alert>
          <AlertDescription>
            Save your campaign settings first to enable SMS macro processing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};