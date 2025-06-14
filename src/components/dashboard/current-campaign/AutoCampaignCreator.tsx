
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

  const getSeasonalGardenTheme = (weekNumber: number) => {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      // Spring themes
      const springThemes = [
        {
          title: "Spring Garden Awakening",
          description: "Celebrate the return of spring with soil preparation, early plantings, and garden revival activities. Focus on helping customers transition from winter dormancy to active growing season.",
          theme: "Spring Garden Renaissance",
          prompt: "Create inspiring spring garden content focused on soil preparation, early season vegetables, spring cleanup, and new growth opportunities for garden centers."
        },
        {
          title: "Early Season Planting Mastery",
          description: "Guide customers through the critical early planting decisions and soil preparation that set the foundation for a successful growing season.",
          theme: "Spring Planting Excellence", 
          prompt: "Create educational content about spring planting timing, soil preparation, seed starting, and early season garden setup for garden center customers."
        },
        {
          title: "Spring Renewal & Fresh Starts",
          description: "Inspire customers with spring cleanup, garden makeovers, and fresh design ideas that transform winter-weary landscapes into vibrant growing spaces.",
          theme: "Garden Renewal",
          prompt: "Create motivational content about spring garden renewal, cleanup projects, landscape refresh ideas, and starting new garden areas."
        }
      ];
      return springThemes[weekNumber % springThemes.length];
    } else if (month >= 6 && month <= 8) {
      // Summer themes
      const summerThemes = [
        {
          title: "Summer Heat Solutions",
          description: "Help customers master summer gardening challenges with heat-tolerant plants, efficient watering systems, and strategies for thriving in hot weather.",
          theme: "Summer Garden Mastery",
          prompt: "Create practical summer gardening content focused on heat tolerance, water conservation, summer plant care, and maintaining healthy gardens in hot weather."
        },
        {
          title: "Peak Season Harvest Celebration",
          description: "Celebrate the abundance of summer with harvest tips, preservation techniques, and ways to maximize the productivity of summer gardens.",
          theme: "Summer Abundance",
          prompt: "Create exciting content about summer harvests, preservation methods, peak season plant care, and making the most of summer's garden bounty."
        },
        {
          title: "Midsummer Garden Care",
          description: "Provide essential care guidance for maintaining beautiful, productive gardens through the challenges of peak summer heat and growth.",
          theme: "Summer Maintenance",
          prompt: "Create helpful content about midsummer plant care, watering wisdom, pest management, and keeping gardens thriving in summer heat."
        }
      ];
      return summerThemes[weekNumber % summerThemes.length];
    } else if (month >= 9 && month <= 11) {
      // Fall themes
      const fallThemes = [
        {
          title: "Autumn Garden Harvest Festival",
          description: "Embrace fall's bounty with harvest celebrations, preservation techniques, and autumn color displays that showcase the season's spectacular transformation.",
          theme: "Autumn Harvest",
          prompt: "Create engaging fall content about harvest time, autumn color, fall planting opportunities, and celebrating the season's abundance."
        },
        {
          title: "Fall Planting & Winter Prep",
          description: "Guide customers through important fall planting opportunities and winter preparation tasks that ensure garden success next year.",
          theme: "Fall Preparation",
          prompt: "Create informative content about fall planting, winter garden protection, autumn garden tasks, and preparing for the dormant season."
        },
        {
          title: "Seasonal Transition Mastery",
          description: "Help customers navigate the beautiful transition from growing season to winter rest with proper timing and techniques.",
          theme: "Seasonal Transitions",
          prompt: "Create thoughtful content about seasonal garden transitions, fall cleanup, winter prep, and making the most of autumn's opportunities."
        }
      ];
      return fallThemes[weekNumber % fallThemes.length];
    } else {
      // Winter themes
      const winterThemes = [
        {
          title: "Winter Garden Planning & Dreams",
          description: "Transform winter into productive planning time with indoor gardening projects, tool maintenance, and exciting plans for next year's garden adventures.",
          theme: "Winter Planning",
          prompt: "Create inspiring winter content about garden planning, indoor growing, tool care, and preparing for the upcoming growing season."
        },
        {
          title: "Indoor Growing & Houseplant Care",
          description: "Bring the garden indoors with houseplant care, indoor growing projects, and ways to maintain the gardening connection during winter months.",
          theme: "Indoor Gardening",
          prompt: "Create practical content about indoor gardening, houseplant care, winter growing projects, and maintaining green spaces indoors."
        },
        {
          title: "Holiday Plants & Winter Beauty",
          description: "Celebrate winter's unique beauty with holiday plant arrangements, winter interest plants, and festive gardening projects.",
          theme: "Winter Beauty",
          prompt: "Create festive content about holiday plants, winter arrangements, seasonal decorations, and finding beauty in the winter garden."
        }
      ];
      return winterThemes[weekNumber % winterThemes.length];
    }
  };

  useEffect(() => {
    const autoCreateWeeklyContent = async () => {
      if (!user || activeCampaign || isAutoCreating) return;

      console.log('🌱 No campaign found for current week, creating seasonal garden center theme...');
      setIsAutoCreating(true);

      try {
        // First try to get the rich seasonal theme from master templates
        console.log('📚 Checking master template for week:', currentWeekNumber);
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
          console.log('✅ Found curated garden center theme:', masterTemplate.title);
          campaignData = {
            title: masterTemplate.title,
            description: `${masterTemplate.seasonal_focus}: ${masterTemplate.content_ideas}`,
            theme: masterTemplate.theme,
            prompt: masterTemplate.prompt,
            source: 'master_templates'
          };
        } else {
          // Use enhanced seasonal garden center themes
          console.log('🌿 Generating seasonal garden center theme...');
          const seasonalTheme = getSeasonalGardenTheme(currentWeekNumber);
          
          campaignData = {
            title: seasonalTheme.title,
            description: seasonalTheme.description,
            theme: seasonalTheme.theme,
            prompt: seasonalTheme.prompt,
            source: 'seasonal_garden_themes'
          };
          
          console.log('✅ Created seasonal garden theme:', campaignData.title);
        }

        // Create the campaign with rich seasonal garden center data
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        console.log('🏗️ Creating campaign with garden center data:', campaignData.title);

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

        console.log('✅ Auto-created seasonal garden center campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          toast.success(`🌱 Created "${campaignData.title}" with seasonal garden center content!`);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('❌ Error auto-creating seasonal garden content:', error);
        toast.error('Failed to create seasonal campaign. Please try creating one manually.');
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
