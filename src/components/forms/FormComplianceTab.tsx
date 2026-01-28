import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Mail, MessageSquare, AlertTriangle, Building } from 'lucide-react';
import { FormCompliance } from '@/types/formBuilder';

interface FormComplianceTabProps {
  compliance: FormCompliance;
  onComplianceChange: (compliance: FormCompliance) => void;
  hasPhoneField: boolean;
}

export function FormComplianceTab({
  compliance,
  onComplianceChange,
  hasPhoneField,
}: FormComplianceTabProps) {
  return (
    <div className="space-y-6">
      {/* Warning about phone + SMS */}
      {hasPhoneField && !compliance.sms_consent_required && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your form collects phone numbers but SMS consent is not required. 
            Under TCPA regulations, you must obtain explicit consent before sending SMS messages.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Consent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Consent
            </CardTitle>
            <CardDescription>
              Configure email marketing consent requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={compliance.email_consent_required}
                onCheckedChange={(checked) =>
                  onComplianceChange({ ...compliance, email_consent_required: checked })
                }
              />
              <Label>Require email consent checkbox</Label>
            </div>

            {compliance.email_consent_required && (
              <div>
                <Label htmlFor="email_consent_text">Consent Text</Label>
                <Textarea
                  id="email_consent_text"
                  value={compliance.email_consent_text}
                  onChange={(e) =>
                    onComplianceChange({ ...compliance, email_consent_text: e.target.value })
                  }
                  placeholder="I agree to receive marketing emails..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This text appears next to the consent checkbox.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMS Consent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Consent
            </CardTitle>
            <CardDescription>
              Configure SMS marketing consent requirements (TCPA)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={compliance.sms_consent_required}
                onCheckedChange={(checked) =>
                  onComplianceChange({ ...compliance, sms_consent_required: checked })
                }
              />
              <Label>Require SMS consent checkbox</Label>
            </div>

            {compliance.sms_consent_required && (
              <div>
                <Label htmlFor="sms_consent_text">Consent Text</Label>
                <Textarea
                  id="sms_consent_text"
                  value={compliance.sms_consent_text}
                  onChange={(e) =>
                    onComplianceChange({ ...compliance, sms_consent_text: e.target.value })
                  }
                  placeholder="I agree to receive SMS messages. Msg & data rates may apply."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must include "Msg & data rates may apply" for TCPA compliance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Additional Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={compliance.double_opt_in}
                onCheckedChange={(checked) =>
                  onComplianceChange({ ...compliance, double_opt_in: checked })
                }
              />
              <div>
                <Label>Double Opt-In</Label>
                <p className="text-xs text-muted-foreground">
                  Send a confirmation email before adding to your list (recommended for GDPR)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={compliance.gdpr_compliant}
                onCheckedChange={(checked) =>
                  onComplianceChange({ ...compliance, gdpr_compliant: checked })
                }
              />
              <div>
                <Label>GDPR Compliant Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Adds privacy policy link requirement and explicit consent for EU users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
