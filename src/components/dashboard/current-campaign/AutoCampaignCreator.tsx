
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

      console.log('🎯 No campaign found for current week, auto-creating with annual themes...');
      setIsAutoCreating(true);

      try {
        // Generate annual theme for this week with better error handling
        let weeklyTheme = null;
        
        try {
          console.log('📅 Generating annual theme for week:', currentWeekNumber);
          const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-weekly-themes', {
            body: { 
              userId: user.id,
              startYear: new Date().getFullYear(),
              startFromCurrentWeek: true,
              weekNumber: currentWeekNumber
            }
          });

          console.log('🎨 Theme generation response:', themeData);

          if (themeError) {
            console.error('❌ Theme generation error:', themeError);
          } else if (themeData?.themes && themeData.themes.length > 0) {
            weeklyTheme = themeData.themes.find(t => t.week === currentWeekNumber) || themeData.themes[0];
            console.log('✅ Successfully generated annual theme:', weeklyTheme);
          } else {
            console.warn('⚠️ No themes returned from function');
          }
        } catch (error) {
          console.error('❌ Theme generation failed:', error);
        }

        // Create campaign with rich theme data or enhanced fallback
        const campaignTitle = weeklyTheme?.title || `Week ${currentWeekNumber} Seasonal Campaign`;
        const campaignDescription = weeklyTheme?.description || 'A thoughtfully crafted weekly marketing campaign featuring seasonal gardening activities, timely plant care tips, and promotional opportunities designed to engage your customers with relevant, season-appropriate content.';
        const campaignPrompt = weeklyTheme?.content_ideas?.join(' • ') || 'Create engaging seasonal marketing content that highlights current gardening opportunities, featured plants for this time of year, and educational tips that help customers succeed with their gardens this week.';
        
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        console.log('🏗️ Creating campaign with data:', {
          title: campaignTitle,
          description: campaignDescription,
          source: weeklyTheme ? 'annual_themes' : 'auto_generated'
        });

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
          console.error('❌ Error creating auto campaign:', campaignError);
          toast.error('Failed to create weekly campaign');
          return;
        }

        console.log('✅ Auto-created campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          const successMessage = weeklyTheme 
            ? `🌟 Created "${campaignTitle}" with seasonal themes and content ready for review!`
            : `🚀 Created a marketing campaign for Week ${currentWeekNumber} with content ready for review.`;
          
          toast.success(successMessage);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('❌ Error auto-creating weekly content:', error);
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
