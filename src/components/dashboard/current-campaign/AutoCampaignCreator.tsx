
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

      console.log('No campaign found for current week, auto-creating...');
      setIsAutoCreating(true);

      try {
        const campaignTitle = `Week ${currentWeekNumber} Marketing Campaign`;
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            title: campaignTitle,
            description: 'Auto-generated weekly marketing campaign with essential content for your garden center.',
            theme: 'Weekly Marketing',
            prompt: 'Create engaging marketing content for this week that promotes seasonal gardening activities and products.',
            start_date: weekStartDate.toISOString().split('T')[0],
            week_number: currentWeekNumber,
            source: 'auto_generated',
            user_id: user.id
          })
          .select()
          .single();

        if (campaignError) {
          console.error('Error creating auto campaign:', campaignError);
          return;
        }

        console.log('Auto-created campaign:', newCampaign);

        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          toast.success(`Welcome! We've created a marketing campaign for Week ${currentWeekNumber} with content ready for review.`);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('Error auto-creating weekly content:', error);
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
