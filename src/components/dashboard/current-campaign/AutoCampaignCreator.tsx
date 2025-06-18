
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
      // Spring themes with enhanced plant care focus
      const springThemes = [
        {
          title: "Spring Plant Care Revival",
          description: "Master spring plant care essentials including soil preparation, proper watering schedules, and fertilizing timing. Address common spring plant health issues like root rot prevention, transplant shock recovery, and early pest management for thriving gardens.",
          theme: "Spring Plant Health & Care",
          prompt: "Create expert spring plant care content focused on soil preparation techniques, watering schedules, fertilizing timing, transplant care, pest prevention, and solving common spring plant health challenges for garden center customers."
        },
        {
          title: "Early Season Plant Health Mastery",
          description: "Guide customers through critical spring plant care decisions including proper planting techniques, soil amendment, watering systems, and preventive plant health measures that ensure strong, healthy growth all season.",
          theme: "Spring Plant Care Excellence", 
          prompt: "Create detailed plant care content about spring planting timing, soil health improvement, watering system setup, fertilizing schedules, and preventive plant health care for garden center expertise."
        },
        {
          title: "Spring Plant Problem Prevention",
          description: "Focus on preventing common spring plant issues through proper care techniques, timing, and maintenance. Cover transplant care, watering wisdom, soil health, and early intervention strategies for optimal plant health.",
          theme: "Spring Plant Health Solutions",
          prompt: "Create preventive plant care content about spring plant health maintenance, common problem prevention, proper watering techniques, soil care, and early season plant health management."
        }
      ];
      return springThemes[weekNumber % springThemes.length];
    } else if (month >= 6 && month <= 8) {
      // Summer themes with enhanced plant care focus
      const summerThemes = [
        {
          title: "Summer Plant Stress Management",
          description: "Master summer plant care challenges with heat stress prevention, efficient watering techniques, and nutrition management. Address common summer plant problems like wilting, nutrient deficiency, and pest pressure with expert care solutions.",
          theme: "Summer Plant Health & Stress Management",
          prompt: "Create expert summer plant care content focused on heat stress prevention, efficient watering techniques, summer fertilizing schedules, pest management, and maintaining optimal plant health in hot weather conditions."
        },
        {
          title: "Peak Season Plant Care Excellence",
          description: "Optimize summer plant health with proper watering schedules, nutrition timing, and pest management strategies. Cover heat-tolerant plant selection, maintenance techniques, and troubleshooting common summer plant health issues.",
          theme: "Summer Plant Care Mastery",
          prompt: "Create comprehensive summer plant care content about watering schedules, plant nutrition, heat stress management, pest control timing, and maintaining healthy plants through peak summer conditions."
        },
        {
          title: "Midsummer Plant Health Solutions",
          description: "Address midsummer plant care challenges with targeted health solutions, proper maintenance timing, and expert problem-solving. Focus on plant hydration, nutrition balance, and preventing common summer plant health issues.",
          theme: "Summer Plant Health Management",
          prompt: "Create problem-solving plant care content about midsummer plant health maintenance, watering wisdom, nutrition management, pest prevention, and expert solutions for summer plant care challenges."
        }
      ];
      return summerThemes[weekNumber % summerThemes.length];
    } else if (month >= 9 && month <= 11) {
      // Fall themes with enhanced plant care focus
      const fallThemes = [
        {
          title: "Fall Plant Care Transitions",
          description: "Navigate fall plant care transitions with proper timing for pruning, fertilizing, and winterization. Address seasonal plant health needs, transition care techniques, and preparation strategies for healthy plant dormancy and spring recovery.",
          theme: "Fall Plant Care & Transition",
          prompt: "Create expert fall plant care content about seasonal transition timing, pruning techniques, winterization schedules, plant health preparation, and caring for plants through seasonal changes."
        },
        {
          title: "Fall Plant Health & Winter Prep",
          description: "Prepare plants for winter success with proper fall care techniques, nutrition timing, and protection strategies. Cover plant health assessment, winter preparation, and care schedules that ensure strong plant recovery next spring.",
          theme: "Fall Plant Preparation & Health",
          prompt: "Create comprehensive fall plant care content about winter preparation techniques, plant health assessment, protection strategies, nutrition timing, and care schedules for optimal plant health."
        },
        {
          title: "Seasonal Plant Care Mastery",
          description: "Master the art of seasonal plant care transitions with expert timing, proper techniques, and health-focused maintenance. Address fall plant nutrition, pruning wisdom, and protection strategies for thriving plants.",
          theme: "Seasonal Plant Care Excellence",
          prompt: "Create expert seasonal plant care content about fall maintenance timing, plant health optimization, protection techniques, and mastering seasonal plant care transitions for garden center customers."
        }
      ];
      return fallThemes[weekNumber % fallThemes.length];
    } else {
      // Winter themes with enhanced plant care focus
      const winterThemes = [
        {
          title: "Winter Plant Care & Indoor Growing",
          description: "Master winter plant care with indoor growing techniques, houseplant health management, and plant care scheduling. Address winter plant health challenges, indoor air quality effects, and maintaining plant health during dormant seasons.",
          theme: "Winter Plant Care & Indoor Health",
          prompt: "Create expert winter plant care content about indoor growing techniques, houseplant health management, winter plant care schedules, and maintaining optimal plant health during winter months."
        },
        {
          title: "Indoor Plant Health & Care",
          description: "Focus on indoor plant health with proper care techniques, problem diagnosis, and maintenance schedules. Cover houseplant nutrition, watering wisdom, pest prevention, and creating optimal growing conditions indoors.",
          theme: "Indoor Plant Health Mastery",
          prompt: "Create comprehensive indoor plant care content about houseplant health management, proper care techniques, problem solving, nutrition schedules, and optimizing indoor growing conditions."
        },
        {
          title: "Winter Plant Health Planning",
          description: "Plan for plant health success with winter care strategies, indoor growing projects, and preparation for spring growing. Address plant health assessment, care planning, and maintaining plant wellness through winter.",
          theme: "Winter Plant Health & Planning",
          prompt: "Create strategic plant care content about winter plant health planning, care assessment, indoor growing projects, and preparing plants for optimal health and spring recovery."
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
