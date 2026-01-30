import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Form, FormField, FormSettings, FormCompliance, DEFAULT_FORM_SETTINGS, DEFAULT_FORM_COMPLIANCE } from '@/types/formBuilder';
import { Json } from '@/integrations/supabase/types';
import { fetchBrandColors } from '@/hooks/useBrandColors';

interface CreateFormData {
  name: string;
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
}

interface UpdateFormData {
  id: string;
  name?: string;
  status?: 'draft' | 'published' | 'archived';
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
}

export function useForms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) throw new Error('No tenant found');

      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('tenant_id', userData.tenant_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Cast the JSONB fields to proper types
      return (data || []).map(form => ({
        ...form,
        fields_json: form.fields_json as unknown as FormField[],
        settings_json: form.settings_json as unknown as FormSettings,
        compliance_json: form.compliance_json as unknown as FormCompliance,
      })) as Form[];
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (formData: CreateFormData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) throw new Error('No tenant found');

      // Fetch brand colors to use as defaults for new forms
      const brandColors = await fetchBrandColors(user.user.id);

      // Merge brand colors into default settings theme
      const settingsWithBrandColors: FormSettings = {
        ...DEFAULT_FORM_SETTINGS,
        ...formData.settings_json,
        theme: {
          ...DEFAULT_FORM_SETTINGS.theme,
          primary_color: brandColors.primary,
          ...formData.settings_json?.theme,
        },
      };

      const { data, error } = await supabase
        .from('forms')
        .insert({
          tenant_id: userData.tenant_id,
          name: formData.name,
          status: 'draft',
          fields_json: (formData.fields_json || []) as unknown as Json,
          settings_json: settingsWithBrandColors as unknown as Json,
          compliance_json: (formData.compliance_json || DEFAULT_FORM_COMPLIANCE) as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast({
        title: 'Form created',
        description: 'Your form has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating form',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateFormData) => {
      // Cast types for Supabase
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.fields_json !== undefined) dbUpdates.fields_json = updates.fields_json as unknown as Json;
      if (updates.settings_json !== undefined) dbUpdates.settings_json = updates.settings_json as unknown as Json;
      if (updates.compliance_json !== undefined) dbUpdates.compliance_json = updates.compliance_json as unknown as Json;

      const { data, error } = await supabase
        .from('forms')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
    onError: (error) => {
      toast({
        title: 'Error updating form',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast({
        title: 'Form deleted',
        description: 'Your form has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting form',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    forms: formsQuery.data || [],
    isLoading: formsQuery.isLoading,
    error: formsQuery.error,
    createForm: createFormMutation.mutateAsync,
    updateForm: updateFormMutation.mutateAsync,
    deleteForm: deleteFormMutation.mutateAsync,
    isCreating: createFormMutation.isPending,
    isUpdating: updateFormMutation.isPending,
    isDeleting: deleteFormMutation.isPending,
  };
}

export function useForm(formId: string | undefined) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['form', formId],
    queryFn: async () => {
      if (!formId) return null;

      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;

      return {
        ...data,
        fields_json: data.fields_json as unknown as FormField[],
        settings_json: data.settings_json as unknown as FormSettings,
        compliance_json: data.compliance_json as unknown as FormCompliance,
      } as Form;
    },
    enabled: !!formId,
  });
}

export function useFormSubmissions(formId: string | undefined, days: number = 7) {
  return useQuery({
    queryKey: ['form-submissions', formId, days],
    queryFn: async () => {
      if (!formId) return { submissions: [], count: 0 };

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error, count } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact' })
        .eq('form_id', formId)
        .gte('submitted_at', startDate.toISOString())
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      return {
        submissions: data || [],
        count: count || 0,
      };
    },
    enabled: !!formId,
  });
}
