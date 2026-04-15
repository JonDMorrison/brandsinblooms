import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui-legacy/alert';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { AlertTriangle, CheckCircle, ShieldCheck, Send } from 'lucide-react';

interface CampaignConsentWarningProps {
  totalRecipients: number;
  optedInCount: number;
  excludedCount: number;
  onSendOptInRequest?: () => void;
}

export function CampaignConsentWarning({
  totalRecipients,
  optedInCount,
  excludedCount,
  onSendOptInRequest,
}: CampaignConsentWarningProps) {
  if (excludedCount === 0) {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          All recipients have marketing consent
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          This campaign will be sent to {optedInCount} contact{optedInCount !== 1 ? 's' : ''} who 
          have explicitly opted into marketing emails.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
          Some contacts will be excluded
          <Badge variant="secondary" className="font-normal">
            {excludedCount} contact{excludedCount !== 1 ? 's' : ''}
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300 space-y-3">
          <p>
            You have <strong>{excludedCount}</strong> contact{excludedCount !== 1 ? 's' : ''} in 
            this segment who have not opted into marketing. BloomSuite will automatically exclude 
            them from this send to ensure compliance.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                {optedInCount}
              </Badge>
              <span className="text-sm">Will receive</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {excludedCount}
              </Badge>
              <span className="text-sm">Will be excluded</span>
            </div>
          </div>
          {onSendOptInRequest && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSendOptInRequest}
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Opt-In Request to Excluded Contacts
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>

      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          <strong>Why this matters:</strong> Marketing emails can only be sent to contacts who 
          have explicitly opted in. This protects your sender reputation and ensures compliance 
          with email marketing regulations.
        </AlertDescription>
      </Alert>
    </div>
  );
}
