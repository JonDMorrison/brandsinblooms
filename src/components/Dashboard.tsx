
import { useState } from "react";
import { DashboardTabs } from "./dashboard/DashboardTabs";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardContent } from "./dashboard/DashboardContent";
import { DashboardSkeleton } from "./dashboard/DashboardSkeleton";
import { ContentSidebar } from "@/components/ContentSidebar";
import { useDashboardData } from "./dashboard/useDashboardData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DashboardProps {
  onboardingData: any;
}

export const Dashboard = ({ onboardingData }: DashboardProps) => {
  const [currentView, setCurrentView] = useState<"home" | "kanban" | "calendar" | "team" | "profile">("home");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [localOnboardingData, setLocalOnboardingData] = useState(onboardingData);

  const { campaigns, tasks, loading, error, handleTaskUpdate, handleCampaignCreated, refetch } = useDashboardData();

  const handleBusinessNameChange = (newName: string) => {
    const updatedData = {
      ...localOnboardingData,
      aboutBusiness: `${newName} has been serving the community with quality gardening products and expert advice.`
    };
    setLocalOnboardingData(updatedData);
    
    const userId = localStorage.getItem('userId');
    if (userId) {
      localStorage.setItem(`garden-center-onboarding-${userId}`, JSON.stringify(updatedData));
    }
    toast.success('Business name updated successfully!');
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsContentModalOpen(true);
  };

  const handleCloseContentModal = () => {
    setIsContentModalOpen(false);
    setSelectedTask(null);
  };

  const handleCampaignCreatedWrapper = async () => {
    try {
      await handleCampaignCreated();
      toast.success('Dashboard refreshed with latest data!');
    } catch (error) {
      console.error('Dashboard: Error handling campaign creation:', error);
      toast.error('Failed to refresh dashboard data');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background">
        <DashboardTabs>
          <DashboardLayout
            currentView={currentView}
            onViewChange={setCurrentView}
            onboardingData={localOnboardingData}
            onBusinessNameChange={handleBusinessNameChange}
            onCampaignCreated={handleCampaignCreatedWrapper}
            isLoading={true}
          >
            <DashboardSkeleton />
          </DashboardLayout>
        </DashboardTabs>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-red-700 mb-2">Dashboard Error</h2>
            <p className="text-red-600 mb-6">
              We encountered an issue loading your dashboard. This might be a temporary problem.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  console.log('Dashboard: Retrying data load');
                  refetch();
                }} 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
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
        onCampaignCreated={handleCampaignCreatedWrapper}
      >
        <DashboardContent
          onboardingData={localOnboardingData}
          onBusinessNameChange={handleBusinessNameChange}
          onCampaignCreated={handleCampaignCreatedWrapper}
          onTaskClick={handleTaskClick}
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
