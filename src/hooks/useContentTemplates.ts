
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Removed sonner import - using global toast replacement

interface Template {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
  type: string;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export const useContentTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('content_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (templateData: Omit<Template, 'id' | 'usage_count' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('content_templates')
        .insert({
          ...templateData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setTemplates(prev => [data, ...prev]);
      toast.success('Template created successfully');
      return data;
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
      throw error;
    }
  };

  const useTemplate = async (templateId: string) => {
    try {
      await supabase.rpc('increment_template_usage', { template_id: templateId });
      
      // Update local state
      setTemplates(prev => 
        prev.map(template => 
          template.id === templateId 
            ? { ...template, usage_count: template.usage_count + 1 }
            : template
        )
      );
    } catch (error) {
      console.error('Error updating template usage:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('content_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(template => template.id !== templateId));
      toast.success('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  return {
    templates,
    loading,
    createTemplate,
    useTemplate,
    deleteTemplate,
    refetch: fetchTemplates
  };
};
