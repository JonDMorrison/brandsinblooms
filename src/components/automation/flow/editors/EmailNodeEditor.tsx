import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Sparkles, RefreshCw, Loader2, Clock, Layout } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { regenerateEmailContent } from '@/utils/aiContentRegenerator';
import { toast } from '@/utils/toast';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { InputWithMergeTags } from '@/components/ui/input-with-merge-tags';
import { TextareaWithMergeTags } from '@/components/ui/textarea-with-merge-tags';
import { AutomationTemplateBrowser } from '@/components/automation/AutomationTemplateBrowser';

interface EmailNodeData {
  subject: string;
  content: string;
  template?: string;
  imageUrl?: string;
  imageMetadata?: any;
  delay?: string;
  templateId?: string;
  templateName?: string;
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
    template: data.template || '',
    imageUrl: data.imageUrl || '',
    imageMetadata: data.imageMetadata || null,
    delay: data.delay || 'Immediate',
    templateId: data.templateId || '',
    templateName: data.templateName || ''
  });

  const [errors, setErrors] = useState<Partial<EmailNodeData>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);

  useEffect(() => {
    setFormData({
      subject: data.subject || '',
      content: data.content || '',
      template: data.template || '',
      imageUrl: data.imageUrl || '',
      imageMetadata: data.imageMetadata || null,
      delay: data.delay || 'Immediate',
      templateId: data.templateId || '',
      templateName: data.templateName || ''
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

  const handleTemplateSelect = (template: any, renderedHtml: string) => {
    setFormData(prev => ({
      ...prev,
      subject: template.name,
      content: renderedHtml,
      templateId: template.id,
      templateName: template.name,
      template: '' // Clear the simple template dropdown
    }));
    toast.success(`Template "${template.name}" applied!`);
  };

  return (
    <Card className="w-full max-w-2xl" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📧 Edit Email Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Use Saved Template Button */}
        <div className="p-3 border border-dashed rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Use a Saved Template</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.templateName 
                  ? `Using: ${formData.templateName}` 
                  : 'Import a newsletter design you created in Campaigns'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateBrowser(true)}
            >
              <Layout className="h-4 w-4 mr-2" />
              Browse Templates
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delay" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Send Timing
          </Label>
          <NativeSelect
            id="delay"
            value={formData.delay}
            onChange={(e) => setFormData({ ...formData, delay: e.target.value })}
          >
            <option value="Immediate">Immediate</option>
            <option value="1 hour">After 1 hour</option>
            <option value="2 hours">After 2 hours</option>
            <option value="4 hours">After 4 hours</option>
            <option value="12 hours">After 12 hours</option>
            <option value="24 hours">After 24 hours</option>
            <option value="2 days">After 2 days</option>
            <option value="3 days">After 3 days</option>
            <option value="7 days">After 7 days</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            When should this email be sent after the previous step?
          </p>
        </div>

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
          <InputWithMergeTags
            id="subject"
            placeholder="Enter email subject..."
            value={formData.subject}
            onChange={(value) => setFormData({ ...formData, subject: value })}
            inputClassName={errors.subject ? 'border-destructive' : ''}
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
          <TextareaWithMergeTags
            id="content"
            placeholder="Select a template above to generate content, or write your own..."
            value={formData.content}
            onChange={(value) => setFormData({ ...formData, content: value })}
            textareaClassName={`min-h-[200px] ${errors.content ? 'border-destructive' : ''}`}
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

        <div className="space-y-2">
          <Label>Email Image (Optional)</Label>
          <MediaSelectorImage
            src={formData.imageUrl}
            onChange={(imageUrl, metadata) => {
              setFormData({ 
                ...formData, 
                imageUrl,
                imageMetadata: metadata 
              });
            }}
            contentContext={formData.content || formData.template || 'Garden center email content'}
            className="w-full h-48"
          />
          <p className="text-xs text-muted-foreground">
            📸 Add a relevant image to make your email more engaging and professional.
          </p>
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

      {/* Template Browser Modal */}
      <AutomationTemplateBrowser
        open={showTemplateBrowser}
        onClose={() => setShowTemplateBrowser(false)}
        onSelectTemplate={handleTemplateSelect}
      />
    </Card>
  );
};