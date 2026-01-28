import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from '@/hooks/useForms';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField, FormSettings, FormCompliance } from '@/types/formBuilder';
import { Json } from '@/integrations/supabase/types';
import { FormBuildTab } from '@/components/forms/FormBuildTab';
import { FormDesignTab } from '@/components/forms/FormDesignTab';
import { FormAudienceTab } from '@/components/forms/FormAudienceTab';
import { FormComplianceTab } from '@/components/forms/FormComplianceTab';
import { FormPublishTab } from '@/components/forms/FormPublishTab';
import { Skeleton } from '@/components/ui/skeleton';

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: form, isLoading, error } = useForm(formId);

  const [name, setName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [compliance, setCompliance] = useState<FormCompliance | null>(null);
  const [audience, setAudience] = useState({ assign_personas: [] as string[], assign_tags: [] as string[] });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize state from loaded form
  useEffect(() => {
    if (form) {
      setName(form.name);
      setFields(form.fields_json || []);
      setSettings(form.settings_json);
      setCompliance(form.compliance_json);
    }
  }, [form]);

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
        })
        .eq('id', formId);

      if (error) throw error;

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
          <p className="text-muted-foreground mb-4">This form may have been deleted.</p>
          <Button variant="outline" onClick={() => navigate('/crm/forms')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="build" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-6">
          <FormBuildTab
            fields={fields}
            onFieldsChange={(newFields) => {
              setFields(newFields);
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
            />
          )}
        </TabsContent>

        <TabsContent value="publish" className="mt-6">
          <FormPublishTab
            form={form}
            hasChanges={hasChanges}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
