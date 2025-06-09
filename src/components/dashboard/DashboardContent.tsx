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
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SampleCampaignCard } from "./SampleCampaignCard";
import { useAuth } from "@/contexts/AuthContext";

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
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const { user } = useAuth();
  
  const {
    campaigns,
    tasks,
    loading,
    error,
    isOffline,
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

  const handleGetStarted = () => {
    setShowNewCampaignDialog(true);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading your marketing hub..." />
      </div>
    );
  }

  // Show error state with retry option
  if (error && !isOffline) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full border-destructive/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Dashboard Error</h2>
            <p className="text-destructive/80 mb-6">
              We encountered an issue loading your dashboard. This might be a temporary problem.
            </p>
            <Button 
              onClick={() => refetch()} 
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate current week and find active campaign
  const currentWeekNumber = Math.ceil(
    ((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );
  
  // Look for campaign matching current week number first
  const activeCampaign = campaigns.find(c => c.week_number === currentWeekNumber);

  // Find user-created campaigns - only campaigns created via Quick Actions
  // Filter by source field to only show campaigns created through Quick Actions
  const userCreatedCampaigns = campaigns.filter(campaign => {
    const isActive = campaign.id === activeCampaign?.id;
    
    // Don't include the active campaign
    if (isActive) return false;
    
    // Only include campaigns that were created via Quick Actions
    return campaign.source === 'quick_action';
  });

  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const pendingTasksCount = tasks.filter(task => task.status === 'draft' && task.ai_output).length;

  // Determine if user needs guidance
  const needsGuidance = campaigns.length === 0 || totalTasksCount === 0;
  const isNewUser = campaigns.length === 0;

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    handleCampaignCreatedWrapper();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <WelcomeSection 
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
        onGetStarted={isNewUser ? handleGetStarted : undefined}
      />

      {/* Show sample content for new users */}
      {isNewUser && (
        <SampleCampaignCard onCreateRealCampaign={handleGetStarted} />
      )}

      {/* Progress/Guidance Banner */}
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

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Campaign - Now moved above Quick Actions */}
          {activeCampaign ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Current Campaign (Week {currentWeekNumber})
              </h2>
              <CampaignCard 
                campaign={activeCampaign} 
                onTaskUpdate={handleTaskUpdate}
                onCampaignUpdate={refetch}
              />
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Current Campaign (Week {currentWeekNumber})
              </h2>
              <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Campaign for Week {currentWeekNumber}</h3>
                      <p className="text-sm">
                        Create a campaign for the current week to start generating content.
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowNewCampaignDialog(true)}
                      className="bg-primary hover:bg-primary-600 text-white"
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Create Campaign for Week {currentWeekNumber}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions - Now below Current Campaign */}
          <QuickActionsGrid onCampaignCreated={handleCampaignCreatedWrapper} />

          {/* Custom Campaigns - Only shows campaigns created via Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Custom Campaigns</h2>
            {userCreatedCampaigns.length > 0 ? (
              <div className="space-y-4">
                {userCreatedCampaigns.map((campaign) => (
                  <NewCampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onTaskUpdate={handleTaskUpdate}
                    onCampaignUpdate={refetch}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="text-gray-500">
                      <PlusCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Custom Campaigns Yet</h3>
                      <p className="text-sm">
                        Use the Quick Actions above to create custom campaigns for events or special promotions. They will appear here once created.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* What's Coming Next */}
          <WhatsComingNextCard onTaskUpdate={handleTaskUpdate} />
        </div>
        
        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Review Queue */}
          <ReviewQueue 
            onTaskUpdate={handleTaskUpdate}
            onTaskClick={onTaskClick}
          />
          
          {/* Ready to Post */}
          <ReadyToPostCard tasks={tasks} />
          
          {/* Analytics Snapshot */}
          <AnalyticsSnapshot 
            totalTasks={totalTasksCount}
            completedTasks={completedTasksCount}
            pendingTasks={pendingTasksCount}
            activeCampaigns={activeCampaign ? 1 : 0}
          />
        </div>
      </div>

      {/* New Campaign Dialog */}
      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />
    </div>
  );
};
