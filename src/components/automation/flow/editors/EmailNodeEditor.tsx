import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Loader2, Clock, Layout, FileText, AlertTriangle, User, Eye, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { regenerateEmailContent } from '@/utils/aiContentRegenerator';
import { toast } from '@/utils/toast';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { InputWithMergeTags } from '@/components/ui/input-with-merge-tags';
import { TextareaWithMergeTags } from '@/components/ui/textarea-with-merge-tags';
import { AutomationTemplateBrowser } from '@/components/automation/AutomationTemplateBrowser';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { EmailNodeExecutionPanel } from '@/components/crm/automation/EmailNodeExecutionPanel';

// Enhanced source template attribution
interface SourceTemplate {
  id: string;
  name: string;
  insertedAt: string; // ISO timestamp
}

interface EmailNodeData {
  subject: string;
  content: string;
  template?: string;
  imageUrl?: string;
  imageMetadata?: any;
  delay?: string;
  templateId?: string;
  templateName?: string;
  sourceTemplate?: SourceTemplate; // Enhanced attribution
}

interface PreviewDiagnostics {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
}

interface CustomerOption {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

type PreviewMode = 'none' | 'sample' | 'customer';

interface EmailNodeEditorProps {
  data: EmailNodeData;
  nodeId?: string;
  automationId?: string;
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
  nodeId,
  automationId,
  onSave,
  onCancel
}) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  
  const [formData, setFormData] = useState<EmailNodeData>({
    subject: data.subject || '',
    content: data.content || '',
    template: data.template || '',
    imageUrl: data.imageUrl || '',
    imageMetadata: data.imageMetadata || null,
    delay: data.delay || 'Immediate',
    templateId: data.templateId || '',
    templateName: data.templateName || '',
    sourceTemplate: data.sourceTemplate || undefined
  });

  const [errors, setErrors] = useState<Partial<EmailNodeData>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  
  // Preview state
  const [previewMode, setPreviewMode] = useState<PreviewMode>('none');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderedSubject, setRenderedSubject] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);

  // Fetch customers for preview selector
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['crm-customers-automation-preview', tenantId, customerSearch],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (customerSearch) {
        // SECURITY: [PostgREST filter injection] - Sanitize user input before interpolation into .or() filter
        const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
        const safeSearch = sanitizeForPostgrest(customerSearch);
        query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerOption[];
    },
    enabled: !!tenantId && previewMode === 'customer',
  });

  useEffect(() => {
    setFormData({
      subject: data.subject || '',
      content: data.content || '',
      template: data.template || '',
      imageUrl: data.imageUrl || '',
      imageMetadata: data.imageMetadata || null,
      delay: data.delay || 'Immediate',
      templateId: data.templateId || '',
      templateName: data.templateName || '',
      sourceTemplate: data.sourceTemplate || undefined
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
    const sourceTemplate: SourceTemplate = {
      id: template.id,
      name: template.name,
      insertedAt: new Date().toISOString()
    };
    
    setFormData(prev => ({
      ...prev,
      subject: template.name,
      content: renderedHtml,
      templateId: template.id,
      templateName: template.name,
      sourceTemplate,
      template: '' // Clear the simple template dropdown
    }));
    toast.success(`Template "${template.name}" applied!`);
  };
  
  // Clear template attribution (keeps HTML)
  const handleClearTemplateLink = () => {
    setFormData(prev => ({
      ...prev,
      templateId: undefined,
      templateName: undefined,
      sourceTemplate: undefined
    }));
    toast.success('Template link cleared. Content unchanged.');
  };
  
  // Preview rendering using server-side renderer
  const renderPreview = useCallback(async () => {
    if (!formData.content) return;
    
    setIsRendering(true);
    setPreviewError(null);
    
    try {
      const body: Record<string, unknown> = {
        html: formData.content,
        subject: formData.subject,
      };
      
      if (previewMode === 'customer' && selectedCustomerId) {
        body.customerId = selectedCustomerId;
      } else if (previewMode === 'sample') {
        body.sampleCustomer = {
          first_name: 'Jane',
          last_name: 'Gardener',
          email: 'jane@example.com',
          phone: '(555) 123-4567',
        };
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('render-email-preview', {
        body,
      });
      
      if (fnError) throw fnError;
      
      setRenderedHtml(data.renderedHtml);
      setRenderedSubject(data.renderedSubject);
      setDiagnostics(data.diagnostics);
    } catch (err) {
      console.error('Preview render error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to render preview');
    } finally {
      setIsRendering(false);
    }
  }, [formData.content, formData.subject, previewMode, selectedCustomerId]);
  
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const hasWarnings = diagnostics && (diagnostics.missingTags.length > 0 || diagnostics.emptyResolvedTags.length > 0);

  return (
    <Card className="w-full max-w-2xl" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📧 Edit Email Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Template Snapshot Banner - shows when template was used */}
        {formData.sourceTemplate && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200 flex items-center justify-between">
              <span>Template Snapshot</span>
              <Badge variant="secondary" className="text-xs ml-2">
                {new Date(formData.sourceTemplate.insertedAt).toLocaleDateString()}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <p className="text-sm mb-2">
                This email was created from template: <strong>{formData.sourceTemplate.name}</strong>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                ⚠️ Changes to the original template will NOT update this automation email.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateBrowser(true)}
                  className="text-xs"
                >
                  <Layout className="h-3 w-3 mr-1" />
                  Replace Template
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearTemplateLink}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Link
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Execution Stats Panel - only show if automation exists */}
        {automationId && nodeId && (
          <EmailNodeExecutionPanel
            automationId={automationId}
            nodeId={nodeId}
            className="border-muted"
          />
        )}
        
        {/* Use Saved Template Button - only show if no template applied */}
        {!formData.sourceTemplate && (
          <div className="p-3 border border-dashed rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Use a Saved Template</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Import a newsletter design you created in Campaigns
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
        )}

        {/* Preview as Customer Panel */}
        <div className="border rounded-lg">
          <button
            type="button"
            className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
            onClick={() => setShowPreviewPanel(!showPreviewPanel)}
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview as Customer</span>
              {hasWarnings && (
                <Badge variant="destructive" className="text-xs">
                  {(diagnostics?.missingTags.length || 0) + (diagnostics?.emptyResolvedTags.length || 0)} issues
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground text-xs">{showPreviewPanel ? '▼' : '▶'}</span>
          </button>
          
          {showPreviewPanel && (
            <div className="p-3 border-t space-y-3">
              {/* Preview Mode Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-sm">Preview as:</Label>
                <NativeSelect 
                  value={previewMode} 
                  onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
                  className="w-[150px]"
                >
                  <option value="none">No personalization</option>
                  <option value="sample">Sample Customer</option>
                  <option value="customer">Real Customer</option>
                </NativeSelect>

                {previewMode === 'customer' && (
                  <>
                    <Input
                      placeholder="Search..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-[140px]"
                    />
                    <NativeSelect 
                      value={selectedCustomerId} 
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      disabled={customersLoading}
                      className="w-[200px]"
                    >
                      <option value="">Select customer...</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.first_name || customer.email}
                        </option>
                      ))}
                    </NativeSelect>
                  </>
                )}

                <Button 
                  onClick={renderPreview} 
                  disabled={isRendering || (previewMode === 'customer' && !selectedCustomerId)}
                  size="sm"
                  variant="secondary"
                >
                  {isRendering ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1" />
                  )}
                  Render
                </Button>
              </div>

              {/* Customer Badge */}
              {previewMode === 'customer' && selectedCustomer && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {selectedCustomer.first_name} {selectedCustomer.last_name} ({selectedCustomer.email})
                </Badge>
              )}
              {previewMode === 'sample' && (
                <Badge variant="outline" className="gap-1">
                  <User className="h-3 w-3" />
                  Jane Gardener (jane@example.com)
                </Badge>
              )}

              {/* Error Display */}
              {previewError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {/* Diagnostics Warning */}
              {hasWarnings && (
                <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
                    Personalization Issues
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                    {diagnostics!.missingTags.length > 0 && (
                      <div className="mt-1">
                        <strong>Missing:</strong>{' '}
                        {diagnostics!.missingTags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="mr-1 text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {diagnostics!.missingTags.length > 3 && <span>+{diagnostics!.missingTags.length - 3} more</span>}
                      </div>
                    )}
                    {diagnostics!.emptyResolvedTags.length > 0 && (
                      <div className="mt-1">
                        <strong>Empty:</strong>{' '}
                        {diagnostics!.emptyResolvedTags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="mr-1 text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Rendered Subject */}
              {renderedSubject && (
                <div className="p-2 bg-muted rounded text-sm">
                  <span className="font-medium">Subject:</span> {renderedSubject}
                </div>
              )}

              {/* Diagnostics Summary */}
              {diagnostics && !hasWarnings && diagnostics.usedTags.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    ✓ {diagnostics.usedTags.length} merge tags OK
                  </Badge>
                </div>
              )}
            </div>
          )}
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