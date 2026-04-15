import React from "react";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import { Shield, AlertTriangle, Settings, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";
import type { SenderConfig } from "@/hooks/useSenderConfiguration";

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
  className = "",
}) => {
  const { isVerified, senderEmail, displayName } = senderConfig;

  const config = isVerified
    ? {
        variant: "default" as const,
        icon: Shield,
        label: compact ? "Verified" : "🔒 Custom Domain",
        tooltipTitle: "Custom Domain Verified",
        badgeClassName: "bg-green-600 hover:bg-green-700 text-white",
      }
    : {
        variant: "secondary" as const,
        icon: AlertTriangle,
        label: compact ? "Setup" : "⚠️ Domain Required",
        tooltipTitle: "Custom Domain Required",
        badgeClassName: "bg-orange-500 hover:bg-orange-600 text-white",
      };

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
              <strong>From:</strong> {displayName}
              {senderEmail ? ` <${senderEmail}>` : ""}
            </p>
            {!isVerified && (
              <p className="text-sm text-muted-foreground">
                Campaign sending is paused until a custom domain is verified.
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
                Custom domain required
              </p>
              <p className="text-orange-700 text-sm">
                Configure and verify your sending domain to send campaigns.
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="ml-4 flex-shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
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
