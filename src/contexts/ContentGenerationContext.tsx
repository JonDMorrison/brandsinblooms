
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { toast } from 'sonner';

interface ContentGenerationState {
  isGenerating: boolean;
  generatingCampaignId: string | null;
  error: string | null;
}

interface ContentGenerationContextType {
  state: ContentGenerationState;
  generateContent: (campaignId: string, campaignTheme: string, campaignDescription: string, weekNumber?: number) => Promise<boolean>;
  clearGeneratingState: () => void;
  isGeneratingForCampaign: (campaignId: string) => boolean;
}

const ContentGenerationContext = createContext<ContentGenerationContextType | undefined>(undefined);

export const useContentGeneration = () => {
  const context = useContext(ContentGenerationContext);
  if (!context) {
    throw new Error('useContentGeneration must be used within ContentGenerationProvider');
  }
  return context;
};

export const ContentGenerationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [state, setState] = useState<ContentGenerationState>({
    isGenerating: false,
    generatingCampaignId: null,
    error: null
  });

  const generateContent = useCallback(async (
    campaignId: string, 
    campaignTheme: string, 
    campaignDescription: string, 
    weekNumber?: number
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Please log in to generate content');
      return false;
    }

    // Prevent multiple simultaneous generations
    if (state.isGenerating) {
      console.log('Content generation already in progress, skipping');
      return false;
    }

    console.log('🎯 Starting content generation for campaign:', campaignId);

    setState({
      isGenerating: true,
      generatingCampaignId: campaignId,
      error: null
    });

    try {
      const result = await generateCampaignContent(
        campaignId,
        campaignTheme,
        campaignDescription,
        user.id,
        weekNumber,
        tenant?.id
      );

      if (result.success) {
        console.log('✅ Content generation successful');
        toast.success(`Generated ${result.tasks?.length || 0} content pieces!`);
        setState({
          isGenerating: false,
          generatingCampaignId: null,
          error: null
        });
        return true;
      } else {
        console.error('❌ Content generation failed:', result.message);
        setState({
          isGenerating: false,
          generatingCampaignId: null,
          error: result.message
        });
        toast.error(`Content generation failed: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Content generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState({
        isGenerating: false,
        generatingCampaignId: null,
        error: errorMessage
      });
      toast.error(`Failed to generate content: ${errorMessage}`);
      return false;
    }
  }, [user, tenant, state.isGenerating]);

  const clearGeneratingState = useCallback(() => {
    setState({
      isGenerating: false,
      generatingCampaignId: null,
      error: null
    });
  }, []);

  const isGeneratingForCampaign = useCallback((campaignId: string) => {
    return state.isGenerating && state.generatingCampaignId === campaignId;
  }, [state.isGenerating, state.generatingCampaignId]);

  return (
    <ContentGenerationContext.Provider value={{
      state,
      generateContent,
      clearGeneratingState,
      isGeneratingForCampaign
    }}>
      {children}
    </ContentGenerationContext.Provider>
  );
};
