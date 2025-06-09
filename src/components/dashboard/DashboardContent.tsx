
import { useState } from "react";
import { useDashboardData } from "./useDashboardData";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { NextStepBanner } from "@/components/homepage/NextStepBanner";
import { SetupProgressCard } from "@/components/homepage/SetupProgressCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SampleCampaignCard } from "./SampleCampaignCard";
import { DashboardError } from "./DashboardError";
import { DashboardGrid } from "./DashboardGrid";
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
    return <DashboardError onRetry={refetch} />;
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
      <DashboardGrid
        activeCampaign={activeCampaign}
        userCreatedCampaigns={userCreatedCampaigns}
        tasks={tasks}
        currentWeekNumber={currentWeekNumber}
        completedTasksCount={completedTasksCount}
        totalTasksCount={totalTasksCount}
        pendingTasksCount={pendingTasksCount}
        onTaskUpdate={handleTaskUpdate}
        onCampaignCreated={handleCampaignCreatedWrapper}
        onCampaignUpdate={refetch}
        onCreateCampaign={() => setShowNewCampaignDialog(true)}
        onTaskClick={onTaskClick}
      />

      {/* New Campaign Dialog */}
      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />
    </div>
  );
};
