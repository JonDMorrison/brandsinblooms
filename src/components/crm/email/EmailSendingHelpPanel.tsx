import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Shield, 
  CheckCircle2, 
  Server, 
  Globe,
  ArrowRight,
  Info
} from 'lucide-react';

interface EmailSendingHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailSendingHelpPanel: React.FC<EmailSendingHelpPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">How Email Sending Works</h2>
                  <p className="text-sm text-gray-600 font-normal">Understanding your email delivery options</p>
                </div>
              </CardTitle>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close help panel"
              >
                <span className="text-xl text-gray-500">×</span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Quick Summary:</strong> BloomSuite can send emails in two ways - through our shared service (immediate) or from your custom domain (better deliverability, requires setup).
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Shared Domain Method */}
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-lg text-orange-800">Shared Domain Sending</CardTitle>
                    <Badge variant="secondary">Default</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Ready to use immediately</p>
                        <p className="text-xs text-gray-600">No setup required</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Reliable delivery</p>
                        <p className="text-xs text-gray-600">Sent via our managed service</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <p className="text-xs text-orange-800">
                      <strong>How it works:</strong> Emails are sent from our verified domain with your content. 
                      Recipients may see "via BloomSuite" in some email clients.
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    <strong>Best for:</strong> Getting started quickly, testing campaigns
                  </div>
                </CardContent>
              </Card>

              {/* Custom Domain Method */}
              <Card className="border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg text-green-800">Custom Domain Sending</CardTitle>
                    <Badge variant="default" className="bg-green-100 text-green-800">Recommended</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Professional branding</p>
                        <p className="text-xs text-gray-600">Emails from your domain</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Better deliverability</p>
                        <p className="text-xs text-gray-600">Improved inbox placement</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Full authentication</p>
                        <p className="text-xs text-gray-600">DKIM, SPF, and DMARC</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <p className="text-xs text-green-800">
                      <strong>How it works:</strong> We configure your domain with proper email authentication. 
                      Emails appear to come directly from your business.
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    <strong>Best for:</strong> Professional businesses, higher volume sending
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Setup Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Setup Options for Custom Domain
              </h3>

              <div className="space-y-3">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900">Automated Setup (Recommended)</h4>
                        <p className="text-sm text-blue-700">We handle the technical configuration for you</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-2 text-xs text-blue-600">
                      ✓ No technical knowledge required ✓ 5-minute setup ✓ Immediate verification
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Manual DNS Setup</h4>
                        <p className="text-sm text-gray-600">Add DNS records through your domain provider</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      ⚡ Full control ⚡ Works with any provider ⚡ 15-30 minute setup
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Technical Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Technical Details</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>Authentication Records:</strong> SPF, DKIM, and DMARC records verify your domain</p>
                <p><strong>Delivery Service:</strong> Powered by Resend.com infrastructure</p>
                <p><strong>Monitoring:</strong> Real-time delivery tracking and analytics</p>
                <p><strong>Compliance:</strong> CAN-SPAM and GDPR compliant by default</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it, let's set up!
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};