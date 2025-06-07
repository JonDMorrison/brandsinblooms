
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
        currentView={currentView as "home" | "kanban" | "calendar" | "team" | "profile"}
        onViewChange={onViewChange}
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
      />
      <SidebarInset className="flex flex-col min-h-screen">
        <DashboardHeader 
          currentView={currentView as "home" | "kanban" | "calendar" | "team" | "profile"}
          onCampaignCreated={onCampaignCreated}
        />
        <main className="flex-1 bg-garden-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
