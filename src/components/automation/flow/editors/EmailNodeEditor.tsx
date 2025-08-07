import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { regenerateEmailContent } from '@/utils/aiContentRegenerator';
import { toast } from '@/utils/toast';

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
  { value: '', label: 'Custom Email', prompt: '' },
  { value: 'welcome', label: 'Welcome Email', prompt: 'Create a warm welcome email for new customers joining our garden center community' },
  { value: 'promotion', label: 'Promotional Email', prompt: 'Create an engaging promotional email highlighting seasonal garden products and offers' },
  { value: 'reminder', label: 'Reminder Email', prompt: 'Create a helpful reminder email about important garden care tasks or upcoming events' },
  { value: 'followup', label: 'Follow-up Email', prompt: 'Create a thoughtful follow-up email to nurture customer relationships and provide value' },
  { value: 'seasonal', label: 'Seasonal Tips', prompt: 'Create a seasonal gardening tips email with actionable advice for current garden tasks' },
  { value: 'product_spotlight', label: 'Product Spotlight', prompt: 'Create an email featuring and highlighting specific garden products or tools' }
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

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

  const generateContent = async () => {
    setIsGenerating(true);
    try {
      const selectedTemplate = emailTemplates.find(t => t.value === formData.template);
      const prompt = selectedTemplate?.prompt || 'Create a professional email for garden center customers';
      
      const { data, error } = await supabase.functions.invoke('generate-email-content', {
        body: {
          prompt,
          type: 'email_block',
          postType: 'newsletter'
        }
      });

      if (error) throw error;

      setFormData({
        ...formData,
        subject: data.title || 'Generated Email Subject',
        content: data.content || 'Generated email content'
      });

      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const improveContent = async () => {
    if (!formData.content.trim()) {
      toast.error('Please add some content first to improve it');
      return;
    }

    setIsImproving(true);
    try {
      const improvedContent = await regenerateEmailContent(formData.content, {
        tone: 'friendly',
        focus: 'seasonal',
        contentType: 'email_body',
        preserveStructure: true
      });

      setFormData({
        ...formData,
        content: improvedContent
      });

      toast.success('Content improved successfully!');
    } catch (error) {
      console.error('Error improving content:', error);
      toast.error('Failed to improve content. Please try again.');
    } finally {
      setIsImproving(false);
    }
  };

  const handleTemplateChange = async (templateValue: string) => {
    setFormData({ ...formData, template: templateValue });
    
    // Auto-generate content when template is selected (but not for custom)
    if (templateValue && templateValue !== '') {
      const selectedTemplate = emailTemplates.find(t => t.value === templateValue);
      if (selectedTemplate?.prompt) {
        setIsGenerating(true);
        try {
          const { data, error } = await supabase.functions.invoke('generate-email-content', {
            body: {
              prompt: selectedTemplate.prompt,
              type: 'email_block',
              postType: 'newsletter'
            }
          });

          if (error) throw error;

          setFormData(prev => ({
            ...prev,
            subject: data.title || prev.subject,
            content: data.content || prev.content,
            template: templateValue
          }));

          toast.success('Template content generated!');
        } catch (error) {
          console.error('Error generating template content:', error);
          toast.error('Failed to generate template content');
        } finally {
          setIsGenerating(false);
        }
      }
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
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={isGenerating}
          >
            {emailTemplates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </NativeSelect>
          {isGenerating && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating content...
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="subject">Email Subject *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateContent}
                disabled={isGenerating || isImproving}
                className="text-xs"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Generate
              </Button>
            </div>
          </div>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Email Content *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={improveContent}
                disabled={isGenerating || isImproving || !formData.content.trim()}
                className="text-xs"
              >
                {isImproving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Improve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateContent}
                disabled={isGenerating || isImproving}
                className="text-xs"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Generate
              </Button>
            </div>
          </div>
          <Textarea
            id="content"
            placeholder="Select a template above to generate content, or write your own..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className={`min-h-[200px] ${errors.content ? 'border-destructive' : ''}`}
          />
          {errors.content && (
            <p className="text-sm text-destructive">{errors.content}</p>
          )}
          {formData.content && !isGenerating && !isImproving && (
            <p className="text-xs text-muted-foreground">
              💡 Tip: Use the "Improve" button to enhance your content with seasonal relevance and better engagement.
            </p>
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