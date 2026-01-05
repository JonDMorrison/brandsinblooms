import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Mail, MessageSquare, ShoppingCart, Settings, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActivationGuard, ProviderReadiness, getProviderSetupInfo } from '@/lib/automation/guardrails';

interface ActivationGuardsProps {
  guard: ActivationGuard;
  providers: ProviderReadiness;
  hasEmailSteps: boolean;
  hasSMSSteps: boolean;
  triggerType: string;
  className?: string;
}

export const ActivationGuards: React.FC<ActivationGuardsProps> = ({
  guard,
  providers,
  hasEmailSteps,
  hasSMSSteps,
  triggerType,
  className = ''
}) => {
  const navigate = useNavigate();
  const setupInfo = getProviderSetupInfo();

  // Can activate - show ready status with any warnings
  if (guard.canActivate) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Ready to activate</span>
        </div>
        
        {/* Channel status badges */}
        <div className="flex flex-wrap gap-2">
          {hasEmailSteps && (
            <Badge variant="default" className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
              <Mail className="w-3 h-3 mr-1" />
              Email Ready
            </Badge>
          )}
          {hasSMSSteps && (
            <Badge 
              variant={providers.sms.ready ? 'default' : 'secondary'} 
              className={`text-xs ${providers.sms.ready ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              SMS {providers.sms.ready ? 'Ready' : 'Will Skip'}
            </Badge>
          )}
          {triggerType === 'abandoned_cart' && (
            <Badge variant={providers.pos.cartEventsEnabled ? 'default' : 'destructive'} className="text-xs">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Cart Events {providers.pos.cartEventsEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
        </div>

        {/* Show warnings if any (like SMS will be skipped) */}
        {guard.warnings.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <ul className="list-disc list-inside text-sm text-amber-800">
                {guard.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Optional: Show SMS setup CTA if SMS steps exist but not configured */}
        {hasSMSSteps && !providers.sms.ready && (
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <div>
                <div className="font-medium text-amber-900">{setupInfo.sms.title}</div>
                <div className="text-sm text-amber-700">{setupInfo.sms.description}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(setupInfo.sms.ctaLink)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Settings className="w-3 h-3 mr-1" />
              {setupInfo.sms.ctaText}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Cannot activate - show blocking errors
  return (
    <div className={`space-y-3 ${className}`}>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">Cannot activate automation:</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {guard.blockedReasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Provider setup CTAs for blocking issues only */}
      <div className="space-y-2">
        {/* POS cart events - this IS blocking for abandoned_cart */}
        {triggerType === 'abandoned_cart' && !providers.pos.cartEventsEnabled && (
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-600" />
              <div>
                <div className="font-medium text-orange-900">{setupInfo.pos.title}</div>
                <div className="text-sm text-orange-700">{setupInfo.pos.description}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(setupInfo.pos.ctaLink)}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Settings className="w-3 h-3 mr-1" />
              {setupInfo.pos.ctaText}
            </Button>
          </div>
        )}
      </div>

      {/* Warnings */}
      {guard.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium text-amber-900">Warnings:</div>
              <ul className="list-disc list-inside text-sm text-amber-800">
                {guard.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
