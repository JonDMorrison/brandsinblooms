
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Globe, 
  Zap, 
  Plus, 
  ArrowRight, 
  Copy, 
  ExternalLink,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useDomains } from '@/hooks/useDomains';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface AddDomainWizardProps {
  onClose: () => void;
}

export const AddDomainWizard: React.FC<AddDomainWizardProps> = ({ onClose }) => {
  const { createSystemPath, addCustomDomain } = useDomains();
  const { tenant } = useTenant();
  const [customDomain, setCustomDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('quick-start');

  const handleQuickStart = async () => {
    if (!tenant?.slug) {
      toast.error('Tenant information not available');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSystemPath(tenant.slug);
      toast.success('Quick start domain activated!');
      onClose();
    } catch (error) {
      console.error('Error setting up quick start:', error);
      toast.error('Failed to set up quick start domain');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomDomain = async () => {
    if (!customDomain.trim()) {
      toast.error('Please enter a domain name');
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    if (!domainRegex.test(customDomain)) {
      toast.error('Please enter a valid domain name');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCustomDomain(customDomain);
      toast.success('Custom domain added! DNS records will be provided.');
      onClose();
    } catch (error) {
      console.error('Error adding custom domain:', error);
      toast.error('Failed to add custom domain');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const quickStartUrl = `https://pages.bloomsuite.app/t/${tenant?.slug || 'your-site'}`;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Domain
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to set up your domain for landing pages and email sending
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick-start" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Start
            </TabsTrigger>
            <TabsTrigger value="custom-domain" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Custom Domain
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick-start" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  Quick Start Domain
                </CardTitle>
                <CardDescription>
                  Get started instantly with a pre-configured BloomSuite subdomain
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Instant Setup</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Your site will be immediately available at:
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-white border rounded">
                    <code className="flex-1 text-sm">{quickStartUrl}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(quickStartUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">What's included:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Instant HTTPS/TLS encryption</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Global CDN delivery</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>No DNS configuration required</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Perfect for testing and demos</span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleQuickStart}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Activating...' : 'Activate Quick Start'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom-domain" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Add Custom Domain
                </CardTitle>
                <CardDescription>
                  Use your own domain name for professional branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your domain without www or https://
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-yellow-800">DNS Setup Required</p>
                      <p className="text-sm text-yellow-700">
                        After adding your domain, you'll need to configure DNS records with your domain provider. 
                        We'll provide detailed instructions and copy-paste values.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">What happens next:</h4>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>We'll generate the required DNS records for your domain</li>
                    <li>You'll copy and paste these records to your domain provider</li>
                    <li>We'll verify the DNS propagation (usually takes 5-60 minutes)</li>
                    <li>TLS certificate will be automatically issued</li>
                    <li>Your domain will be ready for landing pages and email sending</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleAddCustomDomain}
                    disabled={isSubmitting || !customDomain.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Adding Domain...' : 'Add Domain'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
