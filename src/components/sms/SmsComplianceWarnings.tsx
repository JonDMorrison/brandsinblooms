import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, ShieldAlert, Phone } from 'lucide-react';

interface SmsComplianceWarningsProps {
  messageContent: string;
  isFirstMessage?: boolean;
  hasOptOutText?: boolean;
  recipientCount?: number;
  invalidPhoneCount?: number;
  landlineCount?: number;
  isMms?: boolean;
  hasBrandIdentification?: boolean;
}

const SmsComplianceWarnings: React.FC<SmsComplianceWarningsProps> = ({
  messageContent,
  isFirstMessage = false,
  hasOptOutText,
  recipientCount = 0,
  invalidPhoneCount = 0,
  landlineCount = 0,
  isMms = false,
  hasBrandIdentification,
}) => {
  const warnings: React.ReactNode[] = [];

  // Check for opt-out text
  const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'reply stop'];
  const messageHasOptOut = optOutKeywords.some(keyword => 
    messageContent.toLowerCase().includes(keyword)
  );
  const finalHasOptOut = hasOptOutText !== undefined ? hasOptOutText : messageHasOptOut;

  // Check for brand identification
  const brandKeywords = ['from', 'sent by', 'team'];
  const messageHasBrand = brandKeywords.some(keyword => 
    messageContent.toLowerCase().includes(keyword)
  );
  const finalHasBrand = hasBrandIdentification !== undefined ? hasBrandIdentification : messageHasBrand;

  // Warning: Missing opt-out on first message
  if (isFirstMessage && !finalHasOptOut) {
    warnings.push(
      <Alert key="no-optout" variant="destructive" className="mb-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Missing Opt-Out Instructions</AlertTitle>
        <AlertDescription>
          First marketing messages should include opt-out instructions (e.g., "Reply STOP to unsubscribe").
          This is required for TCPA compliance.
        </AlertDescription>
      </Alert>
    );
  }

  // Warning: MMS without brand identification
  if (isMms && !finalHasBrand && isFirstMessage) {
    warnings.push(
      <Alert key="mms-brand" className="mb-2">
        <Info className="h-4 w-4" />
        <AlertTitle>MMS Brand Identification</AlertTitle>
        <AlertDescription>
          MMS marketing messages should include your business name for compliance and trust.
        </AlertDescription>
      </Alert>
    );
  }

  // Warning: Invalid phone numbers
  if (invalidPhoneCount > 0) {
    warnings.push(
      <Alert key="invalid-phones" className="mb-2">
        <Phone className="h-4 w-4" />
        <AlertTitle>Invalid Phone Numbers Detected</AlertTitle>
        <AlertDescription>
          {invalidPhoneCount} recipient(s) have invalid phone numbers and will be skipped.
        </AlertDescription>
      </Alert>
    );
  }

  // Warning: Landline numbers
  if (landlineCount > 0) {
    warnings.push(
      <Alert key="landlines" className="mb-2">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Landline Numbers Detected</AlertTitle>
        <AlertDescription>
          {landlineCount} recipient(s) may have landline numbers that cannot receive SMS.
        </AlertDescription>
      </Alert>
    );
  }

  // Info: Large campaign
  if (recipientCount > 1000) {
    warnings.push(
      <Alert key="large-campaign" className="mb-2">
        <Info className="h-4 w-4" />
        <AlertTitle>Large Campaign</AlertTitle>
        <AlertDescription>
          You're sending to {recipientCount.toLocaleString()} recipients. 
          Delivery may take some time due to warmup limits and rate limiting.
        </AlertDescription>
      </Alert>
    );
  }

  // Check message length for potential split
  const msgLength = messageContent.length;
  if (msgLength > 160) {
    const hasUnicode = /[^\x00-\x7F]/.test(messageContent);
    const segmentLimit = hasUnicode ? 67 : 153;
    const segments = Math.ceil(msgLength / segmentLimit);
    
    if (segments > 3) {
      warnings.push(
        <Alert key="long-message" className="mb-2">
          <Info className="h-4 w-4" />
          <AlertTitle>Long Message ({segments} segments)</AlertTitle>
          <AlertDescription>
            This message will be sent as {segments} segments, which costs more credits.
            Consider shortening to reduce costs.
          </AlertDescription>
        </Alert>
      );
    }
  }

  if (warnings.length === 0) {
    return null;
  }

  return <div className="space-y-2">{warnings}</div>;
};

export default SmsComplianceWarnings;
