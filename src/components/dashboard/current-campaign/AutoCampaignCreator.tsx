
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";
import { toast } from "sonner";
import type { Campaign } from "@/types";

interface AutoCampaignCreatorProps {
  activeCampaign: Campaign | undefined;
  currentWeekNumber: number;
  onCampaignCreated: () => void;
  onTaskUpdate: () => void;
}

export const AutoCampaignCreator = ({
  activeCampaign,
  currentWeekNumber,
  onCampaignCreated,
  onTaskUpdate
}: AutoCampaignCreatorProps) => {
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const autoCreateWeeklyContent = async () => {
      if (!user || activeCampaign || isAutoCreating) return;

      console.log('No campaign found for current week, auto-creating with annual themes...');
      setIsAutoCreating(true);

      try {
        // First, try to get the annual theme for this week
        let weeklyTheme = null;
        
        try {
          console.log('Generating annual theme for week:', currentWeekNumber);
          const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-weekly-themes', {
            body: { 
              userId: user.id,
              startYear: new Date().getFullYear(),
              startFromCurrentWeek: true,
              weekNumber: currentWeekNumber
            }
          });

          if (!themeError && themeData?.themes && themeData.themes.length > 0) {
            // Find the theme for current week or use the first one
            weeklyTheme = themeData.themes.find(t => t.week === currentWeekNumber) || themeData.themes[0];
            console.log('Generated annual theme:', weeklyTheme);
          }
        } catch (error) {
          console.log('Theme generation failed, will use fallback:', error);
        }

        // Create campaign with annual theme data or fallback
        const campaignTitle = weeklyTheme?.title || `Week ${currentWeekNumber} Marketing Campaign`;
        const campaignDescription = weeklyTheme?.description || 'Auto-generated weekly marketing campaign with essential content for your garden center.';
        const campaignPrompt = weeklyTheme?.content_ideas?.join(' • ') || 'Create engaging marketing content for this week that promotes seasonal gardening activities and products.';
        
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            title: campaignTitle,
            description: campaignDescription,
            theme: campaignTitle,
            prompt: campaignPrompt,
            start_date: weekStartDate.toISOString().split('T')[0],
            week_number: currentWeekNumber,
            source: weeklyTheme ? 'annual_themes' : 'auto_generated',
            user_id: user.id
          })
          .select()
          .single();

        if (campaignError) {
          console.error('Error creating auto campaign:', campaignError);
          return;
        }

        console.log('Auto-created campaign with annual theme:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          const successMessage = weeklyTheme 
            ? `Welcome! We've created "${campaignTitle}" with seasonal content ready for review.`
            : `Welcome! We've created a marketing campaign for Week ${currentWeekNumber} with content ready for review.`;
          
          toast.success(successMessage);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('Error auto-creating weekly content:', error);
        toast.error('Failed to create weekly campaign. Please try creating one manually.');
      } finally {
        setIsAutoCreating(false);
      }
    };

    if (!activeCampaign && user) {
      autoCreateWeeklyContent();
    }
  }, [activeCampaign, currentWeekNumber, user, isAutoCreating, onTaskUpdate, onCampaignCreated]);

  return { isAutoCreating };
};
