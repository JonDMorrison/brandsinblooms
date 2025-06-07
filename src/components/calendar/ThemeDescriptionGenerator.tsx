
import { supabase } from "@/integrations/supabase/client";

interface ThemeDescriptionGeneratorProps {
  theme: string;
  onDescriptionGenerated: (description: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const generateThemeDescription = async (
  theme: string,
  onDescriptionGenerated: (description: string) => void,
  onLoadingChange: (isLoading: boolean) => void
) => {
  if (!theme.trim()) return;
  
  onLoadingChange(true);
  
  try {
    console.log('Generating theme description for:', theme);
    
    const { data, error } = await supabase.functions.invoke('generate-theme-description', {
      body: { theme: theme.trim() }
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
    
    // Improved fallback description
    const fallbackDescription = `This week's content will showcase ${theme.toLowerCase()} with practical tips and expert guidance. We'll highlight seasonal opportunities and demonstrate how our quality products and services can help customers achieve their gardening goals.`;
    onDescriptionGenerated(fallbackDescription);
  } finally {
    onLoadingChange(false);
  }
};
