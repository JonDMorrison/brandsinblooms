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

  const getEngagingSeasonalTheme = (weekNumber: number) => {
    const month = new Date().getMonth() + 1;
    const seasonName = month >= 3 && month <= 5 ? 'Spring' : 
                     month >= 6 && month <= 8 ? 'Summer' : 
                     month >= 9 && month <= 11 ? 'Fall' : 'Winter';
    
    if (month >= 3 && month <= 5) {
      // Spring themes - engaging and benefit-driven
      const springThemes = [
        {
          title: "Spring Plant Revival Mastery",
          description: "Transform your garden from winter survivor to spring showstopper with expert plant revival techniques, soil recovery secrets, and timing strategies that guarantee lush, healthy growth all season long.",
          theme: "Spring Plant Health Revolution",
          prompt: "Create expert spring plant revival content focusing on transforming winter-damaged plants, soil rehabilitation techniques, perfect timing for fertilizing and watering, pest prevention strategies, and seasonal plant care secrets that create Instagram-worthy garden transformations."
        },
        {
          title: "Beat Spring Plant Problems Before They Start",
          description: "Master the art of preventive spring plant care with early intervention strategies, soil preparation secrets, and expert timing that keeps your plants thriving while your neighbors struggle with common spring issues.",
          theme: "Spring Plant Problem Prevention", 
          prompt: "Create problem-prevention focused spring content about stopping plant issues before they start, soil health optimization, watering wisdom, fertilizer timing, pest management, and expert care strategies that create confident, successful gardeners."
        },
        {
          title: "Spring Growth Explosion Secrets",
          description: "Unlock explosive spring plant growth with professional techniques for soil preparation, strategic fertilizing, optimal watering schedules, and plant care timing that creates dramatic before-and-after garden transformations.",
          theme: "Spring Growth Maximization",
          prompt: "Create growth-focused spring content about maximizing plant growth potential, soil amendment strategies, fertilizing for explosive growth, watering techniques, plant nutrition timing, and care methods that create dramatic garden improvements."
        }
      ];
      return springThemes[weekNumber % springThemes.length];
    } else if (month >= 6 && month <= 8) {
      // Summer themes - heat and stress focused
      const summerThemes = [
        {
          title: "Save Plants from Summer Heat Stress",
          description: "Rescue your plants from brutal summer heat with expert stress management techniques, efficient watering systems, and heat protection strategies that keep gardens thriving when temperatures soar.",
          theme: "Summer Heat Stress Rescue",
          prompt: "Create heat-stress focused summer content about saving plants from extreme temperatures, efficient watering techniques, heat protection strategies, cooling methods, plant nutrition during stress, and expert care that prevents summer plant casualties."
        },
        {
          title: "Summer Watering Wisdom That Works",
          description: "Master efficient summer watering with professional techniques that conserve water while keeping plants perfectly hydrated, including timing secrets, system optimization, and troubleshooting common watering mistakes.",
          theme: "Summer Watering Mastery",
          prompt: "Create water-focused summer content about efficient watering techniques, timing strategies, water conservation methods, irrigation optimization, moisture management, and expert watering wisdom that keeps plants thriving in heat."
        },
        {
          title: "Drought-Proof Your Garden This Summer",
          description: "Transform your garden into a drought-resistant paradise with plant selection strategies, water-wise landscaping techniques, and maintenance methods that create beautiful, resilient gardens that thrive with minimal water.",
          theme: "Summer Drought Resistance",
          prompt: "Create drought-resistance focused content about water-wise plant selection, xeriscaping techniques, mulching strategies, drought-tolerant gardening, water conservation methods, and creating resilient summer gardens."
        }
      ];
      return summerThemes[weekNumber % summerThemes.length];
    } else if (month >= 9 && month <= 11) {
      // Fall themes - preparation and transition focused
      const fallThemes = [
        {
          title: "Fall Plant Prep for Spring Success",
          description: "Set your garden up for spectacular spring results with expert fall preparation techniques, strategic planting timing, winterization methods, and care schedules that guarantee healthy plant recovery and explosive spring growth.",
          theme: "Fall Preparation Excellence",
          prompt: "Create fall preparation content about setting plants up for spring success, winterization techniques, fall planting strategies, preparation timing, protection methods, and expert care that ensures healthy plant dormancy and spring recovery."
        },
        {
          title: "Fall Color Explosion Strategies",
          description: "Maximize stunning fall colors with expert plant selection, care timing, and maintenance techniques that create breathtaking autumn displays while preparing plants for healthy winter rest and spring comeback.",
          theme: "Fall Color Maximization",
          prompt: "Create fall color-focused content about maximizing autumn plant displays, color-enhancing care techniques, fall maintenance timing, leaf care strategies, and creating spectacular fall garden beauty."
        },
        {
          title: "Winter Protection That Actually Works",
          description: "Protect your plant investments with proven winterization techniques, timing strategies, and care methods that ensure plant survival through harsh winter conditions and guarantee strong spring recovery.",
          theme: "Winter Protection Mastery",
          prompt: "Create winter protection content about proven plant winterization techniques, protection timing, covering strategies, care methods, and expert techniques that ensure plant survival and spring recovery."
        }
      ];
      return fallThemes[weekNumber % fallThemes.length];
    } else {
      // Winter themes - indoor and planning focused
      const winterThemes = [
        {
          title: "Indoor Plant Paradise Creation",
          description: "Transform your home into a thriving indoor plant paradise with expert houseplant care techniques, problem-solving strategies, and maintenance schedules that create healthy, beautiful indoor gardens all winter long.",
          theme: "Indoor Plant Mastery",
          prompt: "Create indoor plant content about houseplant care excellence, problem diagnosis and solutions, indoor growing techniques, plant health maintenance, and creating thriving indoor plant environments during winter months."
        },
        {
          title: "Winter Garden Planning for Spring Success",
          description: "Plan your best garden ever with strategic winter planning techniques, plant selection strategies, design optimization, and preparation methods that set you up for spectacular spring and summer garden results.",
          theme: "Winter Garden Planning",
          prompt: "Create winter planning content about strategic garden planning, plant selection for next season, garden design optimization, preparation strategies, and planning techniques that create garden success."
        },
        {
          title: "Houseplant Health Emergency Kit",
          description: "Rescue struggling houseplants with expert diagnostic techniques, treatment methods, and maintenance strategies that revive dying plants and create thriving indoor plant health all winter long.",
          theme: "Houseplant Health Rescue",
          prompt: "Create houseplant rescue content about diagnosing plant problems, treatment techniques, recovery methods, health maintenance, and expert care that saves struggling indoor plants and creates plant health success."
        }
      ];
      return winterThemes[weekNumber % winterThemes.length];
    }
  };

  useEffect(() => {
    const autoCreateWeeklyContent = async () => {
      if (!user || activeCampaign || isAutoCreating) return;

      console.log('🌱 No campaign found for current week, creating engaging garden center theme...');
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
          // Use engaging seasonal garden center themes
          console.log('🌿 Generating engaging seasonal garden center theme...');
          const engagingTheme = getEngagingSeasonalTheme(currentWeekNumber);
          
          campaignData = {
            title: engagingTheme.title,
            description: engagingTheme.description,
            theme: engagingTheme.theme,
            prompt: engagingTheme.prompt,
            source: 'engaging_seasonal_themes'
          };
          
          console.log('✅ Created engaging seasonal theme:', campaignData.title);
        }

        // Create the campaign with engaging seasonal garden center data
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        console.log('🏗️ Creating campaign with engaging garden center data:', campaignData.title);

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
          
          toast.success(`🌱 Created "${campaignData.title}" with engaging seasonal content!`);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('❌ Error auto-creating engaging seasonal content:', error);
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
