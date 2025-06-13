
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

      console.log('🎯 No campaign found for current week, auto-creating with rich seasonal themes...');
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
            // Enhanced fallback with seasonal context
            const month = new Date().getMonth() + 1;
            let seasonalTheme;
            
            if (month >= 3 && month <= 5) {
              seasonalTheme = {
                title: `Spring Garden Renaissance - Week ${currentWeekNumber}`,
                description: 'Celebrate the awakening of spring with fresh plantings, soil preparation, and garden renewal activities that capture the excitement of the growing season.',
                theme: 'Spring Garden Renaissance',
                prompt: 'Create inspiring spring garden content focused on renewal, fresh plantings, and seasonal garden activities.'
              };
            } else if (month >= 6 && month <= 8) {
              seasonalTheme = {
                title: `Summer Garden Mastery - Week ${currentWeekNumber}`,
                description: 'Master the art of summer gardening with heat-tolerant plants, water-wise techniques, and harvest celebrations that make the most of peak growing season.',
                theme: 'Summer Garden Mastery',
                prompt: 'Create engaging summer garden content focused on heat management, water conservation, and abundant harvests.'
              };
            } else if (month >= 9 && month <= 11) {
              seasonalTheme = {
                title: `Autumn Garden Harvest - Week ${currentWeekNumber}`,
                description: 'Embrace fall\'s bounty with harvest preservation, autumn color displays, and winter preparation activities that celebrate the season\'s abundance.',
                theme: 'Autumn Garden Harvest',
                prompt: 'Create rich autumn content focused on harvest celebration, fall colors, and winter garden preparation.'
              };
            } else {
              seasonalTheme = {
                title: `Winter Garden Planning - Week ${currentWeekNumber}`,
                description: 'Transform winter into productive planning time with indoor gardening, tool maintenance, and next year\'s garden design and preparation.',
                theme: 'Winter Garden Planning',
                prompt: 'Create thoughtful winter content focused on planning, indoor gardening, and preparation for the coming growing season.'
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

        console.log('🏗️ Creating campaign with rich seasonal data:', campaignData.title);

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

        console.log('✅ Auto-created rich seasonal campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          const sourceMessage = masterTemplate 
            ? `🌟 Created "${campaignData.title}" with curated seasonal themes!`
            : `🚀 Created "${campaignData.title}" with AI-powered seasonal content!`;
          
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
