import { useState, useEffect } from 'react';
import { NewsletterIdea, NewsletterTemplate } from '@/types/newsletter';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getFallbackThemes } from '@/utils/fallbackThemes';
import { format } from 'date-fns';

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
      
      // Don't set fallback data - keep ideas empty until user provides prompt
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  const generateAIIdeas = async (prompt: string) => {
    try {
      // If this is the first time and we have no ideas, also fetch the curated ideas
      const shouldFetchCurated = ideas.length === 0;
      
      if (shouldFetchCurated) {
        setLoading(true);
        // Fetch all ideas in parallel when user enters first prompt
        const [aiResult, curatedIdeasResult, weeklyThemesResult] = await Promise.allSettled([
          supabase.functions.invoke('generate-newsletter-ideas', {
            body: { prompt }
          }),
          supabase.rpc('fn_get_newsletter_ideas'),
          fetchWeeklyThemes()
        ]);
        
        let aiIdeas: NewsletterIdea[] = [];
        let curatedIdeas: NewsletterIdea[] = [];
        let weeklyThemes: NewsletterIdea[] = [];
        
        // Process AI ideas
        if (aiResult.status === 'fulfilled' && !aiResult.value.error) {
          aiIdeas = aiResult.value.data?.ideas || [];
        }
        
        // Process curated ideas
        if (curatedIdeasResult.status === 'fulfilled' && !curatedIdeasResult.value.error) {
          const data = curatedIdeasResult.value.data;
          curatedIdeas = Array.isArray(data) ? (data as unknown) as NewsletterIdea[] : [];
        }
        
        // Process weekly themes
        if (weeklyThemesResult.status === 'fulfilled') {
          weeklyThemes = weeklyThemesResult.value;
        }
        
        // Combine and deduplicate all ideas
        const allIdeas = [...aiIdeas, ...weeklyThemes, ...curatedIdeas];
        const uniqueIdeas = allIdeas.filter((idea, index, self) => 
          index === self.findIndex(other => 
            other.title.toLowerCase().trim() === idea.title.toLowerCase().trim()
          )
        );
        setIdeas(uniqueIdeas);
        setTemplates(defaultTemplates);
        setLoading(false);
        
        return aiIdeas;
      } else {
        // Just generate AI ideas if we already have curated ones
        const { data, error } = await supabase.functions.invoke('generate-newsletter-ideas', {
          body: { prompt }
        });

        if (error) throw error;

        const aiIdeas: NewsletterIdea[] = data.ideas || [];
        
        // Add AI-generated ideas to the current list
        setIdeas(prev => [...aiIdeas, ...prev]);
        
        return aiIdeas;
      }
    } catch (err) {
      console.error('Error generating AI ideas:', err);
      setLoading(false);
      throw err;
    }
  };

  // Remove automatic fetching - ideas will load only when user enters a prompt
  // useEffect(() => {
  //   fetchNewsletterIdeas();
  // }, []);

  const getCurrentWeekNumber = (): number => {
    // Use ISO week calculation to match the edge function
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const fetchWeeklyThemes = async (): Promise<NewsletterIdea[]> => {
    try {
      if (!user) {
        // Return empty array if no user - no fallback themes
        return [];
      }

      const currentWeek = getCurrentWeekNumber();
      console.log('🗓️ Current week calculated as:', currentWeek, 'for date:', format(new Date(), 'yyyy-MM-dd'));
      
      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          generateAll52Weeks: true,
          startYear: new Date().getFullYear(),
          startWeek: currentWeek
        }
      });

      if (error || !data?.themes) {
        console.warn('Edge function failed, returning empty array');
        // Return empty array instead of fallback themes
        return [];
      }

      console.log('📋 Generated themes count:', data.themes.length);
      console.log('📋 First 3 themes:', data.themes.slice(0, 3).map(t => ({ week: t.week, title: t.title })));
      
      return mapThemesToIdeas(data.themes, currentWeek);
    } catch (err) {
      console.error('Error fetching weekly themes:', err);
      // Return empty array instead of fallback themes
      return [];
    }
  };

  const mapThemesToIdeas = (themes: any[], startWeek?: number): NewsletterIdea[] => {
    const currentWeek = startWeek || getCurrentWeekNumber();
    
    return themes.map((theme, index) => {
      // Calculate the actual week number, wrapping around the year
      let weekNumber = theme.week || (currentWeek + index);
      if (weekNumber > 52) {
        weekNumber = weekNumber - 52;
      }
      
      return {
        id: `weekly-theme-${weekNumber}-${index}`,
        title: theme.title,
        description: theme.description,
        category: 'weekly' as const,
        weekNumber: weekNumber,
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
      };
    });
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

// Fallback ideas when the API fails - seasonal and evergreen
const getFallbackIdeas = (): NewsletterIdea[] => [
  {
    id: 'seasonal-current',
    title: 'Seasonal Garden Care Guide',
    description: 'Essential care tips and advice for maintaining your garden this season',
    category: 'seasonal',
    badge: 'Seasonal',
    templateBlocks: [
      { type: 'header', title: 'Seasonal Garden Care' },
      { type: 'image-text', title: 'This Season\'s Focus', content: 'Important care tips for successful gardening right now.' },
      { type: 'text', content: 'Follow our expert seasonal recommendations to keep your garden thriving.' }
    ],
    heroQuery: 'seasonal garden care tips',
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