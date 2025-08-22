import { useState, useEffect } from 'react';
import { NewsletterIdea, NewsletterTemplate } from '@/types/newsletter';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getFallbackThemes } from '@/utils/fallbackThemes';

export const useNewsletterIdeas = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<NewsletterIdea[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchNewsletterIdeas = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both curated ideas and weekly themes in parallel
      const [curatedIdeasResult, weeklyThemesResult] = await Promise.allSettled([
        // Call the RPC function to get newsletter ideas
        supabase.rpc('fn_get_newsletter_ideas'),
        // Fetch weekly themes
        fetchWeeklyThemes()
      ]);

      let curatedIdeas: NewsletterIdea[] = [];
      let weeklyThemes: NewsletterIdea[] = [];

      // Process curated ideas
      if (curatedIdeasResult.status === 'fulfilled' && !curatedIdeasResult.value.error) {
        const data = curatedIdeasResult.value.data;
        curatedIdeas = Array.isArray(data) ? (data as unknown) as NewsletterIdea[] : [];
      }

      // Process weekly themes
      if (weeklyThemesResult.status === 'fulfilled') {
        weeklyThemes = weeklyThemesResult.value;
      }

      // Combine and deduplicate ideas by title
      const allIdeas = [...weeklyThemes, ...curatedIdeas];
      const uniqueIdeas = allIdeas.filter((idea, index, self) => 
        index === self.findIndex(other => 
          other.title.toLowerCase().trim() === idea.title.toLowerCase().trim()
        )
      );
      setIdeas(uniqueIdeas);
      setTemplates(defaultTemplates);
    } catch (err) {
      console.error('Error fetching newsletter ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch newsletter ideas');
      
      // Set fallback data (includes seasonal themes)
      const fallbackThemes = mapThemesToIdeas(getFallbackThemes());
      const fallbackCurated = getFallbackIdeas();
      setIdeas([...fallbackThemes, ...fallbackCurated]);
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  const generateAIIdeas = async (prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-newsletter-ideas', {
        body: { prompt }
      });

      if (error) throw error;

      const aiIdeas: NewsletterIdea[] = data.ideas || [];
      
      // Add AI-generated ideas to the current list
      setIdeas(prev => [...aiIdeas, ...prev]);
      
      return aiIdeas;
    } catch (err) {
      console.error('Error generating AI ideas:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchNewsletterIdeas();
  }, []);

  const fetchWeeklyThemes = async (): Promise<NewsletterIdea[]> => {
    try {
      if (!user) {
        // Return fallback themes if no user
        return mapThemesToIdeas(getFallbackThemes());
      }

      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          generateAll52Weeks: true,
          startYear: new Date().getFullYear()
        }
      });

      if (error || !data?.themes) {
        // Fall back to seasonal themes
        return mapThemesToIdeas(getFallbackThemes());
      }

      return mapThemesToIdeas(data.themes);
    } catch (err) {
      console.error('Error fetching weekly themes:', err);
      // Fall back to seasonal themes
      return mapThemesToIdeas(getFallbackThemes());
    }
  };

  const mapThemesToIdeas = (themes: any[]): NewsletterIdea[] => {
    return themes.map((theme, index) => ({
      id: `weekly-theme-${theme.week || index + 1}`,
      title: theme.title,
      description: theme.description,
      category: 'weekly' as const,
      weekNumber: theme.week || index + 1,
      templateBlocks: [
        { type: 'header', title: theme.title },
        { type: 'text', content: theme.description },
        ...(theme.content_ideas || []).slice(0, 3).map((idea: string) => ({
          type: 'image-text',
          title: idea,
          content: `Explore ${idea.toLowerCase()} with your audience this week.`
        }))
      ],
      heroQuery: theme.title?.toLowerCase().replace(/[^a-z0-9\s]/g, '') || 'newsletter content',
      estimatedReadTime: '4 min'
    }));
  };

  return {
    ideas,
    templates,
    loading,
    error,
    generateAIIdeas,
    refetch: fetchNewsletterIdeas
  };
};

// Fallback ideas when the API fails
const getFallbackIdeas = (): NewsletterIdea[] => [
  {
    id: 'holiday-winter',
    title: 'Winter Garden Care Tips',
    description: 'Essential care guide for keeping your garden healthy during winter months',
    category: 'seasonal',
    badge: 'Seasonal',
    templateBlocks: [
      { type: 'header', title: 'Winter Garden Care Tips' },
      { type: 'image-text', title: 'Protecting Your Plants', content: 'Learn how to protect your plants from frost and cold weather.' },
      { type: 'text', content: 'Winter is a crucial time for garden maintenance...' }
    ],
    heroQuery: 'winter garden frost protection',
    estimatedReadTime: '5 min'
  },
  {
    id: 'product-feature',
    title: 'New Arrival: Premium Plant Collection',
    description: 'Showcase your latest plant arrivals and seasonal favorites',
    category: 'product',
    badge: 'Product',
    templateBlocks: [
      { type: 'header', title: 'New Premium Plants' },
      { type: 'image-text', title: 'Featured Plant', content: 'Discover our newest additions to the collection.' },
      { type: 'button', buttonText: 'Shop Now', buttonUrl: '#' }
    ],
    heroQuery: 'premium indoor plants collection',
    estimatedReadTime: '3 min'
  },
  {
    id: 'general-tips',
    title: 'Monthly Gardening Checklist',
    description: 'Your complete guide to monthly garden tasks and maintenance',
    category: 'general',
    templateBlocks: [
      { type: 'header', title: 'Monthly Gardening Checklist' },
      { type: 'text', content: 'Stay on top of your garden with these monthly tasks...' },
      { type: 'image-text', title: 'This Month\'s Focus', content: 'Key activities for this time of year.' }
    ],
    heroQuery: 'gardening checklist tools',
    estimatedReadTime: '7 min'
  }
];