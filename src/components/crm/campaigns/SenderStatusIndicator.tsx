import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Settings } from 'lucide-react';
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
  className?: string;
}

export const SenderStatusIndicator: React.FC<SenderStatusIndicatorProps> = ({
  senderConfig,
  showDetailedAlert = false,
  className = ''
}) => {
  const { isVerified, senderEmail, displayName, deliveryMethod } = senderConfig;

  const renderBadge = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={isVerified ? "default" : "secondary"}
            className={`flex items-center space-x-1 ${className}`}
          >
            {isVerified ? (
              <>
                <Shield className="h-3 w-3" />
                <span>🔒 Verified Sender</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                <span>⚠️ Shared Domain</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs space-y-2">
            <p className="font-medium">
              {isVerified ? 'Custom Domain Verified' : 'Using Shared Sender'}
            </p>
            <p className="text-sm">
              <strong>From:</strong> {displayName} &lt;{senderEmail}&gt;
            </p>
            {!isVerified && (
              <p className="text-sm text-muted-foreground">
                To improve deliverability and brand trust, verify your domain in Settings.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (showDetailedAlert && !isVerified) {
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
                Your emails will be sent from <code>{senderEmail}</code> on behalf of {senderConfig.companyName}. 
                For better deliverability and branding, consider verifying your custom domain.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-4 flex-shrink-0">
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