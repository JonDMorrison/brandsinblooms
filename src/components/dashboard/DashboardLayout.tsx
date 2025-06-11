
import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: "home" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
  onCampaignCreated?: () => void;
}

export const DashboardLayout = ({
  children,
  currentView,
  onViewChange,
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
}: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-garden-background">
        <AppSidebar
          currentView={currentView}
          onViewChange={onViewChange}
          onboardingData={onboardingData}
          onBusinessNameChange={onBusinessNameChange}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};
