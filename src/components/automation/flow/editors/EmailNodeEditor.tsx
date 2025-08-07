import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';

interface EmailNodeData {
  subject: string;
  content: string;
  template?: string;
}

interface EmailNodeEditorProps {
  data: EmailNodeData;
  onSave: (data: EmailNodeData) => void;
  onCancel: () => void;
}

const emailTemplates = [
  { value: '', label: 'Custom Email' },
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'promotion', label: 'Promotional Email' },
  { value: 'reminder', label: 'Reminder Email' },
  { value: 'followup', label: 'Follow-up Email' }
];

export const EmailNodeEditor: React.FC<EmailNodeEditorProps> = ({
  data,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<EmailNodeData>({
    subject: data.subject || '',
    content: data.content || '',
    template: data.template || ''
  });

  const [errors, setErrors] = useState<Partial<EmailNodeData>>({});

  useEffect(() => {
    setFormData({
      subject: data.subject || '',
      content: data.content || '',
      template: data.template || ''
    });
  }, [data]);

  const validateForm = () => {
    const newErrors: Partial<EmailNodeData> = {};
    
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Email content is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  return (
    <Card className="w-full max-w-2xl" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📧 Edit Email Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template">Email Template</Label>
          <NativeSelect
            id="template"
            value={formData.template}
            onChange={(e) => setFormData({ ...formData, template: e.target.value })}
          >
            {emailTemplates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Email Subject *</Label>
          <Input
            id="subject"
            placeholder="Enter email subject..."
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className={errors.subject ? 'border-destructive' : ''}
            autoFocus
          />
          {errors.subject && (
            <p className="text-sm text-destructive">{errors.subject}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Email Content *</Label>
          <Textarea
            id="content"
            placeholder="Enter your email content..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className={`min-h-[200px] ${errors.content ? 'border-destructive' : ''}`}
          />
          {errors.content && (
            <p className="text-sm text-destructive">{errors.content}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};