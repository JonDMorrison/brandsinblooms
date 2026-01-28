import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, Users } from 'lucide-react';
import { FORM_TEMPLATES, createFormFromTemplate } from '@/lib/formTemplates';

interface FormTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateData: any) => void;
}

export function FormTemplatesDialog({ open, onOpenChange, onSelect }: FormTemplatesDialogProps) {
  const handleSelect = (templateId: string) => {
    const template = FORM_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const formData = createFormFromTemplate(template);
    onSelect({
      name: template.name,
      ...formData,
    });
  };

  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'newsletter-signup':
        return <Mail className="h-6 w-6 text-primary" />;
      case 'vip-waitlist':
        return <Users className="h-6 w-6 text-primary" />;
      case 'event-signup':
        return <Calendar className="h-6 w-6 text-primary" />;
      default:
        return <Mail className="h-6 w-6 text-primary" />;
    }
  };

  const getFieldBadges = (templateId: string) => {
    const template = FORM_TEMPLATES.find(t => t.id === templateId);
    if (!template) return null;

    const hasEmail = template.fields.some(f => f.type === 'email');
    const hasPhone = template.fields.some(f => f.type === 'phone');
    const hasEmailConsent = template.compliance.email_consent_required;
    const hasSmsConsent = template.compliance.sms_consent_required;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {hasEmail && <Badge variant="outline" className="text-xs">Email</Badge>}
        {hasPhone && <Badge variant="outline" className="text-xs">Phone</Badge>}
        {hasEmailConsent && <Badge variant="outline" className="text-xs">Email Consent</Badge>}
        {hasSmsConsent && <Badge variant="outline" className="text-xs">SMS Consent</Badge>}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built form template and customize it to your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-4">
          {FORM_TEMPLATES.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelect(template.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getTemplateIcon(template.id)}
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {getFieldBadges(template.id)}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
