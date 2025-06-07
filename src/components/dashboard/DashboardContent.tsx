
import { useDashboardData } from "./useDashboardData";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignCard } from "@/components/homepage/NewCampaignCard";
import { WhatsComingNextCard } from "@/components/homepage/WhatsComingNextCard";
import { AnalyticsSnapshot } from "@/components/homepage/AnalyticsSnapshot";
import { NextStepBanner } from "@/components/homepage/NextStepBanner";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { ReviewQueue } from "@/components/content/ReviewQueue";
import { SetupProgressCard } from "@/components/homepage/SetupProgressCard";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated,
  onTaskClick
}: DashboardContentProps) => {
  const {
    campaigns,
    tasks,
    loading,
    error,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch
  } = useDashboardData();

  const handleCampaignCreatedWrapper = async () => {
    try {
      console.log('DashboardContent: Campaign created, triggering refresh');
      await handleCampaignCreated();
      onCampaignCreated();
    } catch (error) {
      console.error('DashboardContent: Error handling campaign creation:', error);
    }
  };

  // Calculate dashboard metrics
  const activeCampaign = campaigns.find(c => {
    const campaignStart = new Date(c.start_date);
    const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return now >= campaignStart && now <= campaignEnd;
  });

  // Find new campaigns that don't have any content tasks yet
  const newCampaigns = campaigns.filter(campaign => {
    const campaignTasks = tasks.filter(task => task.campaign_id === campaign.id);
    return campaignTasks.length === 0 && campaign.id !== activeCampaign?.id;
  });

  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const pendingTasksCount = tasks.filter(task => task.status === 'draft' && task.ai_output).length;

  // Determine if user needs guidance
  const needsGuidance = campaigns.length === 0 || totalTasksCount === 0;

  return (
    <div className="p-6 space-y-6">
      <WelcomeSection 
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
      />

      {needsGuidance ? (
        <SetupProgressCard 
          campaignsCount={campaigns.length}
          tasksCount={totalTasksCount}
          completedTasksCount={completedTasksCount}
        />
      ) : (
        <NextStepBanner 
          campaignsCount={campaigns.length}
          tasksCount={totalTasksCount}
          completedTasksCount={completedTasksCount}
          onCampaignCreated={handleCampaignCreatedWrapper}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuickActionsGrid onCampaignCreated={handleCampaignCreatedWrapper} />
          
          {activeCampaign && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Campaign</h2>
              <CampaignCard 
                campaign={activeCampaign} 
                onTaskUpdate={handleTaskUpdate}
                onCampaignUpdate={refetch}
              />
            </div>
          )}

          {newCampaigns.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">New Campaigns</h2>
              <div className="space-y-4">
                {newCampaigns.map((campaign) => (
                  <NewCampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onTaskUpdate={handleTaskUpdate}
                    onCampaignUpdate={refetch}
                  />
                ))}
              </div>
            </div>
          )}
          
          <WhatsComingNextCard onTaskUpdate={handleTaskUpdate} />
        </div>
        
        <div className="space-y-6">
          <ReviewQueue 
            onTaskUpdate={handleTaskUpdate}
            onTaskClick={onTaskClick}
          />
          <ReadyToPostCard tasks={tasks} />
          <AnalyticsSnapshot 
            totalTasks={totalTasksCount}
            completedTasks={completedTasksCount}
            pendingTasks={pendingTasksCount}
            activeCampaigns={campaigns.filter(c => {
              const campaignStart = new Date(c.start_date);
              const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000);
              const now = new Date();
              return now >= campaignStart && now <= campaignEnd;
            }).length}
          />
        </div>
      </div>
    </div>
  );
};
