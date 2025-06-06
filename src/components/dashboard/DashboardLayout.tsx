
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardLayoutProps {
  currentView: "home" | "kanban" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "kanban" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
  children: React.ReactNode;
}

export const DashboardLayout = ({
  currentView,
  onViewChange,
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated,
  children
}: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-garden-background">
        <AppSidebar 
          currentView={currentView} 
          onViewChange={onViewChange}
          onboardingData={onboardingData}
          onBusinessNameChange={onBusinessNameChange}
        />
        
        <main className="flex-1">
          <DashboardHeader 
            currentView={currentView}
            onCampaignCreated={onCampaignCreated}
          />
          <div className={currentView !== "home" ? "p-6" : ""}>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
