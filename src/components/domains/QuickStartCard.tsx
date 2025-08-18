
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  Clock
} from 'lucide-react';
import { useDomains, Domain } from '@/hooks/useDomains';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface QuickStartCardProps {
  systemDomain: Domain | undefined;
  tenantSlug: string;
}

export const QuickStartCard: React.FC<QuickStartCardProps> = ({ 
  systemDomain, 
  tenantSlug 
}) => {
  const { createSystemPath } = useDomains();
  const { tenant } = useTenant();
  const [isCreating, setIsCreating] = useState(false);

  const handleSetupQuickStart = async () => {
    if (!tenant?.slug) {
      toast.error('Tenant information not available');
      return;
    }

    setIsCreating(true);
    try {
      await createSystemPath(tenant.slug);
      toast.success('Quick start domain activated!');
    } catch (error) {
      console.error('Error setting up quick start:', error);
      toast.error('Failed to set up quick start domain');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const quickStartUrl = `https://pages.bloomsuite.app/t/${tenantSlug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          Quick Start
          {systemDomain && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Get started instantly with your pre-configured BloomSuite subdomain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {systemDomain ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Ready to use!</span>
              </div>
              <p className="text-sm text-green-700 mb-3">
                Your site is live and accessible at:
              </p>
              <div className="flex items-center gap-2 p-2 bg-white border rounded">
                <code className="flex-1 text-sm">{quickStartUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(quickStartUrl, 'URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={quickStartUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Features included:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  HTTPS/TLS encryption (active)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Global CDN delivery
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Instant deployment
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Ready to activate</span>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Your site will be instantly available at:
              </p>
              <div className="p-2 bg-white border rounded">
                <code className="text-sm text-muted-foreground">{quickStartUrl}</code>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">What you'll get:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Instant HTTPS/TLS encryption
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Global CDN delivery
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  No DNS setup required
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleSetupQuickStart}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Activate Quick Start
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
