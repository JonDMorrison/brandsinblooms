
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CampaignCard } from "./CampaignCard";
import { WhatsComingNextCard } from "./WhatsComingNextCard";
import { getSeasonalContent } from "./SeasonalContent";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { Calendar, Plus } from "lucide-react";
import { Campaign } from "@/types/content";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

interface HomepageMainContentProps {
  currentCampaign: Campaign | undefined;
  onTaskUpdate: () => void;
}

export const HomepageMainContent = ({ currentCampaign, onTaskUpdate }: HomepageMainContentProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [campaignTasks, setCampaignTasks] = useState([]);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const seasonalContent = getSeasonalContent();

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchCampaignTasks = async () => {
    if (!currentCampaign || !tenant) return;

    try {
      // Build status filter - include 'preview' for developer
      const statusFilter = ['planned', 'review', 'approved', 'posted', 'generated'];
      if (isDeveloper) {
        statusFilter.push('preview');
      }

      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            tenant_id
          )
        `)
        .eq('campaign_id', currentCampaign.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaign tasks:', error);
      } else {
        const userTasks = data?.filter(task => 
          task.campaigns?.tenant_id === tenant.id
        ) || [];
        setCampaignTasks(userTasks);
      }
    } catch (error) {
      console.error('Error fetching campaign tasks:', error);
    }
  };

  useEffect(() => {
    if (currentCampaign) {
      fetchCampaignTasks();
    }
  }, [currentCampaign, tenant, isDeveloper]);

  const handleTaskClick = (task: any) => {
    // Handle task click - could open a modal or navigate
    console.log('Task clicked:', task);
  };

  return (
    <div className="lg:col-span-2 space-y-8">
      {/* Main Campaign Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <HeadlineLarge className="text-text-primary">
              This Week's Campaign
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              Your active marketing content for this week
            </BodyMedium>
          </div>
          <div className="flex items-center gap-2 text-text-tertiary">
            <Calendar className="w-4 h-4" />
            <BodyMedium>Week {getCurrentWeekNumber()}</BodyMedium>
          </div>
        </div>

        {currentCampaign ? (
          <CampaignCard 
            campaign={currentCampaign} 
            campaignTasks={campaignTasks}
            isGeneratingTasks={isGeneratingTasks}
            onTaskClick={handleTaskClick}
            onTaskUpdate={onTaskUpdate}
            seasonalContent={seasonalContent} 
          />
        ) : (
          <AppleCard variant="default" surface="secondary" className="border-dashed border-2">
            <AppleCardContent className="text-center py-12">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <HeadlineLarge className="text-text-primary mb-2">
                No Campaign This Week
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary max-w-md mx-auto">
                Create a new campaign to generate professional marketing content for your garden center
              </BodyMedium>
            </AppleCardContent>
          </AppleCard>
        )}
      </div>

      {/* What's Coming Next Section */}
      <div className="space-y-6">
        <div>
          <HeadlineLarge className="text-text-primary">
            What's Coming Next
          </HeadlineLarge>
          <BodyMedium className="text-text-secondary mt-1">
            Upcoming content and seasonal opportunities
          </BodyMedium>
        </div>
        <WhatsComingNextCard onTaskUpdate={onTaskUpdate} />
      </div>
    </div>
  );
};
