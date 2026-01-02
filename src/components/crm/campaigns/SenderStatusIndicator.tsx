import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Settings, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SenderConfig } from '@/hooks/useSenderConfiguration';

interface SenderStatusIndicatorProps {
  senderConfig: SenderConfig;
  showDetailedAlert?: boolean;
  compact?: boolean;
  className?: string;
}

export const SenderStatusIndicator: React.FC<SenderStatusIndicatorProps> = ({
  senderConfig,
  showDetailedAlert = false,
  compact = false,
  className = ''
}) => {
  const { isVerified, senderEmail, displayName, deliveryMethod } = senderConfig;

  const getStatusConfig = () => {
    switch (deliveryMethod) {
      case 'custom':
        return {
          variant: 'default' as const,
          icon: Shield,
          label: compact ? 'Verified' : '🔒 Custom Domain',
          tooltipTitle: 'Custom Domain Verified',
          badgeClassName: 'bg-green-600 hover:bg-green-700 text-white',
          alertType: null
        };
      case 'platform':
        return {
          variant: 'secondary' as const,
          icon: Mail,
          label: compact ? 'Platform' : '📧 Platform Email',
          tooltipTitle: 'Using Platform Email',
          badgeClassName: 'bg-blue-600 hover:bg-blue-700 text-white',
          alertType: 'platform' as const
        };
      case 'shared':
      default:
        return {
          variant: 'secondary' as const,
          icon: AlertTriangle,
          label: compact ? 'Shared' : '⚠️ Shared Domain',
          tooltipTitle: 'Using Shared Sender',
          badgeClassName: 'bg-orange-500 hover:bg-orange-600 text-white',
          alertType: 'shared' as const
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  const renderBadge = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={config.variant}
            className={`flex items-center space-x-1 ${config.badgeClassName} ${className}`}
          >
            <IconComponent className="h-3 w-3" />
            <span>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs space-y-2">
            <p className="font-medium">{config.tooltipTitle}</p>
            <p className="text-sm">
              <strong>From:</strong> {displayName} &lt;{senderEmail}&gt;
            </p>
            {deliveryMethod === 'platform' && (
              <p className="text-sm text-muted-foreground">
                Emails are sent from your BloomSuite platform address. 
                For better branding, verify your custom domain.
              </p>
            )}
            {deliveryMethod === 'shared' && (
              <p className="text-sm text-muted-foreground">
                To improve deliverability and brand trust, set up your domain in Settings.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (showDetailedAlert && config.alertType === 'platform') {
    return (
      <div className="space-y-3">
        {renderBadge()}
        <Alert className="border-blue-200 bg-blue-50">
          <Mail className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="text-blue-800 font-medium mb-1">
                Sending from your BloomSuite email
              </p>
              <p className="text-blue-700 text-sm">
                Your emails will be sent from <code className="bg-blue-100 px-1 rounded">{senderEmail}</code> on behalf of {senderConfig.companyName}. 
                For better branding, consider verifying your custom domain.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-4 flex-shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
              <Link to="/crm/settings/email-auth">
                <Settings className="h-4 w-4 mr-2" />
                Setup Domain
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showDetailedAlert && config.alertType === 'shared') {
    return (
      <div className="space-y-3">
        {renderBadge()}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="text-orange-800 font-medium mb-1">
                Sending via shared domain
              </p>
              <p className="text-orange-700 text-sm">
                Your emails will be sent from <code className="bg-orange-100 px-1 rounded">{senderEmail}</code> on behalf of {senderConfig.companyName}. 
                For better deliverability and branding, consider verifying your custom domain.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-4 flex-shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100">
              <Link to="/crm/settings/email-auth">
                <Settings className="h-4 w-4 mr-2" />
                Setup Domain
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return renderBadge();
};
