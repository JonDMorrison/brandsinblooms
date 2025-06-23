
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getFallbackThemes } from "@/utils/fallbackThemes";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { handleError } from "@/utils/errorHandling";

interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

export const useThemeGeneration = (onThemesGenerated?: (themes: WeeklyTheme[]) => void) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);
  const [generatedThemes, setGeneratedThemes] = useState<WeeklyTheme[]>([]);
  const [networkError, setNetworkError] = useState(false);

  const generateFallbackThemes = () => {
    const fallbackThemes = getFallbackThemes();
    setGeneratedThemes(fallbackThemes);
    onThemesGenerated?.(fallbackThemes);
  };

  const generateWeeklyThemes = async (generateAll52Weeks: boolean = true) => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setNetworkError(false);
    
    try {
      console.log(`Generating ${generateAll52Weeks ? '52-week' : 'weekly'} themes for user:`, user.id);
      
      // If offline or previous network error, use fallback immediately
      if (!isOnline) {
        console.log('Offline detected, using fallback themes');
        generateFallbackThemes();
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          generateAll52Weeks: generateAll52Weeks,
          startYear: new Date().getFullYear()
        }
      });

      if (error) {
        console.error('Error generating themes:', error);
        
        const appError = handleError(error, 'theme generation');
        
        if (appError.isNetworkError) {
          setNetworkError(true);
          if (generateAll52Weeks) {
            generateFallbackThemes();
          }
          return;
        }
        
        throw new Error(error.message || 'Failed to generate themes');
      }

      if (data?.themes && Array.isArray(data.themes)) {
        setGeneratedThemes(data.themes);
        onThemesGenerated?.(data.themes);
        
        const themeCount = data.themes.length;
        if (generateAll52Weeks) {
          // Only show success toast for major generations - this is approved
          toast.success(`Generated ${themeCount} unique weekly themes!`);
        }
      } else {
        throw new Error('Invalid response format from theme generator');
      }
    } catch (error: any) {
      console.error('Error generating weekly themes:', error);
      
      const appError = handleError(error, 'theme generation');
      
      if (appError.isNetworkError) {
        setNetworkError(true);
        if (generateAll52Weeks) {
          generateFallbackThemes();
        }
      } else {
        toast.error('An unexpected error occurred');
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
          prompt: theme.content_ideas.join(' • '),
          user_id: user.id,
          source: 'theme_generator'
        };
      });

      const { error } = await supabase
        .from('campaigns')
        .insert(campaigns);

      if (error) {
        throw new Error(error.message);
      }

      setGeneratedThemes([]);
    } catch (error: any) {
      console.error('Error saving campaigns:', error);
      toast.error('An unexpected error occurred');
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
