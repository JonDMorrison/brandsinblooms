
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getFallbackThemes } from "@/utils/fallbackThemes";

interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

export const useThemeGeneration = (onThemesGenerated?: (themes: WeeklyTheme[]) => void) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedThemes, setGeneratedThemes] = useState<WeeklyTheme[]>([]);
  const [networkError, setNetworkError] = useState(false);

  const generateFallbackThemes = () => {
    const fallbackThemes = getFallbackThemes();
    setGeneratedThemes(fallbackThemes);
    toast.success(`Generated ${fallbackThemes.length} starter themes! You can customize these and generate more later.`);
    onThemesGenerated?.(fallbackThemes);
  };

  const generateWeeklyThemes = async () => {
    if (!user) {
      toast.error('Please log in to generate themes');
      return;
    }

    setLoading(true);
    setNetworkError(false);
    
    try {
      console.log('Generating 52-week themes for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          startYear: new Date().getFullYear()
        }
      });

      if (error) {
        console.error('Error generating themes:', error);
        
        if (error.message?.includes('Failed to send a request') || error.message?.includes('Failed to fetch')) {
          setNetworkError(true);
          toast.error('Network connection issue. You can use starter themes while we resolve this.');
          generateFallbackThemes();
          return;
        }
        
        throw new Error(error.message || 'Failed to generate themes');
      }

      if (data?.themes && Array.isArray(data.themes)) {
        setGeneratedThemes(data.themes);
        onThemesGenerated?.(data.themes);
        toast.success(`Generated ${data.themes.length} unique weekly themes!`);
      } else {
        throw new Error('Invalid response format from theme generator');
      }
    } catch (error: any) {
      console.error('Error generating weekly themes:', error);
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        setNetworkError(true);
        toast.error('Connection issue detected. Using starter themes instead.');
        generateFallbackThemes();
      } else {
        toast.error(error.message || 'Failed to generate weekly themes');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToCampaigns = async () => {
    if (!generatedThemes.length || !user) return;

    setLoading(true);
    try {
      const campaigns = generatedThemes.map((theme, index) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + (index * 7));
        
        return {
          week_number: theme.week,
          title: theme.title,
          theme: theme.title,
          description: theme.description,
          start_date: startDate.toISOString().split('T')[0],
          prompt: theme.content_ideas.join(' • ')
        };
      });

      const { error } = await supabase
        .from('campaigns')
        .insert(campaigns);

      if (error) {
        throw new Error(error.message);
      }

      toast.success(`${generatedThemes.length}-week campaign calendar created successfully!`);
      setGeneratedThemes([]);
    } catch (error: any) {
      console.error('Error saving campaigns:', error);
      toast.error(error.message || 'Failed to save campaigns');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    generatedThemes,
    networkError,
    generateWeeklyThemes,
    saveToCampaigns
  };
};
