
import { useState } from "react";
import { DashboardTabs } from "./dashboard/DashboardTabs";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardContent } from "./dashboard/DashboardContent";
import { ContentSidebar } from "@/components/ContentSidebar";
import { useDashboardData } from "./dashboard/useDashboardData";

interface DashboardProps {
  onboardingData: any;
}

export const Dashboard = ({ onboardingData }: DashboardProps) => {
  const [currentView, setCurrentView] = useState<"home" | "kanban" | "calendar" | "team" | "profile">("home");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [localOnboardingData, setLocalOnboardingData] = useState(onboardingData);

  const { campaigns, tasks, loading, handleTaskUpdate, handleCampaignCreated } = useDashboardData();

  const handleBusinessNameChange = (newName: string) => {
    // Update the local onboarding data with the new business name
    const updatedData = {
      ...localOnboardingData,
      aboutBusiness: `${newName} has been serving the community with quality gardening products and expert advice.`
    };
    setLocalOnboardingData(updatedData);
    
    // Also update localStorage if user is authenticated
    const userId = localStorage.getItem('userId');
    if (userId) {
      localStorage.setItem(`garden-center-onboarding-${userId}`, JSON.stringify(updatedData));
    }
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsContentModalOpen(true);
  };

  const handleCloseContentModal = () => {
    setIsContentModalOpen(false);
    setSelectedTask(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading your marketing hub...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardTabs>
      <DashboardLayout
        currentView={currentView}
        onViewChange={setCurrentView}
        onboardingData={localOnboardingData}
        onBusinessNameChange={handleBusinessNameChange}
        onCampaignCreated={handleCampaignCreated}
      >
        <DashboardContent
          onboardingData={localOnboardingData}
          onBusinessNameChange={handleBusinessNameChange}
          onCampaignCreated={handleCampaignCreated}
        />
      </DashboardLayout>

      <ContentSidebar 
        task={selectedTask} 
        isOpen={isContentModalOpen}
        onClose={handleCloseContentModal}
        onTaskUpdate={handleTaskUpdate}
      />
    </DashboardTabs>
  );
};
