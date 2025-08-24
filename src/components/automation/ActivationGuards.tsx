import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Mail, MessageSquare, ShoppingCart, Settings } from 'lucide-react';
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

  if (guard.canActivate) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Ready to activate</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasEmailSteps && (
            <Badge variant={providers.email.ready ? 'default' : 'destructive'} className="text-xs">
              <Mail className="w-3 h-3 mr-1" />
              Email {providers.email.ready ? 'Ready' : 'Not Ready'}
            </Badge>
          )}
          {hasSMSSteps && (
            <Badge variant={providers.sms.ready ? 'default' : 'destructive'} className="text-xs">
              <MessageSquare className="w-3 h-3 mr-1" />
              SMS {providers.sms.ready ? 'Ready' : 'Not Ready'}
            </Badge>
          )}
          {triggerType === 'abandoned_cart' && (
            <Badge variant={providers.pos.cartEventsEnabled ? 'default' : 'destructive'} className="text-xs">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Cart Events {providers.pos.cartEventsEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
        </div>
      </div>
    );
  }

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

      {/* Provider setup CTAs */}
      <div className="space-y-2">
        {hasEmailSteps && !providers.email.ready && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">{setupInfo.email.title}</div>
                <div className="text-sm text-blue-700">{setupInfo.email.description}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(setupInfo.email.ctaLink)}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Settings className="w-3 h-3 mr-1" />
              {setupInfo.email.ctaText}
            </Button>
          </div>
        )}

        {hasSMSSteps && !providers.sms.ready && (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              <div>
                <div className="font-medium text-green-900">{setupInfo.sms.title}</div>
                <div className="text-sm text-green-700">{setupInfo.sms.description}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(setupInfo.sms.ctaLink)}
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <Settings className="w-3 h-3 mr-1" />
              {setupInfo.sms.ctaText}
            </Button>
          </div>
        )}

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
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Warnings:</div>
              <ul className="list-disc list-inside text-sm">
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