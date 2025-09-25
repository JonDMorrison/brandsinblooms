import { useState, useEffect } from 'react';
import { NewsletterIdea, NewsletterTemplate } from '@/types/newsletter';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNewsletterIdeas = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<NewsletterIdea[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default templates
  const defaultTemplates: NewsletterTemplate[] = [
    {
      id: 'block-builder',
      name: 'Block Builder',
      layout: 'block-builder',
      thumbnail: '', // Using CSS patterns instead
      description: 'Multiple customizable blocks for rich content',
      isDefault: true
    },
    {
      id: 'simple-email',
      name: 'Simple Email',
      layout: 'simple-email',
      thumbnail: '', // Using CSS patterns instead
      description: 'Clean, straightforward single-column format'
    }
  ];

  // Fetch 52 weekly themes preset from campaigns table
  const fetchWeeklyThemesPreset = async (): Promise<NewsletterIdea[]> => {
    try {
      console.log('📋 Fetching 52 weekly themes preset from campaigns table...');
      
      // Query campaigns table for all 52 weekly themes
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('week_number, title, theme, description, prompt')
        .not('week_number', 'is', null)
        .gte('week_number', 1)
        .lte('week_number', 52)
        .order('week_number', { ascending: true });

      if (error) {
        console.error('Error fetching weekly themes:', error);
        throw error;
      }

      if (!campaigns || campaigns.length === 0) {
        console.warn('No weekly themes found in campaigns table');
        return [];
      }

      console.log(`📋 Found ${campaigns.length} weekly themes in database`);
      
      // Map campaigns to NewsletterIdea format
      const weeklyIdeas: NewsletterIdea[] = campaigns.map((campaign) => ({
        id: `weekly-theme-${campaign.week_number}`,
        title: `Week ${campaign.week_number}: ${campaign.title || campaign.theme}`,
        description: campaign.description || campaign.prompt || `Weekly theme for week ${campaign.week_number}`,
        category: 'weekly' as const,
        badge: `Week ${campaign.week_number}`,
        weekNumber: campaign.week_number,
        templateBlocks: [
          { 
            type: 'header', 
            title: campaign.theme || campaign.title || `Week ${campaign.week_number}` 
          },
          { 
            type: 'text', 
            content: campaign.description || campaign.prompt || 'Weekly themed content for your newsletter.' 
          },
          { 
            type: 'image-text', 
            title: 'This Week\'s Focus', 
            content: `Featured content and ideas for week ${campaign.week_number}.` 
          }
        ],
        heroQuery: (campaign.theme || campaign.title || 'weekly newsletter')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ''),
        estimatedReadTime: '5 min'
      }));

      return weeklyIdeas;
    } catch (err) {
      console.error('Error fetching weekly themes preset:', err);
      throw err;
    }
  };

  // Load weekly themes automatically when hook is initialized
  const loadWeeklyThemes = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const weeklyThemes = await fetchWeeklyThemesPreset();
      setIdeas(weeklyThemes);
      setTemplates(defaultTemplates);
      
      console.log(`✅ Loaded ${weeklyThemes.length} weekly themes successfully`);
    } catch (err) {
      console.error('Error loading weekly themes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weekly themes');
      setIdeas([]);
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  // Generate additional AI ideas based on user prompt
  const generateAIIdeas = async (prompt: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('generate-newsletter-ideas', {
        body: { prompt }
      });

      if (error) throw error;

      const aiIdeas: NewsletterIdea[] = data.ideas || [];
      
      // Add AI-generated ideas to the current list (prepend them)
      setIdeas(prev => [...aiIdeas, ...prev]);
      
      console.log(`✅ Generated ${aiIdeas.length} AI ideas for prompt: "${prompt}"`);
      return aiIdeas;
    } catch (err) {
      console.error('Error generating AI ideas:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Auto-load weekly themes when user is available
  useEffect(() => {
    if (user) {
      loadWeeklyThemes();
    }
  }, [user]);

  const refetch = () => {
    if (user) {
      loadWeeklyThemes();
    }
  };

  return {
    ideas,
    templates,
    loading,
    error,
    generateAIIdeas,
    refetch
  };
};