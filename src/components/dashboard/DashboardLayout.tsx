
import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: "home" | "kanban" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
  isLoading?: boolean;
}

export const DashboardLayout = ({
  children,
  currentView,
  onViewChange,
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated,
  isLoading = false
}: DashboardLayoutProps) => {
  const validCurrentView = currentView as "home" | "kanban" | "calendar" | "team" | "profile";

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar 
          currentView={validCurrentView}
          onViewChange={onViewChange}
          onboardingData={onboardingData}
          onBusinessNameChange={onBusinessNameChange}
        />
        <SidebarInset className="flex flex-col flex-1">
          <DashboardHeader 
            currentView={validCurrentView}
            onCampaignCreated={onCampaignCreated}
          />
          <main className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
