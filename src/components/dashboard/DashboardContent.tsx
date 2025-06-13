
import { useState, useEffect } from "react";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { DashboardError } from "./DashboardError";
import { useDashboardData } from "./useDashboardData";
import { ContentSidebar } from "@/components/ContentSidebar";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
  onCampaignCreated?: () => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
}: DashboardContentProps) => {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    activeCampaign,
    userCreatedCampaigns,
    tasks,
    currentWeekNumber,
    completedTasksCount,
    totalTasksCount,
    pendingTasksCount,
    loading,
    error,
    refetch
  } = useDashboardData();

  const handleTaskClick = (task: any) => {
    console.log('DashboardContent: Task clicked:', task);
    setSelectedTask(task);
    setIsSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    console.log('DashboardContent: Closing sidebar');
    setIsSidebarOpen(false);
    setSelectedTask(null);
  };

  const handleTaskUpdate = () => {
    refetch();
  };

  const handleCampaignCreatedInternal = () => {
    refetch();
    onCampaignCreated?.();
  };

  const handleCreateCampaign = () => {
    // This could trigger a modal or navigate to campaign creation
    console.log('Create campaign clicked');
  };

  const handleFirstTimeGetStarted = () => {
    // Scroll to the content section or open the first task
    if (tasks.length > 0) {
      const firstTask = tasks[0];
      handleTaskClick(firstTask);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <DashboardError onRetry={refetch} />;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        {/* First Time User Welcome - Shows amazing first impression */}
        <FirstTimeUserWelcome 
          onGetStarted={handleFirstTimeGetStarted}
          tasksCount={totalTasksCount}
        />
        
        <DashboardGrid
          activeCampaign={activeCampaign}
          userCreatedCampaigns={userCreatedCampaigns}
          tasks={tasks}
          currentWeekNumber={currentWeekNumber}
          completedTasksCount={completedTasksCount}
          totalTasksCount={totalTasksCount}
          pendingTasksCount={pendingTasksCount}
          onTaskUpdate={handleTaskUpdate}
          onCampaignCreated={handleCampaignCreatedInternal}
          onCampaignUpdate={refetch}
          onCreateCampaign={handleCreateCampaign}
          onTaskClick={handleTaskClick}
        />
      </div>

      <ContentSidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
        task={selectedTask}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  );
};
