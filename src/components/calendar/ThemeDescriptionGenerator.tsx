
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ThemeDescriptionGeneratorProps {
  theme: string;
  onDescriptionGenerated: (description: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const generateThemeDescription = async (
  theme: string,
  onDescriptionGenerated: (description: string) => void,
  onLoadingChange: (isLoading: boolean) => void,
  userId?: string
) => {
  if (!theme.trim()) return;
  
  onLoadingChange(true);
  
  try {
    console.log('Generating region-aware theme description for:', theme);
    
    const { data, error } = await supabase.functions.invoke('generate-theme-description', {
      body: { 
        theme: theme.trim(),
        userId: userId // Pass userId for potential regional context
      }
    });

    if (error) {
      console.error('Error from edge function:', error);
      throw new Error(error.message || 'Failed to generate description');
    }

    if (data?.description) {
      onDescriptionGenerated(data.description);
    } else {
      throw new Error('No description returned from AI');
    }
  } catch (error) {
    console.error('Error generating description:', error);
    
    // Improved fallback description that considers regional differences
    const fallbackDescription = `This theme will showcase ${theme.toLowerCase()} with practical tips and expert guidance tailored to various growing conditions. We'll highlight seasonal opportunities and demonstrate how our quality products and services can help customers achieve their gardening goals in their specific climate zone.`;
    onDescriptionGenerated(fallbackDescription);
  } finally {
    onLoadingChange(false);
  }
};
