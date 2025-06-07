
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
  return (
    <SidebarProvider>
      <AppSidebar 
        currentView={currentView}
        onViewChange={onViewChange}
      />
      <SidebarInset className="flex flex-col min-h-screen">
        <DashboardHeader 
          onboardingData={onboardingData}
          onBusinessNameChange={onBusinessNameChange}
          onCampaignCreated={onCampaignCreated}
          isLoading={isLoading}
        />
        <main className="flex-1 bg-garden-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
