
import { useDashboardData } from "./useDashboardData";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { TaskList } from "@/components/homepage/TaskList";
import { UpcomingContentCard } from "@/components/homepage/UpcomingContentCard";
import { AnalyticsSnapshot } from "@/components/homepage/AnalyticsSnapshot";
import { NextStepBanner } from "@/components/homepage/NextStepBanner";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { ReviewQueue } from "@/components/content/ReviewQueue";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold text-red-700 mb-2">Dashboard Error</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <Button 
                onClick={() => refetch()} 
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCampaign = campaigns.find(c => {
    const campaignStart = new Date(c.start_date);
    const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return now >= campaignStart && now <= campaignEnd;
  });

  const upcomingTasks = tasks
    .filter(task => task.status === 'draft')
    .slice(0, 5);

  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;

  return (
    <div className="p-6 space-y-6">
      <WelcomeSection 
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
      />

      <NextStepBanner 
        campaignsCount={campaigns.length}
        tasksCount={totalTasksCount}
        completedTasksCount={completedTasksCount}
        onCampaignCreated={handleCampaignCreatedWrapper}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuickActionsGrid onCampaignCreated={handleCampaignCreatedWrapper} />
          
          {activeCampaign && (
            <CampaignCard 
              campaign={activeCampaign} 
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          
          <TaskList 
            tasks={upcomingTasks}
            onTaskUpdate={handleTaskUpdate}
          />
        </div>
        
        <div className="space-y-6">
          <ReviewQueue 
            onTaskUpdate={handleTaskUpdate}
          />
          <ReadyToPostCard tasks={tasks} />
          <AnalyticsSnapshot 
            totalTasks={totalTasksCount}
            completedTasks={completedTasksCount}
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
