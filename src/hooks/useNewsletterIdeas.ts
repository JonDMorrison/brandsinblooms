import { useState, useEffect } from 'react';
import { NewsletterIdea, NewsletterTemplate } from '@/types/newsletter';
import { supabase } from '@/integrations/supabase/client';

export const useNewsletterIdeas = () => {
  const [ideas, setIdeas] = useState<NewsletterIdea[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default templates
  const defaultTemplates: NewsletterTemplate[] = [
    {
      id: 'classic',
      name: 'Classic',
      layout: 'classic',
      thumbnail: '/newsletter-layouts/classic.png',
      description: 'Traditional newsletter layout with header, content blocks, and footer',
      isDefault: true
    },
    {
      id: 'magazine',
      name: 'Magazine',
      layout: 'magazine',
      thumbnail: '/newsletter-layouts/magazine.png',
      description: 'Modern magazine-style layout with sidebar and featured content'
    },
    {
      id: 'minimal',
      name: 'One Column',
      layout: 'one-column',
      thumbnail: '/newsletter-layouts/one-column.png',
      description: 'Clean, minimal single-column layout for easy reading'
    }
  ];

  const fetchNewsletterIdeas = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, use fallback data until we create the RPC function
      // TODO: Implement the actual RPC function fn_get_newsletter_ideas
      setIdeas(getFallbackIdeas());
      setTemplates(defaultTemplates);
    } catch (err) {
      console.error('Error fetching newsletter ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch newsletter ideas');
      
      // Set fallback data
      setIdeas(getFallbackIdeas());
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