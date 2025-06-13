
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

      console.log('🎯 No campaign found for current week, auto-creating with business-focused themes...');
      setIsAutoCreating(true);

      try {
        // First try to get the rich seasonal theme from master templates
        console.log('📚 Fetching master template for week:', currentWeekNumber);
        const { data: masterTemplate, error: templateError } = await supabase
          .from('master_campaign_templates')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .maybeSingle();

        if (templateError) {
          console.error('❌ Error fetching master template:', templateError);
        }

        let campaignData;
        
        if (masterTemplate) {
          // Use rich seasonal theme from master template
          console.log('✅ Found rich seasonal theme:', masterTemplate.title);
          campaignData = {
            title: masterTemplate.title,
            description: `${masterTemplate.seasonal_focus}: ${masterTemplate.content_ideas}`,
            theme: masterTemplate.theme,
            prompt: masterTemplate.prompt,
            source: 'master_templates'
          };
        } else {
          // Fallback to AI-generated theme if no master template exists
          console.log('🤖 No master template found, generating with AI...');
          
          try {
            const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-weekly-themes', {
              body: { 
                userId: user.id,
                startYear: new Date().getFullYear(),
                startFromCurrentWeek: true,
                weekNumber: currentWeekNumber
              }
            });

            if (!themeError && themeData?.themes && themeData.themes.length > 0) {
              const weeklyTheme = themeData.themes.find(t => t.week === currentWeekNumber) || themeData.themes[0];
              campaignData = {
                title: weeklyTheme.title,
                description: weeklyTheme.description,
                theme: weeklyTheme.title,
                prompt: weeklyTheme.content_ideas?.join(' • '),
                source: 'ai_generated'
              };
            } else {
              throw new Error('Failed to generate AI theme');
            }
          } catch (aiError) {
            console.warn('⚠️ AI theme generation failed, using enhanced fallback');
            // Enhanced fallback with seasonal context - UPDATED for general business
            const month = new Date().getMonth() + 1;
            let seasonalTheme;
            
            if (month >= 3 && month <= 5) {
              seasonalTheme = {
                title: `Spring Growth Strategy - Week ${currentWeekNumber}`,
                description: 'Harness the energy of spring renewal to drive customer engagement with fresh marketing approaches, new product launches, and revitalized brand messaging.',
                theme: 'Spring Growth Strategy',
                prompt: 'Create inspiring spring business content focused on renewal, fresh strategies, and seasonal marketing opportunities.'
              };
            } else if (month >= 6 && month <= 8) {
              seasonalTheme = {
                title: `Summer Success Campaign - Week ${currentWeekNumber}`,
                description: 'Maximize peak season opportunities with high-energy marketing, customer retention strategies, and community engagement that captures summer enthusiasm.',
                theme: 'Summer Success Campaign',
                prompt: 'Create engaging summer business content focused on peak performance, community engagement, and customer satisfaction.'
              };
            } else if (month >= 9 && month <= 11) {
              seasonalTheme = {
                title: `Autumn Achievement Focus - Week ${currentWeekNumber}`,
                description: 'Celebrate accomplishments and prepare for year-end success with strategic campaigns that showcase results and build momentum for the future.',
                theme: 'Autumn Achievement Focus',
                prompt: 'Create compelling autumn content focused on achievements, strategic planning, and preparing for successful year-end results.'
              };
            } else {
              seasonalTheme = {
                title: `Winter Planning & Vision - Week ${currentWeekNumber}`,
                description: 'Transform quiet season into strategic advantage with forward-thinking content, planning resources, and vision-setting activities that prepare for future growth.',
                theme: 'Winter Planning & Vision',
                prompt: 'Create thoughtful winter content focused on strategic planning, vision setting, and preparing for upcoming growth opportunities.'
              };
            }
            
            campaignData = {
              ...seasonalTheme,
              source: 'seasonal_fallback'
            };
          }
        }

        // Create the campaign with rich seasonal data
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        console.log('🏗️ Creating campaign with business-focused data:', campaignData.title);

        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            title: campaignData.title,
            description: campaignData.description,
            theme: campaignData.theme,
            prompt: campaignData.prompt,
            start_date: weekStartDate.toISOString().split('T')[0],
            week_number: currentWeekNumber,
            source: campaignData.source,
            user_id: user.id
          })
          .select()
          .single();

        if (campaignError) {
          console.error('❌ Error creating auto campaign:', campaignError);
          toast.error('Failed to create weekly campaign');
          return;
        }

        console.log('✅ Auto-created business-focused campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          const sourceMessage = masterTemplate 
            ? `🌟 Created "${campaignData.title}" with curated business themes!`
            : `🚀 Created "${campaignData.title}" with strategic marketing content!`;
          
          toast.success(sourceMessage);
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
