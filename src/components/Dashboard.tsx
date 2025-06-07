
import { useState } from "react";
import { DashboardTabs } from "./dashboard/DashboardTabs";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardContent } from "./dashboard/DashboardContent";
import { DashboardSkeleton } from "./dashboard/DashboardSkeleton";
import { ContentSidebar } from "@/components/ContentSidebar";
import { useDashboardData } from "./dashboard/useDashboardData";
import { ErrorBoundary } from "./ErrorBoundary";
import { NetworkErrorBoundary } from "./NetworkErrorBoundary";
import { OfflineBanner } from "./ui/offline-banner";
import { LoadingSpinner } from "./ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingData, ContentTask } from "@/types";

interface DashboardProps {
  onboardingData: OnboardingData;
}

export const Dashboard = ({ onboardingData }: DashboardProps) => {
  const [currentView, setCurrentView] = useState<"home" | "kanban" | "calendar" | "team" | "profile">("home");
  const [selectedTask, setSelectedTask] = useState<ContentTask | null>(null);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [localOnboardingData, setLocalOnboardingData] = useState(onboardingData);

  const { campaigns, tasks, loading, error, isOffline, handleTaskUpdate, handleCampaignCreated, refetch } = useDashboardData();

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

  const handleTaskClick = (task: ContentTask) => {
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
      if (!isOffline) {
        toast.success('Dashboard refreshed with latest data!');
      }
    } catch (error) {
      console.error('Dashboard: Error handling campaign creation:', error);
      toast.error('Failed to refresh dashboard data');
    }
  };

  if (loading) {
    return (
      <NetworkErrorBoundary>
        <div className="min-h-screen bg-background">
          <OfflineBanner />
          <DashboardTabs>
            <DashboardLayout
              currentView={currentView}
              onViewChange={setCurrentView}
              onboardingData={localOnboardingData}
              onBusinessNameChange={handleBusinessNameChange}
              onCampaignCreated={handleCampaignCreatedWrapper}
              isLoading={true}
            >
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" text="Loading your dashboard..." />
              </div>
            </DashboardLayout>
          </DashboardTabs>
        </div>
      </NetworkErrorBoundary>
    );
  }

  if (error && !isOffline) {
    return (
      <NetworkErrorBoundary>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <OfflineBanner />
          <Card className="max-w-md w-full border-destructive/20">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold text-destructive mb-2">Dashboard Error</h2>
              <p className="text-destructive/80 mb-6">
                We encountered an issue loading your dashboard. This might be a temporary problem.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    refetch();
                  }} 
                  className="w-full"
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
      </NetworkErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <NetworkErrorBoundary>
        <div className="min-h-screen bg-background">
          <OfflineBanner />
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
        </div>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  );
};
