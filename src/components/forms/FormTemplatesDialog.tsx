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
import { 
  Mail, 
  Users, 
  Calendar, 
  Sparkles, 
  CheckCircle,
  MessageSquare,
  Shield
} from 'lucide-react';
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
    onOpenChange(false);
  };

  const templateCards = [
    {
      id: 'newsletter-signup',
      name: 'Newsletter Signup',
      description: 'Perfect for growing your email list. Collects email and optional first name with email marketing consent.',
      icon: Mail,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      features: [
        { icon: Mail, label: 'Email collection' },
        { icon: CheckCircle, label: 'Email consent (CASL)' },
      ],
      bestFor: 'Blog subscriptions, updates, promotions',
    },
    {
      id: 'vip-waitlist',
      name: 'VIP / Loyalty Signup',
      description: 'Build an exclusive waitlist or loyalty program. Collects email, phone, and both marketing consents.',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      features: [
        { icon: Mail, label: 'Email collection' },
        { icon: MessageSquare, label: 'Phone + SMS consent (TCPA)' },
        { icon: Shield, label: 'Full compliance' },
      ],
      bestFor: 'VIP lists, early access, loyalty programs',
    },
    {
      id: 'event-signup',
      name: 'Event Signup',
      description: 'Register attendees for events, webinars, or classes. Includes session selection and email consent.',
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      features: [
        { icon: Calendar, label: 'Event time selection' },
        { icon: Mail, label: 'Email consent for updates' },
      ],
      bestFor: 'Workshops, webinars, in-store events',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Start with a Template
          </DialogTitle>
          <DialogDescription>
            Choose a template designed for common use cases. Each template is pre-configured with the right fields and compliance settings—you can customize everything after.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-4">
          {templateCards.map((template) => {
            const Icon = template.icon;
            
            return (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                onClick={() => handleSelect(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${template.bgColor}`}>
                      <Icon className={`h-6 w-6 ${template.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(template.id);
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {template.features.map((feature, idx) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs font-normal flex items-center gap-1"
                        >
                          <FeatureIcon className="h-3 w-3" />
                          {feature.label}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    <span className="font-medium">Best for:</span> {template.bestFor}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
