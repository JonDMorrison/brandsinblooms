
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";
// Removed sonner import - using global toast replacement
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

  const getEngagingSeasonalTheme = (weekNumber: number) => {
    const month = new Date().getMonth() + 1;
    const day = new Date().getDate();
    
    if (month >= 3 && month <= 5) {
      // Spring themes - natural timing based
      const springThemes = [
        {
          title: "Early Spring Plant Revival",
          description: "Transform your garden from winter survivor to spring showstopper with expert plant revival techniques, soil recovery secrets, and timing strategies that guarantee lush, healthy growth all season long.",
          theme: "Spring Plant Health Revolution",
          prompt: "Create expert spring plant revival content focusing on transforming winter-damaged plants, soil rehabilitation techniques, perfect timing for fertilizing and watering, pest prevention strategies, and seasonal plant care secrets."
        },
        {
          title: "Mid-Spring Growth Explosion",
          description: "Unlock explosive spring plant growth with professional techniques for soil preparation, strategic fertilizing, optimal watering schedules, and plant care timing that creates dramatic garden transformations.",
          theme: "Spring Growth Maximization",
          prompt: "Create growth-focused spring content about maximizing plant growth potential, soil amendment strategies, fertilizing for explosive growth, watering techniques, and plant nutrition timing."
        },
        {
          title: "Late Spring Garden Preparation",
          description: "Master preventive spring plant care with early intervention strategies, soil preparation secrets, and expert timing that keeps your plants thriving while your neighbors struggle with common issues.",
          theme: "Spring Garden Preparation",
          prompt: "Create preparation-focused spring content about setting up gardens for success, soil health optimization, plant selection timing, and expert care strategies for the growing season."
        }
      ];
      return springThemes[weekNumber % springThemes.length];
    } else if (month >= 6 && month <= 8) {
      // Summer themes
      const summerThemes = [
        {
          title: "Beat the Summer Heat Stress",
          description: "Rescue your plants from brutal summer heat with expert stress management techniques, efficient watering systems, and heat protection strategies that keep gardens thriving when temperatures soar.",
          theme: "Summer Heat Management",
          prompt: "Create heat-stress focused summer content about saving plants from extreme temperatures, efficient watering techniques, heat protection strategies, and expert summer plant care."
        },
        {
          title: "Midsummer Watering Mastery",
          description: "Master efficient summer watering with professional techniques that conserve water while keeping plants perfectly hydrated, including timing secrets and system optimization.",
          theme: "Summer Watering Excellence",
          prompt: "Create water-focused summer content about efficient watering techniques, timing strategies, water conservation methods, and irrigation optimization for hot weather."
        },
        {
          title: "Late Summer Garden Maintenance",
          description: "Transform your garden into a drought-resistant paradise with plant care strategies, maintenance techniques, and methods that create beautiful, resilient gardens.",
          theme: "Summer Garden Care",
          prompt: "Create maintenance-focused content about summer garden care, plant health during heat, maintenance timing, and creating resilient summer gardens."
        }
      ];
      return summerThemes[weekNumber % summerThemes.length];
    } else if (month >= 9 && month <= 11) {
      // Fall themes
      const fallThemes = [
        {
          title: "Early Fall Garden Transition",
          description: "Set your garden up for spectacular results with expert fall preparation techniques, strategic timing, winterization methods, and care schedules that guarantee healthy plant recovery.",
          theme: "Fall Garden Transition",
          prompt: "Create fall transition content about preparing gardens for seasonal change, plant care adjustments, preparation timing, and expert techniques for fall gardening success."
        },
        {
          title: "Peak Fall Color Display",
          description: "Maximize stunning fall colors with expert plant selection, care timing, and maintenance techniques that create breathtaking autumn displays while preparing plants for winter.",
          theme: "Fall Color Excellence",
          prompt: "Create fall color-focused content about maximizing autumn plant displays, color-enhancing care techniques, fall maintenance timing, and creating spectacular fall garden beauty."
        },
        {
          title: "Winter Preparation Essentials",
          description: "Protect your plant investments with proven winterization techniques, timing strategies, and care methods that ensure plant survival through harsh conditions.",
          theme: "Winter Preparation",
          prompt: "Create winter preparation content about proven plant winterization techniques, protection timing, covering strategies, and expert techniques for plant winter survival."
        }
      ];
      return fallThemes[weekNumber % fallThemes.length];
    } else {
      // Winter themes
      const winterThemes = [
        {
          title: "Indoor Plant Paradise",
          description: "Transform your home into a thriving indoor plant paradise with expert houseplant care techniques, problem-solving strategies, and maintenance schedules for beautiful indoor gardens.",
          theme: "Indoor Plant Excellence",
          prompt: "Create indoor plant content about houseplant care excellence, problem diagnosis and solutions, indoor growing techniques, and creating thriving indoor plant environments."
        },
        {
          title: "Winter Garden Planning",
          description: "Plan your best garden ever with strategic winter planning techniques, plant selection strategies, design optimization, and preparation methods for spectacular spring results.",
          theme: "Garden Planning Excellence",
          prompt: "Create winter planning content about strategic garden planning, plant selection for next season, garden design optimization, and planning techniques for garden success."
        },
        {
          title: "Houseplant Health Revival",
          description: "Rescue struggling houseplants with expert diagnostic techniques, treatment methods, and maintenance strategies that revive plants and create thriving indoor plant health.",
          theme: "Plant Health Recovery",
          prompt: "Create houseplant rescue content about diagnosing plant problems, treatment techniques, recovery methods, and expert care that saves struggling indoor plants."
        }
      ];
      return winterThemes[weekNumber % winterThemes.length];
    }
  };

  useEffect(() => {
    const autoCreateWeeklyContent = async () => {
      if (!user || activeCampaign || isAutoCreating) return;

      console.log('🌱 No campaign found, creating engaging seasonal garden center theme...');
      setIsAutoCreating(true);

      try {
        // First try to get theme from master templates
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
          // Use rich seasonal theme from master template but clean the title
          console.log('✅ Found curated garden center theme:', masterTemplate.title);
          campaignData = {
            title: masterTemplate.title.replace(/Week\s+\d+\s*[-:]?\s*/gi, '').trim() || masterTemplate.theme,
            description: `${masterTemplate.seasonal_focus}: ${masterTemplate.content_ideas}`,
            theme: masterTemplate.theme,
            prompt: masterTemplate.prompt,
            source: 'master_templates'
          };
        } else {
          // Use engaging seasonal garden center themes
          console.log('🌿 Generating engaging seasonal garden center theme...');
          const engagingTheme = getEngagingSeasonalTheme(currentWeekNumber);
          
          campaignData = {
            title: engagingTheme.title,
            description: engagingTheme.description,
            theme: engagingTheme.theme,
            prompt: engagingTheme.prompt,
            source: 'seasonal_themes'
          };
          
          console.log('✅ Created engaging seasonal theme:', campaignData.title);
        }

        // Create the campaign with natural seasonal data
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        console.log('🏗️ Creating campaign with natural seasonal data:', campaignData.title);

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

        console.log('✅ Auto-created engaging seasonal garden center campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          
          toast.success(`🌱 Created "${campaignData.title}" with seasonal content!`);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('❌ Error auto-creating seasonal content:', error);
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
