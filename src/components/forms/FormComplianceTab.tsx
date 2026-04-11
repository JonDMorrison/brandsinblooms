import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Info, Mail, MessageSquare, Shield } from "lucide-react";
import { FormCompliance } from "@/types/formBuilder";

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
      {hasPhoneField && !compliance.sms_consent_required && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your form collects phone numbers but SMS consent is not marked as
            required. Under TCPA rules, explicit consent should be collected
            before sending marketing texts.
          </AlertDescription>
        </Alert>
      )}

      {hasEmailField && !compliance.email_consent_required && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Enable required email consent if this form is intended to capture
            marketing subscribers.
          </AlertDescription>
        </Alert>
      )}

      <ConsentSection
        title="Email Consent"
        description="Configure the email marketing consent checkbox shown on the form."
        icon={Mail}
        required={compliance.email_consent_required}
        consentText={compliance.email_consent_text}
        placeholder="I agree to receive marketing emails from BloomSuite."
        helperText="When enabled, the email consent checkbox must be checked for submission to succeed."
        onRequiredChange={(checked) =>
          onComplianceChange({ ...compliance, email_consent_required: checked })
        }
        onTextChange={(text) =>
          onComplianceChange({ ...compliance, email_consent_text: text })
        }
      />

      <ConsentSection
        title="SMS Consent"
        description="Configure the SMS marketing consent checkbox shown on the form."
        icon={MessageSquare}
        required={compliance.sms_consent_required}
        consentText={compliance.sms_consent_text}
        placeholder="I agree to receive SMS messages. Msg & data rates may apply."
        helperText="When enabled, the SMS consent checkbox must be checked for submission to succeed."
        onRequiredChange={(checked) =>
          onComplianceChange({ ...compliance, sms_consent_required: checked })
        }
        onTextChange={(text) =>
          onComplianceChange({ ...compliance, sms_consent_text: text })
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Compliance Options
          </CardTitle>
          <CardDescription>
            Additional privacy and permission settings for this form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptionRow
            title="Double Opt-In"
            description="Require email confirmation before activating consent."
            checked={compliance.double_opt_in}
            disabled
            badge={<Badge variant="outline">Coming Soon</Badge>}
            onCheckedChange={() => undefined}
            note="This option is not yet implemented in the form submission pipeline."
          />

          <OptionRow
            title="GDPR Compliant"
            description="Enable GDPR-compliant data handling for this form."
            checked={compliance.gdpr_compliant}
            onCheckedChange={(checked) =>
              onComplianceChange({ ...compliance, gdpr_compliant: checked })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface ConsentSectionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  consentText: string;
  placeholder: string;
  helperText: string;
  onRequiredChange: (checked: boolean) => void;
  onTextChange: (text: string) => void;
}

function ConsentSection({
  title,
  description,
  icon: Icon,
  required,
  consentText,
  placeholder,
  helperText,
  onRequiredChange,
  onTextChange,
}: ConsentSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Required</Label>
            <p className="text-sm text-muted-foreground">{helperText}</p>
          </div>
          <Switch checked={required} onCheckedChange={onRequiredChange} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Consent Text</Label>
          <Textarea
            value={consentText}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={placeholder}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This text is displayed beside the consent checkbox on the public
            form.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface OptionRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  note?: string;
  onCheckedChange: (checked: boolean) => void;
}

function OptionRow({
  title,
  description,
  checked,
  disabled = false,
  badge,
  note,
  onCheckedChange,
}: OptionRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{title}</Label>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
