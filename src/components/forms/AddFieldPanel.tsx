import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Mail, 
  Phone, 
  Type, 
  List,
  CheckSquare,
  EyeOff,
  ShieldCheck,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { FormField, FormFieldType } from '@/types/formBuilder';

interface AddFieldPanelProps {
  onAddField: (type: FormFieldType) => void;
  onOpenTemplates: () => void;
  existingFields: FormField[];
}

const BASIC_FIELDS: { 
  type: FormFieldType; 
  label: string; 
  icon: React.ElementType;
  description: string;
}[] = [
  { type: 'email', label: 'Email', icon: Mail, description: 'Email address input' },
  { type: 'text', label: 'Text', icon: Type, description: 'Single-line text' },
  { type: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { type: 'select', label: 'Dropdown', icon: List, description: 'Choose from options' },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Yes/no option' },
  { type: 'hidden', label: 'Hidden', icon: EyeOff, description: 'Invisible tracking' },
];

const CONSENT_FIELDS: {
  type: FormFieldType;
  label: string;
  icon: React.ElementType;
  description: string;
  regulation: string;
}[] = [
  { 
    type: 'email_consent', 
    label: 'Email Consent', 
    icon: ShieldCheck, 
    description: 'Marketing opt-in',
    regulation: 'CASL'
  },
  { 
    type: 'sms_consent', 
    label: 'SMS Consent', 
    icon: MessageSquare, 
    description: 'SMS opt-in',
    regulation: 'TCPA'
  },
];

export function AddFieldPanel({ onAddField, onOpenTemplates, existingFields }: AddFieldPanelProps) {
  // Check if consent fields already exist
  const hasEmailConsent = existingFields.some(f => f.type === 'email_consent');
  const hasSmsConsent = existingFields.some(f => f.type === 'sms_consent');
  const hasPhoneField = existingFields.some(f => f.type === 'phone');

  return (
    <div className="space-y-4">
      {/* Templates Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full justify-start border-primary/30 hover:bg-primary/10"
            onClick={onOpenTemplates}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Use a Template
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Pre-configured forms for newsletters, waitlists, and events
          </p>
        </CardContent>
      </Card>

      {/* Basic Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Field</CardTitle>
          <CardDescription className="text-xs">
            Click to add a new field to your form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {BASIC_FIELDS.map((field) => {
            const Icon = field.icon;
            return (
              <Button
                key={field.type}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-auto py-2 px-3"
                onClick={() => onAddField(field.type)}
              >
                <Icon className="h-4 w-4 mr-3 text-muted-foreground" />
                <div className="text-left">
                  <div className="font-medium text-sm">{field.label}</div>
                  <div className="text-xs text-muted-foreground">{field.description}</div>
                </div>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Consent Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Compliance
          </CardTitle>
          <CardDescription className="text-xs">
            Required for marketing compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CONSENT_FIELDS.map((field) => {
            const Icon = field.icon;
            const isDisabled = (field.type === 'email_consent' && hasEmailConsent) || 
                              (field.type === 'sms_consent' && hasSmsConsent);
            const showWarning = field.type === 'sms_consent' && hasPhoneField && !hasSmsConsent;
            
            return (
              <div key={field.type}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start h-auto py-2 px-3 ${showWarning ? 'border border-amber-300 bg-amber-50' : ''}`}
                  onClick={() => onAddField(field.type)}
                  disabled={isDisabled}
                >
                  <Icon className={`h-4 w-4 mr-3 ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`} />
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{field.label}</span>
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        {field.regulation}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isDisabled ? 'Already added' : field.description}
                    </div>
                  </div>
                  {!isDisabled && <Plus className="h-4 w-4 ml-auto text-muted-foreground" />}
                </Button>
                {showWarning && (
                  <p className="text-xs text-amber-700 mt-1 ml-3">
                    ⚠️ Recommended: You're collecting phone numbers
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
