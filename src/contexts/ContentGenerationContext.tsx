import React, { createContext, useContext, useState, useCallback } from 'react';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';



interface ContentGenerationContextType {
  generateContent: (campaignId: string, theme: string, description: string, weekNumber: number) => Promise<boolean>;
  isGeneratingForCampaign: (campaignId: string) => boolean;
  generatingCampaigns: Set<string>;
}

const ContentGenerationContext = createContext<ContentGenerationContextType | undefined>(undefined);

export const useContentGeneration = () => {
  const context = useContext(ContentGenerationContext);
  if (!context) {
    throw new Error('useContentGeneration must be used within a ContentGenerationProvider');
  }
  return context;
};

interface ContentGenerationProviderProps {
  children: React.ReactNode;
}

export const ContentGenerationProvider = ({ children }: ContentGenerationProviderProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [generatingCampaigns, setGeneratingCampaigns] = useState<Set<string>>(new Set());

  const generateContent = useCallback(async (
    campaignId: string, 
    theme: string, 
    description: string, 
    weekNumber: number
  ): Promise<boolean> => {
    if (!user) {
      return false;
    }

    if (generatingCampaigns.has(campaignId)) {
      console.log('Already generating content for campaign:', campaignId);
      return false;
    }

    setGeneratingCampaigns(prev => new Set(prev).add(campaignId));
    
    try {
      const result = await generateCampaignContent(
        campaignId,
        theme,
        description,
        user.id,
        weekNumber,
        tenant?.id
      );

      if (result.success && result.tasks) {
        console.log('[ContentGeneration] Content generated successfully with', result.tasks.length, 'tasks');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error generating content:', error);
      return false;
    } finally {
      setGeneratingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  }, [user, tenant, generatingCampaigns]);

  const isGeneratingForCampaign = useCallback((campaignId: string) => {
    return generatingCampaigns.has(campaignId);
  }, [generatingCampaigns]);

  const value = {
    generateContent,
    isGeneratingForCampaign,
    generatingCampaigns
  };

  return (
    <ContentGenerationContext.Provider value={value}>
      {children}
    </ContentGenerationContext.Provider>
  );
};
