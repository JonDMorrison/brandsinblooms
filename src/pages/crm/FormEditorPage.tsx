import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useForm } from '@/hooks/useForms';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Loader2, Eye, EyeOff, PanelRightClose, PanelRight, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField, FormSettings, FormCompliance, FormAudience } from '@/types/formBuilder';
import { Json } from '@/integrations/supabase/types';
import { FormBuildTab } from '@/components/forms/FormBuildTab';
import { FormDesignTab } from '@/components/forms/FormDesignTab';
import { FormAudienceTab } from '@/components/forms/FormAudienceTab';
import { FormComplianceTab } from '@/components/forms/FormComplianceTab';
import { FormPublishTab } from '@/components/forms/FormPublishTab';
import { FormSubmissionsTab } from '@/components/forms/FormSubmissionsTab';
import { FormTestMatrix } from '@/components/forms/FormTestMatrix';
import { FormAnalyticsTab } from '@/components/forms/FormAnalyticsTab';
import { PreviewPanel } from '@/components/forms/preview';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: form, isLoading, error, refetch } = useForm(formId);

  const [name, setName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [compliance, setCompliance] = useState<FormCompliance | null>(null);
  const [audience, setAudience] = useState<FormAudience>({ assign_personas: [], assign_tags: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activeTab, setActiveTab] = useState('build');

  const isMobile = useMediaQuery('(max-width: 1024px)');

  // Fix 4: Browser beforeunload warning
  useBeforeUnload({ when: hasChanges });

  // Fix 4: React Router navigation guard
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Hide preview by default on mobile
  useEffect(() => {
    if (isMobile) {
      setShowPreview(false);
    }
  }, [isMobile]);

  // Reset dirty state when navigating to a different form
  useEffect(() => {
    setHasChanges(false);
  }, [formId]);

  // Initialize state from loaded form (Fix 2: include audience)
  useEffect(() => {
    if (form) {
      setName(form.name);
      setFields(form.fields_json || []);
      setSettings(form.settings_json);
      setCompliance(form.compliance_json);
      // Initialize audience from saved form data
      const formAny = form as any;
      if (formAny.audience_json) {
        setAudience({
          assign_personas: formAny.audience_json.assign_personas || [],
          assign_tags: formAny.audience_json.assign_tags || [],
        });
      }
    }
  }, [form]);

  // Fix 2: Include audience_json in save payload
  const handleSave = async () => {
    if (!formId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('forms')
        .update({
          name,
          fields_json: fields as unknown as Json,
          settings_json: settings as unknown as Json,
          compliance_json: compliance as unknown as Json,
          audience_json: audience as unknown as Json,
        })
        .eq('id', formId);

      if (error) throw error;

      // Invalidate cached query data so navigation shows fresh state
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
      queryClient.invalidateQueries({ queryKey: ['forms'] });

      toast({
        title: 'Form saved',
        description: 'Your changes have been saved.',
      });
      setHasChanges(false);
    } catch (err: any) {
      toast({
        title: 'Error saving form',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const markChanged = () => setHasChanges(true);

  const showPreviewForTab = ['build', 'design', 'compliance'].includes(activeTab);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Form not found</h2>
          <p className="text-muted-foreground mb-4">
            {error ? (error as Error)?.message || 'Failed to load form.' : 'This form may have been deleted.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {error && (
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/crm/forms')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Forms
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm/forms')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markChanged();
            }}
            className="text-xl font-semibold border-none bg-transparent focus-visible:ring-0 px-0 max-w-md"
            placeholder="Form name"
          />
        </div>
        <div className="flex items-center gap-2">
          {showPreviewForTab && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="hidden lg:flex items-center gap-2"
            >
              {showPreview ? (
                <>
                  <PanelRightClose className="h-4 w-4" />
                  <span className="hidden xl:inline">Hide Preview</span>
                </>
              ) : (
                <>
                  <PanelRight className="h-4 w-4" />
                  <span className="hidden xl:inline">Show Preview</span>
                </>
              )}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className={cn(
            'flex-1 overflow-auto p-6 transition-all duration-200',
            showPreview && showPreviewForTab && !isMobile ? 'lg:w-[60%] lg:max-w-[800px]' : 'w-full'
          )}
        >
          {/* Fix 6: 7 tabs including Analytics */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 max-w-3xl">
              <TabsTrigger value="build">Build</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="publish">Publish</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="build" className="mt-6">
              <FormBuildTab
                fields={fields}
                onFieldsChange={(newFields) => {
                  setFields(newFields);
                  markChanged();
                }}
                onApplyTemplate={(templateData) => {
                  if (templateData.name) setName(templateData.name);
                  if (templateData.fields_json) setFields(templateData.fields_json);
                  if (templateData.settings_json) setSettings(templateData.settings_json);
                  if (templateData.compliance_json) setCompliance(templateData.compliance_json);
                  markChanged();
                }}
              />
            </TabsContent>

            <TabsContent value="design" className="mt-6">
              {settings && (
                <FormDesignTab
                  settings={settings}
                  onSettingsChange={(newSettings) => {
                    setSettings(newSettings);
                    markChanged();
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="audience" className="mt-6">
              <FormAudienceTab
                audience={audience}
                onAudienceChange={(newAudience) => {
                  setAudience(newAudience);
                  markChanged();
                }}
              />
            </TabsContent>

            <TabsContent value="compliance" className="mt-6">
              {compliance && (
                <FormComplianceTab
                  compliance={compliance}
                  onComplianceChange={(newCompliance) => {
                    setCompliance(newCompliance);
                    markChanged();
                  }}
                  hasPhoneField={fields.some(f => f.type === 'phone')}
                  hasEmailField={fields.some(f => f.type === 'email')}
                />
              )}
            </TabsContent>

            {/* Fix 5: Pass current fields for validation */}
            <TabsContent value="publish" className="mt-6">
              <FormPublishTab
                form={form}
                fields={fields}
                hasChanges={hasChanges}
                onSave={handleSave}
                isSaving={isSaving}
              />
            </TabsContent>

            <TabsContent value="submissions" className="mt-6">
              <div className="space-y-6">
                <FormSubmissionsTab formId={form.id} formName={form.name} />
                <FormTestMatrix form={form} />
              </div>
            </TabsContent>

            {/* Fix 6: Analytics tab */}
            <TabsContent value="analytics" className="mt-6">
              <FormAnalyticsTab formId={form.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Preview Panel */}
        {showPreview && showPreviewForTab && (
          <div className="hidden lg:flex lg:flex-col w-[40%] min-w-[380px] max-w-[500px] border-l bg-muted/30 p-4 overflow-hidden">
            <PreviewPanel
              fields={fields}
              settings={settings}
              compliance={compliance}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Mobile Preview Button (floating) */}
      {showPreviewForTab && isMobile && (
        <Button
          onClick={() => setShowPreview(!showPreview)}
          className="fixed bottom-6 right-6 rounded-full shadow-lg z-50"
          size="lg"
        >
          {showPreview ? (
            <EyeOff className="h-5 w-5 mr-2" />
          ) : (
            <Eye className="h-5 w-5 mr-2" />
          )}
          Preview
        </Button>
      )}

      {/* Mobile Preview Modal */}
      {showPreview && showPreviewForTab && isMobile && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm overflow-auto">
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Form Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                <EyeOff className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <PreviewPanel
                fields={fields}
                settings={settings}
                compliance={compliance}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fix 4: Unsaved changes navigation guard dialog */}
      {blocker.state === 'blocked' && (
        <ConfirmationDialog
          open={true}
          onOpenChange={() => blocker.reset?.()}
          title="Unsaved Changes"
          description="You have unsaved changes. Are you sure you want to leave?"
          confirmText="Leave"
          cancelText="Stay"
          onConfirm={() => blocker.proceed?.()}
        />
      )}
    </div>
  );
}
