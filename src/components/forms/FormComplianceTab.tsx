import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Mail, 
  MessageSquare, 
  AlertTriangle, 
  Info,
  CheckCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { FormCompliance } from '@/types/formBuilder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FormComplianceTabProps {
  compliance: FormCompliance;
  onComplianceChange: (compliance: FormCompliance) => void;
  hasPhoneField: boolean;
  hasEmailField?: boolean;
}

export function FormComplianceTab({
  compliance,
  onComplianceChange,
  hasPhoneField,
  hasEmailField = true,
}: FormComplianceTabProps) {
  return (
    <div className="space-y-6">
      {/* Warnings */}
      {hasPhoneField && !compliance.sms_consent_required && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> Your form collects phone numbers but SMS consent is not enabled. 
            Under TCPA regulations, you must obtain explicit consent before sending SMS messages or face significant fines.
          </AlertDescription>
        </Alert>
      )}

      {hasEmailField && !compliance.email_consent_required && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Recommendation:</strong> Enable email consent for compliance with CASL (Canada) and email marketing best practices.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Consent */}
        <ConsentCard
          type="email"
          title="Email Marketing Consent"
          description="Allow subscribers to opt-in to email communications"
          regulation="CASL"
          regulationDescription="Canada's Anti-Spam Legislation requires consent before sending commercial emails"
          enabled={compliance.email_consent_required}
          onEnabledChange={(checked) =>
            onComplianceChange({ ...compliance, email_consent_required: checked })
          }
          consentText={compliance.email_consent_text}
          onConsentTextChange={(text) =>
            onComplianceChange({ ...compliance, email_consent_text: text })
          }
          defaultText="I agree to receive marketing emails and updates"
          placeholder="e.g., I agree to receive promotional emails from [Company Name]"
          tips={[
            'Be specific about what emails they will receive',
            'Include your company name if possible',
            'Keep it simple and clear',
          ]}
          icon={Mail}
        />

        {/* SMS Consent */}
        <ConsentCard
          type="sms"
          title="SMS Marketing Consent"
          description="Allow subscribers to opt-in to text messages"
          regulation="TCPA"
          regulationDescription="Telephone Consumer Protection Act requires express written consent for marketing texts"
          enabled={compliance.sms_consent_required}
          onEnabledChange={(checked) =>
            onComplianceChange({ ...compliance, sms_consent_required: checked })
          }
          consentText={compliance.sms_consent_text}
          onConsentTextChange={(text) =>
            onComplianceChange({ ...compliance, sms_consent_text: text })
          }
          defaultText="I agree to receive SMS messages. Msg & data rates may apply."
          placeholder="e.g., I agree to receive text messages. Msg & data rates may apply. Reply STOP to unsubscribe."
          tips={[
            'Must include "Msg & data rates may apply"',
            'Recommend including unsubscribe instructions',
            'Frequency disclosure is recommended',
          ]}
          icon={MessageSquare}
          isHighRisk={hasPhoneField && !compliance.sms_consent_required}
        />
      </div>

      {/* Additional Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Additional Compliance Options
          </CardTitle>
          <CardDescription>
            Optional settings for enhanced compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Double Opt-In */}
          <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <Switch
              checked={compliance.double_opt_in}
              onCheckedChange={(checked) =>
                onComplianceChange({ ...compliance, double_opt_in: checked })
              }
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Double Opt-In</Label>
                <Badge variant="outline" className="text-xs">Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Send a confirmation email before adding contacts to your list. 
                This ensures higher quality leads and is required for GDPR compliance.
              </p>
              {compliance.double_opt_in && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2 text-green-800 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Subscribers will receive a confirmation email before being added</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GDPR Mode */}
          <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <Switch
              checked={compliance.gdpr_compliant}
              onCheckedChange={(checked) =>
                onComplianceChange({ ...compliance, gdpr_compliant: checked })
              }
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">GDPR Compliant Mode</Label>
                <Badge variant="outline" className="text-xs">EU</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enable enhanced privacy controls for European users, including explicit consent requirements 
                and data processing transparency.
              </p>
              {compliance.gdpr_compliant && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-blue-800 text-sm space-y-1">
                    <p className="font-medium">GDPR mode enables:</p>
                    <ul className="list-disc ml-5 space-y-0.5">
                      <li>Privacy policy link requirement</li>
                      <li>Explicit consent language</li>
                      <li>Data retention transparency</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ConsentCardProps {
  type: 'email' | 'sms';
  title: string;
  description: string;
  regulation: string;
  regulationDescription: string;
  enabled: boolean;
  onEnabledChange: (checked: boolean) => void;
  consentText: string;
  onConsentTextChange: (text: string) => void;
  defaultText: string;
  placeholder: string;
  tips: string[];
  icon: React.ElementType;
  isHighRisk?: boolean;
}

function ConsentCard({
  type,
  title,
  description,
  regulation,
  regulationDescription,
  enabled,
  onEnabledChange,
  consentText,
  onConsentTextChange,
  defaultText,
  placeholder,
  tips,
  icon: Icon,
  isHighRisk,
}: ConsentCardProps) {
  return (
    <Card className={isHighRisk ? 'border-destructive' : ''}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-primary/10' : 'bg-muted'}`}>
              <Icon className={`h-5 w-5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="secondary" className="text-xs cursor-help">
                        {regulation}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{regulationDescription}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </CardHeader>

      {/* Consent Text Editor - Only shown when enabled */}
      {enabled && (
        <CardContent className="pt-0 space-y-4">
          <div>
            <Label htmlFor={`${type}_consent_text`} className="text-sm font-medium">
              Checkbox Label Text
            </Label>
            <Textarea
              id={`${type}_consent_text`}
              value={consentText || defaultText}
              onChange={(e) => onConsentTextChange(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This text appears next to the consent checkbox on your form.
            </p>
          </div>

          {/* Tips */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-3 w-3" />
              <span>Tips for compliant consent text</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                {tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>

          {/* Preview */}
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 border-2 border-muted-foreground rounded mt-0.5 flex-shrink-0" />
              <span className="text-sm">{consentText || defaultText}</span>
            </div>
          </div>
        </CardContent>
      )}

      {/* Not enabled state */}
      {!enabled && (
        <CardContent className="pt-0">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              {type === 'email' 
                ? 'Enable to add an email consent checkbox to your form. Recommended for compliance.'
                : 'Enable to add an SMS consent checkbox. Required if you collect phone numbers for marketing.'}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
