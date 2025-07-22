import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { ContentBlock } from '@/types/emailBuilder';

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layout_json: ContentBlock[];
  thumbnail_url?: string;
  usage_count: number;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveTemplateData {
  name: string;
  description: string;
  category: string;
  content_blocks: ContentBlock[];
  tags?: string[];
  is_public?: boolean;
}

export const useCampaignTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('saved_campaign_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const processedTemplates: CampaignTemplate[] = (data || []).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: template.category || 'General',
        layout_json: Array.isArray(template.layout_json) ? template.layout_json as unknown as ContentBlock[] : [],
        thumbnail_url: template.thumbnail_url,
        usage_count: template.usage_count || 0,
        tags: Array.isArray(template.tags) ? template.tags : [],
        is_public: template.is_public || false,
        created_at: template.created_at,
        updated_at: template.updated_at
      }));

      setTemplates(processedTemplates);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message);
      toast.error('Failed to load campaign templates');
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async (templateData: SaveTemplateData): Promise<CampaignTemplate | null> => {
    if (!user) {
      toast.error('Must be logged in to save templates');
      return null;
    }

    try {
      const { data, error: saveError } = await supabase
        .from('saved_campaign_templates')
        .insert({
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          layout_json: templateData.content_blocks as any,
          tags: templateData.tags || [],
          is_public: templateData.is_public || false,
          user_id: user.id,
          usage_count: 0
        })
        .select()
        .single();

      if (saveError) throw saveError;

      const newTemplate: CampaignTemplate = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        category: data.category || 'General',
        layout_json: Array.isArray(data.layout_json) ? data.layout_json as unknown as ContentBlock[] : [],
        thumbnail_url: data.thumbnail_url,
        usage_count: data.usage_count || 0,
        tags: Array.isArray(data.tags) ? data.tags : [],
        is_public: data.is_public || false,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      setTemplates(prev => [newTemplate, ...prev]);
      toast.success(`Template "${templateData.name}" saved successfully!`);
      return newTemplate;
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
      return null;
    }
  };

  const useTemplate = async (templateId: string): Promise<CampaignTemplate | null> => {
    try {
      // Increment usage count
      const { error: updateError } = await supabase
        .rpc('increment_template_usage', { template_id: templateId });

      if (updateError) throw updateError;

      // Update local state
      setTemplates(prev => 
        prev.map(template => 
          template.id === templateId 
            ? { ...template, usage_count: template.usage_count + 1 }
            : template
        )
      );

      const template = templates.find(t => t.id === templateId);
      if (template) {
        toast.success(`Applied template: ${template.name}`);
        return template;
      }
      return null;
    } catch (err: any) {
      console.error('Error using template:', err);
      toast.error('Failed to apply template');
      return null;
    }
  };

  const deleteTemplate = async (templateId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('saved_campaign_templates')
        .delete()
        .eq('id', templateId);

      if (deleteError) throw deleteError;

      setTemplates(prev => prev.filter(template => template.id !== templateId));
      toast.success('Template deleted successfully');
      return true;
    } catch (err: any) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template');
      return false;
    }
  };

  const getTemplatesByCategory = () => {
    return templates.reduce((groups, template) => {
      const category = template.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
      return groups;
    }, {} as Record<string, CampaignTemplate[]>);
  };

  const getTopPerformingTemplates = (limit = 3) => {
    return templates
      .filter(template => template.usage_count > 0)
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit);
  };

  const searchTemplates = (query: string, category?: string) => {
    return templates.filter(template => {
      const matchesQuery = query === '' || 
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
      
      const matchesCategory = !category || template.category === category;
      
      return matchesQuery && matchesCategory;
    });
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    saveAsTemplate,
    useTemplate,
    deleteTemplate,
    getTemplatesByCategory,
    getTopPerformingTemplates,
    searchTemplates
  };
};